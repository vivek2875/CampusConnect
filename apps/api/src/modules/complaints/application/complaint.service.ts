import { recordAuditEvent } from '../../../shared/audit/audit.service';
import { AppError } from '../../../shared/errors/app-error';
import { withTransaction } from '../../../shared/persistence/transaction';
import { createComplaintImageUrl, isComplaintAssetOwnedByUser } from '../../../shared/storage/cloudinary';
import type { UserRole } from '../../users/domain/user.types';
import { userRepository } from '../../users/infrastructure/user.repository';
import { notificationService } from '../../notifications/application/notification.service';
import type { ComplaintDepartment, ComplaintImage, ComplaintPriority, ComplaintStatus } from '../domain/complaint.types';
import { complaintEventRepository } from '../infrastructure/complaint-event.repository';
import { complaintRepository } from '../infrastructure/complaint.repository';
import type { ComplaintDocument } from '../infrastructure/complaint.model';
import { analyzeComplaint } from './complaint-intelligence.service';
import { decodeCursor, encodeCursor } from '../../../shared/pagination/cursor';

interface ComplaintQuery {
  tenantId: string;
  actorId: string;
  role: UserRole;
  limit: number;
  cursor?: string;
  department?: ComplaintDepartment;
  priority?: ComplaintPriority;
  status?: ComplaintStatus;
}

export const complaintService = {
  async create(input: {
    tenantId: string;
    reporterId: string;
    title: string;
    description: string;
    department: ComplaintDepartment;
    images: Array<{ publicId: string }>;
    ip?: string;
  }) {
    const [analysis, candidates] = await Promise.all([
      analyzeComplaint({ title: input.title, description: input.description, selectedDepartment: input.department }),
      complaintRepository.findRecentOpenByDepartment({
        tenantId: input.tenantId,
        department: input.department,
        createdAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000),
      }),
    ]);
    const duplicateCandidateIds = candidates
      .filter((candidate) => similarity(`${input.title} ${input.description}`, `${candidate.title} ${candidate.description}`) >= 0.6)
      .slice(0, 3)
      .map((candidate) => candidate.id);

    const complaint = await withTransaction(async (session) => {
      const created = await complaintRepository.create({
        tenantId: input.tenantId,
        reporterId: input.reporterId,
        title: input.title,
        description: input.description,
        department: input.department,
        priority: analysis.suggestedPriority,
        images: normalizeImages(input.images, input),
        intelligence: { ...analysis, duplicateCandidateIds },
        session,
      });
      await complaintEventRepository.create({
        tenantId: input.tenantId,
        complaintId: created.id,
        actorId: input.reporterId,
        type: 'created',
        payload: { status: 'pending' },
        session,
      });
      return created;
    });

    recordAuditEvent({
      tenantId: input.tenantId,
      actorId: input.reporterId,
      action: 'COMPLAINT_CREATED',
      targetType: 'Complaint',
      targetId: complaint.id,
      ip: input.ip,
    });
    return this.getById({ tenantId: input.tenantId, actorId: input.reporterId, role: 'student', complaintId: complaint.id });
  },

  async list(input: ComplaintQuery) {
    const scope = buildVisibilityScope(input);
    const result = await complaintRepository.findPage({
      tenantId: input.tenantId,
      limit: input.limit,
      ...(input.cursor ? { cursor: decodeCursor(input.cursor) } : {}),
      ...(scope.reporterId ? { reporterId: scope.reporterId } : {}),
      ...(scope.assigneeId ? { assigneeId: scope.assigneeId } : {}),
      ...(input.department ? { department: input.department } : {}),
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.status ? { status: input.status } : {}),
    });
    return {
      complaints: await serializeComplaints(result.complaints, input),
      nextCursor: result.nextCursor ? encodeCursor(result.nextCursor) : undefined,
    };
  },

  async getById(input: { tenantId: string; actorId: string; role: UserRole; complaintId: string }) {
    const complaint = await complaintRepository.findById(input.tenantId, input.complaintId);
    if (!complaint) throw complaintNotFoundError();
    assertCanView(complaint, input);
    return (await serializeComplaints([complaint], input))[0];
  },

  async assign(input: { tenantId: string; actorId: string; role: UserRole; complaintId: string; assigneeId: string; ip?: string }) {
    assertAdmin(input.role);
    const assignee = await userRepository.findById(input.assigneeId);
    if (
      !assignee ||
      assignee.tenantId.toString() !== input.tenantId ||
      assignee.role !== 'maintenance_staff' ||
      assignee.status !== 'active'
    ) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_ASSIGNEE',
        message: 'Assign complaints only to an active maintenance staff member in this campus.',
      });
    }
    const complaint = await withTransaction(async (session) => {
      const updated = await complaintRepository.assign({ ...input, assignedById: input.actorId, session });
      if (!updated)
        throw new AppError({ statusCode: 409, code: 'COMPLAINT_NOT_ASSIGNABLE', message: 'This complaint can no longer be assigned.' });
      await complaintEventRepository.create({
        tenantId: input.tenantId,
        complaintId: updated.id,
        actorId: input.actorId,
        type: 'assigned',
        payload: { assigneeId: input.assigneeId, status: 'assigned' },
        session,
      });
      return updated;
    });
    recordAuditEvent({
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: 'COMPLAINT_ASSIGNED',
      targetType: 'Complaint',
      targetId: complaint.id,
      ip: input.ip,
    });
    notificationService.create({
      tenantId: input.tenantId,
      recipientId: input.assigneeId,
      type: 'complaint_assigned',
      title: 'Complaint assigned to you',
      body: complaint.title,
      link: '/complaints',
    });
    return this.getById({ tenantId: input.tenantId, actorId: input.actorId, role: input.role, complaintId: complaint.id });
  },

  async updateStatus(input: {
    tenantId: string;
    actorId: string;
    role: UserRole;
    complaintId: string;
    status: ComplaintStatus;
    ip?: string;
  }) {
    const current = await complaintRepository.findById(input.tenantId, input.complaintId);
    if (!current) throw complaintNotFoundError();
    assertCanChangeStatus(current, input);
    const complaint = await withTransaction(async (session) => {
      const updated = await complaintRepository.updateStatus({
        tenantId: input.tenantId,
        complaintId: input.complaintId,
        expectedStatus: current.status,
        status: input.status,
        session,
      });
      if (!updated)
        throw new AppError({
          statusCode: 409,
          code: 'COMPLAINT_STATUS_CONFLICT',
          message: 'The complaint changed before your update. Refresh and try again.',
        });
      await complaintEventRepository.create({
        tenantId: input.tenantId,
        complaintId: updated.id,
        actorId: input.actorId,
        type: 'status_changed',
        payload: { from: current.status, to: input.status },
        session,
      });
      return updated;
    });
    recordAuditEvent({
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: 'COMPLAINT_STATUS_CHANGED',
      targetType: 'Complaint',
      targetId: complaint.id,
      ip: input.ip,
    });
    if (complaint.reporterId.toString() !== input.actorId)
      notificationService.create({
        tenantId: input.tenantId,
        recipientId: complaint.reporterId.toString(),
        type: 'complaint_updated',
        title: 'Complaint status updated',
        body: `${complaint.title} is now ${complaint.status.replace(/_/g, ' ')}.`,
        link: '/complaints',
      });
    return this.getById({ tenantId: input.tenantId, actorId: input.actorId, role: input.role, complaintId: complaint.id });
  },

  async getHistory(input: { tenantId: string; actorId: string; role: UserRole; complaintId: string; limit: number; cursor?: string }) {
    await this.getById(input);
    const result = await complaintEventRepository.findPage({
      tenantId: input.tenantId,
      complaintId: input.complaintId,
      limit: input.limit,
      ...(input.cursor ? { cursor: decodeCursor(input.cursor) } : {}),
    });
    return {
      events: result.events.map((event) => ({ id: event.id, type: event.type, payload: event.payload, createdAt: event.createdAt })),
      nextCursor: result.nextCursor ? encodeCursor(result.nextCursor) : undefined,
    };
  },
};

async function serializeComplaints(complaints: ComplaintDocument[], input: { tenantId: string; actorId: string; role: UserRole }) {
  if (!complaints.length) return [];
  const userIds = [
    ...new Set(
      complaints.flatMap((complaint) => [complaint.reporterId.toString(), complaint.assigneeId?.toString()].filter(Boolean) as string[]),
    ),
  ];
  const users = await userRepository.findActiveByIds(input.tenantId, userIds);
  const usersById = new Map(users.map((user) => [user.id, user]));
  return complaints.map((complaint) => {
    const reporter = usersById.get(complaint.reporterId.toString());
    const assignee = complaint.assigneeId ? usersById.get(complaint.assigneeId.toString()) : undefined;
    return {
      id: complaint.id,
      title: complaint.title,
      description: complaint.description,
      department: complaint.department,
      priority: complaint.priority,
      status: complaint.status,
      images: complaint.images,
      intelligence: complaint.intelligence,
      reporter: reporter ? { id: reporter.id, firstName: reporter.firstName, lastName: reporter.lastName } : null,
      assignee: assignee ? { id: assignee.id, firstName: assignee.firstName, lastName: assignee.lastName } : null,
      canManage: isAdmin(input.role) || (input.role === 'maintenance_staff' && complaint.assigneeId?.toString() === input.actorId),
      createdAt: complaint.createdAt,
      updatedAt: complaint.updatedAt,
    };
  });
}

function buildVisibilityScope(input: Pick<ComplaintQuery, 'actorId' | 'role'>): { reporterId?: string; assigneeId?: string } {
  if (isAdmin(input.role)) return {};
  if (input.role === 'maintenance_staff') return { assigneeId: input.actorId };
  return { reporterId: input.actorId };
}

function assertCanView(complaint: ComplaintDocument, input: { actorId: string; role: UserRole }): void {
  if (
    isAdmin(input.role) ||
    complaint.reporterId.toString() === input.actorId ||
    (input.role === 'maintenance_staff' && complaint.assigneeId?.toString() === input.actorId)
  )
    return;
  throw new AppError({ statusCode: 403, code: 'FORBIDDEN', message: 'You do not have permission to view this complaint.' });
}

function assertCanChangeStatus(complaint: ComplaintDocument, input: { actorId: string; role: UserRole; status: ComplaintStatus }): void {
  const validTransition = allowedTransitions[complaint.status]?.includes(input.status);
  if (!validTransition)
    throw new AppError({ statusCode: 409, code: 'INVALID_STATUS_TRANSITION', message: 'This status change is not allowed.' });
  if (isAdmin(input.role)) return;
  if (
    input.role === 'maintenance_staff' &&
    complaint.assigneeId?.toString() === input.actorId &&
    ['in_progress', 'resolved'].includes(input.status)
  )
    return;
  if (complaint.reporterId.toString() === input.actorId && complaint.status === 'resolved' && input.status === 'closed') return;
  throw new AppError({ statusCode: 403, code: 'FORBIDDEN', message: 'You do not have permission to change this complaint status.' });
}

function normalizeImages(images: Array<{ publicId: string }>, input: { tenantId: string; reporterId: string }): ComplaintImage[] {
  return images.map((image) => {
    if (!isComplaintAssetOwnedByUser(image.publicId, { tenantId: input.tenantId, userId: input.reporterId })) {
      throw new AppError({
        statusCode: 403,
        code: 'MEDIA_OWNERSHIP_INVALID',
        message: 'One or more images do not belong to your account.',
      });
    }
    return { publicId: image.publicId, url: createComplaintImageUrl(image.publicId) };
  });
}

function similarity(left: string, right: string): number {
  const leftTokens = new Set(left.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
  const rightTokens = new Set(right.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
  const union = new Set([...leftTokens, ...rightTokens]);
  if (!union.size) return 0;
  return [...leftTokens].filter((token) => rightTokens.has(token)).length / union.size;
}

const allowedTransitions: Partial<Record<ComplaintStatus, ComplaintStatus[]>> = {
  assigned: ['in_progress'],
  in_progress: ['resolved'],
  resolved: ['in_progress', 'closed'],
};

function isAdmin(role: UserRole): boolean {
  return role === 'admin' || role === 'super_admin';
}

function assertAdmin(role: UserRole): void {
  if (!isAdmin(role))
    throw new AppError({ statusCode: 403, code: 'FORBIDDEN', message: 'Only campus administrators can assign complaints.' });
}

function complaintNotFoundError(): AppError {
  return new AppError({ statusCode: 404, code: 'COMPLAINT_NOT_FOUND', message: 'Complaint not found or unavailable.' });
}
