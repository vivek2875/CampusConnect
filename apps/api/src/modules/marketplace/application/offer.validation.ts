import { z } from 'zod';

import { marketplaceOfferStatuses } from '../domain/offer.types';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);

export const createOfferSchema = z.object({
  body: z.object({ amountMinor: z.number().int().min(1).max(100_000_000), message: z.string().trim().min(2).max(500).optional() }).strict(),
  params: z.object({ listingId: objectId }).strict(),
  query: z.object({}).strict(),
});

export const offerPageSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z
    .object({
      direction: z.enum(['incoming', 'outgoing']).default('incoming'),
      status: z.enum(marketplaceOfferStatuses).optional(),
      limit: z.coerce.number().int().min(1).max(50).default(20),
      cursor: z.string().min(1).max(200).optional(),
    })
    .strict(),
});

export const updateOfferSchema = z.object({
  body: z.object({ status: z.enum(['accepted', 'declined', 'withdrawn']) }).strict(),
  params: z.object({ offerId: objectId }).strict(),
  query: z.object({}).strict(),
});
