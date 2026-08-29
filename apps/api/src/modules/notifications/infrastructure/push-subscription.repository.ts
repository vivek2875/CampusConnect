import { Types } from 'mongoose';

import { PushSubscriptionModel, type PushSubscriptionDocument } from './push-subscription.model';

export const pushSubscriptionRepository = {
  upsert(input: {
    tenantId: string;
    userId: string;
    endpoint: string;
    keys: { p256dh: string; auth: string };
    expirationTime?: number | null;
  }) {
    const tenantId = new Types.ObjectId(input.tenantId);
    const userId = new Types.ObjectId(input.userId);
    return PushSubscriptionModel.findOneAndUpdate(
      { endpoint: input.endpoint, tenantId, userId },
      {
        $set: {
          tenantId,
          userId,
          keys: input.keys,
          ...(input.expirationTime !== undefined ? { expirationTime: input.expirationTime } : {}),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();
  },
  findForRecipient(tenantId: string, userId: string): Promise<PushSubscriptionDocument[]> {
    return PushSubscriptionModel.find({ tenantId: new Types.ObjectId(tenantId), userId: new Types.ObjectId(userId) }).exec();
  },
  removeOwned(tenantId: string, userId: string, endpoint: string): Promise<void> {
    return PushSubscriptionModel.deleteOne({ tenantId: new Types.ObjectId(tenantId), userId: new Types.ObjectId(userId), endpoint })
      .exec()
      .then(() => undefined);
  },
  removeByEndpoint(endpoint: string): Promise<void> {
    return PushSubscriptionModel.deleteOne({ endpoint })
      .exec()
      .then(() => undefined);
  },
};
