import { Router } from 'express';

import { requireAuth } from '../../../shared/auth/require-auth';
import { AppError } from '../../../shared/errors/app-error';
import { asyncHandler } from '../../../shared/http/async-handler';
import { emptyRequestSchema } from '../../../shared/http/empty-request-schema';
import { validate } from '../../../shared/http/validate';
import { requireCsrf } from '../../../shared/security/csrf';
import { createComplaintUploadSignature } from '../../../shared/storage/cloudinary';
import type { ComplaintDepartment, ComplaintPriority, ComplaintStatus } from '../domain/complaint.types';
import { complaintService } from '../application/complaint.service';
import {
  assignComplaintSchema,
  complaintHistorySchema,
  complaintIdSchema,
  createComplaintSchema,
  listComplaintsSchema,
  updateComplaintStatusSchema,
} from '../application/complaint.validation';

export const complaintRouter = Router();

complaintRouter.post(
  '/uploads/signature',
  requireAuth,
  requireCsrf,
  validate(emptyRequestSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    response.status(200).json({ data: createComplaintUploadSignature({ tenantId: auth.tenantId, userId: auth.userId }) });
  }),
);

complaintRouter.get(
  '/complaints',
  requireAuth,
  validate(listComplaintsSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    const query = parseComplaintQuery(request.query);
    const result = await complaintService.list({ tenantId: auth.tenantId, actorId: auth.userId, role: auth.role, ...query });
    response.status(200).json({ data: result.complaints, meta: { limit: query.limit, nextCursor: result.nextCursor ?? null } });
  }),
);

complaintRouter.post(
  '/complaints',
  requireAuth,
  requireCsrf,
  validate(createComplaintSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    const complaint = await complaintService.create({ ...request.body, tenantId: auth.tenantId, reporterId: auth.userId, ip: request.ip });
    response.status(201).json({ data: complaint });
  }),
);

complaintRouter.get(
  '/complaints/:complaintId/history',
  requireAuth,
  validate(complaintHistorySchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    const limit = Number(request.query.limit);
    const cursor = typeof request.query.cursor === 'string' ? request.query.cursor : undefined;
    const result = await complaintService.getHistory({
      tenantId: auth.tenantId,
      actorId: auth.userId,
      role: auth.role,
      complaintId: String(request.params.complaintId),
      limit,
      ...(cursor ? { cursor } : {}),
    });
    response.status(200).json({ data: result.events, meta: { limit, nextCursor: result.nextCursor ?? null } });
  }),
);

complaintRouter.get(
  '/complaints/:complaintId',
  requireAuth,
  validate(complaintIdSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    response.status(200).json({
      data: await complaintService.getById({
        tenantId: auth.tenantId,
        actorId: auth.userId,
        role: auth.role,
        complaintId: String(request.params.complaintId),
      }),
    });
  }),
);

complaintRouter.patch(
  '/complaints/:complaintId/assign',
  requireAuth,
  requireCsrf,
  validate(assignComplaintSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    const complaint = await complaintService.assign({
      tenantId: auth.tenantId,
      actorId: auth.userId,
      role: auth.role,
      complaintId: String(request.params.complaintId),
      assigneeId: request.body.assigneeId,
      ip: request.ip,
    });
    response.status(200).json({ data: complaint });
  }),
);

complaintRouter.patch(
  '/complaints/:complaintId/status',
  requireAuth,
  requireCsrf,
  validate(updateComplaintStatusSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    const complaint = await complaintService.updateStatus({
      tenantId: auth.tenantId,
      actorId: auth.userId,
      role: auth.role,
      complaintId: String(request.params.complaintId),
      status: request.body.status,
      ip: request.ip,
    });
    response.status(200).json({ data: complaint });
  }),
);

function getAuth(request: Parameters<typeof requireAuth>[0]) {
  if (!request.auth) throw new AppError({ statusCode: 401, code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.' });
  return request.auth;
}

function parseComplaintQuery(query: Record<string, unknown>) {
  const cursor = typeof query.cursor === 'string' ? query.cursor : undefined;
  const department = typeof query.department === 'string' ? (query.department as ComplaintDepartment) : undefined;
  const priority = typeof query.priority === 'string' ? (query.priority as ComplaintPriority) : undefined;
  const status = typeof query.status === 'string' ? (query.status as ComplaintStatus) : undefined;
  return {
    limit: Number(query.limit),
    ...(cursor ? { cursor } : {}),
    ...(department ? { department } : {}),
    ...(priority ? { priority } : {}),
    ...(status ? { status } : {}),
  };
}
