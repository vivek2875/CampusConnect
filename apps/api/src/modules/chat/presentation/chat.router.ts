import { Router } from 'express';
import { requireAuth } from '../../../shared/auth/require-auth';
import { AppError } from '../../../shared/errors/app-error';
import { asyncHandler } from '../../../shared/http/async-handler';
import { emptyRequestSchema } from '../../../shared/http/empty-request-schema';
import { validate } from '../../../shared/http/validate';
import { requireCsrf } from '../../../shared/security/csrf';
import { createChatUploadSignature } from '../../../shared/storage/cloudinary';
import { chatService } from '../application/chat.service';
import {
  conversationIdSchema,
  chatRecipientPageSchema,
  conversationPageSchema,
  createConversationSchema,
  messagePageSchema,
  sendMessageSchema,
} from '../application/chat.validation';
export const chatRouter = Router();
chatRouter.post(
  '/chat/uploads/signature',
  requireAuth,
  requireCsrf,
  validate(emptyRequestSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    response.status(200).json({ data: createChatUploadSignature({ tenantId: auth.tenantId, userId: auth.userId }) });
  }),
);
chatRouter.get(
  '/chat/recipients',
  requireAuth,
  validate(chatRecipientPageSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    const limit = Number(request.query.limit);
    const query = String(request.query.query);
    response.status(200).json({
      data: await chatService.searchRecipients({ tenantId: auth.tenantId, userId: auth.userId, query, limit }),
    });
  }),
);
chatRouter.get(
  '/conversations',
  requireAuth,
  validate(conversationPageSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    const limit = Number(request.query.limit);
    const cursor = typeof request.query.cursor === 'string' ? request.query.cursor : undefined;
    const result = await chatService.listConversations({
      tenantId: auth.tenantId,
      userId: auth.userId,
      limit,
      ...(cursor ? { cursor } : {}),
    });
    response.status(200).json({ data: result.conversations, meta: { limit, nextCursor: result.nextCursor ?? null } });
  }),
);
chatRouter.post(
  '/conversations',
  requireAuth,
  requireCsrf,
  validate(createConversationSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    response
      .status(201)
      .json({ data: await chatService.createConversation({ tenantId: auth.tenantId, userId: auth.userId, ...request.body }) });
  }),
);
chatRouter.get(
  '/conversations/:conversationId/messages',
  requireAuth,
  validate(messagePageSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    const limit = Number(request.query.limit);
    const cursor = typeof request.query.cursor === 'string' ? request.query.cursor : undefined;
    const result = await chatService.listMessages({
      tenantId: auth.tenantId,
      userId: auth.userId,
      conversationId: String(request.params.conversationId),
      limit,
      ...(cursor ? { cursor } : {}),
    });
    response.status(200).json({ data: result.messages, meta: { limit, nextCursor: result.nextCursor ?? null } });
  }),
);
chatRouter.post(
  '/conversations/:conversationId/messages',
  requireAuth,
  requireCsrf,
  validate(sendMessageSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    const result = await chatService.sendMessage({
      tenantId: auth.tenantId,
      userId: auth.userId,
      conversationId: String(request.params.conversationId),
      ...request.body,
    });
    response.status(201).json({ data: result.message });
  }),
);
chatRouter.patch(
  '/conversations/:conversationId/read',
  requireAuth,
  requireCsrf,
  validate(conversationIdSchema),
  asyncHandler(async (request, response) => {
    const auth = getAuth(request);
    await chatService.markRead({ tenantId: auth.tenantId, userId: auth.userId, conversationId: String(request.params.conversationId) });
    response.status(204).send();
  }),
);
function getAuth(request: Parameters<typeof requireAuth>[0]) {
  if (!request.auth) throw new AppError({ statusCode: 401, code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.' });
  return request.auth;
}
