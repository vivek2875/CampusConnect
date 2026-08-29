import { AppError } from '../../../shared/errors/app-error';
export interface EventCursor {
  startsAt: Date;
  id: string;
}
export function encodeEventCursor(cursor: EventCursor) {
  return Buffer.from(JSON.stringify({ startsAt: cursor.startsAt.toISOString(), id: cursor.id })).toString('base64url');
}
export function decodeEventCursor(value: string): EventCursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('startsAt' in parsed) ||
      !('id' in parsed) ||
      typeof parsed.startsAt !== 'string' ||
      typeof parsed.id !== 'string' ||
      !/^[a-f\d]{24}$/i.test(parsed.id)
    )
      throw new Error('Invalid cursor');
    const startsAt = new Date(parsed.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new Error('Invalid date');
    return { startsAt, id: parsed.id };
  } catch {
    throw new AppError({ statusCode: 400, code: 'INVALID_CURSOR', message: 'The pagination cursor is invalid.' });
  }
}
