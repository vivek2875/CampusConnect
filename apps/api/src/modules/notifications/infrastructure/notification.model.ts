import { Schema, model, models, type HydratedDocument, type Types } from 'mongoose';

import type { NotificationType } from '../domain/notification.types';

interface NotificationPersistence {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  recipientId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  readAt?: Date;
  createdAt: Date;
}
const notificationSchema = new Schema<NotificationPersistence>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, immutable: true },
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    type: {
      type: String,
      required: true,
      enum: [
        'complaint_assigned',
        'complaint_updated',
        'event_registration',
        'event_reminder',
        'lost_found_claim',
        'notice_published',
        'chat_message',
      ],
    },
    title: { type: String, required: true, maxlength: 140 },
    body: { type: String, required: true, maxlength: 500 },
    link: { type: String, maxlength: 500 },
    readAt: { type: Date },
    createdAt: { type: Date, default: Date.now, immutable: true },
  },
  { versionKey: false },
);
notificationSchema.index({ tenantId: 1, recipientId: 1, createdAt: -1, _id: -1 });
notificationSchema.index({ tenantId: 1, recipientId: 1, readAt: 1, createdAt: -1 });
export type NotificationDocument = HydratedDocument<NotificationPersistence>;
export const NotificationModel = models.Notification ?? model<NotificationPersistence>('Notification', notificationSchema);
