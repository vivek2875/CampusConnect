import { z } from 'zod';

const assistantMessageSchema = z
  .object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(2_000),
  })
  .strict();

export const assistantSchema = z.object({
  body: z
    .object({
      question: z.string().trim().min(2).max(2_000).optional(),
      messages: z.array(assistantMessageSchema).min(1).max(12).optional(),
    })
    .strict()
    .superRefine((value, context) => {
      if (Boolean(value.question) === Boolean(value.messages)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'Provide a question or conversation messages.' });
      }
      if (value.messages && value.messages.at(-1)?.role !== 'user') {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['messages'], message: 'The final message must be from the user.' });
      }
    }),
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
