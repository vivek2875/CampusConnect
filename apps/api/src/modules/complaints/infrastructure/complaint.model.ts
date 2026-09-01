import { Schema, model, models, type HydratedDocument, type Types } from 'mongoose';

import type {
  ComplaintDepartment,
  ComplaintImage,
  ComplaintIntelligence,
  ComplaintPriority,
  ComplaintStatus,
} from '../domain/complaint.types';
import { complaintDepartments } from '../domain/complaint.types';

export interface ComplaintPersistence {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  reporterId: Types.ObjectId;
  title: string;
  description: string;
  department: ComplaintDepartment;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  images: ComplaintImage[];
  assigneeId?: Types.ObjectId;
  assignedById?: Types.ObjectId;
  assignedAt?: Date;
  intelligence: ComplaintIntelligence;
  createdAt: Date;
  updatedAt: Date;
}

const imageSchema = new Schema<ComplaintImage>(
  { publicId: { type: String, required: true, maxlength: 500 }, url: { type: String, required: true, maxlength: 2_000 } },
  { _id: false },
);

const intelligenceSchema = new Schema<ComplaintIntelligence>(
  {
    provider: { type: String, required: true, enum: ['gemini', 'rules'] },
    summary: { type: String, required: true, maxlength: 500 },
    suggestedDepartment: { type: String, required: true, enum: [...complaintDepartments] },
    suggestedPriority: { type: String, required: true, enum: ['low', 'normal', 'high', 'urgent'] },
    estimatedResolutionHours: { type: Number, required: true, min: 1, max: 720 },
    duplicateCandidateIds: { type: [String], required: true, default: [] },
  },
  { _id: false },
);

const complaintSchema = new Schema<ComplaintPersistence>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, immutable: true },
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 140 },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 4_000 },
    department: { type: String, required: true, enum: [...complaintDepartments] },
    priority: { type: String, required: true, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
    status: { type: String, required: true, enum: ['pending', 'assigned', 'in_progress', 'resolved', 'closed'], default: 'pending' },
    images: {
      type: [imageSchema],
      required: true,
      default: [],
      validate: [(images: ComplaintImage[]) => images.length <= 6, 'At most six images are allowed.'],
    },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedById: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedAt: { type: Date },
    intelligence: { type: intelligenceSchema, required: true },
  },
  { timestamps: true, versionKey: false },
);

complaintSchema.index({ tenantId: 1, reporterId: 1, createdAt: -1, _id: -1 });
complaintSchema.index({ tenantId: 1, assigneeId: 1, status: 1, updatedAt: -1, _id: -1 });
complaintSchema.index({ tenantId: 1, department: 1, status: 1, priority: 1, createdAt: -1, _id: -1 });
complaintSchema.index({ tenantId: 1, title: 'text', description: 'text' });

export type ComplaintDocument = HydratedDocument<ComplaintPersistence>;
export const ComplaintModel = models.Complaint ?? model<ComplaintPersistence>('Complaint', complaintSchema);
