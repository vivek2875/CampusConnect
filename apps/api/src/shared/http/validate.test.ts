import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { validate } from './validate';

describe('validate', () => {
  it('normalizes an absent JSON body to an empty object', () => {
    const request = {
      body: undefined,
      params: {},
      get query() {
        return {};
      },
    } as unknown as Request;
    const next = vi.fn();
    const schema = z.object({ body: z.object({}).strict(), params: z.object({}).strict(), query: z.object({}).strict() });

    validate(schema)(request, {} as never, next);

    expect(next).toHaveBeenCalledWith();
    expect(request.body).toEqual({});
  });

  it('preserves a coerced query when Express exposes it as a read-only getter', () => {
    const query = { limit: '10' };
    const request = {
      body: {},
      params: {},
      get query() {
        return query;
      },
    } as unknown as Request;
    const next = vi.fn();
    const schema = z.object({
      body: z.object({}).strict(),
      params: z.object({}).strict(),
      query: z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) }).strict(),
    });

    validate(schema)(request, {} as never, next);

    expect(next).toHaveBeenCalledWith();
    expect(request.query).toEqual({ limit: 10 });
  });
});
