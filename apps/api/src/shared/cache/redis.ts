import Redis from 'ioredis';

import { env } from '../../config/env';
import { logger } from '../../observability/logger';

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  enableReadyCheck: true,
  maxRetriesPerRequest: null,
  retryStrategy: (attempt) => Math.min(attempt * 100, 2_000),
});

redis.on('error', (error) => logger.error({ err: error }, 'Redis client error'));

export async function connectRedis(): Promise<void> {
  if (redis.status === 'wait') {
    await redis.connect();
  }

  await redis.ping();
  logger.info('Redis connected');
}

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
}
