import { Router } from 'express';

import { requireAuth } from '../../../shared/auth/require-auth';
import { AppError } from '../../../shared/errors/app-error';
import { asyncHandler } from '../../../shared/http/async-handler';
import { emptyRequestSchema } from '../../../shared/http/empty-request-schema';
import { authenticationRateLimit } from '../../../shared/http/rate-limit';
import { validate } from '../../../shared/http/validate';
import { requireCsrf, issueCsrfToken } from '../../../shared/security/csrf';
import { clearRefreshCookie, REFRESH_COOKIE_NAME, setRefreshCookie } from '../../../shared/security/cookies';
import { authService } from '../application/auth.service';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  sessionIdSchema,
  sessionListSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from '../application/auth.validation';

export const authRouter = Router();

authRouter.get('/csrf', issueCsrfToken);

authRouter.post(
  '/register',
  authenticationRateLimit,
  requireCsrf,
  validate(registerSchema),
  asyncHandler(async (request, response) => {
    const result = await authService.register({ ...request.body, userAgent: request.header('user-agent'), ip: request.ip });
    setRefreshCookie(response, result.refreshToken);
    response.status(201).json({ data: toAuthenticationResponse(result) });
  }),
);

authRouter.post(
  '/login',
  authenticationRateLimit,
  requireCsrf,
  validate(loginSchema),
  asyncHandler(async (request, response) => {
    const result = await authService.login({ ...request.body, userAgent: request.header('user-agent'), ip: request.ip });
    setRefreshCookie(response, result.refreshToken);
    response.status(200).json({ data: toAuthenticationResponse(result) });
  }),
);

authRouter.post(
  '/refresh',
  authenticationRateLimit,
  requireCsrf,
  validate(emptyRequestSchema),
  asyncHandler(async (request, response) => {
    const result = await authService.refresh(request.cookies?.[REFRESH_COOKIE_NAME], {
      userAgent: request.header('user-agent'),
      ip: request.ip,
    });
    setRefreshCookie(response, result.refreshToken);
    response.status(200).json({ data: toAuthenticationResponse(result) });
  }),
);

authRouter.post(
  '/logout',
  requireCsrf,
  validate(emptyRequestSchema),
  asyncHandler(async (request, response) => {
    await authService.logout(request.cookies?.[REFRESH_COOKIE_NAME], request.ip);
    clearRefreshCookie(response);
    response.status(204).send();
  }),
);

authRouter.post(
  '/verify-email',
  authenticationRateLimit,
  validate(verifyEmailSchema),
  asyncHandler(async (request, response) => {
    await authService.verifyEmail(request.body.token);
    response.status(200).json({ data: { verified: true } });
  }),
);

authRouter.post(
  '/resend-verification',
  requireAuth,
  requireCsrf,
  validate(emptyRequestSchema),
  asyncHandler(async (request, response) => {
    const deliveryMode = await authService.resendVerification(getAuth(request).userId);
    response.status(202).json({ data: { deliveryMode } });
  }),
);

authRouter.post(
  '/forgot-password',
  authenticationRateLimit,
  validate(forgotPasswordSchema),
  asyncHandler(async (request, response) => {
    await authService.requestPasswordReset(request.body);
    response.status(202).json({ data: { accepted: true } });
  }),
);

authRouter.post(
  '/reset-password',
  authenticationRateLimit,
  validate(resetPasswordSchema),
  asyncHandler(async (request, response) => {
    await authService.resetPassword(request.body.token, request.body.password);
    clearRefreshCookie(response);
    response.status(200).json({ data: { reset: true } });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    response.status(200).json({ data: await authService.getProfile(auth.userId, auth.tenantId) });
  }),
);

authRouter.patch(
  '/me',
  requireAuth,
  requireCsrf,
  validate(updateProfileSchema),
  asyncHandler(async (request, response) => {
    response.status(200).json({ data: await authService.updateProfile(getAuth(request).userId, request.body) });
  }),
);

authRouter.get(
  '/sessions',
  requireAuth,
  validate(sessionListSchema),
  asyncHandler(async (request, response) => {
    const limit = Number(request.query.limit);
    const cursor = typeof request.query.cursor === 'string' ? request.query.cursor : undefined;
    const result = await authService.listSessions({ userId: getAuth(request).userId, limit, ...(cursor ? { cursor } : {}) });
    response.status(200).json({ data: result.sessions, meta: { limit, nextCursor: result.nextCursor ?? null } });
  }),
);

authRouter.delete(
  '/sessions/:sessionId',
  requireAuth,
  requireCsrf,
  validate(sessionIdSchema),
  asyncHandler(async (request, response) => {
    await authService.revokeSession(getAuth(request).userId, String(request.params.sessionId), request.ip);
    response.status(204).send();
  }),
);

function getAuth(request: Parameters<typeof requireAuth>[0]) {
  if (!request.auth) {
    throw new AppError({ statusCode: 401, code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.' });
  }
  return request.auth;
}

function toAuthenticationResponse(result: Awaited<ReturnType<typeof authService.login>>) {
  return { accessToken: result.accessToken, user: result.user, session: result.session };
}
