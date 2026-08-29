import { Router } from 'express';
import { requireAuth } from '../../../shared/auth/require-auth';
import { requireVerifiedEmail } from '../../../shared/auth/require-verified-email';
import { AppError } from '../../../shared/errors/app-error';
import { asyncHandler } from '../../../shared/http/async-handler';
import { emptyRequestSchema } from '../../../shared/http/empty-request-schema';
import { validate } from '../../../shared/http/validate';
import { requireCsrf } from '../../../shared/security/csrf';
import { eventService } from '../application/event.service';
import { checkinSchema, createEventSchema, eventIdSchema, eventPageSchema } from '../application/event.validation';

export const eventRouter = Router();
eventRouter.get(
  '/events',
  requireAuth,
  validate(eventPageSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    const limit = Number(request.query.limit);
    const cursor = typeof request.query.cursor === 'string' ? request.query.cursor : undefined;
    const result = await eventService.list({ tenantId: auth.tenantId, userId: auth.userId, limit, ...(cursor ? { cursor } : {}) });
    response.set('Cache-Control', 'private, no-store');
    response.status(200).json({ data: result.events, meta: { limit, nextCursor: result.nextCursor ?? null } });
  }),
);
eventRouter.post(
  '/events',
  requireAuth,
  requireVerifiedEmail,
  requireCsrf,
  validate(createEventSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    response
      .status(201)
      .json({ data: await eventService.create({ ...request.body, tenantId: auth.tenantId, organizerId: auth.userId, role: auth.role }) });
  }),
);
eventRouter.post(
  '/events/:eventId/registrations',
  requireAuth,
  requireCsrf,
  validate(eventIdSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    response.status(201).json({
      data: await eventService.register({ tenantId: auth.tenantId, eventId: String(request.params.eventId), userId: auth.userId }),
    });
  }),
);
eventRouter.post(
  '/events/:eventId/check-in',
  requireAuth,
  requireCsrf,
  validate(checkinSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    response.status(200).json({
      data: await eventService.checkIn({
        tenantId: auth.tenantId,
        eventId: String(request.params.eventId),
        actorId: auth.userId,
        role: auth.role,
        ticket: request.body.ticket,
      }),
    });
  }),
);
function getAuth(request: Parameters<typeof requireAuth>[0]) {
  if (!request.auth) throw new AppError({ statusCode: 401, code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.' });
  return request.auth;
}
