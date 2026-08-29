import { Schema, model, models, type Types } from 'mongoose';

interface AuditLogPersistence {
  tenantId?: Types.ObjectId;
  actorId?: Types.ObjectId;
  action: string;
  targetType: string;
  targetId?: Types.ObjectId;
  ip?: string;
  metadata?: Record<string, string | number | boolean>;
  createdAt: Date;
}

const auditLogSchema = new Schema<AuditLogPersistence>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true, trim: true, maxlength: 100 },
    targetType: { type: String, required: true, trim: true, maxlength: 100 },
    targetId: { type: Schema.Types.ObjectId },
    ip: { type: String, maxlength: 64 },
    metadata: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now, immutable: true },
  },
  { versionKey: false },
);

auditLogSchema.index({ tenantId: 1, actorId: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

export const AuditLogModel = models.AuditLog ?? model<AuditLogPersistence>('AuditLog', auditLogSchema);
