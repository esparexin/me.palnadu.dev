import type {Prisma} from '@prisma/client';
import type {AuditAction, AuditEntityType} from '@me-palnadu/contracts';

/**
 * One administrative action to be recorded.
 *
 * `detail` is typed to what Prisma accepts as JSON input rather than `unknown`, so a
 * value that cannot be persisted is a compile error instead of a runtime surprise.
 */
export interface AuditEntry {
  actorId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  detail?: Prisma.InputJsonObject;
}

/** Writes an audit entry using the caller's transaction client (ADR-0006 §4). */
export const writeAuditEntry = async (
  tx: Prisma.TransactionClient,
  entry: AuditEntry,
): Promise<void> => {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      ...(entry.detail === undefined ? {} : {detail: entry.detail}),
    },
  });
};
