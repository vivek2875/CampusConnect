import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { env } from '../../config/env';

export function createOpaqueToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(`${env.REFRESH_TOKEN_PEPPER}:${token}`).digest('hex');
}

export function opaqueTokensMatch(token: string, expectedHash: string): boolean {
  const receivedHash = hashOpaqueToken(token);
  return timingSafeEqual(Buffer.from(receivedHash, 'hex'), Buffer.from(expectedHash, 'hex'));
}
