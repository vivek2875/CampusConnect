import mongoose, { type ClientSession } from 'mongoose';

export async function withTransaction<T>(operation: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await operation(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}
