import { userRepository } from '../../modules/users/infrastructure/user.repository';
import { logger } from '../../observability/logger';
import { redis } from '../cache/redis';

const AUTH_STATE_TTL_SECONDS = 300;

interface CachedAuthState {
  tenantId: string;
  status: string;
  authVersion: number;
  emailVerified: boolean;
}

export async function getAuthorizationState(userId: string): Promise<CachedAuthState | null> {
  const cacheKey = getCacheKey(userId);
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return parseCachedState(cached);
  } catch (error) {
    logger.warn({ err: error }, 'Authorization cache read failed; falling back to MongoDB');
  }

  const state = await userRepository.findAuthorizationState(userId);
  if (!state) return null;

  const normalizedState: CachedAuthState = {
    tenantId: state.tenantId.toString(),
    status: state.status,
    authVersion: state.authVersion,
    emailVerified: state.emailVerified,
  };

  try {
    await redis.set(cacheKey, JSON.stringify(normalizedState), 'EX', AUTH_STATE_TTL_SECONDS);
  } catch (error) {
    logger.warn({ err: error }, 'Authorization cache write failed');
  }

  return normalizedState;
}

export async function invalidateAuthorizationState(userId: string): Promise<void> {
  try {
    await redis.del(getCacheKey(userId));
  } catch (error) {
    logger.warn({ err: error }, 'Authorization cache invalidation failed');
  }
}

function getCacheKey(userId: string): string {
  return `campusconnect:auth-state:${userId}`;
}

function parseCachedState(value: string): CachedAuthState | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'tenantId' in parsed &&
      'status' in parsed &&
      'authVersion' in parsed &&
      'emailVerified' in parsed &&
      typeof parsed.tenantId === 'string' &&
      typeof parsed.status === 'string' &&
      typeof parsed.authVersion === 'number' &&
      typeof parsed.emailVerified === 'boolean'
    ) {
      return parsed as CachedAuthState;
    }
  } catch {
    // Treat a malformed cache value as a cache miss.
  }
  return null;
}
