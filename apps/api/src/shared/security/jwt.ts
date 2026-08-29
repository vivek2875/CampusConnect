import jwt, { type SignOptions } from 'jsonwebtoken';

import type { AccessTokenClaims } from '../../modules/authentication/domain/auth.types';
import { userRoles, type UserRole } from '../../modules/users/domain/user.types';
import { env } from '../../config/env';
import { AppError } from '../errors/app-error';

export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(
    {
      tid: claims.tenantId,
      role: claims.role,
      sid: claims.sessionId,
      av: claims.authVersion,
      type: 'access',
    },
    env.JWT_ACCESS_SECRET,
    {
      subject: claims.userId,
      expiresIn: env.JWT_ACCESS_TTL as SignOptions['expiresIn'],
      issuer: 'campusconnect-api',
      audience: 'campusconnect-web',
    },
  );
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: 'campusconnect-api',
    audience: 'campusconnect-web',
  });

  if (
    typeof payload === 'string' ||
    payload.type !== 'access' ||
    typeof payload.sub !== 'string' ||
    typeof payload.tid !== 'string' ||
    typeof payload.sid !== 'string' ||
    typeof payload.av !== 'number' ||
    !isUserRole(payload.role)
  ) {
    throw new AppError({
      statusCode: 401,
      code: 'INVALID_ACCESS_TOKEN',
      message: 'Authentication is invalid.',
    });
  }

  return {
    userId: payload.sub,
    tenantId: payload.tid,
    role: payload.role,
    sessionId: payload.sid,
    authVersion: payload.av,
  };
}

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && userRoles.includes(value as UserRole);
}
