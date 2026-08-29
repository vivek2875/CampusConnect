import type { NotificationType } from '../domain/notification.types';
import { env } from '../../../config/env';
import { logger } from '../../../observability/logger';
import { sendEmail } from '../../../shared/communications/email.service';
import { userRepository } from '../../users/infrastructure/user.repository';
import { notificationRepository } from '../infrastructure/notification.repository';
import { pushService } from './push.service';
import { decodeCursor, encodeCursor } from '../../../shared/pagination/cursor';

export const notificationService = {
  create(input: { tenantId: string; recipientId: string; type: NotificationType; title: string; body: string; link?: string }): void {
    void deliverNotification(input);
  },
  async list(input: { tenantId: string; recipientId: string; limit: number; cursor?: string }) {
    const result = await notificationRepository.findPage({
      tenantId: input.tenantId,
      recipientId: input.recipientId,
      limit: input.limit,
      ...(input.cursor ? { cursor: decodeCursor(input.cursor) } : {}),
    });
    return {
      notifications: result.notifications.map(toNotification),
      nextCursor: result.nextCursor ? encodeCursor(result.nextCursor) : undefined,
    };
  },
  async markRead(input: { tenantId: string; recipientId: string; notificationId: string }) {
    const result = await notificationRepository.markRead(input.tenantId, input.recipientId, input.notificationId);
    return result ? toNotification(result) : null;
  },
};

const emailEligibleTypes = new Set<NotificationType>(['complaint_assigned', 'complaint_updated', 'event_registration', 'lost_found_claim']);

async function deliverNotification(input: {
  tenantId: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}): Promise<void> {
  try {
    await notificationRepository.create(input);
    await pushService.send(input);
    if (!emailEligibleTypes.has(input.type)) return;

    const recipient = await userRepository.findById(input.recipientId);
    if (!recipient || recipient.status !== 'active' || recipient.tenantId.toString() !== input.tenantId) return;
    await sendEmail({
      to: recipient.email,
      subject: `CampusConnect: ${input.title}`,
      text: `${input.body}${input.link ? `\n\nOpen CampusConnect: ${env.CLIENT_ORIGIN}${input.link}` : ''}`,
    });
  } catch (error) {
    logger.error({ err: error, notificationType: input.type, recipientId: input.recipientId }, 'Notification delivery failed');
  }
}
function toNotification(
  notification: Awaited<ReturnType<typeof notificationRepository.markRead>> extends infer T ? Exclude<T, null> : never,
) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    link: notification.link ?? null,
    readAt: notification.readAt ?? null,
    createdAt: notification.createdAt,
  };
}
