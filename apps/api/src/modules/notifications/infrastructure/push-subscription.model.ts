import { Schema, model, models, type HydratedDocument, type Types } from 'mongoose';

interface PushSubscriptionPersistence {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const pushSubscriptionSchema = new Schema<PushSubscriptionPersistence>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, immutable: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    endpoint: { type: String, required: true, unique: true, maxlength: 2_000 },
    keys: {
      p256dh: { type: String, required: true, maxlength: 500 },
      auth: { type: String, required: true, maxlength: 500 },
    },
    expirationTime: { type: Number, required: false },
  },
  { timestamps: true, versionKey: false },
);

pushSubscriptionSchema.index({ tenantId: 1, userId: 1, updatedAt: -1 });

export type PushSubscriptionDocument = HydratedDocument<PushSubscriptionPersistence>;
export const PushSubscriptionModel =
  models.PushSubscription ?? model<PushSubscriptionPersistence>('PushSubscription', pushSubscriptionSchema);
