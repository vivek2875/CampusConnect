import { AppError } from '../../../shared/errors/app-error';
import type { UserRole } from '../../users/domain/user.types';
import type { NoticeAudience, NoticeCategory } from '../domain/notice.types';
import { noticeRepository } from '../infrastructure/notice.repository';
import { decodeNoticeCursor, encodeNoticeCursor } from './notice.pagination';
export const noticeService = {
  async create(input: {
    tenantId: string;
    authorId: string;
    role: UserRole;
    title: string;
    content: string;
    category: NoticeCategory;
    audience: NoticeAudience;
    priority: 'normal' | 'important';
    expiresAt?: Date;
  }) {
    if (!['faculty', 'admin', 'super_admin'].includes(input.role))
      throw new AppError({ statusCode: 403, code: 'FORBIDDEN', message: 'Only faculty or administrators can publish notices.' });
    const notice = await noticeRepository.create(input);
    return toNotice(notice);
  },
  async list(input: { tenantId: string; role: UserRole; limit: number; cursor?: string; category?: NoticeCategory }) {
    const audiences: NoticeAudience[] =
      input.role === 'super_admin' || input.role === 'admin'
        ? ['all', 'student', 'faculty', 'maintenance_staff']
        : ['all', input.role as Exclude<NoticeAudience, 'all'>];
    const result = await noticeRepository.findPage({
      tenantId: input.tenantId,
      audience: audiences,
      limit: input.limit,
      ...(input.cursor ? { cursor: decodeNoticeCursor(input.cursor) } : {}),
      ...(input.category ? { category: input.category } : {}),
    });
    return { notices: result.notices.map(toNotice), nextCursor: result.nextCursor ? encodeNoticeCursor(result.nextCursor) : undefined };
  },
};
function toNotice(notice: Awaited<ReturnType<typeof noticeRepository.create>>) {
  return {
    id: notice.id,
    title: notice.title,
    content: notice.content,
    category: notice.category,
    audience: notice.audience,
    priority: notice.priority,
    publishedAt: notice.publishedAt,
    expiresAt: notice.expiresAt ?? null,
  };
}
