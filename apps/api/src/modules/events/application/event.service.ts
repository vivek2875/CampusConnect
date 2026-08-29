import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../../config/env';
import { AppError } from '../../../shared/errors/app-error';
import { withTransaction } from '../../../shared/persistence/transaction';
import { notificationService } from '../../notifications/application/notification.service';
import type { UserRole } from '../../users/domain/user.types';
import { eventRepository } from '../infrastructure/event.repository';
import { decodeEventCursor, encodeEventCursor } from './event.pagination';

export const eventService = {
  async create(input: {
    tenantId: string;
    organizerId: string;
    role: UserRole;
    title: string;
    description: string;
    location: string;
    startsAt: Date;
    endsAt: Date;
    registrationDeadline: Date;
    capacity: number;
  }) {
    if (!canOrganize(input.role))
      throw new AppError({ statusCode: 403, code: 'FORBIDDEN', message: 'Only faculty or administrators can create events.' });
    return toEvent(await eventRepository.create(input));
  },
  async list(input: { tenantId: string; userId: string; limit: number; cursor?: string }) {
    const result = await eventRepository.findPage({
      tenantId: input.tenantId,
      limit: input.limit,
      ...(input.cursor ? { cursor: decodeEventCursor(input.cursor) } : {}),
    });
    const registrations = await eventRepository.findRegistrationsForUser(
      input.tenantId,
      input.userId,
      result.events.map((event) => event.id),
    );
    const registrationsByEventId = new Map(registrations.map((registration) => [registration.eventId.toString(), registration]));
    return {
      events: result.events.map((event) => toEvent(event, registrationsByEventId.get(event.id), input.userId)),
      nextCursor: result.nextCursor ? encodeEventCursor(result.nextCursor) : undefined,
    };
  },
  async register(input: { tenantId: string; eventId: string; userId: string }) {
    const existing = await eventRepository.findRegistrationForUser(input.tenantId, input.eventId, input.userId);
    const knownEvent = await eventRepository.findById(input.tenantId, input.eventId);
    if (!knownEvent || knownEvent.status !== 'published')
      throw new AppError({ statusCode: 404, code: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    if (existing)
      return {
        registrationId: existing.id,
        ticket: signTicket(
          { tenantId: input.tenantId, eventId: input.eventId, registrationId: existing.id, userId: input.userId },
          knownEvent.endsAt,
        ),
      };

    const result = await withTransaction(async (session) => {
      const existingInTransaction = await eventRepository.findRegistrationForUser(input.tenantId, input.eventId, input.userId, session);
      if (existingInTransaction) return { registration: existingInTransaction, event: knownEvent, created: false };
      const event = await eventRepository.reserveSeat({ tenantId: input.tenantId, eventId: input.eventId, session });
      if (!event)
        throw new AppError({ statusCode: 409, code: 'EVENT_UNAVAILABLE', message: 'Registration is closed or the event is full.' });
      const registration = await eventRepository.createRegistration({
        tenantId: input.tenantId,
        eventId: input.eventId,
        userId: input.userId,
        session,
      });
      return { registration, event, created: true };
    });
    if (result.created)
      notificationService.create({
        tenantId: input.tenantId,
        recipientId: input.userId,
        type: 'event_registration',
        title: 'Event registration confirmed',
        body: result.event.title,
        link: '/events',
      });
    return {
      registrationId: result.registration.id,
      ticket: signTicket(
        { tenantId: input.tenantId, eventId: input.eventId, registrationId: result.registration.id, userId: input.userId },
        result.event.endsAt,
      ),
    };
  },
  async checkIn(input: { tenantId: string; eventId: string; actorId: string; role: UserRole; ticket: string }) {
    const event = await eventRepository.findById(input.tenantId, input.eventId);
    if (!event || event.status !== 'published')
      throw new AppError({ statusCode: 404, code: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    if (event.organizerId.toString() !== input.actorId && !isAdmin(input.role))
      throw new AppError({ statusCode: 403, code: 'FORBIDDEN', message: 'Only the organizer or an administrator can check attendees in.' });
    const claims = verifyTicket(input.ticket);
    if (claims.tenantId !== input.tenantId || claims.eventId !== input.eventId)
      throw new AppError({ statusCode: 403, code: 'INVALID_EVENT_TICKET', message: 'This ticket is for another event.' });
    const checkedIn = await eventRepository.checkIn({
      tenantId: input.tenantId,
      registrationId: claims.registrationId,
      certificateCode: `CC-${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`,
    });
    if (!checkedIn)
      throw new AppError({ statusCode: 409, code: 'ALREADY_CHECKED_IN', message: 'This attendee has already been checked in.' });
    return { registrationId: checkedIn.id, checkedInAt: checkedIn.checkedInAt, certificateCode: checkedIn.certificateCode };
  },
};
function signTicket(claims: { tenantId: string; eventId: string; registrationId: string; userId: string }, eventEndsAt?: Date) {
  return jwt.sign({ ...claims, type: 'event_checkin' }, env.EVENT_TICKET_SECRET, {
    expiresIn: eventEndsAt ? Math.max(60, Math.floor((eventEndsAt.getTime() + 24 * 60 * 60 * 1_000 - Date.now()) / 1_000)) : '7d',
    issuer: 'campusconnect-api',
    audience: 'campusconnect-event',
  });
}
function verifyTicket(ticket: string) {
  const value = jwt.verify(ticket, env.EVENT_TICKET_SECRET, { issuer: 'campusconnect-api', audience: 'campusconnect-event' });
  if (
    typeof value === 'string' ||
    value.type !== 'event_checkin' ||
    typeof value.tenantId !== 'string' ||
    typeof value.eventId !== 'string' ||
    typeof value.registrationId !== 'string' ||
    typeof value.userId !== 'string'
  )
    throw new AppError({ statusCode: 401, code: 'INVALID_EVENT_TICKET', message: 'Event ticket is invalid.' });
  return value as { tenantId: string; eventId: string; registrationId: string; userId: string };
}
function toEvent(
  event: Awaited<ReturnType<typeof eventRepository.findById>> extends infer T ? Exclude<T, null> : never,
  registration?: Awaited<ReturnType<typeof eventRepository.findRegistrationForUser>>,
  userId?: string,
) {
  return {
    id: event.id,
    organizerId: event.organizerId.toString(),
    title: event.title,
    description: event.description,
    location: event.location,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    registrationDeadline: event.registrationDeadline,
    capacity: event.capacity,
    registrationCount: event.registrationCount,
    remainingCapacity: event.capacity - event.registrationCount,
    status: event.status,
    createdAt: event.createdAt,
    registration:
      registration && userId
        ? {
            id: registration.id,
            ticket: signTicket(
              { tenantId: event.tenantId.toString(), eventId: event.id, registrationId: registration.id, userId },
              event.endsAt,
            ),
            checkedInAt: registration.checkedInAt ?? null,
            certificateCode: registration.certificateCode ?? null,
          }
        : null,
  };
}
function canOrganize(role: UserRole) {
  return role === 'faculty' || isAdmin(role);
}
function isAdmin(role: UserRole) {
  return role === 'admin' || role === 'super_admin';
}
