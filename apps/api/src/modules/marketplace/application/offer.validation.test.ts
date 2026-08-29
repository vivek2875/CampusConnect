import { describe, expect, it } from 'vitest';

import { createOfferSchema, offerPageSchema, updateOfferSchema } from './offer.validation';

describe('marketplace offer validation', () => {
  it('accepts a bounded monetary offer and an optional note', () => {
    const result = createOfferSchema.parse({
      body: { amountMinor: 12_500, message: 'Can collect it this evening.' },
      params: { listingId: '507f1f77bcf86cd799439011' },
      query: {},
    });

    expect(result.body.amountMinor).toBe(12_500);
  });

  it('rejects malformed monetary input and invalid offer actions', () => {
    expect(() =>
      createOfferSchema.parse({ body: { amountMinor: 0 }, params: { listingId: '507f1f77bcf86cd799439011' }, query: {} }),
    ).toThrow();
    expect(() =>
      updateOfferSchema.parse({ body: { status: 'expired' }, params: { offerId: '507f1f77bcf86cd799439011' }, query: {} }),
    ).toThrow();
  });

  it('applies safe pagination defaults', () => {
    const result = offerPageSchema.parse({ body: {}, params: {}, query: {} });

    expect(result.query).toMatchObject({ direction: 'incoming', limit: 20 });
  });
});
