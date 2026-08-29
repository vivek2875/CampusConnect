import { Schema, model, models, type Types } from 'mongoose';

interface ComplaintEventPersistence {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  complaintId: Types.ObjectId;
  actorId: Types.ObjectId;
  type: 'created' | 'assigned' | 'status_changed';
  payload: Record<string, string>;
  createdAt: Date;
}

const complaintEventSchema = new Schema<ComplaintEventPersistence>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, immutable: true },
    complaintId: { type: Schema.Types.ObjectId, ref: 'Complaint', required: true, immutable: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    type: { type: String, required: true, immutable: true, enum: ['created', 'assigned', 'status_changed'] },
    payload: { type: Schema.Types.Mixed, required: true, immutable: true },
    createdAt: { type: Date, required: true, default: Date.now, immutable: true },
  },
  { versionKey: false },
);

complaintEventSchema.index({ tenantId: 1, complaintId: 1, createdAt: 1, _id: 1 });

export const ComplaintEventModel = models.ComplaintEvent ?? model<ComplaintEventPersistence>('ComplaintEvent', complaintEventSchema);
