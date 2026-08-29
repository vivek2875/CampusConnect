import { AuditLogModel } from '../shared/audit/audit-log.model';
import { disconnectMongo, connectMongo } from '../shared/persistence/mongo';
import { SessionModel } from '../modules/authentication/infrastructure/session.model';
import { ConversationModel } from '../modules/chat/infrastructure/conversation.model';
import { MessageModel } from '../modules/chat/infrastructure/message.model';
import { ComplaintEventModel } from '../modules/complaints/infrastructure/complaint-event.model';
import { ComplaintModel } from '../modules/complaints/infrastructure/complaint.model';
import { EventRegistrationModel } from '../modules/events/infrastructure/event-registration.model';
import { EventModel } from '../modules/events/infrastructure/event.model';
import { LostFoundClaimModel } from '../modules/lost-found/infrastructure/lost-found-claim.model';
import { LostFoundModel } from '../modules/lost-found/infrastructure/lost-found.model';
import { ListingEngagementModel } from '../modules/marketplace/infrastructure/engagement.model';
import { ListingModel } from '../modules/marketplace/infrastructure/listing.model';
import { MarketplaceOfferModel } from '../modules/marketplace/infrastructure/offer.model';
import { NoticeModel } from '../modules/notices/infrastructure/notice.model';
import { NotificationModel } from '../modules/notifications/infrastructure/notification.model';
import { PushSubscriptionModel } from '../modules/notifications/infrastructure/push-subscription.model';
import { TenantModel } from '../modules/tenants/infrastructure/tenant.model';
import { UserModel } from '../modules/users/infrastructure/user.model';

const models = [
  AuditLogModel,
  SessionModel,
  ConversationModel,
  MessageModel,
  ComplaintEventModel,
  ComplaintModel,
  EventRegistrationModel,
  EventModel,
  LostFoundClaimModel,
  LostFoundModel,
  ListingEngagementModel,
  ListingModel,
  MarketplaceOfferModel,
  NoticeModel,
  NotificationModel,
  PushSubscriptionModel,
  TenantModel,
  UserModel,
];

async function createIndexes(): Promise<void> {
  await connectMongo();
  await Promise.all(models.map((model) => model.createIndexes()));
  await disconnectMongo();
}

void createIndexes().catch(async (error: unknown) => {
  await disconnectMongo();
  console.error('Could not create MongoDB indexes.', error);
  process.exit(1);
});
