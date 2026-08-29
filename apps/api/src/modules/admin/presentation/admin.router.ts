import { Router } from 'express';
import { requireAuth } from '../../../shared/auth/require-auth';
import { AppError } from '../../../shared/errors/app-error';
import { asyncHandler } from '../../../shared/http/async-handler';
import { validate } from '../../../shared/http/validate';
import { adminService } from '../application/admin.service';
import { listAdminUsersSchema } from '../application/admin.validation';
export const adminRouter = Router();
adminRouter.get(
  '/admin/dashboard',
  requireAuth,
  asyncHandler(async (request, response) => {
    if (!request.auth) throw new AppError({ statusCode: 401, code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.' });
    response.status(200).json({ data: await adminService.dashboard({ tenantId: request.auth.tenantId, role: request.auth.role }) });
  }),
);
adminRouter.get(
  '/admin/users',
  requireAuth,
  validate(listAdminUsersSchema),
  asyncHandler(async (request, response) => {
    if (!request.auth) throw new AppError({ statusCode: 401, code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.' });
    const limit = Number(request.query.limit);
    const cursor = typeof request.query.cursor === 'string' ? request.query.cursor : undefined;
    const filterRole = typeof request.query.role === 'string' ? request.query.role : undefined;
    const status = typeof request.query.status === 'string' ? request.query.status : undefined;
    const result = await adminService.listUsers({
      tenantId: request.auth.tenantId,
      role: request.auth.role,
      limit,
      ...(cursor ? { cursor } : {}),
      ...(filterRole ? { filterRole: filterRole as typeof request.auth.role } : {}),
      ...(status ? { status: status as 'active' | 'suspended' } : {}),
    });
    response.status(200).json({ data: result.users, meta: { limit, nextCursor: result.nextCursor ?? null } });
  }),
);
