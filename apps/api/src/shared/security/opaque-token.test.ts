import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  process.env.MONGODB_URI = 'mongodb://localhost:27017/campusconnect-test';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.CLIENT_ORIGIN = 'http://localhost:5173';
  process.env.JWT_ACCESS_SECRET = 'a-very-long-test-secret-that-is-not-for-production';
  process.env.REFRESH_TOKEN_PEPPER = 'another-long-test-pepper-that-is-not-for-production';
  process.env.EVENT_TICKET_SECRET = 'event-ticket-test-secret-that-is-not-for-production';
  process.env.DEFAULT_TENANT_SLUG = 'test-campus';
});

describe('opaque tokens', () => {
  it('matches only the original opaque token', async () => {
    const { createOpaqueToken, hashOpaqueToken, opaqueTokensMatch } = await import('./opaque-token');
    const token = createOpaqueToken();
    const hash = hashOpaqueToken(token);

    expect(opaqueTokensMatch(token, hash)).toBe(true);
    expect(opaqueTokensMatch(createOpaqueToken(), hash)).toBe(false);
  });
});
