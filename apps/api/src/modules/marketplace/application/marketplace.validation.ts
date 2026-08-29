import { z } from 'zod';

import { listingCategories, listingConditions, listingStatuses } from '../domain/listing.types';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const publicId = z
  .string()
  .trim()
  .min(8)
  .max(500)
  .regex(/^[A-Za-z0-9_./-]+$/);
const price = z.object({ amountMinor: z.number().int().min(0).max(100_000_000), currency: z.literal('INR') }).strict();
const listingFields = {
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2_000),
  category: z.enum(listingCategories),
  condition: z.enum(listingConditions),
  price,
  images: z
    .array(z.object({ publicId }).strict())
    .max(8)
    .refine((images) => new Set(images.map((image) => image.publicId)).size === images.length, 'Images must be unique.'),
};

export const createListingSchema = z.object({
  body: z.object(listingFields).strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export const updateListingSchema = z.object({
  body: z
    .object({ ...listingFields, status: z.enum(['active', 'reserved', 'sold']) })
    .partial()
    .strict()
    .refine((body) => Object.keys(body).length > 0, 'At least one field must be provided.'),
  params: z.object({ listingId: objectId }).strict(),
  query: z.object({}).strict(),
});

export const listingIdSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ listingId: objectId }).strict(),
  query: z.object({}).strict(),
});

const listingQueryFields = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().min(1).max(200).optional(),
    category: z.enum(listingCategories).optional(),
    condition: z.enum(listingConditions).optional(),
    minPrice: z.coerce.number().int().min(0).max(100_000_000).optional(),
    maxPrice: z.coerce.number().int().min(0).max(100_000_000).optional(),
    q: z.string().trim().min(2).max(100).optional(),
  })
  .strict();

const listingQuery = listingQueryFields.refine(
  (query) => query.minPrice === undefined || query.maxPrice === undefined || query.minPrice <= query.maxPrice,
  {
    message: 'minPrice must not be greater than maxPrice.',
    path: ['minPrice'],
  },
);

export const listListingsSchema = z.object({ body: z.object({}).strict(), params: z.object({}).strict(), query: listingQuery });

export const listMyListingsSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: listingQueryFields
    .extend({ status: z.enum(listingStatuses).optional() })
    .refine((query) => query.minPrice === undefined || query.maxPrice === undefined || query.minPrice <= query.maxPrice, {
      message: 'minPrice must not be greater than maxPrice.',
      path: ['minPrice'],
    }),
});

export const wishlistSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z.object({ limit: z.coerce.number().int().min(1).max(50).default(20), cursor: z.string().min(1).max(200).optional() }).strict(),
});

export const recommendationsSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z.object({ limit: z.coerce.number().int().min(1).max(20).default(8) }).strict(),
});
