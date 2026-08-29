import { Schema, model, models, type Types } from 'mongoose';

import type { EngagementKind } from '../domain/listing.types';

export interface ListingEngagementPersistence {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  listingId: Types.ObjectId;
  userId: Types.ObjectId;
  kind: EngagementKind;
  createdAt: Date;
}

const listingEngagementSchema = new Schema<ListingEngagementPersistence>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, immutable: true },
    listingId: { type: Schema.Types.ObjectId, ref: 'MarketplaceListing', required: true, immutable: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    kind: { type: String, required: true, enum: ['like', 'wishlist'], immutable: true },
    createdAt: { type: Date, required: true, default: Date.now, immutable: true },
  },
  { versionKey: false },
);

listingEngagementSchema.index({ tenantId: 1, userId: 1, listingId: 1, kind: 1 }, { unique: true });
listingEngagementSchema.index({ tenantId: 1, listingId: 1, kind: 1 });
listingEngagementSchema.index({ tenantId: 1, userId: 1, kind: 1, createdAt: -1, _id: -1 });
listingEngagementSchema.index({ tenantId: 1, userId: 1, createdAt: -1, _id: -1 });

export const ListingEngagementModel =
  models.ListingEngagement ?? model<ListingEngagementPersistence>('ListingEngagement', listingEngagementSchema);
