import type { RequestHandler } from 'express';

import { AppError } from '../errors/app-error';
import { verifyAccessToken } from '../security/jwt';
import { getAuthorizationState } from './auth-state-cache';

export const requireAuth: RequestHandler = (request, _response, next) => {
  const authorization = request.header('authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return next(new AppError({ statusCode: 401, code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.' }));
  }

  const accessToken = authorization.slice(7);
  void authorizeRequest(accessToken).catch(next);

  async function authorizeRequest(token: string): Promise<void> {
    const claims = verifyAccessToken(token);
    const state = await getAuthorizationState(claims.userId);

    if (!state || state.status !== 'active' || state.tenantId !== claims.tenantId || state.authVersion !== claims.authVersion) {
      throw new AppError({ statusCode: 401, code: 'SESSION_REVOKED', message: 'Your session is no longer active.' });
    }

    request.auth = { ...claims, emailVerified: state.emailVerified };
    next();
  }
};
