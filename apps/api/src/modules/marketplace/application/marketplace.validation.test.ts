import { describe, expect, it } from 'vitest';

import { createListingSchema, listListingsSchema, recommendationsSchema } from './marketplace.validation';

describe('Marketplace validation', () => {
  it('rejects duplicate image references and malformed listing payloads', () => {
    const result = createListingSchema.safeParse({
      body: {
        title: 'Scientific calculator',
        description: 'A reliable calculator used for one semester.',
        category: 'electronics',
        condition: 'good',
        price: { amountMinor: 125000, currency: 'INR' },
        images: [{ publicId: 'campusconnect/example/image' }, { publicId: 'campusconnect/example/image' }],
      },
      params: {},
      query: {},
    });

    expect(result.success).toBe(false);
  });

  it('coerces a valid page query and rejects inverted price ranges', () => {
    const valid = listListingsSchema.safeParse({ body: {}, params: {}, query: { limit: '10', minPrice: '100', maxPrice: '500' } });
    const invalid = listListingsSchema.safeParse({ body: {}, params: {}, query: { minPrice: '500', maxPrice: '100' } });

    expect(valid.success && valid.data.query.limit).toBe(10);
    expect(invalid.success).toBe(false);
  });

  it('bounds recommendation feed requests', () => {
    expect(recommendationsSchema.safeParse({ body: {}, params: {}, query: { limit: '8' } }).success).toBe(true);
    expect(recommendationsSchema.safeParse({ body: {}, params: {}, query: { limit: '21' } }).success).toBe(false);
  });
});
