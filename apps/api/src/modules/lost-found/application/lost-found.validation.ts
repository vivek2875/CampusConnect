import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const publicId = z
  .string()
  .trim()
  .min(8)
  .max(500)
  .regex(/^[A-Za-z0-9_./-]+$/);
export const createItemSchema = z.object({
  body: z
    .object({
      type: z.enum(['lost', 'found']),
      title: z.string().trim().min(3).max(140),
      description: z.string().trim().min(10).max(2_000),
      location: z.string().trim().min(2).max(160),
      images: z.array(z.object({ publicId }).strict()).max(6),
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});
export const itemIdSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ itemId: objectId }).strict(),
  query: z.object({}).strict(),
});
export const pageSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(50).default(20),
      cursor: z.string().min(1).max(200).optional(),
      type: z.enum(['lost', 'found']).optional(),
    })
    .strict(),
});
export const claimSchema = z.object({
  body: z.object({ verificationDetails: z.string().trim().min(10).max(1_000) }).strict(),
  params: z.object({ itemId: objectId }).strict(),
  query: z.object({}).strict(),
});
export const claimIdSchema = z.object({
  body: z.object({ status: z.enum(['approved', 'rejected']) }).strict(),
  params: z.object({ claimId: objectId }).strict(),
  query: z.object({}).strict(),
});
