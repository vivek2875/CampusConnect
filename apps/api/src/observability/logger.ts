import pino from 'pino';

import { env } from '../config/env';

export const logger = pino({
  level: env.LOG_LEVEL,
  ...(env.NODE_ENV === 'production'
    ? {
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie', 'password', 'token'],
          censor: '[REDACTED]',
        },
      }
    : {}),
});
