export const marketplaceOfferStatuses = ['pending', 'accepted', 'declined', 'withdrawn', 'expired'] as const;
export type MarketplaceOfferStatus = (typeof marketplaceOfferStatuses)[number];
