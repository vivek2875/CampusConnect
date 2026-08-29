import { Schema, model, models, type Types } from 'mongoose';

import type { ClaimStatus } from '../domain/lost-found.types';

interface LostFoundClaimPersistence {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  itemId: Types.ObjectId;
  claimantId: Types.ObjectId;
  verificationDetails: string;
  status: ClaimStatus;
  reviewedById?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const claimSchema = new Schema<LostFoundClaimPersistence>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, immutable: true },
    itemId: { type: Schema.Types.ObjectId, ref: 'LostFoundItem', required: true, immutable: true },
    claimantId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    verificationDetails: { type: String, required: true, trim: true, minlength: 10, maxlength: 1_000 },
    status: { type: String, required: true, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedById: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, versionKey: false },
);
claimSchema.index({ tenantId: 1, itemId: 1, claimantId: 1 }, { unique: true });
claimSchema.index({ tenantId: 1, itemId: 1, status: 1, createdAt: -1 });
export const LostFoundClaimModel = models.LostFoundClaim ?? model<LostFoundClaimPersistence>('LostFoundClaim', claimSchema);
