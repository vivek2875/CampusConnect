import type { Response } from 'express';
import { beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  process.env.MONGODB_URI = 'mongodb://localhost:27017/campusconnect-test';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.CLIENT_ORIGIN = 'http://localhost:5173';
  process.env.JWT_ACCESS_SECRET = 'a-very-long-test-secret-that-is-not-for-production';
  process.env.REFRESH_TOKEN_PEPPER = 'another-long-test-pepper-that-is-not-for-production';
  process.env.EVENT_TICKET_SECRET = 'event-ticket-test-secret-that-is-not-for-production';
  process.env.DEFAULT_TENANT_SLUG = 'test-campus';
});

describe('cookie scopes', () => {
  it('sends the CSRF cookie to every versioned API mutation route', async () => {
    const { CSRF_COOKIE_NAME, setCsrfCookie } = await import('./cookies');
    const response = { cookie: vi.fn() } as unknown as Response;

    setCsrfCookie(response, 'csrf-token');

    expect(response.cookie).toHaveBeenCalledWith(
      CSRF_COOKIE_NAME,
      'csrf-token',
      expect.objectContaining({ path: '/api/v1', httpOnly: false, sameSite: 'strict' }),
    );
  });

  it('keeps the refresh-token cookie scoped to authentication endpoints', async () => {
    const { REFRESH_COOKIE_NAME, setRefreshCookie } = await import('./cookies');
    const response = { cookie: vi.fn() } as unknown as Response;

    setRefreshCookie(response, 'refresh-token');

    expect(response.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'refresh-token',
      expect.objectContaining({ path: '/api/v1/auth', httpOnly: true, sameSite: 'strict' }),
    );
  });
});
