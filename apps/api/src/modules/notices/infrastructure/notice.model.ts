import { Schema, model, models, type HydratedDocument, type Types } from 'mongoose';
import type { NoticeAudience, NoticeCategory } from '../domain/notice.types';
interface NoticePersistence {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  authorId: Types.ObjectId;
  title: string;
  content: string;
  category: NoticeCategory;
  audience: NoticeAudience;
  priority: 'normal' | 'important';
  publishedAt: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const noticeSchema = new Schema<NoticePersistence>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, immutable: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 180 },
    content: { type: String, required: true, trim: true, minlength: 10, maxlength: 8_000 },
    category: { type: String, required: true, enum: ['department', 'hostel', 'placements', 'academics', 'exams', 'general'] },
    audience: { type: String, required: true, enum: ['all', 'student', 'faculty', 'maintenance_staff'], default: 'all' },
    priority: { type: String, required: true, enum: ['normal', 'important'], default: 'normal' },
    publishedAt: { type: Date, default: Date.now, immutable: true },
    expiresAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);
noticeSchema.index({ tenantId: 1, audience: 1, publishedAt: -1, _id: -1 });
noticeSchema.index({ tenantId: 1, category: 1, publishedAt: -1, _id: -1 });
export type NoticeDocument = HydratedDocument<NoticePersistence>;
export const NoticeModel = models.Notice ?? model<NoticePersistence>('Notice', noticeSchema);
