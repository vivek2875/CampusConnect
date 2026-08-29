export const notificationTypes = [
  'complaint_assigned',
  'complaint_updated',
  'event_registration',
  'event_reminder',
  'lost_found_claim',
  'notice_published',
  'chat_message',
  'marketplace_offer',
] as const;
export type NotificationType = (typeof notificationTypes)[number];
