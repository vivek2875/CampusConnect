import { z } from 'zod';
export const assistantSchema = z.object({
  body: z.object({ question: z.string().trim().min(2).max(2_000) }).strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});
export const priceEstimateSchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(3).max(120),
      description: z.string().trim().min(10).max(2_000),
      category: z.enum(['electronics', 'books', 'furniture', 'cycles', 'hostel_essentials', 'sports', 'fashion']),
      condition: z.enum(['new', 'like_new', 'good', 'fair']),
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});
