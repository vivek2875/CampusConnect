import { Schema, model, models, type HydratedDocument, type Types } from 'mongoose';

import type { LostFoundImage, LostFoundStatus, LostFoundType } from '../domain/lost-found.types';

interface LostFoundPersistence {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  reporterId: Types.ObjectId;
  type: LostFoundType;
  title: string;
  description: string;
  location: string;
  images: LostFoundImage[];
  status: LostFoundStatus;
  relatedItemIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

const imageSchema = new Schema<LostFoundImage>(
  { publicId: { type: String, required: true }, url: { type: String, required: true } },
  { _id: false },
);
const lostFoundSchema = new Schema<LostFoundPersistence>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, immutable: true },
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    type: { type: String, required: true, enum: ['lost', 'found'] },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 140 },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 2_000 },
    location: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
    images: {
      type: [imageSchema],
      required: true,
      default: [],
      validate: [(images: LostFoundImage[]) => images.length <= 6, 'At most six images are allowed.'],
    },
    status: { type: String, required: true, enum: ['open', 'claimed', 'resolved', 'archived'], default: 'open' },
    relatedItemIds: { type: [String], required: true, default: [] },
  },
  { timestamps: true, versionKey: false },
);
lostFoundSchema.index({ tenantId: 1, type: 1, status: 1, createdAt: -1, _id: -1 });
lostFoundSchema.index({ tenantId: 1, reporterId: 1, createdAt: -1, _id: -1 });
lostFoundSchema.index({ tenantId: 1, title: 'text', description: 'text', location: 'text' });
export type LostFoundDocument = HydratedDocument<LostFoundPersistence>;
export const LostFoundModel = models.LostFoundItem ?? model<LostFoundPersistence>('LostFoundItem', lostFoundSchema);
