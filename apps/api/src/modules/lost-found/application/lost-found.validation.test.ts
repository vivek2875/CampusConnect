import { describe, expect, it } from 'vitest';
import { claimSchema, createItemSchema } from './lost-found.validation';

describe('Lost & Found validation', () => {
  it('enforces ownership verification details for claims', () => {
    expect(
      claimSchema.safeParse({ body: { verificationDetails: 'short' }, params: { itemId: '64f2036e9158996b91bb4f91' }, query: {} }).success,
    ).toBe(false);
    expect(
      claimSchema.safeParse({
        body: { verificationDetails: 'The bottle has a small red sticker below the lid.' },
        params: { itemId: '64f2036e9158996b91bb4f91' },
        query: {},
      }).success,
    ).toBe(true);
  });

  it('limits submitted item images', () => {
    const images = Array.from({ length: 7 }, (_, index) => ({ publicId: `lost-found/test-user/image-${index}` }));
    expect(
      createItemSchema.safeParse({
        body: {
          type: 'found',
          title: 'Blue bottle',
          description: 'A blue bottle left beside the north library entrance.',
          location: 'North library',
          images,
        },
        params: {},
        query: {},
      }).success,
    ).toBe(false);
  });
});
