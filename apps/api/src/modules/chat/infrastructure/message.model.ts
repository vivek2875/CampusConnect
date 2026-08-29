import { Schema, model, models, type HydratedDocument, type Types } from 'mongoose';
interface MessagePersistence {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  text?: string;
  image?: { publicId: string; url: string };
  readAt?: Date;
  createdAt: Date;
}
const imageSchema = new Schema<{ publicId: string; url: string }>(
  { publicId: { type: String, required: true }, url: { type: String, required: true } },
  { _id: false },
);
const messageSchema = new Schema<MessagePersistence>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, immutable: true },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, immutable: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    text: { type: String, trim: true, maxlength: 2_000 },
    image: { type: imageSchema },
    readAt: { type: Date },
    createdAt: { type: Date, default: Date.now, immutable: true },
  },
  { versionKey: false },
);
messageSchema.index({ tenantId: 1, conversationId: 1, createdAt: -1, _id: -1 });
messageSchema.index({ tenantId: 1, conversationId: 1, senderId: 1, readAt: 1 });
export type MessageDocument = HydratedDocument<MessagePersistence>;
export const MessageModel = models.Message ?? model<MessagePersistence>('Message', messageSchema);
