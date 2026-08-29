export const lostFoundTypes = ['lost', 'found'] as const;
export const lostFoundStatuses = ['open', 'claimed', 'resolved', 'archived'] as const;
export const claimStatuses = ['pending', 'approved', 'rejected'] as const;

export type LostFoundType = (typeof lostFoundTypes)[number];
export type LostFoundStatus = (typeof lostFoundStatuses)[number];
export type ClaimStatus = (typeof claimStatuses)[number];

export interface LostFoundImage {
  publicId: string;
  url: string;
}
