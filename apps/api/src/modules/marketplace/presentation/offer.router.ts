import { Router } from 'express';

import { requireAuth } from '../../../shared/auth/require-auth';
import { AppError } from '../../../shared/errors/app-error';
import { asyncHandler } from '../../../shared/http/async-handler';
import { validate } from '../../../shared/http/validate';
import { requireCsrf } from '../../../shared/security/csrf';
import { offerService } from '../application/offer.service';
import { createOfferSchema, offerPageSchema, updateOfferSchema } from '../application/offer.validation';
import type { MarketplaceOfferStatus } from '../domain/offer.types';

export const offerRouter = Router();

offerRouter.post(
  '/listings/:listingId/offers',
  requireAuth,
  requireCsrf,
  validate(createOfferSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    response.status(201).json({
      data: await offerService.create({
        tenantId: auth.tenantId,
        buyerId: auth.userId,
        listingId: String(request.params.listingId),
        amountMinor: request.body.amountMinor,
        ...(request.body.message ? { message: request.body.message } : {}),
        ip: request.ip,
      }),
    });
  }),
);

offerRouter.get(
  '/offers',
  requireAuth,
  validate(offerPageSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    const cursor = typeof request.query.cursor === 'string' ? request.query.cursor : undefined;
    const status = typeof request.query.status === 'string' ? (request.query.status as MarketplaceOfferStatus) : undefined;
    const result = await offerService.list({
      tenantId: auth.tenantId,
      userId: auth.userId,
      direction: request.query.direction as 'incoming' | 'outgoing',
      limit: Number(request.query.limit),
      ...(cursor ? { cursor } : {}),
      ...(status ? { status } : {}),
    });
    response.status(200).json({ data: result.offers, meta: { limit: Number(request.query.limit), nextCursor: result.nextCursor ?? null } });
  }),
);

offerRouter.patch(
  '/offers/:offerId',
  requireAuth,
  requireCsrf,
  validate(updateOfferSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    response.status(200).json({
      data: await offerService.respond({
        tenantId: auth.tenantId,
        actorId: auth.userId,
        offerId: String(request.params.offerId),
        status: request.body.status,
        ip: request.ip,
      }),
    });
  }),
);

function getAuth(request: Parameters<typeof requireAuth>[0]) {
  if (!request.auth) throw new AppError({ statusCode: 401, code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.' });
  return request.auth;
}
