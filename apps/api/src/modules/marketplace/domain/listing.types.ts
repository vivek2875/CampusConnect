export const listingCategories = ['electronics', 'books', 'furniture', 'cycles', 'hostel_essentials', 'sports', 'fashion'] as const;
export const listingConditions = ['new', 'like_new', 'good', 'fair'] as const;
export const listingStatuses = ['active', 'reserved', 'sold', 'archived'] as const;
export const engagementKinds = ['like', 'wishlist'] as const;

export type ListingCategory = (typeof listingCategories)[number];
export type ListingCondition = (typeof listingConditions)[number];
export type ListingStatus = (typeof listingStatuses)[number];
export type EngagementKind = (typeof engagementKinds)[number];

export interface MarketplaceImage {
  publicId: string;
  url: string;
}

export interface MarketplacePrice {
  amountMinor: number;
  currency: 'INR';
}
