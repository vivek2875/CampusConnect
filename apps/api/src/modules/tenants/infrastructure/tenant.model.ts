import { Schema, model, models, type HydratedDocument, type Types } from 'mongoose';

import type { TenantStatus } from '../domain/tenant.types';

export interface TenantPersistence {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  allowedEmailDomains: string[];
  status: TenantStatus;
  createdAt: Date;
  updatedAt: Date;
}

const tenantSchema = new Schema<TenantPersistence>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 80 },
    allowedEmailDomains: {
      type: [String],
      required: true,
      default: [],
      validate: {
        validator: (domains: string[]) => domains.every((domain) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)),
        message: 'Each allowed email domain must be valid.',
      },
    },
    status: { type: String, enum: ['active', 'suspended'], required: true, default: 'active' },
  },
  { timestamps: true, versionKey: false },
);

tenantSchema.index({ slug: 1 }, { unique: true });

export type TenantDocument = HydratedDocument<TenantPersistence>;
export const TenantModel = models.Tenant ?? model<TenantPersistence>('Tenant', tenantSchema);
