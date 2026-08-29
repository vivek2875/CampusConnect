import { Types } from 'mongoose';

import { trustServerQuery } from '../../../shared/persistence/trusted-query';
import type { NotificationType } from '../domain/notification.types';
import { NotificationModel, type NotificationDocument } from './notification.model';

export const notificationRepository = {
  create(input: { tenantId: string; recipientId: string; type: NotificationType; title: string; body: string; link?: string }) {
    return NotificationModel.create({
      ...input,
      tenantId: new Types.ObjectId(input.tenantId),
      recipientId: new Types.ObjectId(input.recipientId),
    });
  },
  async findPage(input: { tenantId: string; recipientId: string; limit: number; cursor?: { createdAt: Date; id: string } }) {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(input.tenantId),
      recipientId: new Types.ObjectId(input.recipientId),
    };
    if (input.cursor)
      filter.$or = [
        { createdAt: { $lt: input.cursor.createdAt } },
        { createdAt: input.cursor.createdAt, _id: { $lt: new Types.ObjectId(input.cursor.id) } },
      ];
    const notifications = await NotificationModel.find(trustServerQuery(filter))
      .sort({ createdAt: -1, _id: -1 })
      .limit(input.limit + 1)
      .exec();
    const page = notifications.slice(0, input.limit);
    const last = page.at(-1);
    return {
      notifications: page,
      ...(notifications.length > input.limit && last ? { nextCursor: { createdAt: last.createdAt, id: last.id } } : {}),
    };
  },
  markRead(tenantId: string, recipientId: string, notificationId: string): Promise<NotificationDocument | null> {
    return NotificationModel.findOneAndUpdate(
      { _id: notificationId, tenantId: new Types.ObjectId(tenantId), recipientId: new Types.ObjectId(recipientId) },
      { $set: { readAt: new Date() } },
      { new: true },
    ).exec();
  },
};
