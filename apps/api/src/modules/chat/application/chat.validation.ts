import { z } from 'zod';
const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const publicId = z
  .string()
  .trim()
  .min(8)
  .max(500)
  .regex(/^[A-Za-z0-9_./-]+$/);
export const createConversationSchema = z.object({
  body: z
    .object({ recipientId: objectId.optional(), listingId: objectId.optional() })
    .strict()
    .refine((value) => Boolean(value.recipientId) !== Boolean(value.listingId), 'Provide exactly one recipientId or listingId.'),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});
export const conversationIdSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ conversationId: objectId }).strict(),
  query: z.object({}).strict(),
});
export const sendMessageSchema = z.object({
  body: z
    .object({ text: z.string().trim().min(1).max(2_000).optional(), imagePublicId: publicId.optional() })
    .strict()
    .refine((value) => Boolean(value.text) || Boolean(value.imagePublicId), 'A message needs text or an image.'),
  params: z.object({ conversationId: objectId }).strict(),
  query: z.object({}).strict(),
});
export const conversationPageSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z.object({ limit: z.coerce.number().int().min(1).max(50).default(20), cursor: z.string().min(1).max(200).optional() }).strict(),
});
export const chatRecipientPageSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z
    .object({
      query: z.string().trim().min(2).max(80),
      limit: z.coerce.number().int().min(1).max(20).default(10),
    })
    .strict(),
});
export const messagePageSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ conversationId: objectId }).strict(),
  query: z.object({ limit: z.coerce.number().int().min(1).max(50).default(50), cursor: z.string().min(1).max(200).optional() }).strict(),
});
