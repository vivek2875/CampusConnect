import { recordAuditEvent } from '../../../shared/audit/audit.service';
import { AppError } from '../../../shared/errors/app-error';
import { decodeCursor, encodeCursor } from '../../../shared/pagination/cursor';
import { withTransaction } from '../../../shared/persistence/transaction';
import { notificationService } from '../../notifications/application/notification.service';
import { userRepository } from '../../users/infrastructure/user.repository';
import { listingRepository } from '../infrastructure/listing.repository';
import { offerRepository } from '../infrastructure/offer.repository';

export const offerService = {
  async create(input: { tenantId: string; buyerId: string; listingId: string; amountMinor: number; message?: string; ip?: string }) {
    const listing = await listingRepository.findVisibleById(input.tenantId, input.listingId);
    if (!listing || listing.status !== 'active') {
      throw new AppError({ statusCode: 404, code: 'LISTING_NOT_AVAILABLE', message: 'This listing is not available for offers.' });
    }
    if (listing.sellerId.toString() === input.buyerId) {
      throw new AppError({
        statusCode: 400,
        code: 'CANNOT_OFFER_ON_OWN_LISTING',
        message: 'You cannot make an offer on your own listing.',
      });
    }

    const offer = await offerRepository.create({
      tenantId: input.tenantId,
      listingId: listing.id,
      buyerId: input.buyerId,
      sellerId: listing.sellerId.toString(),
      listingTitle: listing.title,
      amountMinor: input.amountMinor,
      ...(input.message ? { message: input.message } : {}),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000),
    });
    recordAuditEvent({
      tenantId: input.tenantId,
      actorId: input.buyerId,
      action: 'MARKETPLACE_OFFER_CREATED',
      targetType: 'MarketplaceOffer',
      targetId: offer.id,
      ip: input.ip,
    });
    notificationService.create({
      tenantId: input.tenantId,
      recipientId: listing.sellerId.toString(),
      type: 'marketplace_offer',
      title: 'New marketplace offer',
      body: `${offer.listingTitle} · ₹${Math.round(offer.amountMinor / 100)}`,
      link: '/offers?direction=incoming',
    });
    return serializeOffer(offer, input.buyerId, input.tenantId);
  },

  async list(input: {
    tenantId: string;
    userId: string;
    direction: 'incoming' | 'outgoing';
    limit: number;
    cursor?: string;
    status?: 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'expired';
  }) {
    await offerRepository.expirePending(input.tenantId);
    const result = await offerRepository.findPage({
      tenantId: input.tenantId,
      userId: input.userId,
      direction: input.direction,
      limit: input.limit,
      ...(input.cursor ? { cursor: decodeCursor(input.cursor) } : {}),
      ...(input.status ? { status: input.status } : {}),
    });
    return {
      offers: await Promise.all(result.offers.map((offer) => serializeOffer(offer, input.userId, input.tenantId))),
      nextCursor: result.nextCursor ? encodeCursor(result.nextCursor) : undefined,
    };
  },

  async respond(input: { tenantId: string; actorId: string; offerId: string; status: 'accepted' | 'declined' | 'withdrawn'; ip?: string }) {
    const offer = await offerRepository.findById(input.tenantId, input.offerId);
    if (!offer) throw new AppError({ statusCode: 404, code: 'OFFER_NOT_FOUND', message: 'Offer not found.' });
    if (input.status === 'withdrawn') {
      if (offer.buyerId.toString() !== input.actorId) throw forbidden();
      const withdrawn = await offerRepository.updatePendingStatus({
        tenantId: input.tenantId,
        offerId: input.offerId,
        status: 'withdrawn',
      });
      if (!withdrawn) throw offerNotPending();
      recordAuditEvent({
        tenantId: input.tenantId,
        actorId: input.actorId,
        action: 'MARKETPLACE_OFFER_WITHDRAWN',
        targetType: 'MarketplaceOffer',
        targetId: withdrawn.id,
        ip: input.ip,
      });
      return serializeOffer(withdrawn, input.actorId, input.tenantId);
    }
    if (offer.sellerId.toString() !== input.actorId) throw forbidden();

    const updated = await withTransaction(async (session) => {
      const changed = await offerRepository.updatePendingStatus({
        tenantId: input.tenantId,
        offerId: input.offerId,
        status: input.status,
        session,
      });
      if (!changed) throw offerNotPending();
      if (input.status === 'accepted') {
        const listing = await listingRepository.reserveForAcceptedOffer({
          tenantId: input.tenantId,
          listingId: changed.listingId.toString(),
          sellerId: input.actorId,
          session,
        });
        if (!listing) {
          throw new AppError({
            statusCode: 409,
            code: 'LISTING_NOT_AVAILABLE',
            message: 'This listing is no longer available to reserve.',
          });
        }
        await offerRepository.declineOtherPending({
          tenantId: input.tenantId,
          listingId: changed.listingId.toString(),
          acceptedOfferId: changed.id,
          session,
        });
      }
      return changed;
    });
    recordAuditEvent({
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: `MARKETPLACE_OFFER_${input.status.toUpperCase()}`,
      targetType: 'MarketplaceOffer',
      targetId: updated.id,
      ip: input.ip,
    });
    notificationService.create({
      tenantId: input.tenantId,
      recipientId: updated.buyerId.toString(),
      type: 'marketplace_offer',
      title: `Marketplace offer ${input.status}`,
      body: updated.listingTitle,
      link: '/offers?direction=outgoing',
    });
    return serializeOffer(updated, input.actorId, input.tenantId);
  },
};

async function serializeOffer(
  offer: Awaited<ReturnType<typeof offerRepository.findById>> extends infer T ? Exclude<T, null> : never,
  viewerId: string,
  tenantId: string,
) {
  const counterpartId = offer.buyerId.toString() === viewerId ? offer.sellerId.toString() : offer.buyerId.toString();
  const counterpart = await userRepository.findById(counterpartId);
  return {
    id: offer.id,
    listingId: offer.listingId.toString(),
    listingTitle: offer.listingTitle,
    amountMinor: offer.amountMinor,
    message: offer.message ?? null,
    status: offer.status,
    expiresAt: offer.expiresAt,
    createdAt: offer.createdAt,
    direction: offer.buyerId.toString() === viewerId ? 'outgoing' : 'incoming',
    counterpart:
      counterpart && counterpart.tenantId.toString() === tenantId
        ? { id: counterpart.id, firstName: counterpart.firstName, lastName: counterpart.lastName }
        : null,
  };
}

function forbidden() {
  return new AppError({ statusCode: 403, code: 'FORBIDDEN', message: 'You cannot change this offer.' });
}

function offerNotPending() {
  return new AppError({ statusCode: 409, code: 'OFFER_NOT_PENDING', message: 'This offer is no longer pending.' });
}
