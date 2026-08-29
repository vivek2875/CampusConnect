import mongoose from 'mongoose';

import { env } from '../../config/env';
import { logger } from '../../observability/logger';

export async function connectMongo(): Promise<void> {
  mongoose.set('strictQuery', true);
  mongoose.set('sanitizeFilter', true);

  await mongoose.connect(env.MONGODB_URI, {
    autoIndex: env.NODE_ENV !== 'production' || env.INITIALIZE_DATABASE_ON_START,
    maxPoolSize: 30,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5_000,
  });

  logger.info({ host: mongoose.connection.host, database: mongoose.connection.name }, 'MongoDB connected');
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
