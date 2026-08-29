import mongoose from 'mongoose';

/**
 * Marks operators in a filter constructed by repository code as safe for
 * Mongoose's sanitizeFilter protection. Do not pass request bodies or other
 * unvalidated client input to this helper.
 */
export function trustServerQuery<T extends Record<string, unknown>>(filter: T): T {
  markOperatorObjects(filter, new Set<object>());
  return filter;
}

function markOperatorObjects(value: unknown, visited: Set<object>): void {
  if (!value || typeof value !== 'object' || value instanceof Date || value instanceof mongoose.Types.ObjectId) return;
  if (visited.has(value)) return;
  visited.add(value);

  if (Array.isArray(value)) {
    value.forEach((entry) => markOperatorObjects(entry, visited));
    return;
  }

  const record = value as Record<string, unknown>;
  Object.values(record).forEach((entry) => markOperatorObjects(entry, visited));
  if (Object.keys(record).some((key) => key.startsWith('$'))) mongoose.trusted(record);
}
