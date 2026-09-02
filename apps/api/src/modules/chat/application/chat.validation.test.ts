import { describe, expect, it } from 'vitest';
import { chatRecipientPageSchema } from './chat.validation';

describe('Chat recipient search validation', () => {
  it('accepts a bounded member search query', () => {
    const result = chatRecipientPageSchema.safeParse({ body: {}, params: {}, query: { query: 'Vivek', limit: '10' } });

    expect(result.success).toBe(true);
  });

  it('rejects short queries and unbounded page sizes', () => {
    expect(chatRecipientPageSchema.safeParse({ body: {}, params: {}, query: { query: 'V' } }).success).toBe(false);
    expect(chatRecipientPageSchema.safeParse({ body: {}, params: {}, query: { query: 'Vivek', limit: '21' } }).success).toBe(false);
  });
});
