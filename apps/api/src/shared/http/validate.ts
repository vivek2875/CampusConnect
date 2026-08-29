import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

export function validate(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    const parsed = schema.safeParse({
      body: request.body ?? {},
      params: request.params,
      query: request.query,
    });

    if (!parsed.success) {
      return next(parsed.error);
    }

    request.body = parsed.data.body;
    request.params = parsed.data.params;
    // Express 5 exposes `query` through a read-only getter. Defining an own
    // property preserves the sanitized, coerced query for downstream handlers.
    Object.defineProperty(request, 'query', {
      configurable: true,
      enumerable: true,
      value: parsed.data.query,
      writable: false,
    });
    return next();
  };
}
