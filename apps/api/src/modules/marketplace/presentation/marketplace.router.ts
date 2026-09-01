import { Router } from 'express';

import { requireAuth } from '../../../shared/auth/require-auth';
import { asyncHandler } from '../../../shared/http/async-handler';
import { emptyRequestSchema } from '../../../shared/http/empty-request-schema';
import { validate } from '../../../shared/http/validate';
import { requireCsrf } from '../../../shared/security/csrf';
import type { ListingCategory, ListingCondition, ListingStatus } from '../domain/listing.types';
import { marketplaceService } from '../application/marketplace.service';
import {
  createListingSchema,
  listingIdSchema,
  listListingsSchema,
  listMyListingsSchema,
  recommendationsSchema,
  updateListingSchema,
  wishlistSchema,
} from '../application/marketplace.validation';

export const marketplaceRouter = Router();

marketplaceRouter.post(
  '/uploads/signature',
  requireAuth,
  requireCsrf,
  validate(emptyRequestSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    response.status(200).json({ data: marketplaceService.getUploadSignature({ tenantId: auth.tenantId, userId: auth.userId }) });
  }),
);

marketplaceRouter.get(
  '/recommendations',
  requireAuth,
  validate(recommendationsSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    const listings = await marketplaceService.getRecommendations({
      tenantId: auth.tenantId,
      userId: auth.userId,
      limit: Number(request.query.limit),
    });
    response.status(200).json({ data: listings });
  }),
);

marketplaceRouter.get(
  '/listings/mine',
  requireAuth,
  validate(listMyListingsSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    const query = parseListingQuery(request.query);
    const status = typeof request.query.status === 'string' ? (request.query.status as ListingStatus) : undefined;
    const result = await marketplaceService.getMyListings({
      tenantId: auth.tenantId,
      userId: auth.userId,
      ...query,
      ...(status ? { status } : {}),
    });
    response.status(200).json({ data: result.listings, meta: { limit: query.limit, nextCursor: result.nextCursor ?? null } });
  }),
);

marketplaceRouter.get(
  '/wishlist',
  requireAuth,
  validate(wishlistSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    const limit = Number(request.query.limit);
    const cursor = typeof request.query.cursor === 'string' ? request.query.cursor : undefined;
    const result = await marketplaceService.getWishlist({
      tenantId: auth.tenantId,
      userId: auth.userId,
      limit,
      ...(cursor ? { cursor } : {}),
    });
    response.status(200).json({ data: result.listings, meta: { limit, nextCursor: result.nextCursor ?? null } });
  }),
);

marketplaceRouter.get(
  '/listings',
  requireAuth,
  validate(listListingsSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    const query = parseListingQuery(request.query);
    const result = await marketplaceService.getListings({ tenantId: auth.tenantId, userId: auth.userId, ...query });
    response.status(200).json({ data: result.listings, meta: { limit: query.limit, nextCursor: result.nextCursor ?? null } });
  }),
);

marketplaceRouter.post(
  '/listings',
  requireAuth,
  requireCsrf,
  validate(createListingSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    const listing = await marketplaceService.createListing({
      ...request.body,
      tenantId: auth.tenantId,
      sellerId: auth.userId,
      ip: request.ip,
    });
    response.status(201).json({ data: listing });
  }),
);

marketplaceRouter.get(
  '/listings/:listingId',
  requireAuth,
  validate(listingIdSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    response.status(200).json({
      data: await marketplaceService.getListing({
        tenantId: auth.tenantId,
        userId: auth.userId,
        listingId: String(request.params.listingId),
      }),
    });
  }),
);

marketplaceRouter.patch(
  '/listings/:listingId',
  requireAuth,
  requireCsrf,
  validate(updateListingSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    const listing = await marketplaceService.updateListing({
      tenantId: auth.tenantId,
      sellerId: auth.userId,
      listingId: String(request.params.listingId),
      update: request.body,
      ip: request.ip,
    });
    response.status(200).json({ data: listing });
  }),
);

marketplaceRouter.delete(
  '/listings/:listingId',
  requireAuth,
  requireCsrf,
  validate(listingIdSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    await marketplaceService.archiveListing({
      tenantId: auth.tenantId,
      sellerId: auth.userId,
      listingId: String(request.params.listingId),
      ip: request.ip,
    });
    response.status(204).send();
  }),
);

marketplaceRouter.post(
  '/listings/:listingId/restore',
  requireAuth,
  requireCsrf,
  validate(listingIdSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    response.status(200).json({
      data: await marketplaceService.restoreListing({
        tenantId: auth.tenantId,
        sellerId: auth.userId,
        listingId: String(request.params.listingId),
        ip: request.ip,
      }),
    });
  }),
);

for (const engagement of ['like', 'wishlist'] as const) {
  marketplaceRouter.post(
    `/listings/:listingId/${engagement}s`,
    requireAuth,
    requireCsrf,
    validate(listingIdSchema),
    asyncHandler(async (request, response) => {
      const auth = getAuth(request);
      await marketplaceService.addEngagement({
        tenantId: auth.tenantId,
        userId: auth.userId,
        listingId: String(request.params.listingId),
        kind: engagement,
      });
      response.status(204).send();
    }),
  );
  marketplaceRouter.delete(
    `/listings/:listingId/${engagement}s`,
    requireAuth,
    requireCsrf,
    validate(listingIdSchema),
    asyncHandler(async (request, response) => {
      const auth = getAuth(request);
      await marketplaceService.removeEngagement({
        tenantId: auth.tenantId,
        userId: auth.userId,
        listingId: String(request.params.listingId),
        kind: engagement,
      });
      response.status(204).send();
    }),
  );
}

function getAuth(request: Parameters<typeof requireAuth>[0]) {
  if (!request.auth) throw new Error('Authentication middleware did not attach a request context.');
  return request.auth;
}

function parseListingQuery(query: Record<string, unknown>) {
  const category = typeof query.category === 'string' ? (query.category as ListingCategory) : undefined;
  const condition = typeof query.condition === 'string' ? (query.condition as ListingCondition) : undefined;
  const cursor = typeof query.cursor === 'string' ? query.cursor : undefined;
  const search = typeof query.q === 'string' ? query.q : undefined;
  const minPrice = query.minPrice === undefined ? undefined : Number(query.minPrice);
  const maxPrice = query.maxPrice === undefined ? undefined : Number(query.maxPrice);
  return {
    limit: Number(query.limit),
    ...(cursor ? { cursor } : {}),
    ...(category ? { category } : {}),
    ...(condition ? { condition } : {}),
    ...(minPrice !== undefined ? { minPrice } : {}),
    ...(maxPrice !== undefined ? { maxPrice } : {}),
    ...(search ? { query: search } : {}),
  };
}
