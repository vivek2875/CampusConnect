import { AppError } from '../../../shared/errors/app-error';
import { createChatImageUrl, createChatUploadSignature, isChatAssetOwnedByUser } from '../../../shared/storage/cloudinary';
import { notificationService } from '../../notifications/application/notification.service';
import { userRepository } from '../../users/infrastructure/user.repository';
import { listingRepository } from '../../marketplace/infrastructure/listing.repository';
import { chatRepository } from '../infrastructure/chat.repository';

export const chatService = {
  getUploadSignature: createChatUploadSignature,
  async searchRecipients(input: { tenantId: string; userId: string; query: string; limit: number }) {
    const users = await userRepository.findActiveChatRecipients({
      tenantId: input.tenantId,
      excludedUserId: input.userId,
      query: input.query,
      limit: input.limit,
    });
    return users.map((user) => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      emailVerified: Boolean(user.emailVerifiedAt),
    }));
  },
  async createConversation(input: { tenantId: string; userId: string; recipientId?: string; listingId?: string }) {
    let recipientId = input.recipientId;
    if (input.listingId) {
      const listing = await listingRepository.findVisibleById(input.tenantId, input.listingId);
      if (!listing) throw new AppError({ statusCode: 404, code: 'LISTING_NOT_FOUND', message: 'Listing not found.' });
      recipientId = listing.sellerId.toString();
    }
    if (!recipientId || recipientId === input.userId)
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_CONVERSATION_PARTICIPANTS',
        message: 'Choose another campus member to start a conversation.',
      });
    const recipient = await userRepository.findById(recipientId);
    if (!recipient || recipient.tenantId.toString() !== input.tenantId || recipient.status !== 'active')
      throw new AppError({ statusCode: 404, code: 'RECIPIENT_NOT_FOUND', message: 'Recipient not found.' });
    return serializeConversation(
      await chatRepository.findOrCreateConversation({
        tenantId: input.tenantId,
        participantIds: [input.userId, recipientId],
        contextKey: input.listingId ? `marketplace:${input.listingId}` : 'direct',
        ...(input.listingId ? { listingId: input.listingId } : {}),
      }),
      input.userId,
      input.tenantId,
    );
  },
  async listConversations(input: { tenantId: string; userId: string; limit: number; cursor?: string }) {
    const result = await chatRepository.listForParticipant({
      tenantId: input.tenantId,
      userId: input.userId,
      limit: input.limit,
      ...(input.cursor ? { cursor: decodeConversationCursor(input.cursor) } : {}),
    });
    return {
      conversations: await Promise.all(
        result.conversations.map((conversation) => serializeConversation(conversation, input.userId, input.tenantId)),
      ),
      nextCursor: result.nextCursor ? encodeConversationCursor(result.nextCursor) : undefined,
    };
  },
  async listMessages(input: { tenantId: string; userId: string; conversationId: string; limit: number; cursor?: string }) {
    await requireConversation(input);
    const result = await chatRepository.listMessages({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      limit: input.limit,
      ...(input.cursor ? { cursor: decodeMessageCursor(input.cursor) } : {}),
    });
    return { messages: result.messages.map(toMessage), nextCursor: result.nextCursor ? encodeMessageCursor(result.nextCursor) : undefined };
  },
  async sendMessage(input: { tenantId: string; userId: string; conversationId: string; text?: string; imagePublicId?: string }) {
    const conversation = await requireConversation(input);
    const text = input.text?.trim();
    if (!text && !input.imagePublicId)
      throw new AppError({ statusCode: 400, code: 'MESSAGE_EMPTY', message: 'A message needs text or an image.' });
    const image = input.imagePublicId ? ownedImage(input.imagePublicId, input) : undefined;
    const message = await chatRepository.createMessage({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      senderId: input.userId,
      ...(text ? { text } : {}),
      ...(image ? { image } : {}),
    });
    await chatRepository.touchConversation(input.tenantId, input.conversationId, text?.slice(0, 200) ?? 'Image');
    const recipientId = conversation.participantIds.map((id) => id.toString()).find((id) => id !== input.userId);
    if (recipientId)
      notificationService.create({
        tenantId: input.tenantId,
        recipientId,
        type: 'chat_message',
        title: 'New message',
        body: text?.slice(0, 120) ?? 'Sent an image',
        link: '/chat',
      });
    return { message: toMessage(message), participantIds: conversation.participantIds.map((id) => id.toString()) };
  },
  async markRead(input: { tenantId: string; userId: string; conversationId: string }) {
    await requireConversation(input);
    await chatRepository.markRead(input.tenantId, input.conversationId, input.userId);
  },
  async verifyConversationAccess(input: { tenantId: string; userId: string; conversationId: string }) {
    await requireConversation(input);
  },
};
async function requireConversation(input: { tenantId: string; userId: string; conversationId: string }) {
  const conversation = await chatRepository.findForParticipant(input.tenantId, input.conversationId, input.userId);
  if (!conversation) throw new AppError({ statusCode: 404, code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' });
  return conversation;
}
async function serializeConversation(
  conversation: Awaited<ReturnType<typeof chatRepository.findForParticipant>> extends infer T ? Exclude<T, null> : never,
  userId: string,
  tenantId: string,
) {
  const otherId = conversation.participantIds.map((id) => id.toString()).find((id) => id !== userId);
  const [other] = otherId ? await userRepository.findActiveByIds(tenantId, [otherId]) : [];
  return {
    id: conversation.id,
    listingId: conversation.listingId?.toString() ?? null,
    otherParticipant: other ? { id: other.id, firstName: other.firstName, lastName: other.lastName } : null,
    lastMessagePreview: conversation.lastMessagePreview ?? null,
    lastMessageAt: conversation.lastMessageAt,
  };
}
function ownedImage(publicId: string, input: { tenantId: string; userId: string }) {
  if (!isChatAssetOwnedByUser(publicId, input))
    throw new AppError({ statusCode: 403, code: 'MEDIA_OWNERSHIP_INVALID', message: 'The image does not belong to your account.' });
  return { publicId, url: createChatImageUrl(publicId) };
}
function toMessage(message: Awaited<ReturnType<typeof chatRepository.createMessage>>) {
  return {
    id: message.id,
    senderId: message.senderId.toString(),
    text: message.text ?? null,
    image: message.image ?? null,
    readAt: message.readAt ?? null,
    createdAt: message.createdAt,
  };
}
function encodeConversationCursor(cursor: { lastMessageAt: Date; id: string }) {
  return Buffer.from(JSON.stringify({ lastMessageAt: cursor.lastMessageAt.toISOString(), id: cursor.id })).toString('base64url');
}
function decodeConversationCursor(value: string) {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('lastMessageAt' in parsed) ||
      !('id' in parsed) ||
      typeof parsed.lastMessageAt !== 'string' ||
      typeof parsed.id !== 'string' ||
      !/^[a-f\d]{24}$/i.test(parsed.id)
    )
      throw new Error('invalid');
    const lastMessageAt = new Date(parsed.lastMessageAt);
    if (Number.isNaN(lastMessageAt.getTime())) throw new Error('invalid');
    return { lastMessageAt, id: parsed.id };
  } catch {
    throw new AppError({ statusCode: 400, code: 'INVALID_CURSOR', message: 'The pagination cursor is invalid.' });
  }
}
function encodeMessageCursor(cursor: { createdAt: Date; id: string }) {
  return Buffer.from(JSON.stringify({ createdAt: cursor.createdAt.toISOString(), id: cursor.id })).toString('base64url');
}
function decodeMessageCursor(value: string) {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('createdAt' in parsed) ||
      !('id' in parsed) ||
      typeof parsed.createdAt !== 'string' ||
      typeof parsed.id !== 'string' ||
      !/^[a-f\d]{24}$/i.test(parsed.id)
    )
      throw new Error('invalid');
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) throw new Error('invalid');
    return { createdAt, id: parsed.id };
  } catch {
    throw new AppError({ statusCode: 400, code: 'INVALID_CURSOR', message: 'The pagination cursor is invalid.' });
  }
}
