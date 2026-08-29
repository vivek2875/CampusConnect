import { Types } from 'mongoose';

import { logger } from '../../observability/logger';
import { AuditLogModel } from './audit-log.model';

export function recordAuditEvent(input: {
  tenantId?: string;
  actorId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  ip?: string;
  metadata?: Record<string, string | number | boolean>;
}): void {
  void AuditLogModel.create({
    ...input,
    ...(input.tenantId ? { tenantId: new Types.ObjectId(input.tenantId) } : {}),
    ...(input.actorId ? { actorId: new Types.ObjectId(input.actorId) } : {}),
    ...(input.targetId ? { targetId: new Types.ObjectId(input.targetId) } : {}),
  }).catch((error: unknown) => logger.error({ err: error, action: input.action }, 'Audit event could not be recorded'));
}
