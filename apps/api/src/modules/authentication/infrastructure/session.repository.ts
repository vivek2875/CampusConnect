import { Types, type FilterQuery } from 'mongoose';

import { trustServerQuery } from '../../../shared/persistence/trusted-query';
import { SessionModel, type SessionDocument } from './session.model';

export const sessionRepository = {
  create(input: {
    tenantId: string;
    userId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
    userAgent?: string;
    ip?: string;
  }): Promise<SessionDocument> {
    return SessionModel.create({
      ...input,
      tenantId: new Types.ObjectId(input.tenantId),
      userId: new Types.ObjectId(input.userId),
    });
  },

  findByIdWithToken(sessionId: string): Promise<SessionDocument | null> {
    return SessionModel.findById(sessionId).select('+tokenHash').exec();
  },

  rotateToken(input: { sessionId: string; expectedTokenHash: string; tokenHash: string }): Promise<SessionDocument | null> {
    return SessionModel.findOneAndUpdate(
      trustServerQuery({
        _id: input.sessionId,
        tokenHash: input.expectedTokenHash,
        revokedAt: { $exists: false },
        expiresAt: { $gt: new Date() },
      }),
      { $set: { tokenHash: input.tokenHash, lastUsedAt: new Date() } },
      { new: true },
    ).exec();
  },

  revoke(sessionId: string): Promise<SessionDocument | null> {
    return SessionModel.findOneAndUpdate(
      trustServerQuery({ _id: sessionId, revokedAt: { $exists: false } }),
      { $set: { revokedAt: new Date() } },
      { new: true },
    ).exec();
  },

  revokeAllForUser(userId: string): Promise<void> {
    return SessionModel.updateMany(trustServerQuery({ userId: new Types.ObjectId(userId), revokedAt: { $exists: false } }), {
      $set: { revokedAt: new Date() },
    })
      .exec()
      .then(() => undefined);
  },

  async findActiveForUser(input: { userId: string; limit: number; cursor?: { lastUsedAt: Date; id: string } }): Promise<{
    sessions: SessionDocument[];
    nextCursor?: { lastUsedAt: Date; id: string };
  }> {
    const query: FilterQuery<SessionDocument> = {
      userId: new Types.ObjectId(input.userId),
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    };

    if (input.cursor) {
      query.$or = [
        { lastUsedAt: { $lt: input.cursor.lastUsedAt } },
        { lastUsedAt: input.cursor.lastUsedAt, _id: { $lt: new Types.ObjectId(input.cursor.id) } },
      ];
    }

    const sessions = await SessionModel.find(trustServerQuery(query))
      .select('_id createdAt lastUsedAt expiresAt userAgent ip')
      .sort({ lastUsedAt: -1, _id: -1 })
      .limit(input.limit + 1)
      .exec();

    const hasMore = sessions.length > input.limit;
    const page = hasMore ? sessions.slice(0, input.limit) : sessions;
    const lastSession = page.at(-1);
    return {
      sessions: page,
      ...(hasMore && lastSession ? { nextCursor: { lastUsedAt: lastSession.lastUsedAt, id: lastSession.id } } : {}),
    };
  },

  revokeForUser(sessionId: string, userId: string): Promise<SessionDocument | null> {
    return SessionModel.findOneAndUpdate(
      trustServerQuery({ _id: sessionId, userId: new Types.ObjectId(userId), revokedAt: { $exists: false } }),
      { $set: { revokedAt: new Date() } },
      { new: true },
    ).exec();
  },
};
