import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';

import { trustServerQuery } from './trusted-query';

describe('trustServerQuery', () => {
  it('preserves server-created query operators while sanitizeFilter remains enabled', () => {
    const expiresAt = new Date();
    const filter = trustServerQuery({
      status: { $in: ['active', 'reserved'] },
      expiresAt: { $gt: expiresAt },
      $or: [{ archivedAt: { $exists: false } }],
    });

    mongoose.sanitizeFilter(filter);

    expect(filter.status).toMatchObject({ $in: ['active', 'reserved'] });
    expect(filter.expiresAt).toMatchObject({ $gt: expiresAt });
    expect(filter.$or).toMatchObject([{ archivedAt: { $exists: false } }]);
  });

  it('allows server-created text and expression operators', () => {
    const filter = trustServerQuery({
      $text: { $search: 'study table' },
      $expr: { $lt: ['$registrationCount', '$capacity'] },
    });

    mongoose.sanitizeFilter(filter);

    expect(filter.$text).toMatchObject({ $search: 'study table' });
    expect(filter.$expr).toMatchObject({ $lt: ['$registrationCount', '$capacity'] });
  });
});
