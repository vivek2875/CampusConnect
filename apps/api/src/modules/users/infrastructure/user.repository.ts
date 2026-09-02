import { Types, type FilterQuery } from 'mongoose';

import { trustServerQuery } from '../../../shared/persistence/trusted-query';
import type { UserRole, UserStatus } from '../domain/user.types';
import { UserModel, type UserDocument, type UserPersistence } from './user.model';

export const userRepository = {
  create(input: {
    tenantId: Types.ObjectId;
    firstName: string;
    lastName: string;
    email: string;
    passwordHash: string;
    role?: 'student';
    emailVerificationTokenHash?: string;
    emailVerificationExpiresAt?: Date;
  }): Promise<UserDocument> {
    return UserModel.create(input);
  },

  findById(userId: string): Promise<UserDocument | null> {
    return UserModel.findById(userId).exec();
  },

  async findAuthorizationState(
    userId: string,
  ): Promise<{ tenantId: { toString(): string }; status: string; authVersion: number; emailVerified: boolean } | null> {
    const user = await UserModel.findById(userId).select('tenantId status authVersion emailVerifiedAt').lean().exec();
    if (!user || Array.isArray(user)) return null;
    return {
      tenantId: user.tenantId as { toString(): string },
      status: user.status as string,
      authVersion: user.authVersion as number,
      emailVerified: Boolean(user.emailVerifiedAt),
    };
  },

  findActiveByIds(tenantId: string, userIds: string[]): Promise<UserDocument[]> {
    if (!userIds.length) return Promise.resolve([]);
    return UserModel.find(trustServerQuery({ tenantId, _id: { $in: userIds }, status: 'active' }))
      .select('firstName lastName role')
      .exec();
  },

  findActiveChatRecipients(input: { tenantId: string; excludedUserId: string; query: string; limit: number }): Promise<UserDocument[]> {
    return UserModel.find(
      trustServerQuery({
        tenantId: new Types.ObjectId(input.tenantId),
        status: 'active',
        _id: { $ne: new Types.ObjectId(input.excludedUserId) },
        $text: { $search: input.query },
      }),
    )
      .select('firstName lastName role emailVerifiedAt')
      .sort({ score: { $meta: 'textScore' }, firstName: 1, lastName: 1, _id: 1 })
      .limit(input.limit)
      .exec();
  },

  async findAdminPage(input: {
    tenantId: string;
    limit: number;
    cursor?: { createdAt: Date; id: string };
    role?: UserRole;
    status?: UserStatus;
  }): Promise<{ users: UserDocument[]; nextCursor?: { createdAt: Date; id: string } }> {
    const filter: FilterQuery<UserPersistence> = {
      tenantId: new Types.ObjectId(input.tenantId),
      ...(input.role ? { role: input.role } : {}),
      ...(input.status ? { status: input.status } : {}),
    };
    if (input.cursor) {
      filter.$or = [
        { createdAt: { $lt: input.cursor.createdAt } },
        { createdAt: input.cursor.createdAt, _id: { $lt: new Types.ObjectId(input.cursor.id) } },
      ];
    }
    const users = await UserModel.find(trustServerQuery(filter))
      .select('firstName lastName email role status emailVerifiedAt createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .limit(input.limit + 1)
      .exec();
    const page = users.slice(0, input.limit);
    const last = page.at(-1);
    return { users: page, ...(users.length > input.limit && last ? { nextCursor: { createdAt: last.createdAt, id: last.id } } : {}) };
  },

  findForAuthentication(tenantId: string, email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ tenantId, email }).select('+passwordHash').exec();
  },

  findForPasswordReset(tokenHash: string): Promise<UserDocument | null> {
    return UserModel.findOne(
      trustServerQuery({
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { $gt: new Date() },
      }),
    )
      .select('+passwordHash +passwordResetTokenHash')
      .exec();
  },

  findForEmailVerification(tokenHash: string): Promise<UserDocument | null> {
    return UserModel.findOne(
      trustServerQuery({
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: { $gt: new Date() },
      }),
    ).exec();
  },

  setEmailVerificationToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    return UserModel.updateOne({ _id: userId }, { $set: { emailVerificationTokenHash: tokenHash, emailVerificationExpiresAt: expiresAt } })
      .exec()
      .then(() => undefined);
  },

  markEmailVerified(userId: string): Promise<void> {
    return UserModel.updateOne(
      { _id: userId },
      {
        $set: { emailVerifiedAt: new Date() },
        $unset: { emailVerificationTokenHash: '', emailVerificationExpiresAt: '' },
      },
    )
      .exec()
      .then(() => undefined);
  },

  setPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    return UserModel.updateOne({ _id: userId }, { $set: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt } })
      .exec()
      .then(() => undefined);
  },

  resetPassword(userId: string, passwordHash: string): Promise<void> {
    return UserModel.updateOne(
      { _id: userId },
      {
        $set: { passwordHash },
        $inc: { authVersion: 1 },
        $unset: { passwordResetTokenHash: '', passwordResetExpiresAt: '' },
      },
    )
      .exec()
      .then(() => undefined);
  },

  updateProfile(userId: string, input: { firstName: string; lastName: string }): Promise<UserDocument | null> {
    return UserModel.findByIdAndUpdate(userId, { $set: input }, { new: true, runValidators: true }).exec();
  },
};
