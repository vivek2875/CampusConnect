import { Types, type ClientSession, type FilterQuery } from 'mongoose';

import { trustServerQuery } from '../../../shared/persistence/trusted-query';
import type { MarketplaceOfferStatus } from '../domain/offer.types';
import { MarketplaceOfferModel, type MarketplaceOfferDocument } from './offer.model';

export const offerRepository = {
  create(input: {
    tenantId: string;
    listingId: string;
    buyerId: string;
    sellerId: string;
    listingTitle: string;
    amountMinor: number;
    message?: string;
    expiresAt: Date;
  }): Promise<MarketplaceOfferDocument> {
    return MarketplaceOfferModel.create({
      ...input,
      tenantId: new Types.ObjectId(input.tenantId),
      listingId: new Types.ObjectId(input.listingId),
      buyerId: new Types.ObjectId(input.buyerId),
      sellerId: new Types.ObjectId(input.sellerId),
    });
  },

  findById(tenantId: string, offerId: string): Promise<MarketplaceOfferDocument | null> {
    return MarketplaceOfferModel.findOne({ _id: offerId, tenantId: new Types.ObjectId(tenantId) }).exec();
  },

  async findPage(input: {
    tenantId: string;
    userId: string;
    direction: 'incoming' | 'outgoing';
    limit: number;
    cursor?: { createdAt: Date; id: string };
    status?: MarketplaceOfferStatus;
  }): Promise<{ offers: MarketplaceOfferDocument[]; nextCursor?: { createdAt: Date; id: string } }> {
    const filter: FilterQuery<MarketplaceOfferDocument> = {
      tenantId: new Types.ObjectId(input.tenantId),
      [input.direction === 'incoming' ? 'sellerId' : 'buyerId']: new Types.ObjectId(input.userId),
      ...(input.status ? { status: input.status } : {}),
    };
    if (input.cursor) {
      filter.$or = [
        { createdAt: { $lt: input.cursor.createdAt } },
        { createdAt: input.cursor.createdAt, _id: { $lt: new Types.ObjectId(input.cursor.id) } },
      ];
    }
    const offers = await MarketplaceOfferModel.find(trustServerQuery(filter))
      .sort({ createdAt: -1, _id: -1 })
      .limit(input.limit + 1)
      .exec();
    const page = offers.slice(0, input.limit);
    const last = page.at(-1);
    return {
      offers: page,
      ...(offers.length > input.limit && last ? { nextCursor: { createdAt: last.createdAt, id: last.id } } : {}),
    };
  },

  updatePendingStatus(input: {
    tenantId: string;
    offerId: string;
    status: 'accepted' | 'declined' | 'withdrawn';
    session?: ClientSession;
  }): Promise<MarketplaceOfferDocument | null> {
    return MarketplaceOfferModel.findOneAndUpdate(
      trustServerQuery({
        _id: input.offerId,
        tenantId: new Types.ObjectId(input.tenantId),
        status: 'pending',
        expiresAt: { $gt: new Date() },
      }),
      { $set: { status: input.status, respondedAt: new Date() } },
      { new: true, session: input.session },
    ).exec();
  },

  expirePending(tenantId: string): Promise<void> {
    return MarketplaceOfferModel.updateMany(
      trustServerQuery({ tenantId: new Types.ObjectId(tenantId), status: 'pending', expiresAt: { $lte: new Date() } }),
      { $set: { status: 'expired', respondedAt: new Date() } },
    )
      .exec()
      .then(() => undefined);
  },

  declineOtherPending(input: { tenantId: string; listingId: string; acceptedOfferId: string; session: ClientSession }): Promise<void> {
    return MarketplaceOfferModel.updateMany(
      trustServerQuery({
        tenantId: new Types.ObjectId(input.tenantId),
        listingId: new Types.ObjectId(input.listingId),
        _id: { $ne: input.acceptedOfferId },
        status: 'pending',
      }),
      { $set: { status: 'declined', respondedAt: new Date() } },
      { session: input.session },
    )
      .exec()
      .then(() => undefined);
  },
};
