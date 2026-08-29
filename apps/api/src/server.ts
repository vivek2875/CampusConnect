import http from 'node:http';

import { app } from './app';
import { createChatGateway } from './modules/chat/presentation/socket.gateway';
import { ensureDefaultTenant } from './modules/tenants/application/tenant-bootstrap';
import { env } from './config/env';
import { logger } from './observability/logger';
import { connectRedis, disconnectRedis } from './shared/cache/redis';
import { connectMongo, disconnectMongo } from './shared/persistence/mongo';

async function start(): Promise<void> {
  await connectMongo();
  await connectRedis();
  if (env.INITIALIZE_DATABASE_ON_START) {
    const tenant = await ensureDefaultTenant();
    logger.info({ tenantId: tenant.id, slug: tenant.slug }, 'Demo tenant is ready');
  }

  const server = http.createServer(app);
  const io = await createChatGateway(server);
  server.listen(env.PORT, () => logger.info({ port: env.PORT }, 'CampusConnect API is listening'));

  let stopping = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, 'Graceful shutdown started');

    server.close(async (error) => {
      if (error) logger.error({ err: error }, 'HTTP server closed with an error');
      await Promise.allSettled([io.close(), disconnectMongo(), disconnectRedis()]);
      process.exit(error ? 1 : 0);
    });

    setTimeout(() => {
      logger.fatal('Graceful shutdown timed out');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void start().catch((error: unknown) => {
  logger.fatal({ err: error }, 'CampusConnect API failed to start');
  process.exit(1);
});
