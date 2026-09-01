import { Types, type ClientSession, type FilterQuery } from 'mongoose';

import { trustServerQuery } from '../../../shared/persistence/trusted-query';
import type {
  EngagementKind,
  ListingCategory,
  ListingCondition,
  ListingStatus,
  MarketplaceImage,
  MarketplacePrice,
} from '../domain/listing.types';
import { ListingModel, type ListingDocument, type ListingPersistence } from './listing.model';

export const listingRepository = {
  create(input: {
    tenantId: string;
    sellerId: string;
    title: string;
    description: string;
    category: ListingCategory;
    condition: ListingCondition;
    price: MarketplacePrice;
    images: MarketplaceImage[];
  }): Promise<ListingDocument> {
    return ListingModel.create({
      ...input,
      tenantId: new Types.ObjectId(input.tenantId),
      sellerId: new Types.ObjectId(input.sellerId),
    });
  },

  findVisibleById(tenantId: string, listingId: string): Promise<ListingDocument | null> {
    return ListingModel.findOne(
      trustServerQuery({
        _id: listingId,
        tenantId: new Types.ObjectId(tenantId),
        status: { $in: ['active', 'reserved', 'sold'] },
      }),
    ).exec();
  },

  findOwnedById(tenantId: string, sellerId: string, listingId: string): Promise<ListingDocument | null> {
    return ListingModel.findOne({ _id: listingId, tenantId: new Types.ObjectId(tenantId), sellerId: new Types.ObjectId(sellerId) }).exec();
  },

  async findPage(input: {
    tenantId: string;
    limit: number;
    cursor?: { createdAt: Date; id: string };
    category?: ListingCategory;
    condition?: ListingCondition;
    minPrice?: number;
    maxPrice?: number;
    query?: string;
    sellerId?: string;
    statuses: ListingStatus[];
  }): Promise<{ listings: ListingDocument[]; nextCursor?: { createdAt: Date; id: string } }> {
    const filter: FilterQuery<ListingPersistence> = {
      tenantId: new Types.ObjectId(input.tenantId),
      status: { $in: input.statuses },
      ...(input.category ? { category: input.category } : {}),
      ...(input.condition ? { condition: input.condition } : {}),
      ...(input.sellerId ? { sellerId: new Types.ObjectId(input.sellerId) } : {}),
    };

    if (input.minPrice !== undefined || input.maxPrice !== undefined) {
      filter['price.amountMinor'] = {
        ...(input.minPrice !== undefined ? { $gte: input.minPrice } : {}),
        ...(input.maxPrice !== undefined ? { $lte: input.maxPrice } : {}),
      };
    }
    if (input.query) filter.$text = { $search: input.query };
    if (input.cursor) {
      filter.$or = [
        { createdAt: { $lt: input.cursor.createdAt } },
        { createdAt: input.cursor.createdAt, _id: { $lt: new Types.ObjectId(input.cursor.id) } },
      ];
    }

    const listings = await ListingModel.find(trustServerQuery(filter))
      .sort({ createdAt: -1, _id: -1 })
      .limit(input.limit + 1)
      .exec();
    const hasMore = listings.length > input.limit;
    const page = hasMore ? listings.slice(0, input.limit) : listings;
    const lastListing = page.at(-1);
    return {
      listings: page,
      ...(hasMore && lastListing ? { nextCursor: { createdAt: lastListing.createdAt, id: lastListing.id } } : {}),
    };
  },

  updateOwned(
    tenantId: string,
    sellerId: string,
    listingId: string,
    input: Partial<{
      title: string;
      description: string;
      category: ListingCategory;
      condition: ListingCondition;
      price: MarketplacePrice;
      images: MarketplaceImage[];
      status: ListingStatus;
    }>,
  ): Promise<ListingDocument | null> {
    return ListingModel.findOneAndUpdate(
      trustServerQuery({
        _id: listingId,
        tenantId: new Types.ObjectId(tenantId),
        sellerId: new Types.ObjectId(sellerId),
        status: { $ne: 'archived' },
      }),
      { $set: input },
      { new: true, runValidators: true },
    ).exec();
  },

  archiveOwned(tenantId: string, sellerId: string, listingId: string): Promise<ListingDocument | null> {
    return ListingModel.findOneAndUpdate(
      trustServerQuery({
        _id: listingId,
        tenantId: new Types.ObjectId(tenantId),
        sellerId: new Types.ObjectId(sellerId),
        status: { $ne: 'archived' },
      }),
      { $set: { status: 'archived' } },
      { new: true },
    ).exec();
  },

  restoreOwned(tenantId: string, sellerId: string, listingId: string): Promise<ListingDocument | null> {
    return ListingModel.findOneAndUpdate(
      trustServerQuery({
        _id: listingId,
        tenantId: new Types.ObjectId(tenantId),
        sellerId: new Types.ObjectId(sellerId),
        status: 'archived',
      }),
      { $set: { status: 'active' } },
      { new: true, runValidators: true },
    ).exec();
  },

  incrementEngagement(tenantId: string, listingId: string, kind: EngagementKind, amount: 1 | -1): Promise<void> {
    const field = kind === 'like' ? 'counts.likeCount' : 'counts.wishlistCount';
    return ListingModel.updateOne({ _id: listingId, tenantId: new Types.ObjectId(tenantId) }, { $inc: { [field]: amount } })
      .exec()
      .then(() => undefined);
  },

  findByIds(tenantId: string, listingIds: string[]): Promise<ListingDocument[]> {
    return ListingModel.find(
      trustServerQuery({
        _id: { $in: listingIds.map((listingId) => new Types.ObjectId(listingId)) },
        tenantId: new Types.ObjectId(tenantId),
        status: { $in: ['active', 'reserved', 'sold'] },
      }),
    ).exec();
  },

  findRecommendations(input: {
    tenantId: string;
    userId: string;
    excludedListingIds: string[];
    limit: number;
    category?: ListingCategory;
  }): Promise<ListingDocument[]> {
    return ListingModel.find(
      trustServerQuery({
        tenantId: new Types.ObjectId(input.tenantId),
        status: 'active',
        sellerId: { $ne: new Types.ObjectId(input.userId) },
        ...(input.excludedListingIds.length ? { _id: { $nin: input.excludedListingIds.map((id) => new Types.ObjectId(id)) } } : {}),
        ...(input.category ? { category: input.category } : {}),
      }),
    )
      .sort({ createdAt: -1, _id: -1 })
      .limit(input.limit)
      .exec();
  },

  reserveForAcceptedOffer(input: {
    tenantId: string;
    listingId: string;
    sellerId: string;
    session: ClientSession;
  }): Promise<ListingDocument | null> {
    return ListingModel.findOneAndUpdate(
      {
        _id: input.listingId,
        tenantId: new Types.ObjectId(input.tenantId),
        sellerId: new Types.ObjectId(input.sellerId),
        status: 'active',
      },
      { $set: { status: 'reserved' } },
      { new: true, session: input.session },
    ).exec();
  },
};
