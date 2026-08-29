import { Router } from 'express';
import { requireAuth } from '../../../shared/auth/require-auth';
import { AppError } from '../../../shared/errors/app-error';
import { asyncHandler } from '../../../shared/http/async-handler';
import { validate } from '../../../shared/http/validate';
import { requireCsrf } from '../../../shared/security/csrf';
import { z } from 'zod';
import { notificationService } from '../application/notification.service';

const notificationId = z.string().regex(/^[a-f\d]{24}$/i);
const pageSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z.object({ limit: z.coerce.number().int().min(1).max(50).default(20), cursor: z.string().min(1).max(200).optional() }).strict(),
});
const idSchema = z.object({ body: z.object({}).strict(), params: z.object({ notificationId }).strict(), query: z.object({}).strict() });
export const notificationRouter = Router();
notificationRouter.get(
  '/notifications',
  requireAuth,
  validate(pageSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    const limit = Number(request.query.limit);
    const cursor = typeof request.query.cursor === 'string' ? request.query.cursor : undefined;
    const result = await notificationService.list({
      tenantId: auth.tenantId,
      recipientId: auth.userId,
      limit,
      ...(cursor ? { cursor } : {}),
    });
    response.status(200).json({ data: result.notifications, meta: { limit, nextCursor: result.nextCursor ?? null } });
  }),
);
notificationRouter.patch(
  '/notifications/:notificationId/read',
  requireAuth,
  requireCsrf,
  validate(idSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    const notification = await notificationService.markRead({
      tenantId: auth.tenantId,
      recipientId: auth.userId,
      notificationId: String(request.params.notificationId),
    });
    if (!notification) throw new AppError({ statusCode: 404, code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found.' });
    response.status(200).json({ data: notification });
  }),
);
function getAuth(request: Parameters<typeof requireAuth>[0]) {
  if (!request.auth) throw new AppError({ statusCode: 401, code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.' });
  return request.auth;
}
