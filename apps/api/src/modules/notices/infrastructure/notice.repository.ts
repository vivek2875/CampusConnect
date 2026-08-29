import { Types } from 'mongoose';
import { trustServerQuery } from '../../../shared/persistence/trusted-query';
import type { NoticeAudience, NoticeCategory } from '../domain/notice.types';
import { NoticeModel } from './notice.model';
export const noticeRepository = {
  create(input: {
    tenantId: string;
    authorId: string;
    title: string;
    content: string;
    category: NoticeCategory;
    audience: NoticeAudience;
    priority: 'normal' | 'important';
    expiresAt?: Date;
  }) {
    return NoticeModel.create({ ...input, tenantId: new Types.ObjectId(input.tenantId), authorId: new Types.ObjectId(input.authorId) });
  },
  async findPage(input: {
    tenantId: string;
    audience: NoticeAudience[];
    limit: number;
    cursor?: { publishedAt: Date; id: string };
    category?: NoticeCategory;
  }) {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(input.tenantId),
      audience: { $in: input.audience },
      publishedAt: { $lte: new Date() },
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
      ...(input.category ? { category: input.category } : {}),
    };
    if (input.cursor)
      filter.$and = [
        { $or: filter.$or },
        {
          $or: [
            { publishedAt: { $lt: input.cursor.publishedAt } },
            { publishedAt: input.cursor.publishedAt, _id: { $lt: new Types.ObjectId(input.cursor.id) } },
          ],
        },
      ];
    delete filter.$or;
    const notices = await NoticeModel.find(trustServerQuery(filter))
      .sort({ publishedAt: -1, _id: -1 })
      .limit(input.limit + 1)
      .exec();
    const page = notices.slice(0, input.limit);
    const last = page.at(-1);
    return {
      notices: page,
      ...(notices.length > input.limit && last ? { nextCursor: { publishedAt: last.publishedAt, id: last.id } } : {}),
    };
  },
};
