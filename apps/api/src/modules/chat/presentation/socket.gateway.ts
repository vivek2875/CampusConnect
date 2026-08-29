import type { Server as HttpServer } from 'node:http';
import { createAdapter } from '@socket.io/redis-adapter';
import { Server } from 'socket.io';
import { env } from '../../../config/env';
import { logger } from '../../../observability/logger';
import { getAuthorizationState } from '../../../shared/auth/auth-state-cache';
import { redis } from '../../../shared/cache/redis';
import { verifyAccessToken } from '../../../shared/security/jwt';
import { chatService } from '../application/chat.service';

export async function createChatGateway(server: HttpServer): Promise<Server> {
  const io = new Server(server, {
    cors: { origin: env.CLIENT_ORIGIN, credentials: true, methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });
  const publisher = redis.duplicate();
  const subscriber = redis.duplicate();
  await Promise.all([publisher.connect(), subscriber.connect()]);
  io.adapter(createAdapter(publisher, subscriber));
  io.use(async (socket, next) => {
    try {
      const token = typeof socket.handshake.auth.token === 'string' ? socket.handshake.auth.token : '';
      const auth = verifyAccessToken(token);
      const state = await getAuthorizationState(auth.userId);
      if (!state || state.status !== 'active' || state.tenantId !== auth.tenantId || state.authVersion !== auth.authVersion)
        return next(new Error('Authentication failed'));
      socket.data.auth = auth;
      return next();
    } catch {
      return next(new Error('Authentication failed'));
    }
  });
  io.on('connection', (socket) => {
    const auth = socket.data.auth as { userId: string; tenantId: string };
    socket.join(`user:${auth.userId}`);
    socket.on('conversation:join', async ({ conversationId }: { conversationId: string }, acknowledge?: (value: unknown) => void) => {
      try {
        await chatService.verifyConversationAccess({ tenantId: auth.tenantId, userId: auth.userId, conversationId });
        socket.join(`conversation:${conversationId}`);
        acknowledge?.({ ok: true });
      } catch (error) {
        acknowledge?.({ ok: false, message: error instanceof Error ? error.message : 'Unable to join conversation.' });
      }
    });
    socket.on(
      'message:send',
      async (payload: { conversationId: string; text?: string; imagePublicId?: string }, acknowledge?: (value: unknown) => void) => {
        try {
          const result = await chatService.sendMessage({ tenantId: auth.tenantId, userId: auth.userId, ...payload });
          io.to(`conversation:${payload.conversationId}`).emit('message:new', {
            ...result.message,
            conversationId: payload.conversationId,
          });
          result.participantIds.forEach((participantId) =>
            io.to(`user:${participantId}`).emit('conversation:updated', { conversationId: payload.conversationId }),
          );
          acknowledge?.({ ok: true, message: result.message });
        } catch (error) {
          logger.warn({ err: error, userId: auth.userId }, 'Socket message failed');
          acknowledge?.({ ok: false, message: error instanceof Error ? error.message : 'Unable to send message.' });
        }
      },
    );
    socket.on('typing:start', ({ conversationId }: { conversationId: string }) => {
      void emitTyping('typing:start', conversationId);
    });
    socket.on('typing:stop', ({ conversationId }: { conversationId: string }) => {
      void emitTyping('typing:stop', conversationId);
    });
    socket.on('messages:read', async ({ conversationId }: { conversationId: string }) => {
      try {
        await chatService.markRead({ tenantId: auth.tenantId, userId: auth.userId, conversationId });
        socket.to(`conversation:${conversationId}`).emit('messages:read', { conversationId, userId: auth.userId });
      } catch {
        /* Invalid room events are intentionally ignored. */
      }
    });
    async function emitTyping(event: 'typing:start' | 'typing:stop', conversationId: string) {
      try {
        await chatService.verifyConversationAccess({ tenantId: auth.tenantId, userId: auth.userId, conversationId });
        socket.to(`conversation:${conversationId}`).emit(event, { conversationId, userId: auth.userId });
      } catch {
        /* Invalid typing events are intentionally ignored. */
      }
    }
  });
  return io;
}
