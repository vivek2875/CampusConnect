import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import pinoHttp from 'pino-http';

import { env } from './config/env';
import { authRouter } from './modules/authentication/presentation/auth.router';
import { complaintRouter } from './modules/complaints/presentation/complaint.router';
import { lostFoundRouter } from './modules/lost-found/presentation/lost-found.router';
import { eventRouter } from './modules/events/presentation/event.router';
import { notificationRouter } from './modules/notifications/presentation/notification.router';
import { pushRouter } from './modules/notifications/presentation/push.router';
import { noticeRouter } from './modules/notices/presentation/notice.router';
import { chatRouter } from './modules/chat/presentation/chat.router';
import { aiRouter } from './modules/ai/presentation/ai.router';
import { adminRouter } from './modules/admin/presentation/admin.router';
import { marketplaceRouter } from './modules/marketplace/presentation/marketplace.router';
import { offerRouter } from './modules/marketplace/presentation/offer.router';
import { logger } from './observability/logger';
import { errorHandler } from './shared/http/error-handler';
import { notFoundHandler } from './shared/http/not-found';
import { requestContext } from './shared/http/request-context';
import { apiRateLimit } from './shared/http/rate-limit';
import { registerStaticClient } from './shared/http/static-client';
import { redis } from './shared/cache/redis';

export const app = express();

app.set('trust proxy', env.TRUST_PROXY_HOPS);
app.disable('x-powered-by');
app.use(requestContext);
app.use(pinoHttp({ logger, genReqId: (request) => request.id }));
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'https:', 'data:'],
        connectSrc: ["'self'", 'https://api.cloudinary.com', 'ws:', 'wss:'],
        fontSrc: ["'self'", 'data:'],
        formAction: ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origin === env.CLIENT_ORIGIN) return callback(null, true);
      return callback(new Error('Origin is not allowed by CORS.'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-CSRF-Token', 'X-Request-Id'],
    maxAge: 600,
  }),
);
app.use(express.json({ limit: '100kb', type: 'application/json' }));
app.use(cookieParser());
app.use('/api', apiRateLimit);

app.get('/health/live', (_request, response) => {
  response.status(200).json({ data: { status: 'ok' } });
});

app.get('/health/ready', (_request, response) => {
  const ready = mongoose.connection.readyState === 1 && redis.status === 'ready';
  response.status(ready ? 200 : 503).json({ data: { status: ready ? 'ready' : 'not_ready' } });
});

app.get('/health', (_request, response) => {
  response.status(200).json({ data: { status: 'ok' } });
});

app.use('/api/v1/auth', authRouter);
app.use('/api/v1', complaintRouter);
app.use('/api/v1/lost-found', lostFoundRouter);
app.use('/api/v1', eventRouter);
app.use('/api/v1', notificationRouter);
app.use('/api/v1', pushRouter);
app.use('/api/v1', noticeRouter);
app.use('/api/v1', chatRouter);
app.use('/api/v1', aiRouter);
app.use('/api/v1', adminRouter);
app.use('/api/v1/marketplace', marketplaceRouter);
app.use('/api/v1/marketplace', offerRouter);
registerStaticClient(app);
app.use(notFoundHandler);
app.use(errorHandler);
