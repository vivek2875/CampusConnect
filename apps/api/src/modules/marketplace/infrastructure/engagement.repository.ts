import { Types } from 'mongoose';

import { trustServerQuery } from '../../../shared/persistence/trusted-query';
import type { EngagementKind } from '../domain/listing.types';
import { ListingEngagementModel, type ListingEngagementPersistence } from './engagement.model';

export const engagementRepository = {
  async add(input: { tenantId: string; listingId: string; userId: string; kind: EngagementKind }): Promise<boolean> {
    const result = await ListingEngagementModel.updateOne(
      {
        tenantId: new Types.ObjectId(input.tenantId),
        listingId: new Types.ObjectId(input.listingId),
        userId: new Types.ObjectId(input.userId),
        kind: input.kind,
      },
      {
        $setOnInsert: {
          tenantId: new Types.ObjectId(input.tenantId),
          listingId: new Types.ObjectId(input.listingId),
          userId: new Types.ObjectId(input.userId),
          kind: input.kind,
          createdAt: new Date(),
        },
      },
      { upsert: true },
    ).exec();
    return result.upsertedCount > 0;
  },

  async remove(input: { tenantId: string; listingId: string; userId: string; kind: EngagementKind }): Promise<boolean> {
    const result = await ListingEngagementModel.deleteOne({
      tenantId: new Types.ObjectId(input.tenantId),
      listingId: new Types.ObjectId(input.listingId),
      userId: new Types.ObjectId(input.userId),
      kind: input.kind,
    }).exec();
    return result.deletedCount > 0;
  },

  findForUserAndListings(input: { tenantId: string; userId: string; listingIds: string[] }): Promise<ListingEngagementPersistence[]> {
    if (!input.listingIds.length) return Promise.resolve([]);
    return ListingEngagementModel.find(
      trustServerQuery({
        tenantId: new Types.ObjectId(input.tenantId),
        userId: new Types.ObjectId(input.userId),
        listingId: { $in: input.listingIds.map((listingId) => new Types.ObjectId(listingId)) },
      }),
    ).exec();
  },

  findRecentForUser(input: { tenantId: string; userId: string; limit: number }): Promise<ListingEngagementPersistence[]> {
    return ListingEngagementModel.find({ tenantId: new Types.ObjectId(input.tenantId), userId: new Types.ObjectId(input.userId) })
      .sort({ createdAt: -1, _id: -1 })
      .limit(input.limit)
      .exec();
  },

  async findPageForUser(input: {
    tenantId: string;
    userId: string;
    kind: EngagementKind;
    limit: number;
    cursor?: { createdAt: Date; id: string };
  }): Promise<{ engagements: ListingEngagementPersistence[]; nextCursor?: { createdAt: Date; id: string } }> {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(input.tenantId),
      userId: new Types.ObjectId(input.userId),
      kind: input.kind,
    };
    if (input.cursor) {
      filter.$or = [
        { createdAt: { $lt: input.cursor.createdAt } },
        { createdAt: input.cursor.createdAt, _id: { $lt: new Types.ObjectId(input.cursor.id) } },
      ];
    }

    const engagements = await ListingEngagementModel.find(trustServerQuery(filter))
      .sort({ createdAt: -1, _id: -1 })
      .limit(input.limit + 1)
      .exec();
    const hasMore = engagements.length > input.limit;
    const page = hasMore ? engagements.slice(0, input.limit) : engagements;
    const lastEngagement = page.at(-1);
    return {
      engagements: page,
      ...(hasMore && lastEngagement ? { nextCursor: { createdAt: lastEngagement.createdAt, id: lastEngagement.id } } : {}),
    };
  },
};
