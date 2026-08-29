import { AppError } from '../errors/app-error';

export interface CursorPosition {
  createdAt: Date;
  id: string;
}
export function encodeCursor(cursor: CursorPosition): string {
  return Buffer.from(JSON.stringify({ createdAt: cursor.createdAt.toISOString(), id: cursor.id })).toString('base64url');
}
export function decodeCursor(value: string): CursorPosition {
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
      throw new Error('Invalid cursor');
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) throw new Error('Invalid date');
    return { createdAt, id: parsed.id };
  } catch {
    throw new AppError({ statusCode: 400, code: 'INVALID_CURSOR', message: 'The pagination cursor is invalid.' });
  }
}
