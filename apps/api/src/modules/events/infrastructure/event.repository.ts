import { Types, type ClientSession } from 'mongoose';

import { trustServerQuery } from '../../../shared/persistence/trusted-query';
import { EventModel, type EventDocument } from './event.model';
import { EventRegistrationModel, type RegistrationDocument } from './event-registration.model';

export const eventRepository = {
  create(input: {
    tenantId: string;
    organizerId: string;
    title: string;
    description: string;
    location: string;
    startsAt: Date;
    endsAt: Date;
    registrationDeadline: Date;
    capacity: number;
  }) {
    return EventModel.create({
      ...input,
      tenantId: new Types.ObjectId(input.tenantId),
      organizerId: new Types.ObjectId(input.organizerId),
    });
  },
  findById(tenantId: string, eventId: string): Promise<EventDocument | null> {
    return EventModel.findOne({ _id: eventId, tenantId: new Types.ObjectId(tenantId) }).exec();
  },
  async findPage(input: { tenantId: string; limit: number; cursor?: { startsAt: Date; id: string } }) {
    const filter: Record<string, unknown> = { tenantId: new Types.ObjectId(input.tenantId), status: 'published' };
    if (input.cursor)
      filter.$or = [
        { startsAt: { $gt: input.cursor.startsAt } },
        { startsAt: input.cursor.startsAt, _id: { $gt: new Types.ObjectId(input.cursor.id) } },
      ];
    const events = await EventModel.find(trustServerQuery(filter))
      .sort({ startsAt: 1, _id: 1 })
      .limit(input.limit + 1)
      .exec();
    const page = events.slice(0, input.limit);
    const last = page.at(-1);
    return { events: page, ...(events.length > input.limit && last ? { nextCursor: { startsAt: last.startsAt, id: last.id } } : {}) };
  },
  reserveSeat(input: { tenantId: string; eventId: string; session: ClientSession }): Promise<EventDocument | null> {
    return EventModel.findOneAndUpdate(
      trustServerQuery({
        _id: input.eventId,
        tenantId: new Types.ObjectId(input.tenantId),
        status: 'published',
        registrationDeadline: { $gte: new Date() },
        $expr: { $lt: ['$registrationCount', '$capacity'] },
      }),
      { $inc: { registrationCount: 1 } },
      { new: true, session: input.session },
    ).exec();
  },
  createRegistration(input: { tenantId: string; eventId: string; userId: string; session: ClientSession }): Promise<RegistrationDocument> {
    return EventRegistrationModel.create(
      [
        {
          tenantId: new Types.ObjectId(input.tenantId),
          eventId: new Types.ObjectId(input.eventId),
          userId: new Types.ObjectId(input.userId),
        },
      ],
      { session: input.session },
    ).then((values) => values[0]);
  },
  findRegistration(tenantId: string, registrationId: string): Promise<RegistrationDocument | null> {
    return EventRegistrationModel.findOne({ _id: registrationId, tenantId: new Types.ObjectId(tenantId) }).exec();
  },
  findRegistrationForUser(
    tenantId: string,
    eventId: string,
    userId: string,
    session?: ClientSession,
  ): Promise<RegistrationDocument | null> {
    return EventRegistrationModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      eventId: new Types.ObjectId(eventId),
      userId: new Types.ObjectId(userId),
    })
      .session(session ?? null)
      .exec();
  },
  findRegistrationsForUser(tenantId: string, userId: string, eventIds: string[]): Promise<RegistrationDocument[]> {
    if (!eventIds.length) return Promise.resolve([]);
    return EventRegistrationModel.find(
      trustServerQuery({
        tenantId: new Types.ObjectId(tenantId),
        userId: new Types.ObjectId(userId),
        eventId: { $in: eventIds.map((eventId) => new Types.ObjectId(eventId)) },
      }),
    ).exec();
  },
  checkIn(input: { tenantId: string; registrationId: string; certificateCode: string }): Promise<RegistrationDocument | null> {
    return EventRegistrationModel.findOneAndUpdate(
      trustServerQuery({ _id: input.registrationId, tenantId: new Types.ObjectId(input.tenantId), checkedInAt: { $exists: false } }),
      { $set: { checkedInAt: new Date(), certificateCode: input.certificateCode } },
      { new: true },
    ).exec();
  },
};
