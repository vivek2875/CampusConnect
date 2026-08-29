import { Schema, model, models, type HydratedDocument, type Types } from 'mongoose';

interface SessionPersistence {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt?: Date;
  lastUsedAt: Date;
  userAgent?: string;
  ip?: string;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<SessionPersistence>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, immutable: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    tokenHash: { type: String, required: true, select: false },
    familyId: { type: String, required: true, immutable: true, maxlength: 100 },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    lastUsedAt: { type: Date, required: true, default: Date.now },
    userAgent: { type: String, maxlength: 500 },
    ip: { type: String, maxlength: 64 },
  },
  { timestamps: true, versionKey: false },
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ userId: 1, revokedAt: 1, lastUsedAt: -1, _id: -1 });

export type SessionDocument = HydratedDocument<SessionPersistence>;
export const SessionModel = models.Session ?? model<SessionPersistence>('Session', sessionSchema);
