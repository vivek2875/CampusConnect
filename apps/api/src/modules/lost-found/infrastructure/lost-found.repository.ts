import { Types, type ClientSession, type FilterQuery } from 'mongoose';

import { trustServerQuery } from '../../../shared/persistence/trusted-query';
import type { LostFoundType } from '../domain/lost-found.types';
import { LostFoundModel, type LostFoundDocument } from './lost-found.model';
import { LostFoundClaimModel } from './lost-found-claim.model';

export const lostFoundRepository = {
  create(input: {
    tenantId: string;
    reporterId: string;
    type: LostFoundType;
    title: string;
    description: string;
    location: string;
    images: Array<{ publicId: string; url: string }>;
    relatedItemIds: string[];
  }) {
    return LostFoundModel.create({
      ...input,
      tenantId: new Types.ObjectId(input.tenantId),
      reporterId: new Types.ObjectId(input.reporterId),
    });
  },
  findById(tenantId: string, itemId: string): Promise<LostFoundDocument | null> {
    return LostFoundModel.findOne({ _id: itemId, tenantId: new Types.ObjectId(tenantId) }).exec();
  },
  async findPage(input: {
    tenantId: string;
    limit: number;
    cursor?: { createdAt: Date; id: string };
    type?: LostFoundType;
    reporterId?: string;
  }) {
    const filter: FilterQuery<LostFoundDocument> = {
      tenantId: new Types.ObjectId(input.tenantId),
      status: { $in: ['open', 'claimed'] },
      ...(input.type ? { type: input.type } : {}),
      ...(input.reporterId ? { reporterId: new Types.ObjectId(input.reporterId) } : {}),
    };
    if (input.cursor)
      filter.$or = [
        { createdAt: { $lt: input.cursor.createdAt } },
        { createdAt: input.cursor.createdAt, _id: { $lt: new Types.ObjectId(input.cursor.id) } },
      ];
    const items = await LostFoundModel.find(trustServerQuery(filter))
      .sort({ createdAt: -1, _id: -1 })
      .limit(input.limit + 1)
      .exec();
    const page = items.slice(0, input.limit);
    const last = page.at(-1);
    return { items: page, ...(items.length > input.limit && last ? { nextCursor: { createdAt: last.createdAt, id: last.id } } : {}) };
  },
  findOppositeOpen(input: { tenantId: string; type: LostFoundType; limit: number }): Promise<LostFoundDocument[]> {
    const type = input.type === 'lost' ? 'found' : 'lost';
    return LostFoundModel.find({ tenantId: new Types.ObjectId(input.tenantId), type, status: 'open' })
      .sort({ createdAt: -1 })
      .limit(input.limit)
      .exec();
  },
  resolveForApprovedClaim(input: { itemId: string; tenantId: string; session: ClientSession }) {
    return LostFoundModel.findOneAndUpdate(
      { _id: input.itemId, tenantId: new Types.ObjectId(input.tenantId), status: 'open' },
      { $set: { status: 'resolved' } },
      { new: true, session: input.session },
    ).exec();
  },
  createClaim(input: { tenantId: string; itemId: string; claimantId: string; verificationDetails: string }) {
    return LostFoundClaimModel.create({
      ...input,
      tenantId: new Types.ObjectId(input.tenantId),
      itemId: new Types.ObjectId(input.itemId),
      claimantId: new Types.ObjectId(input.claimantId),
    });
  },
  findClaim(tenantId: string, claimId: string) {
    return LostFoundClaimModel.findOne({ _id: claimId, tenantId: new Types.ObjectId(tenantId) }).exec();
  },
  findClaims(tenantId: string, itemId: string) {
    return LostFoundClaimModel.find({ tenantId: new Types.ObjectId(tenantId), itemId: new Types.ObjectId(itemId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  },
  reviewClaim(input: { tenantId: string; claimId: string; reviewerId: string; status: 'approved' | 'rejected'; session?: ClientSession }) {
    return LostFoundClaimModel.findOneAndUpdate(
      { _id: input.claimId, tenantId: new Types.ObjectId(input.tenantId), status: 'pending' },
      { $set: { status: input.status, reviewedById: new Types.ObjectId(input.reviewerId) } },
      { new: true, ...(input.session ? { session: input.session } : {}) },
    ).exec();
  },
  rejectOtherPendingClaims(input: {
    tenantId: string;
    itemId: string;
    approvedClaimId: string;
    reviewerId: string;
    session: ClientSession;
  }) {
    return LostFoundClaimModel.updateMany(
      trustServerQuery({
        tenantId: new Types.ObjectId(input.tenantId),
        itemId: new Types.ObjectId(input.itemId),
        _id: { $ne: new Types.ObjectId(input.approvedClaimId) },
        status: 'pending',
      }),
      { $set: { status: 'rejected', reviewedById: new Types.ObjectId(input.reviewerId) } },
      { session: input.session },
    ).exec();
  },
};
