import type {Prisma} from '@prisma/client';
import {AuditActionSchema, AuditEntityTypeSchema, type AuditEntry} from '@me-palnadu/contracts';

/** One audit row, mapped in exactly one place for every reader of the trail. */
export interface AuditRow {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  detail: Prisma.JsonValue | null;
  createdAt: Date;
}

export const toAuditEntry = (row: AuditRow): AuditEntry => ({
  id: row.id,
  actorId: row.actorId,
  action: AuditActionSchema.parse(row.action),
  entityType: AuditEntityTypeSchema.parse(row.entityType),
  entityId: row.entityId,
  // Prisma's JsonValue includes arrays and scalars; the contract allows an object
  // only, so anything else is omitted rather than coerced.
  ...(isJsonObject(row.detail) ? {detail: row.detail} : {}),
  createdAt: row.createdAt.toISOString(),
});

const isJsonObject = (value: Prisma.JsonValue | null): value is Prisma.JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
