import { Types } from 'mongoose';
import { trustServerQuery } from '../../../shared/persistence/trusted-query';
import { ConversationModel, type ConversationDocument } from './conversation.model';
import { MessageModel, type MessageDocument } from './message.model';
export const chatRepository = {
  findOrCreateConversation(input: {
    tenantId: string;
    participantIds: string[];
    contextKey: string;
    listingId?: string;
  }): Promise<ConversationDocument> {
    const participantKey = [...input.participantIds].sort().join(':');
    return ConversationModel.findOneAndUpdate(
      { tenantId: new Types.ObjectId(input.tenantId), participantKey, contextKey: input.contextKey },
      {
        $setOnInsert: {
          tenantId: new Types.ObjectId(input.tenantId),
          participantIds: input.participantIds.map((id) => new Types.ObjectId(id)),
          participantKey,
          contextKey: input.contextKey,
          ...(input.listingId ? { listingId: new Types.ObjectId(input.listingId) } : {}),
          lastMessageAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).exec();
  },
  findForParticipant(tenantId: string, conversationId: string, userId: string): Promise<ConversationDocument | null> {
    return ConversationModel.findOne({
      _id: conversationId,
      tenantId: new Types.ObjectId(tenantId),
      participantIds: new Types.ObjectId(userId),
    }).exec();
  },
  async listForParticipant(input: { tenantId: string; userId: string; limit: number; cursor?: { lastMessageAt: Date; id: string } }) {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(input.tenantId),
      participantIds: new Types.ObjectId(input.userId),
    };
    if (input.cursor)
      filter.$or = [
        { lastMessageAt: { $lt: input.cursor.lastMessageAt } },
        { lastMessageAt: input.cursor.lastMessageAt, _id: { $lt: new Types.ObjectId(input.cursor.id) } },
      ];
    const conversations = await ConversationModel.find(trustServerQuery(filter))
      .sort({ lastMessageAt: -1, _id: -1 })
      .limit(input.limit + 1)
      .exec();
    const page = conversations.slice(0, input.limit);
    const last = page.at(-1);
    return {
      conversations: page,
      ...(conversations.length > input.limit && last ? { nextCursor: { lastMessageAt: last.lastMessageAt, id: last.id } } : {}),
    };
  },
  createMessage(input: {
    tenantId: string;
    conversationId: string;
    senderId: string;
    text?: string;
    image?: { publicId: string; url: string };
  }): Promise<MessageDocument> {
    return MessageModel.create({
      ...input,
      tenantId: new Types.ObjectId(input.tenantId),
      conversationId: new Types.ObjectId(input.conversationId),
      senderId: new Types.ObjectId(input.senderId),
    });
  },
  touchConversation(tenantId: string, conversationId: string, preview: string) {
    return ConversationModel.updateOne(
      { _id: conversationId, tenantId: new Types.ObjectId(tenantId) },
      { $set: { lastMessageAt: new Date(), lastMessagePreview: preview } },
    ).exec();
  },
  async listMessages(input: { tenantId: string; conversationId: string; limit: number; cursor?: { createdAt: Date; id: string } }) {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(input.tenantId),
      conversationId: new Types.ObjectId(input.conversationId),
    };
    if (input.cursor)
      filter.$or = [
        { createdAt: { $lt: input.cursor.createdAt } },
        { createdAt: input.cursor.createdAt, _id: { $lt: new Types.ObjectId(input.cursor.id) } },
      ];
    const messages = await MessageModel.find(trustServerQuery(filter))
      .sort({ createdAt: -1, _id: -1 })
      .limit(input.limit + 1)
      .exec();
    const page = messages.slice(0, input.limit);
    const last = page.at(-1);
    return {
      messages: page.reverse(),
      ...(messages.length > input.limit && last ? { nextCursor: { createdAt: last.createdAt, id: last.id } } : {}),
    };
  },
  markRead(tenantId: string, conversationId: string, readerId: string) {
    return MessageModel.updateMany(
      trustServerQuery({
        tenantId: new Types.ObjectId(tenantId),
        conversationId: new Types.ObjectId(conversationId),
        senderId: { $ne: new Types.ObjectId(readerId) },
        readAt: { $exists: false },
      }),
      { $set: { readAt: new Date() } },
    ).exec();
  },
};
