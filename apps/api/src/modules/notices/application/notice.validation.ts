import { z } from 'zod';
export const createNoticeSchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(3).max(180),
      content: z.string().trim().min(10).max(8_000),
      category: z.enum(['department', 'hostel', 'placements', 'academics', 'exams', 'general']),
      audience: z.enum(['all', 'student', 'faculty', 'maintenance_staff']).default('all'),
      priority: z.enum(['normal', 'important']).default('normal'),
      expiresAt: z.coerce.date().optional(),
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});
export const noticePageSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(50).default(20),
      cursor: z.string().min(1).max(200).optional(),
      category: z.enum(['department', 'hostel', 'placements', 'academics', 'exams', 'general']).optional(),
    })
    .strict(),
});
