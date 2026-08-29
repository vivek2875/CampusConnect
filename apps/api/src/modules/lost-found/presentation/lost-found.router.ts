import { Router } from 'express';

import { requireAuth } from '../../../shared/auth/require-auth';
import { AppError } from '../../../shared/errors/app-error';
import { asyncHandler } from '../../../shared/http/async-handler';
import { emptyRequestSchema } from '../../../shared/http/empty-request-schema';
import { validate } from '../../../shared/http/validate';
import { requireCsrf } from '../../../shared/security/csrf';
import type { LostFoundType } from '../domain/lost-found.types';
import { lostFoundService } from '../application/lost-found.service';
import { claimIdSchema, claimSchema, createItemSchema, itemIdSchema, pageSchema } from '../application/lost-found.validation';

export const lostFoundRouter = Router();
lostFoundRouter.post(
  '/uploads/signature',
  requireAuth,
  requireCsrf,
  validate(emptyRequestSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    response.status(200).json({ data: lostFoundService.getUploadSignature({ tenantId: auth.tenantId, userId: auth.userId }) });
  }),
);
lostFoundRouter.get(
  '/items',
  requireAuth,
  validate(pageSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    const limit = Number(request.query.limit);
    const cursor = typeof request.query.cursor === 'string' ? request.query.cursor : undefined;
    const type = typeof request.query.type === 'string' ? (request.query.type as LostFoundType) : undefined;
    const result = await lostFoundService.list({
      tenantId: auth.tenantId,
      actorId: auth.userId,
      role: auth.role,
      limit,
      ...(cursor ? { cursor } : {}),
      ...(type ? { type } : {}),
    });
    response.status(200).json({ data: result.items, meta: { limit, nextCursor: result.nextCursor ?? null } });
  }),
);
lostFoundRouter.post(
  '/items',
  requireAuth,
  requireCsrf,
  validate(createItemSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    response
      .status(201)
      .json({ data: await lostFoundService.create({ ...request.body, tenantId: auth.tenantId, reporterId: auth.userId, ip: request.ip }) });
  }),
);
lostFoundRouter.post(
  '/items/:itemId/claims',
  requireAuth,
  requireCsrf,
  validate(claimSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    await lostFoundService.claim({
      tenantId: auth.tenantId,
      itemId: String(request.params.itemId),
      claimantId: auth.userId,
      verificationDetails: request.body.verificationDetails,
      ip: request.ip,
    });
    response.status(204).send();
  }),
);
lostFoundRouter.get(
  '/items/:itemId/claims',
  requireAuth,
  validate(itemIdSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    response.status(200).json({
      data: await lostFoundService.listClaims({
        tenantId: auth.tenantId,
        itemId: String(request.params.itemId),
        actorId: auth.userId,
        role: auth.role,
      }),
    });
  }),
);
lostFoundRouter.patch(
  '/claims/:claimId',
  requireAuth,
  requireCsrf,
  validate(claimIdSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    await lostFoundService.reviewClaim({
      tenantId: auth.tenantId,
      claimId: String(request.params.claimId),
      actorId: auth.userId,
      role: auth.role,
      status: request.body.status,
      ip: request.ip,
    });
    response.status(204).send();
  }),
);
function getAuth(request: Parameters<typeof requireAuth>[0]) {
  if (!request.auth) throw new AppError({ statusCode: 401, code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.' });
  return request.auth;
}
