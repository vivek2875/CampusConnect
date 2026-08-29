import { z } from 'zod';
const objectId = z.string().regex(/^[a-f\d]{24}$/i);
export const createEventSchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(3).max(160),
      description: z.string().trim().min(10).max(4_000),
      location: z.string().trim().min(2).max(180),
      startsAt: z.coerce.date(),
      endsAt: z.coerce.date(),
      registrationDeadline: z.coerce.date(),
      capacity: z.coerce.number().int().min(1).max(100_000),
    })
    .strict()
    .superRefine((event, context) => {
      if (event.endsAt <= event.startsAt)
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['endsAt'], message: 'End time must be after start time.' });
      if (event.registrationDeadline > event.startsAt || event.registrationDeadline <= new Date())
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['registrationDeadline'],
          message: 'Registration deadline must be future and before the event starts.',
        });
    }),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});
export const eventIdSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ eventId: objectId }).strict(),
  query: z.object({}).strict(),
});
export const eventPageSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z.object({ limit: z.coerce.number().int().min(1).max(50).default(20), cursor: z.string().min(1).max(200).optional() }).strict(),
});
export const checkinSchema = z.object({
  body: z.object({ ticket: z.string().min(20).max(2_000) }).strict(),
  params: z.object({ eventId: objectId }).strict(),
  query: z.object({}).strict(),
});
