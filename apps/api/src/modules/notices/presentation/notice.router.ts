import { Router } from 'express';
import { requireAuth } from '../../../shared/auth/require-auth';
import { requireVerifiedEmail } from '../../../shared/auth/require-verified-email';
import { AppError } from '../../../shared/errors/app-error';
import { asyncHandler } from '../../../shared/http/async-handler';
import { validate } from '../../../shared/http/validate';
import { requireCsrf } from '../../../shared/security/csrf';
import type { NoticeCategory } from '../domain/notice.types';
import { noticeService } from '../application/notice.service';
import { createNoticeSchema, noticePageSchema } from '../application/notice.validation';
export const noticeRouter = Router();
noticeRouter.get(
  '/notices',
  requireAuth,
  validate(noticePageSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    const limit = Number(request.query.limit);
    const cursor = typeof request.query.cursor === 'string' ? request.query.cursor : undefined;
    const category = typeof request.query.category === 'string' ? (request.query.category as NoticeCategory) : undefined;
    const result = await noticeService.list({
      tenantId: auth.tenantId,
      role: auth.role,
      limit,
      ...(cursor ? { cursor } : {}),
      ...(category ? { category } : {}),
    });
    response.status(200).json({ data: result.notices, meta: { limit, nextCursor: result.nextCursor ?? null } });
  }),
);
noticeRouter.post(
  '/notices',
  requireAuth,
  requireVerifiedEmail,
  requireCsrf,
  validate(createNoticeSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    response
      .status(201)
      .json({ data: await noticeService.create({ ...request.body, tenantId: auth.tenantId, authorId: auth.userId, role: auth.role }) });
  }),
);
function getAuth(request: Parameters<typeof requireAuth>[0]) {
  if (!request.auth) throw new AppError({ statusCode: 401, code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.' });
  return request.auth;
}
