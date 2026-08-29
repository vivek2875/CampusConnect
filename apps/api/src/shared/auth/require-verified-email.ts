import type { RequestHandler } from 'express';

import { AppError } from '../errors/app-error';

/**
 * Requires a server-confirmed email-verification state. This middleware must
 * run after requireAuth so the state originates from the authorization cache,
 * never from a client-controlled request value.
 */
export const requireVerifiedEmail: RequestHandler = (request, _response, next) => {
  if (!request.auth?.emailVerified) {
    return next(
      new AppError({
        statusCode: 403,
        code: 'EMAIL_VERIFICATION_REQUIRED',
        message: 'Verify your email address before publishing campus content.',
      }),
    );
  }

  next();
};
