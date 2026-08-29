import { describe, expect, it } from 'vitest';
import { createEventSchema } from './event.validation';

describe('Event validation', () => {
  it('requires a future registration deadline before the event', () => {
    const startsAt = new Date(Date.now() + 4 * 60 * 60 * 1_000);
    const valid = createEventSchema.safeParse({
      body: {
        title: 'Robotics meetup',
        description: 'Meet the campus robotics community and plan the next build.',
        location: 'Innovation lab',
        startsAt,
        endsAt: new Date(startsAt.getTime() + 60 * 60 * 1_000),
        registrationDeadline: new Date(Date.now() + 60 * 60 * 1_000),
        capacity: 50,
      },
      params: {},
      query: {},
    });
    const invalid = createEventSchema.safeParse({
      body: {
        title: 'Robotics meetup',
        description: 'Meet the campus robotics community and plan the next build.',
        location: 'Innovation lab',
        startsAt,
        endsAt: new Date(startsAt.getTime() + 60 * 60 * 1_000),
        registrationDeadline: new Date(startsAt.getTime() + 30 * 60 * 1_000),
        capacity: 50,
      },
      params: {},
      query: {},
    });
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });
});
