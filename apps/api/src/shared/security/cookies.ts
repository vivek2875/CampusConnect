import type { CookieOptions, Response } from 'express';

import { env } from '../../config/env';

export const REFRESH_COOKIE_NAME = 'cc_refresh';
export const CSRF_COOKIE_NAME = 'cc_csrf';

const baseCookieOptions: CookieOptions = {
  sameSite: 'strict',
  secure: env.COOKIE_SECURE,
  path: '/api/v1/auth',
};

export function setRefreshCookie(response: Response, value: string): void {
  response.cookie(REFRESH_COOKIE_NAME, value, {
    ...baseCookieOptions,
    httpOnly: true,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1_000,
  });
}

export function clearRefreshCookie(response: Response): void {
  response.clearCookie(REFRESH_COOKIE_NAME, { ...baseCookieOptions, httpOnly: true });
}

export function setCsrfCookie(response: Response, value: string): void {
  response.cookie(CSRF_COOKIE_NAME, value, {
    ...baseCookieOptions,
    httpOnly: false,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1_000,
  });
}
