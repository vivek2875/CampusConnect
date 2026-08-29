import { z } from 'zod';

import { complaintDepartments, complaintPriorities, complaintStatuses } from '../domain/complaint.types';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const publicId = z
  .string()
  .trim()
  .min(8)
  .max(500)
  .regex(/^[A-Za-z0-9_./-]+$/);
const complaintIdParams = z.object({ complaintId: objectId }).strict();

export const createComplaintSchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(3).max(140),
      description: z.string().trim().min(10).max(4_000),
      department: z.enum(complaintDepartments),
      images: z
        .array(z.object({ publicId }).strict())
        .max(6)
        .refine((images) => new Set(images.map((image) => image.publicId)).size === images.length, 'Images must be unique.'),
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

const pageQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().min(1).max(200).optional(),
    department: z.enum(complaintDepartments).optional(),
    priority: z.enum(complaintPriorities).optional(),
    status: z.enum(complaintStatuses).optional(),
  })
  .strict();

export const listComplaintsSchema = z.object({ body: z.object({}).strict(), params: z.object({}).strict(), query: pageQuery });
export const complaintIdSchema = z.object({ body: z.object({}).strict(), params: complaintIdParams, query: z.object({}).strict() });

export const assignComplaintSchema = z.object({
  body: z.object({ assigneeId: objectId }).strict(),
  params: complaintIdParams,
  query: z.object({}).strict(),
});

export const updateComplaintStatusSchema = z.object({
  body: z.object({ status: z.enum(complaintStatuses) }).strict(),
  params: complaintIdParams,
  query: z.object({}).strict(),
});

export const complaintHistorySchema = z.object({
  body: z.object({}).strict(),
  params: complaintIdParams,
  query: z.object({ limit: z.coerce.number().int().min(1).max(50).default(20), cursor: z.string().min(1).max(200).optional() }).strict(),
});
