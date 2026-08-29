import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';

import { redis } from '../cache/redis';

const redisCommand = (...arguments_: string[]): Promise<number> =>
  (redis as unknown as { call: (...commands: string[]) => Promise<number> }).call(...arguments_);

export const authenticationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'AUTH_RATE_LIMITED',
      message: 'Too many authentication attempts. Please try again later.',
    },
  },
  store: new RedisStore({
    prefix: 'campusconnect:rate-limit:auth:',
    sendCommand: redisCommand,
  }),
});

export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: 1_000,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'API_RATE_LIMITED',
      message: 'Too many requests. Please try again shortly.',
    },
  },
  store: new RedisStore({
    prefix: 'campusconnect:rate-limit:api:',
    sendCommand: redisCommand,
  }),
});

export const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'AI_RATE_LIMITED',
      message: 'Too many AI requests. Please try again shortly.',
    },
  },
  store: new RedisStore({
    prefix: 'campusconnect:rate-limit:ai:',
    sendCommand: redisCommand,
  }),
});
