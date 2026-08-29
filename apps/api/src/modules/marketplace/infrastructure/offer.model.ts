import { Schema, model, models, type HydratedDocument, type Types } from 'mongoose';

import type { MarketplaceOfferStatus } from '../domain/offer.types';

interface MarketplaceOfferPersistence {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  listingId: Types.ObjectId;
  buyerId: Types.ObjectId;
  sellerId: Types.ObjectId;
  listingTitle: string;
  amountMinor: number;
  message?: string;
  status: MarketplaceOfferStatus;
  expiresAt: Date;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const offerSchema = new Schema<MarketplaceOfferPersistence>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, immutable: true },
    listingId: { type: Schema.Types.ObjectId, ref: 'MarketplaceListing', required: true, immutable: true },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    listingTitle: { type: String, required: true, immutable: true, trim: true, maxlength: 120 },
    amountMinor: { type: Number, required: true, immutable: true, min: 1, max: 100_000_000 },
    message: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: ['pending', 'accepted', 'declined', 'withdrawn', 'expired'], required: true, default: 'pending' },
    expiresAt: { type: Date, required: true, immutable: true },
    respondedAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

offerSchema.index({ tenantId: 1, listingId: 1, buyerId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });
offerSchema.index({ tenantId: 1, sellerId: 1, status: 1, createdAt: -1, _id: -1 });
offerSchema.index({ tenantId: 1, buyerId: 1, status: 1, createdAt: -1, _id: -1 });
offerSchema.index({ tenantId: 1, listingId: 1, status: 1 });
offerSchema.index({ tenantId: 1, status: 1, expiresAt: 1 });

export type MarketplaceOfferDocument = HydratedDocument<MarketplaceOfferPersistence>;
export const MarketplaceOfferModel = models.MarketplaceOffer ?? model<MarketplaceOfferPersistence>('MarketplaceOffer', offerSchema);
