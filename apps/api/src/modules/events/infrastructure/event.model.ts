import { Schema, model, models, type HydratedDocument, type Types } from 'mongoose';
import type { EventStatus } from '../domain/event.types';

interface EventPersistence {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  organizerId: Types.ObjectId;
  title: string;
  description: string;
  location: string;
  startsAt: Date;
  endsAt: Date;
  registrationDeadline: Date;
  capacity: number;
  registrationCount: number;
  status: EventStatus;
  createdAt: Date;
  updatedAt: Date;
}
const eventSchema = new Schema<EventPersistence>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, immutable: true },
    organizerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 160 },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 4_000 },
    location: { type: String, required: true, trim: true, maxlength: 180 },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    registrationDeadline: { type: Date, required: true },
    capacity: { type: Number, required: true, min: 1, max: 100_000 },
    registrationCount: { type: Number, required: true, min: 0, default: 0 },
    status: { type: String, required: true, enum: ['published', 'cancelled'], default: 'published' },
  },
  { timestamps: true, versionKey: false },
);
eventSchema.index({ tenantId: 1, status: 1, startsAt: 1, _id: 1 });
eventSchema.index({ tenantId: 1, organizerId: 1, startsAt: -1 });
export type EventDocument = HydratedDocument<EventPersistence>;
export const EventModel = models.Event ?? model<EventPersistence>('Event', eventSchema);
