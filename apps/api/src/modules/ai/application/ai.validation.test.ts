import { describe, expect, it } from 'vitest';
import { assistantSchema } from './ai.validation';

describe('Assistant validation', () => {
  it('accepts a legacy single question and a bounded conversation', () => {
    expect(assistantSchema.safeParse({ body: { question: 'How do I file a complaint?' }, params: {}, query: {} }).success).toBe(true);
    expect(
      assistantSchema.safeParse({
        body: {
          messages: [
            { role: 'assistant', content: 'How can I help?' },
            { role: 'user', content: 'How do I file a complaint?' },
          ],
        },
        params: {},
        query: {},
      }).success,
    ).toBe(true);
  });

  it('rejects ambiguous requests and conversations without a final user question', () => {
    expect(
      assistantSchema.safeParse({ body: { question: 'Hello', messages: [{ role: 'user', content: 'Hello' }] }, params: {}, query: {} })
        .success,
    ).toBe(false);
    expect(
      assistantSchema.safeParse({ body: { messages: [{ role: 'assistant', content: 'Hello' }] }, params: {}, query: {} }).success,
    ).toBe(false);
  });
});
