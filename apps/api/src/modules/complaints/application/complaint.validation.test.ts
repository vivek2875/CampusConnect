import { describe, expect, it } from 'vitest';
import { createComplaintSchema, updateComplaintStatusSchema } from './complaint.validation';

describe('Complaint validation', () => {
  it('rejects duplicate image public IDs', () => {
    const result = createComplaintSchema.safeParse({
      body: {
        title: 'No power in room',
        description: 'The ceiling light has been off since last night.',
        department: 'electrical',
        images: [{ publicId: 'complaints/test-user/first-image' }, { publicId: 'complaints/test-user/first-image' }],
      },
      params: {},
      query: {},
    });
    expect(result.success).toBe(false);
  });

  it('accepts the configured academic complaint departments', () => {
    const result = createComplaintSchema.safeParse({
      body: {
        title: 'Computer lab projector issue',
        description: 'The projector in the CSE laboratory is not turning on for class.',
        department: 'cse',
        images: [],
      },
      params: {},
      query: {},
    });

    expect(result.success).toBe(true);
  });

  it('accepts only defined complaint states', () => {
    expect(
      updateComplaintStatusSchema.safeParse({
        body: { status: 'resolved' },
        params: { complaintId: '64f2036e9158996b91bb4f91' },
        query: {},
      }).success,
    ).toBe(true);
    expect(
      updateComplaintStatusSchema.safeParse({ body: { status: 'deleted' }, params: { complaintId: '64f2036e9158996b91bb4f91' }, query: {} })
        .success,
    ).toBe(false);
  });
});
