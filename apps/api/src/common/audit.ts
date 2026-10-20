import type {Prisma} from '@prisma/client';
import type {AuditAction, AuditEntityType} from '@me-palnadu/contracts';
import {ApiError} from './api-error.js';
import type {RequestWithAdmin} from '../auth/admin-context.js';

/**
 * Builds the audit entry for an administrative write.
 *
 * The actor is read from the request only after `AdminSessionGuard` has resolved
 * it against the database, so a forged claim cannot name an author. Its absence
 * here is a wiring fault rather than a client error, and fails closed.
 */
export const auditOf = (
  request: RequestWithAdmin,
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: string,
  detail?: Prisma.InputJsonObject,
) => {
  if (request.admin === undefined) {
    throw new ApiError('UNAUTHENTICATED', 'The session token is not valid.');
  }
  return {
    actorId: request.admin.id,
    action,
    entityType,
    entityId,
    // Conditional spread, not `detail: detail ?? undefined`: under
    // `exactOptionalPropertyTypes` a key present with an undefined value is a type
    // error, and omitting it keeps the optional genuinely optional.
    ...(detail === undefined ? {} : {detail}),
  };
};
