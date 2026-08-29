import { AppError } from '../../../shared/errors/app-error';
export function encodeNoticeCursor(value: { publishedAt: Date; id: string }) {
  return Buffer.from(JSON.stringify({ publishedAt: value.publishedAt.toISOString(), id: value.id })).toString('base64url');
}
export function decodeNoticeCursor(value: string) {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('publishedAt' in parsed) ||
      !('id' in parsed) ||
      typeof parsed.publishedAt !== 'string' ||
      typeof parsed.id !== 'string' ||
      !/^[a-f\d]{24}$/i.test(parsed.id)
    )
      throw new Error('invalid');
    const publishedAt = new Date(parsed.publishedAt);
    if (Number.isNaN(publishedAt.getTime())) throw new Error('invalid');
    return { publishedAt, id: parsed.id };
  } catch {
    throw new AppError({ statusCode: 400, code: 'INVALID_CURSOR', message: 'The pagination cursor is invalid.' });
  }
}
