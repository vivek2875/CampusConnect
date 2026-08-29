import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../../../shared/auth/require-auth';
import { AppError } from '../../../shared/errors/app-error';
import { asyncHandler } from '../../../shared/http/async-handler';
import { validate } from '../../../shared/http/validate';
import { requireCsrf } from '../../../shared/security/csrf';
import { pushService } from '../application/push.service';

const endpoint = z.string().url().max(2_000);
const subscriptionSchema = z.object({
  body: z
    .object({
      endpoint,
      expirationTime: z.number().finite().nullable().optional(),
      keys: z.object({ p256dh: z.string().min(16).max(500), auth: z.string().min(8).max(500) }).strict(),
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});
const unsubscriptionSchema = z.object({
  body: z.object({ endpoint }).strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export const pushRouter = Router();

pushRouter.get('/notifications/push/config', requireAuth, (_request, response) => {
  response.set('Cache-Control', 'no-store');
  response.status(200).json({ data: pushService.getConfiguration() });
});
pushRouter.post(
  '/notifications/push/subscriptions',
  requireAuth,
  requireCsrf,
  validate(subscriptionSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    await pushService.subscribe({ tenantId: auth.tenantId, userId: auth.userId, ...request.body });
    response.status(204).send();
  }),
);
pushRouter.delete(
  '/notifications/push/subscriptions',
  requireAuth,
  requireCsrf,
  validate(unsubscriptionSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    await pushService.unsubscribe({ tenantId: auth.tenantId, userId: auth.userId, endpoint: request.body.endpoint });
    response.status(204).send();
  }),
);

function getAuth(request: Parameters<typeof requireAuth>[0]) {
  if (!request.auth) throw new AppError({ statusCode: 401, code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.' });
  return request.auth;
}
