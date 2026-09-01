import { recordAuditEvent } from '../../../shared/audit/audit.service';
import { AppError } from '../../../shared/errors/app-error';
import {
  createMarketplaceImageUrl,
  createMarketplaceUploadSignature,
  isMarketplaceAssetOwnedByUser,
} from '../../../shared/storage/cloudinary';
import { userRepository } from '../../users/infrastructure/user.repository';
import type {
  EngagementKind,
  ListingCategory,
  ListingCondition,
  ListingStatus,
  MarketplaceImage,
  MarketplacePrice,
} from '../domain/listing.types';
import { engagementRepository } from '../infrastructure/engagement.repository';
import { listingRepository } from '../infrastructure/listing.repository';
import type { ListingDocument } from '../infrastructure/listing.model';
import { decodeCursor, encodeCursor } from './marketplace.pagination';

interface ListingInput {
  title: string;
  description: string;
  category: ListingCategory;
  condition: ListingCondition;
  price: MarketplacePrice;
  images: Array<{ publicId: string }>;
}

interface ListingPageInput {
  tenantId: string;
  userId: string;
  limit: number;
  cursor?: string;
  category?: ListingCategory;
  condition?: ListingCondition;
  minPrice?: number;
  maxPrice?: number;
  query?: string;
}

export const marketplaceService = {
  getUploadSignature(input: { tenantId: string; userId: string }) {
    return createMarketplaceUploadSignature(input);
  },

  async createListing(input: ListingInput & { tenantId: string; sellerId: string; ip?: string }) {
    const listing = await listingRepository.create({
      ...input,
      sellerId: input.sellerId,
      images: normalizeImages(input.images, input),
    });
    recordAuditEvent({
      tenantId: input.tenantId,
      actorId: input.sellerId,
      action: 'MARKETPLACE_LISTING_CREATED',
      targetType: 'MarketplaceListing',
      targetId: listing.id,
      ip: input.ip,
    });
    return this.getListing({ tenantId: input.tenantId, userId: input.sellerId, listingId: listing.id });
  },

  async getListings(input: ListingPageInput) {
    const result = await listingRepository.findPage({
      tenantId: input.tenantId,
      limit: input.limit,
      ...(input.cursor ? { cursor: decodeCursor(input.cursor) } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.condition ? { condition: input.condition } : {}),
      ...(input.minPrice !== undefined ? { minPrice: input.minPrice } : {}),
      ...(input.maxPrice !== undefined ? { maxPrice: input.maxPrice } : {}),
      ...(input.query ? { query: input.query } : {}),
      statuses: ['active'],
    });
    return {
      listings: await hydrateListings(result.listings, input),
      nextCursor: result.nextCursor ? encodeCursor(result.nextCursor) : undefined,
    };
  },

  async getMyListings(input: ListingPageInput & { status?: ListingStatus }) {
    const statuses: ListingStatus[] = input.status ? [input.status] : ['active', 'reserved', 'sold', 'archived'];
    const result = await listingRepository.findPage({
      tenantId: input.tenantId,
      sellerId: input.userId,
      limit: input.limit,
      ...(input.cursor ? { cursor: decodeCursor(input.cursor) } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.condition ? { condition: input.condition } : {}),
      ...(input.minPrice !== undefined ? { minPrice: input.minPrice } : {}),
      ...(input.maxPrice !== undefined ? { maxPrice: input.maxPrice } : {}),
      ...(input.query ? { query: input.query } : {}),
      statuses,
    });
    return {
      listings: await hydrateListings(result.listings, input),
      nextCursor: result.nextCursor ? encodeCursor(result.nextCursor) : undefined,
    };
  },

  async getListing(input: { tenantId: string; userId: string; listingId: string }) {
    const listing = await listingRepository.findVisibleById(input.tenantId, input.listingId);
    if (!listing) throw listingNotFoundError();
    return (await hydrateListings([listing], input))[0];
  },

  async updateListing(input: {
    tenantId: string;
    sellerId: string;
    listingId: string;
    update: Partial<ListingInput & { status: Exclude<ListingStatus, 'archived'> }>;
    ip?: string;
  }) {
    const { images, ...nonImageUpdate } = input.update;
    const update = { ...nonImageUpdate, ...(images ? { images: normalizeImages(images, input) } : {}) };
    const listing = await listingRepository.updateOwned(input.tenantId, input.sellerId, input.listingId, update);
    if (!listing) throw listingNotFoundError();
    recordAuditEvent({
      tenantId: input.tenantId,
      actorId: input.sellerId,
      action: 'MARKETPLACE_LISTING_UPDATED',
      targetType: 'MarketplaceListing',
      targetId: listing.id,
      ip: input.ip,
    });
    return this.getListing({ tenantId: input.tenantId, userId: input.sellerId, listingId: listing.id });
  },

  async archiveListing(input: { tenantId: string; sellerId: string; listingId: string; ip?: string }): Promise<void> {
    const listing = await listingRepository.archiveOwned(input.tenantId, input.sellerId, input.listingId);
    if (!listing) throw listingNotFoundError();
    recordAuditEvent({
      tenantId: input.tenantId,
      actorId: input.sellerId,
      action: 'MARKETPLACE_LISTING_ARCHIVED',
      targetType: 'MarketplaceListing',
      targetId: listing.id,
      ip: input.ip,
    });
  },

  async restoreListing(input: { tenantId: string; sellerId: string; listingId: string; ip?: string }) {
    const listing = await listingRepository.restoreOwned(input.tenantId, input.sellerId, input.listingId);
    if (!listing) throw listingNotFoundError();
    recordAuditEvent({
      tenantId: input.tenantId,
      actorId: input.sellerId,
      action: 'MARKETPLACE_LISTING_RESTORED',
      targetType: 'MarketplaceListing',
      targetId: listing.id,
      ip: input.ip,
    });
    return this.getListing({ tenantId: input.tenantId, userId: input.sellerId, listingId: listing.id });
  },

  async addEngagement(input: { tenantId: string; userId: string; listingId: string; kind: EngagementKind }): Promise<void> {
    const listing = await listingRepository.findVisibleById(input.tenantId, input.listingId);
    if (!listing || listing.status !== 'active') throw listingNotFoundError();
    if (await engagementRepository.add(input)) await listingRepository.incrementEngagement(input.tenantId, input.listingId, input.kind, 1);
  },

  async removeEngagement(input: { tenantId: string; userId: string; listingId: string; kind: EngagementKind }): Promise<void> {
    if (await engagementRepository.remove(input))
      await listingRepository.incrementEngagement(input.tenantId, input.listingId, input.kind, -1);
  },

  async getWishlist(input: { tenantId: string; userId: string; limit: number; cursor?: string }) {
    const result = await engagementRepository.findPageForUser({
      tenantId: input.tenantId,
      userId: input.userId,
      kind: 'wishlist',
      limit: input.limit,
      ...(input.cursor ? { cursor: decodeCursor(input.cursor) } : {}),
    });
    const listings = await listingRepository.findByIds(
      input.tenantId,
      result.engagements.map((engagement) => engagement.listingId.toString()),
    );
    const byId = new Map(listings.map((listing) => [listing.id, listing]));
    const orderedListings = result.engagements.map((engagement) => byId.get(engagement.listingId.toString())).filter(isDefined);
    return {
      listings: await hydrateListings(orderedListings, input),
      nextCursor: result.nextCursor ? encodeCursor(result.nextCursor) : undefined,
    };
  },

  async getRecommendations(input: { tenantId: string; userId: string; limit: number }) {
    const engagements = await engagementRepository.findRecentForUser({ tenantId: input.tenantId, userId: input.userId, limit: 40 });
    const engagedListingIds = [...new Set(engagements.map((engagement) => engagement.listingId.toString()))];
    const interactedListings = await listingRepository.findByIds(input.tenantId, engagedListingIds);
    const categoryWeights = new Map<ListingCategory, number>();
    const listingsById = new Map(interactedListings.map((listing) => [listing.id, listing]));
    engagements.forEach((engagement) => {
      const listing = listingsById.get(engagement.listingId.toString());
      if (!listing) return;
      categoryWeights.set(listing.category, (categoryWeights.get(listing.category) ?? 0) + (engagement.kind === 'wishlist' ? 2 : 1));
    });
    const preferredCategory = [...categoryWeights.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
    const preferred = await listingRepository.findRecommendations({
      tenantId: input.tenantId,
      userId: input.userId,
      excludedListingIds: engagedListingIds,
      limit: input.limit,
      ...(preferredCategory ? { category: preferredCategory } : {}),
    });
    const remaining = input.limit - preferred.length;
    const fallback =
      remaining > 0
        ? await listingRepository.findRecommendations({
            tenantId: input.tenantId,
            userId: input.userId,
            excludedListingIds: [...engagedListingIds, ...preferred.map((listing) => listing.id)],
            limit: remaining,
          })
        : [];
    return hydrateListings([...preferred, ...fallback], input);
  },
};

async function hydrateListings(listings: ListingDocument[], input: { tenantId: string; userId: string }) {
  if (!listings.length) return [];
  const listingIds = listings.map((listing) => listing.id);
  const sellerIds = [...new Set(listings.map((listing) => listing.sellerId.toString()))];
  const [sellers, engagements] = await Promise.all([
    userRepository.findActiveByIds(input.tenantId, sellerIds),
    engagementRepository.findForUserAndListings({ tenantId: input.tenantId, userId: input.userId, listingIds }),
  ]);
  const sellersById = new Map(sellers.map((seller) => [seller.id, seller]));
  const engagementKeys = new Set(engagements.map((engagement) => `${engagement.listingId.toString()}:${engagement.kind}`));

  return listings.map((listing) => {
    const seller = sellersById.get(listing.sellerId.toString());
    return {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      category: listing.category,
      condition: listing.condition,
      price: listing.price,
      images: listing.images,
      status: listing.status,
      counts: listing.counts,
      seller: seller ? { id: seller.id, firstName: seller.firstName, lastName: seller.lastName, role: seller.role } : null,
      isLiked: engagementKeys.has(`${listing.id}:like`),
      isWishlisted: engagementKeys.has(`${listing.id}:wishlist`),
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
    };
  });
}

function normalizeImages(
  images: Array<{ publicId: string }>,
  input: { tenantId: string; sellerId?: string; userId?: string },
): MarketplaceImage[] {
  const userId = input.sellerId ?? input.userId;
  if (!userId) throw new Error('A marketplace image owner is required.');
  return images.map((image) => {
    if (!isMarketplaceAssetOwnedByUser(image.publicId, { tenantId: input.tenantId, userId })) {
      throw new AppError({
        statusCode: 403,
        code: 'MEDIA_OWNERSHIP_INVALID',
        message: 'One or more images do not belong to your account.',
      });
    }
    return { publicId: image.publicId, url: createMarketplaceImageUrl(image.publicId) };
  });
}

function listingNotFoundError(): AppError {
  return new AppError({ statusCode: 404, code: 'LISTING_NOT_FOUND', message: 'Listing not found or unavailable.' });
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
