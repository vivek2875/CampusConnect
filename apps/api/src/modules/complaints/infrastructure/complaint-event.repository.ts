import { Types, type ClientSession } from 'mongoose';

import { trustServerQuery } from '../../../shared/persistence/trusted-query';
import { ComplaintEventModel } from './complaint-event.model';

export const complaintEventRepository = {
  create(input: {
    tenantId: string;
    complaintId: string;
    actorId: string;
    type: 'created' | 'assigned' | 'status_changed';
    payload: Record<string, string>;
    session?: ClientSession;
  }) {
    return ComplaintEventModel.create(
      [
        {
          ...input,
          tenantId: new Types.ObjectId(input.tenantId),
          complaintId: new Types.ObjectId(input.complaintId),
          actorId: new Types.ObjectId(input.actorId),
        },
      ],
      { session: input.session },
    );
  },

  async findPage(input: { tenantId: string; complaintId: string; limit: number; cursor?: { createdAt: Date; id: string } }) {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(input.tenantId),
      complaintId: new Types.ObjectId(input.complaintId),
    };
    if (input.cursor) {
      filter.$or = [
        { createdAt: { $gt: input.cursor.createdAt } },
        { createdAt: input.cursor.createdAt, _id: { $gt: new Types.ObjectId(input.cursor.id) } },
      ];
    }
    const events = await ComplaintEventModel.find(trustServerQuery(filter))
      .sort({ createdAt: 1, _id: 1 })
      .limit(input.limit + 1)
      .exec();
    const hasMore = events.length > input.limit;
    const page = hasMore ? events.slice(0, input.limit) : events;
    const lastEvent = page.at(-1);
    return {
      events: page,
      ...(hasMore && lastEvent ? { nextCursor: { createdAt: lastEvent.createdAt, id: lastEvent.id } } : {}),
    };
  },
};
