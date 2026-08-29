import { Schema, model, models, type HydratedDocument, type Types } from 'mongoose';
interface ConversationPersistence {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  participantIds: Types.ObjectId[];
  participantKey: string;
  contextKey: string;
  listingId?: Types.ObjectId;
  lastMessagePreview?: string;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
const conversationSchema = new Schema<ConversationPersistence>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, immutable: true },
    participantIds: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      required: true,
      immutable: true,
      validate: [(values: Types.ObjectId[]) => values.length === 2, 'Direct conversations require exactly two participants.'],
    },
    participantKey: { type: String, required: true, immutable: true },
    contextKey: { type: String, required: true, immutable: true },
    listingId: { type: Schema.Types.ObjectId, ref: 'MarketplaceListing', immutable: true },
    lastMessagePreview: { type: String, maxlength: 200 },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);
conversationSchema.index({ tenantId: 1, participantKey: 1, contextKey: 1 }, { unique: true });
conversationSchema.index({ tenantId: 1, participantIds: 1, lastMessageAt: -1, _id: -1 });
export type ConversationDocument = HydratedDocument<ConversationPersistence>;
export const ConversationModel = models.Conversation ?? model<ConversationPersistence>('Conversation', conversationSchema);
