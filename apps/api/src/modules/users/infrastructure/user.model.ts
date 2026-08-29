import { Schema, model, models, type HydratedDocument, type Types } from 'mongoose';

import type { UserRole, UserStatus } from '../domain/user.types';

export interface UserPersistence {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt?: Date;
  emailVerificationTokenHash?: string;
  emailVerificationExpiresAt?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  authVersion: number;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserPersistence>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, immutable: true },
    firstName: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 320 },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['student', 'faculty', 'maintenance_staff', 'admin', 'super_admin'],
      required: true,
      default: 'student',
    },
    status: { type: String, enum: ['active', 'suspended'], required: true, default: 'active' },
    emailVerifiedAt: { type: Date, required: false },
    emailVerificationTokenHash: { type: String, select: false },
    emailVerificationExpiresAt: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
    authVersion: { type: Number, required: true, default: 0, min: 0 },
    lastLoginAt: { type: Date, required: false },
  },
  { timestamps: true, versionKey: false },
);

userSchema.index({ tenantId: 1, email: 1 }, { unique: true });
userSchema.index({ tenantId: 1, role: 1, status: 1 });
userSchema.index({ tenantId: 1, createdAt: -1, _id: -1 });

export type UserDocument = HydratedDocument<UserPersistence>;
export const UserModel = models.User ?? model<UserPersistence>('User', userSchema);
