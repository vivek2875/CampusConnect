import { AppError } from '../../../shared/errors/app-error';
import { recordAuditEvent } from '../../../shared/audit/audit.service';
import { withTransaction } from '../../../shared/persistence/transaction';
import { createLostFoundImageUrl, createLostFoundUploadSignature, isLostFoundAssetOwnedByUser } from '../../../shared/storage/cloudinary';
import type { UserRole } from '../../users/domain/user.types';
import type { LostFoundType } from '../domain/lost-found.types';
import { lostFoundRepository } from '../infrastructure/lost-found.repository';
import { notificationService } from '../../notifications/application/notification.service';
import { decodeCursor, encodeCursor } from '../../../shared/pagination/cursor';

export const lostFoundService = {
  getUploadSignature: createLostFoundUploadSignature,
  async create(input: {
    tenantId: string;
    reporterId: string;
    type: LostFoundType;
    title: string;
    description: string;
    location: string;
    images: Array<{ publicId: string }>;
    ip?: string;
  }) {
    const candidates = await lostFoundRepository.findOppositeOpen({ tenantId: input.tenantId, type: input.type, limit: 50 });
    const relatedItemIds = candidates
      .filter((item) => tokenSimilarity(`${input.title} ${input.description}`, `${item.title} ${item.description}`) >= 0.45)
      .slice(0, 3)
      .map((item) => item.id);
    const { ip, images, ...itemInput } = input;
    const item = await lostFoundRepository.create({
      ...itemInput,
      images: images.map((image) => ownedImage(image.publicId, input)),
      relatedItemIds,
    });
    recordAuditEvent({
      tenantId: input.tenantId,
      actorId: input.reporterId,
      action: 'LOST_FOUND_ITEM_CREATED',
      targetType: 'LostFoundItem',
      targetId: item.id,
      ip,
    });
    return item;
  },
  async list(input: { tenantId: string; actorId: string; role: UserRole; limit: number; cursor?: string; type?: LostFoundType }) {
    const result = await lostFoundRepository.findPage({
      tenantId: input.tenantId,
      limit: input.limit,
      ...(input.cursor ? { cursor: decodeCursor(input.cursor) } : {}),
      ...(input.type ? { type: input.type } : {}),
    });
    return {
      items: result.items.map((item) => toItem(item, input)),
      nextCursor: result.nextCursor ? encodeCursor(result.nextCursor) : undefined,
    };
  },
  async claim(input: { tenantId: string; itemId: string; claimantId: string; verificationDetails: string; ip?: string }) {
    const item = await lostFoundRepository.findById(input.tenantId, input.itemId);
    if (!item || item.status !== 'open')
      throw new AppError({ statusCode: 404, code: 'ITEM_NOT_AVAILABLE', message: 'This item is not available for a claim.' });
    if (item.reporterId.toString() === input.claimantId)
      throw new AppError({ statusCode: 400, code: 'CANNOT_CLAIM_OWN_ITEM', message: 'You cannot claim an item you reported.' });
    const { ip, ...claimInput } = input;
    const claim = await lostFoundRepository.createClaim(claimInput);
    recordAuditEvent({
      tenantId: input.tenantId,
      actorId: input.claimantId,
      action: 'LOST_FOUND_CLAIM_CREATED',
      targetType: 'LostFoundClaim',
      targetId: claim.id,
      ip,
    });
    notificationService.create({
      tenantId: input.tenantId,
      recipientId: item.reporterId.toString(),
      type: 'lost_found_claim',
      title: 'New Lost & Found claim',
      body: `Someone submitted ownership details for ${item.title}.`,
      link: '/lost-found',
    });
  },
  async listClaims(input: { tenantId: string; itemId: string; actorId: string; role: UserRole }) {
    const item = await lostFoundRepository.findById(input.tenantId, input.itemId);
    assertReviewer(item, input);
    return (await lostFoundRepository.findClaims(input.tenantId, input.itemId)).map((claim) => ({
      id: claim.id,
      claimantId: claim.claimantId.toString(),
      verificationDetails: claim.verificationDetails,
      status: claim.status,
      createdAt: claim.createdAt,
    }));
  },
  async reviewClaim(input: {
    tenantId: string;
    claimId: string;
    actorId: string;
    role: UserRole;
    status: 'approved' | 'rejected';
    ip?: string;
  }) {
    const claim = await lostFoundRepository.findClaim(input.tenantId, input.claimId);
    if (!claim) throw new AppError({ statusCode: 404, code: 'CLAIM_NOT_FOUND', message: 'Claim not found.' });
    const item = await lostFoundRepository.findById(input.tenantId, claim.itemId.toString());
    assertReviewer(item, input);
    const reviewed = await withTransaction(async (session) => {
      const changed = await lostFoundRepository.reviewClaim({
        tenantId: input.tenantId,
        claimId: input.claimId,
        reviewerId: input.actorId,
        status: input.status,
        session,
      });
      if (!changed) throw new AppError({ statusCode: 409, code: 'CLAIM_NOT_REVIEWABLE', message: 'This claim has already been reviewed.' });
      if (input.status === 'approved') {
        const resolved = await lostFoundRepository.resolveForApprovedClaim({
          itemId: claim.itemId.toString(),
          tenantId: input.tenantId,
          session,
        });
        if (!resolved) throw new AppError({ statusCode: 409, code: 'ITEM_NOT_AVAILABLE', message: 'This item has already been resolved.' });
        await lostFoundRepository.rejectOtherPendingClaims({
          tenantId: input.tenantId,
          itemId: claim.itemId.toString(),
          approvedClaimId: changed.id,
          reviewerId: input.actorId,
          session,
        });
      }
      return changed;
    });
    recordAuditEvent({
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: `LOST_FOUND_CLAIM_${input.status.toUpperCase()}`,
      targetType: 'LostFoundClaim',
      targetId: reviewed.id,
      ip: input.ip,
    });
    notificationService.create({
      tenantId: input.tenantId,
      recipientId: reviewed.claimantId.toString(),
      type: 'lost_found_claim',
      title: `Lost & Found claim ${input.status}`,
      body:
        input.status === 'approved'
          ? 'Your ownership claim was approved. Please coordinate collection with the reporter.'
          : 'Your ownership claim was not approved.',
      link: '/lost-found',
    });
  },
};
function ownedImage(publicId: string, input: { tenantId: string; reporterId: string }) {
  if (!isLostFoundAssetOwnedByUser(publicId, { tenantId: input.tenantId, userId: input.reporterId }))
    throw new AppError({ statusCode: 403, code: 'MEDIA_OWNERSHIP_INVALID', message: 'One or more images do not belong to your account.' });
  return { publicId, url: createLostFoundImageUrl(publicId) };
}
function toItem(
  item: Awaited<ReturnType<typeof lostFoundRepository.findById>> extends infer T ? Exclude<T, null> : never,
  input: { actorId: string; role: UserRole },
) {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    description: item.description,
    location: item.location,
    images: item.images,
    status: item.status,
    relatedItemIds: item.relatedItemIds,
    canReviewClaims: item.reporterId.toString() === input.actorId || input.role === 'admin' || input.role === 'super_admin',
    createdAt: item.createdAt,
  };
}
function tokenSimilarity(left: string, right: string) {
  const a = new Set(left.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
  const b = new Set(right.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
  const all = new Set([...a, ...b]);
  return all.size ? [...a].filter((value) => b.has(value)).length / all.size : 0;
}
function assertReviewer(item: Awaited<ReturnType<typeof lostFoundRepository.findById>>, input: { actorId: string; role: UserRole }) {
  if (!item) throw new AppError({ statusCode: 404, code: 'ITEM_NOT_FOUND', message: 'Item not found.' });
  if (item.reporterId.toString() === input.actorId || input.role === 'admin' || input.role === 'super_admin') return;
  throw new AppError({ statusCode: 403, code: 'FORBIDDEN', message: 'You cannot review these claims.' });
}
