import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { requireVerifiedEmail } from './require-verified-email';

describe('requireVerifiedEmail', () => {
  it('blocks an authenticated but unverified user', () => {
    const request = { auth: { emailVerified: false } } as unknown as Request;
    const next = vi.fn();

    requireVerifiedEmail(request, {} as never, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, code: 'EMAIL_VERIFICATION_REQUIRED' }));
  });

  it('allows a server-confirmed verified user', () => {
    const request = { auth: { emailVerified: true } } as unknown as Request;
    const next = vi.fn();

    requireVerifiedEmail(request, {} as never, next);

    expect(next).toHaveBeenCalledWith();
  });
});
