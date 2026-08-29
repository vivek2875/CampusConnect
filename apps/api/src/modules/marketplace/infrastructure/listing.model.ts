import { Schema, model, models, type HydratedDocument, type Types } from 'mongoose';

import type { ListingCategory, ListingCondition, ListingStatus, MarketplaceImage, MarketplacePrice } from '../domain/listing.types';

export interface ListingPersistence {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  sellerId: Types.ObjectId;
  title: string;
  description: string;
  category: ListingCategory;
  condition: ListingCondition;
  price: MarketplacePrice;
  images: MarketplaceImage[];
  status: ListingStatus;
  counts: {
    likeCount: number;
    wishlistCount: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const imageSchema = new Schema<MarketplaceImage>(
  {
    publicId: { type: String, required: true, maxlength: 500 },
    url: { type: String, required: true, maxlength: 2_000 },
  },
  { _id: false },
);

const listingSchema = new Schema<ListingPersistence>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, immutable: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 2_000 },
    category: {
      type: String,
      required: true,
      enum: ['electronics', 'books', 'furniture', 'cycles', 'hostel_essentials', 'sports', 'fashion'],
    },
    condition: { type: String, required: true, enum: ['new', 'like_new', 'good', 'fair'] },
    price: {
      amountMinor: { type: Number, required: true, min: 0, max: 100_000_000 },
      currency: { type: String, required: true, enum: ['INR'], default: 'INR' },
    },
    images: {
      type: [imageSchema],
      required: true,
      default: [],
      validate: [(images: MarketplaceImage[]) => images.length <= 8, 'At most eight images are allowed.'],
    },
    status: { type: String, required: true, enum: ['active', 'reserved', 'sold', 'archived'], default: 'active' },
    counts: {
      likeCount: { type: Number, required: true, min: 0, default: 0 },
      wishlistCount: { type: Number, required: true, min: 0, default: 0 },
    },
  },
  { timestamps: true, versionKey: false },
);

listingSchema.index({ tenantId: 1, status: 1, createdAt: -1, _id: -1 });
listingSchema.index({ tenantId: 1, status: 1, category: 1, createdAt: -1, _id: -1 });
listingSchema.index({ tenantId: 1, status: 1, 'price.amountMinor': 1 });
listingSchema.index({ tenantId: 1, sellerId: 1, createdAt: -1, _id: -1 });
listingSchema.index({ tenantId: 1, title: 'text', description: 'text' });

export type ListingDocument = HydratedDocument<ListingPersistence>;
export const ListingModel = models.MarketplaceListing ?? model<ListingPersistence>('MarketplaceListing', listingSchema);
