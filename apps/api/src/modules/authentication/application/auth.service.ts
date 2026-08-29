import { randomUUID } from 'node:crypto';

import { env } from '../../../config/env';
import { tenantRepository } from '../../tenants/infrastructure/tenant.repository';
import type { PublicUser } from '../../users/domain/user.types';
import { type UserDocument } from '../../users/infrastructure/user.model';
import { userRepository } from '../../users/infrastructure/user.repository';
import { recordAuditEvent } from '../../../shared/audit/audit.service';
import { invalidateAuthorizationState } from '../../../shared/auth/auth-state-cache';
import { type EmailDeliveryMode, sendEmail } from '../../../shared/communications/email.service';
import { AppError } from '../../../shared/errors/app-error';
import { hashOpaqueToken, createOpaqueToken, opaqueTokensMatch } from '../../../shared/security/opaque-token';
import { hashPassword, verifyPassword } from '../../../shared/security/password';
import { signAccessToken } from '../../../shared/security/jwt';
import type { AuthenticationResult } from '../domain/auth.types';
import { sessionRepository } from '../infrastructure/session.repository';

const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1_000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1_000;

export const authService = {
  async register(input: {
    tenantSlug: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    userAgent?: string;
    ip?: string;
  }): Promise<AuthenticationResult> {
    const tenant = await getRequiredActiveTenant(input.tenantSlug);
    ensurePermittedEmailDomain(input.email, tenant.allowedEmailDomains);

    const verificationToken = createOpaqueToken();
    const user = await userRepository.create({
      tenantId: tenant._id,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      emailVerificationTokenHash: hashOpaqueToken(verificationToken),
      emailVerificationExpiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
    });

    await sendVerificationEmail(user.email, verificationToken);
    recordAuditEvent({
      tenantId: tenant.id,
      actorId: user.id,
      action: 'AUTH_REGISTERED',
      targetType: 'User',
      targetId: user.id,
      ip: input.ip,
    });
    return createAuthenticationResult(user, input);
  },

  async login(input: {
    tenantSlug: string;
    email: string;
    password: string;
    userAgent?: string;
    ip?: string;
  }): Promise<AuthenticationResult> {
    const tenant = await getActiveTenant(input.tenantSlug, false);
    const user = tenant ? await userRepository.findForAuthentication(tenant.id, input.email) : null;

    if (!user || user.status !== 'active' || !(await verifyPassword(input.password, user.passwordHash))) {
      recordAuditEvent({
        tenantId: tenant?.id,
        action: 'AUTH_LOGIN_FAILED',
        targetType: 'User',
        ip: input.ip,
        metadata: { tenantSlug: input.tenantSlug },
      });
      throw invalidCredentialsError();
    }

    user.lastLoginAt = new Date();
    await user.save();
    recordAuditEvent({
      tenantId: user.tenantId.toString(),
      actorId: user.id,
      action: 'AUTH_LOGIN_SUCCEEDED',
      targetType: 'Session',
      ip: input.ip,
    });
    return createAuthenticationResult(user, input);
  },

  async refresh(rawRefreshToken: string | undefined, input: { userAgent?: string; ip?: string }): Promise<AuthenticationResult> {
    const parsedToken = parseRefreshToken(rawRefreshToken);
    const session = await sessionRepository.findByIdWithToken(parsedToken.sessionId);

    if (!session || session.revokedAt || session.expiresAt <= new Date() || !opaqueTokensMatch(parsedToken.secret, session.tokenHash)) {
      if (session && !session.revokedAt) {
        await sessionRepository.revokeAllForUser(session.userId.toString());
        recordAuditEvent({
          tenantId: session.tenantId.toString(),
          actorId: session.userId.toString(),
          action: 'AUTH_REFRESH_TOKEN_REUSE_DETECTED',
          targetType: 'Session',
          targetId: session.id,
          ip: input.ip,
        });
      }
      throw new AppError({ statusCode: 401, code: 'INVALID_REFRESH_TOKEN', message: 'Your session has expired. Please sign in again.' });
    }

    const user = await userRepository.findById(session.userId.toString());
    if (!user || user.status !== 'active') {
      await sessionRepository.revokeAllForUser(session.userId.toString());
      throw new AppError({ statusCode: 401, code: 'SESSION_REVOKED', message: 'Your session is no longer active.' });
    }

    const nextSecret = createOpaqueToken();
    const rotatedSession = await sessionRepository.rotateToken({
      sessionId: session.id,
      expectedTokenHash: session.tokenHash,
      tokenHash: hashOpaqueToken(nextSecret),
    });

    if (!rotatedSession) {
      await sessionRepository.revokeAllForUser(user.id);
      throw new AppError({ statusCode: 401, code: 'INVALID_REFRESH_TOKEN', message: 'Your session has expired. Please sign in again.' });
    }

    return {
      accessToken: createAccessToken(user, rotatedSession.id),
      refreshToken: `${rotatedSession.id}.${nextSecret}`,
      user: toPublicUser(user),
      session: { id: rotatedSession.id, expiresAt: rotatedSession.expiresAt },
    };
  },

  async logout(rawRefreshToken: string | undefined, ip?: string): Promise<void> {
    const parsedToken = tryParseRefreshToken(rawRefreshToken);
    if (!parsedToken) return;

    const session = await sessionRepository.findByIdWithToken(parsedToken.sessionId);
    if (session && !session.revokedAt && opaqueTokensMatch(parsedToken.secret, session.tokenHash)) {
      await sessionRepository.revoke(session.id);
      recordAuditEvent({
        tenantId: session.tenantId.toString(),
        actorId: session.userId.toString(),
        action: 'AUTH_LOGOUT',
        targetType: 'Session',
        targetId: session.id,
        ip,
      });
    }
  },

  async getProfile(userId: string, tenantId: string): Promise<PublicUser> {
    const user = await userRepository.findById(userId);
    if (!user || user.tenantId.toString() !== tenantId || user.status !== 'active') {
      throw new AppError({ statusCode: 401, code: 'SESSION_REVOKED', message: 'Your session is no longer active.' });
    }
    return toPublicUser(user);
  },

  async updateProfile(userId: string, input: { firstName: string; lastName: string }): Promise<PublicUser> {
    const user = await userRepository.updateProfile(userId, input);
    if (!user) throw new AppError({ statusCode: 404, code: 'USER_NOT_FOUND', message: 'User not found.' });
    return toPublicUser(user);
  },

  async listSessions(input: { userId: string; limit: number; cursor?: string }): Promise<{
    sessions: Array<{ id: string; createdAt: Date; lastUsedAt: Date; expiresAt: Date; userAgent?: string; ip?: string }>;
    nextCursor?: string;
  }> {
    const result = await sessionRepository.findActiveForUser({
      userId: input.userId,
      limit: input.limit,
      ...(input.cursor ? { cursor: decodeSessionCursor(input.cursor) } : {}),
    });
    return {
      sessions: result.sessions.map((session) => ({
        id: session.id,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
        expiresAt: session.expiresAt,
        ...(session.userAgent ? { userAgent: session.userAgent } : {}),
        ...(session.ip ? { ip: session.ip } : {}),
      })),
      ...(result.nextCursor ? { nextCursor: encodeSessionCursor(result.nextCursor) } : {}),
    };
  },

  async revokeSession(userId: string, sessionId: string, ip?: string): Promise<void> {
    const session = await sessionRepository.revokeForUser(sessionId, userId);
    if (!session) throw new AppError({ statusCode: 404, code: 'SESSION_NOT_FOUND', message: 'Session not found.' });
    recordAuditEvent({
      tenantId: session.tenantId.toString(),
      actorId: userId,
      action: 'AUTH_SESSION_REVOKED',
      targetType: 'Session',
      targetId: session.id,
      ip,
    });
  },

  async verifyEmail(token: string): Promise<void> {
    const user = await userRepository.findForEmailVerification(hashOpaqueToken(token));
    if (!user) {
      throw new AppError({ statusCode: 400, code: 'INVALID_VERIFICATION_TOKEN', message: 'This verification link is invalid or expired.' });
    }
    await userRepository.markEmailVerified(user.id);
    await invalidateAuthorizationState(user.id);
    recordAuditEvent({
      tenantId: user.tenantId.toString(),
      actorId: user.id,
      action: 'AUTH_EMAIL_VERIFIED',
      targetType: 'User',
      targetId: user.id,
    });
  },

  async resendVerification(userId: string): Promise<EmailDeliveryMode | 'not_needed'> {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError({ statusCode: 404, code: 'USER_NOT_FOUND', message: 'User not found.' });
    if (user.emailVerifiedAt) return 'not_needed';

    const verificationToken = createOpaqueToken();
    await userRepository.setEmailVerificationToken(user.id, hashOpaqueToken(verificationToken), new Date(Date.now() + EMAIL_TOKEN_TTL_MS));
    return sendVerificationEmail(user.email, verificationToken);
  },

  async requestPasswordReset(input: { tenantSlug: string; email: string }): Promise<void> {
    const tenant = await getActiveTenant(input.tenantSlug, false);
    const user = tenant ? await userRepository.findForAuthentication(tenant.id, input.email) : null;
    if (!user || user.status !== 'active') return;

    const resetToken = createOpaqueToken();
    await userRepository.setPasswordResetToken(user.id, hashOpaqueToken(resetToken), new Date(Date.now() + RESET_TOKEN_TTL_MS));
    await sendPasswordResetEmail(user.email, resetToken);
  },

  async resetPassword(token: string, password: string): Promise<void> {
    const user = await userRepository.findForPasswordReset(hashOpaqueToken(token));
    if (!user) {
      throw new AppError({ statusCode: 400, code: 'INVALID_RESET_TOKEN', message: 'This password reset link is invalid or expired.' });
    }

    await userRepository.resetPassword(user.id, await hashPassword(password));
    await sessionRepository.revokeAllForUser(user.id);
    await invalidateAuthorizationState(user.id);
    recordAuditEvent({
      tenantId: user.tenantId.toString(),
      actorId: user.id,
      action: 'AUTH_PASSWORD_RESET',
      targetType: 'User',
      targetId: user.id,
    });
  },
};

async function createAuthenticationResult(user: UserDocument, input: { userAgent?: string; ip?: string }): Promise<AuthenticationResult> {
  const secret = createOpaqueToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1_000);
  const session = await sessionRepository.create({
    tenantId: user.tenantId.toString(),
    userId: user.id,
    tokenHash: hashOpaqueToken(secret),
    familyId: randomUUID(),
    expiresAt,
    ...(input.userAgent ? { userAgent: input.userAgent.slice(0, 500) } : {}),
    ...(input.ip ? { ip: input.ip.slice(0, 64) } : {}),
  });

  return {
    accessToken: createAccessToken(user, session.id),
    refreshToken: `${session.id}.${secret}`,
    user: toPublicUser(user),
    session: { id: session.id, expiresAt },
  };
}

function createAccessToken(user: UserDocument, sessionId: string): string {
  return signAccessToken({
    userId: user.id,
    tenantId: user.tenantId.toString(),
    role: user.role,
    sessionId,
    authVersion: user.authVersion,
  });
}

function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: user.id,
    tenantId: user.tenantId.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerified: Boolean(user.emailVerifiedAt),
    createdAt: user.createdAt,
  };
}

async function getActiveTenant(slug: string, shouldThrow = true) {
  const tenant = await tenantRepository.findActiveBySlug(slug);
  if (!tenant && shouldThrow) {
    throw new AppError({ statusCode: 404, code: 'TENANT_NOT_FOUND', message: 'Campus not found or unavailable.' });
  }
  return tenant;
}

async function getRequiredActiveTenant(slug: string) {
  const tenant = await getActiveTenant(slug, true);
  if (!tenant) {
    throw new AppError({ statusCode: 404, code: 'TENANT_NOT_FOUND', message: 'Campus not found or unavailable.' });
  }
  return tenant;
}

function ensurePermittedEmailDomain(email: string, domains: string[]): void {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain || !domains.includes(domain)) {
    throw new AppError({ statusCode: 403, code: 'EMAIL_DOMAIN_NOT_ALLOWED', message: 'Use your institution email address.' });
  }
}

function parseRefreshToken(rawToken: string | undefined): { sessionId: string; secret: string } {
  const parsedToken = tryParseRefreshToken(rawToken);
  if (!parsedToken) {
    throw new AppError({ statusCode: 401, code: 'INVALID_REFRESH_TOKEN', message: 'Your session has expired. Please sign in again.' });
  }
  return parsedToken;
}

function tryParseRefreshToken(rawToken: string | undefined): { sessionId: string; secret: string } | null {
  if (!rawToken) return null;
  const [sessionId, secret, remainder] = rawToken.split('.');
  if (!sessionId || !secret || remainder || !/^[a-f\d]{24}$/i.test(sessionId) || !/^[A-Za-z0-9_-]{32,200}$/.test(secret)) {
    return null;
  }
  return { sessionId, secret };
}

function invalidCredentialsError(): AppError {
  return new AppError({ statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Email, password, or campus is incorrect.' });
}

function encodeSessionCursor(cursor: { lastUsedAt: Date; id: string }): string {
  return Buffer.from(JSON.stringify({ lastUsedAt: cursor.lastUsedAt.toISOString(), id: cursor.id })).toString('base64url');
}

function decodeSessionCursor(cursor: string): { lastUsedAt: Date; id: string } {
  try {
    const decoded: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      !('lastUsedAt' in decoded) ||
      !('id' in decoded) ||
      typeof decoded.lastUsedAt !== 'string' ||
      typeof decoded.id !== 'string' ||
      !/^[a-f\d]{24}$/i.test(decoded.id)
    ) {
      throw new Error('Invalid cursor');
    }

    const lastUsedAt = new Date(decoded.lastUsedAt);
    if (Number.isNaN(lastUsedAt.getTime())) throw new Error('Invalid cursor');
    return { lastUsedAt, id: decoded.id };
  } catch {
    throw new AppError({ statusCode: 400, code: 'INVALID_CURSOR', message: 'The pagination cursor is invalid.' });
  }
}

async function sendVerificationEmail(email: string, token: string): Promise<EmailDeliveryMode> {
  const url = `${env.CLIENT_ORIGIN}/verify-email?token=${encodeURIComponent(token)}`;
  return sendEmail({
    to: email,
    subject: 'Verify your CampusConnect email',
    text: `Welcome to CampusConnect. Verify your email within 24 hours: ${url}`,
  });
}

async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const url = `${env.CLIENT_ORIGIN}/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: email,
    subject: 'Reset your CampusConnect password',
    text: `Reset your password within one hour: ${url}`,
  });
}
