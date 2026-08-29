import { timingSafeEqual } from 'node:crypto';

import type { RequestHandler } from 'express';

import { AppError } from '../errors/app-error';
import { createOpaqueToken } from './opaque-token';
import { CSRF_COOKIE_NAME, setCsrfCookie } from './cookies';

export const issueCsrfToken: RequestHandler = (request, response) => {
  const csrfToken = request.cookies?.[CSRF_COOKIE_NAME] ?? createOpaqueToken();
  setCsrfCookie(response, csrfToken);
  response.set('Cache-Control', 'no-store');
  response.set('Pragma', 'no-cache');
  response.status(200).json({ data: { csrfToken } });
};

export const requireCsrf: RequestHandler = (request, _response, next) => {
  const cookieToken = request.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = request.header('x-csrf-token');

  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    return next(
      new AppError({
        statusCode: 403,
        code: 'CSRF_VALIDATION_FAILED',
        message: 'The request could not be verified.',
      }),
    );
  }

  return next();
};

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
