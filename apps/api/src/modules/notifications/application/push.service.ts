import webpush from 'web-push';

import { env } from '../../../config/env';
import { AppError } from '../../../shared/errors/app-error';
import { logger } from '../../../observability/logger';
import { pushSubscriptionRepository } from '../infrastructure/push-subscription.repository';

const isPushConfigured = Boolean(env.VAPID_SUBJECT && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

if (isPushConfigured) {
  webpush.setVapidDetails(env.VAPID_SUBJECT!, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
}

export const pushService = {
  getConfiguration() {
    return { enabled: isPushConfigured, publicKey: isPushConfigured ? env.VAPID_PUBLIC_KEY : null };
  },

  subscribe(input: {
    tenantId: string;
    userId: string;
    endpoint: string;
    keys: { p256dh: string; auth: string };
    expirationTime?: number | null;
  }) {
    if (!isPushConfigured) {
      throw new AppError({
        statusCode: 503,
        code: 'PUSH_NOT_CONFIGURED',
        message: 'Browser push notifications are not configured for this environment.',
      });
    }
    return pushSubscriptionRepository.upsert(input);
  },

  unsubscribe(input: { tenantId: string; userId: string; endpoint: string }) {
    return pushSubscriptionRepository.removeOwned(input.tenantId, input.userId, input.endpoint);
  },

  async send(input: { tenantId: string; recipientId: string; title: string; body: string; link?: string }): Promise<void> {
    if (!isPushConfigured) return;
    const subscriptions = await pushSubscriptionRepository.findForRecipient(input.tenantId, input.recipientId);
    await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            { endpoint: subscription.endpoint, keys: subscription.keys },
            JSON.stringify({ title: input.title, body: input.body, link: input.link ?? '/notifications' }),
            { TTL: 60 * 60 },
          );
        } catch (error) {
          const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error ? error.statusCode : undefined;
          if (statusCode === 404 || statusCode === 410) {
            await pushSubscriptionRepository.removeByEndpoint(subscription.endpoint);
            return;
          }
          logger.warn({ err: error, recipientId: input.recipientId }, 'Push delivery failed');
        }
      }),
    );
  },
};
