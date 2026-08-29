import { Schema, model, models, type HydratedDocument, type Types } from 'mongoose';
interface RegistrationPersistence {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  eventId: Types.ObjectId;
  userId: Types.ObjectId;
  registeredAt: Date;
  checkedInAt?: Date;
  certificateCode?: string;
  createdAt: Date;
  updatedAt: Date;
}
const registrationSchema = new Schema<RegistrationPersistence>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, immutable: true },
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, immutable: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    registeredAt: { type: Date, default: Date.now, immutable: true },
    checkedInAt: { type: Date },
    certificateCode: { type: String, unique: true, sparse: true, maxlength: 80 },
  },
  { timestamps: true, versionKey: false },
);
registrationSchema.index({ tenantId: 1, eventId: 1, userId: 1 }, { unique: true });
registrationSchema.index({ tenantId: 1, userId: 1, createdAt: -1, _id: -1 });
registrationSchema.index({ tenantId: 1, eventId: 1, checkedInAt: 1 });
export type RegistrationDocument = HydratedDocument<RegistrationPersistence>;
export const EventRegistrationModel = models.EventRegistration ?? model<RegistrationPersistence>('EventRegistration', registrationSchema);
