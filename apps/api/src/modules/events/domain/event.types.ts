export const eventStatuses = ['published', 'cancelled'] as const;
export type EventStatus = (typeof eventStatuses)[number];
