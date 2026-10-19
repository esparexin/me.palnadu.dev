import {Inject, Injectable} from '@nestjs/common';
import {RoleSchema, type Role, type SessionClaims} from '@me-palnadu/contracts';
import type {Prisma} from '@prisma/client';
import {ApiError} from '../../common/api-error.js';
import {mapPersistenceError} from '../../common/persistence-error.js';
import {PrismaService} from '../../prisma/prisma.service.js';
import type {AuthenticatedAdmin} from '../../auth/admin-context.js';

/**
 * One administrative action to be recorded.
 *
 * `detail` is typed to what Prisma accepts as JSON input rather than `unknown`, so a
 * value that cannot be persisted is a compile error instead of a runtime surprise.
 */
export interface AuditEntry {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  detail?: Prisma.InputJsonObject;
}

/**
 * Resolves an administrator session.
 *
 * Every check here is against the database, in the order specified by
 * SECURITY.md section 4.4:
 *
 *   1. the GitHub id in the token names an administrator;
 *   2. that administrator is active;
 *   3. the session exists, belongs to them, and is not revoked;
 *   4. the session has not expired (belt and braces: the token's `exp` was already
 *      enforced during signature verification);
 *   5. the session was issued under the user's current token version.
 *
 * A failure at (1) or (2) is FORBIDDEN, because the token was genuinely signed and
 * the caller is authenticated - they simply are not permitted. A failure at (3), (4)
 * or (5) is UNAUTHENTICATED, because the session is not a live session.
 */
@Injectable()
export class AdminService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async resolveSession(claims: SessionClaims): Promise<AuthenticatedAdmin> {
    let user: {
      id: string;
      githubId: number;
      login: string;
      role: string;
      tokenVersion: number;
      active: boolean;
    } | null;
    let session: {
      sessionId: string;
      tokenVersion: number;
      expiresAt: Date;
      revokedAt: Date | null;
      userId: string;
    } | null;

    try {
      [user, session] = await Promise.all([
        this.prisma.adminUser.findUnique({where: {githubId: claims.gh_id}}),
        this.prisma.adminSession.findUnique({where: {sessionId: claims.sid}}),
      ]);
    } catch (error) {
      throw mapPersistenceError(error).error;
    }

    if (user === null || user.active === false || user.githubId !== claims.gh_id) {
      throw new ApiError('FORBIDDEN', 'This account may not administer the site.');
    }

    if (
      session === null ||
      session.revokedAt !== null ||
      session.userId !== user.id ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new ApiError('UNAUTHENTICATED', 'The session token is not valid.');
    }
    if (session.tokenVersion !== user.tokenVersion || claims.tv !== user.tokenVersion) {
      throw new ApiError('UNAUTHENTICATED', 'The session token is not valid.');
    }

    // The role is parsed, not cast. A role outside the canonical enum is a data
    // integrity fault, not a role the caller may be granted by omission.
    const role: Role = RoleSchema.parse(user.role);

    return {
      id: user.id,
      githubId: user.githubId,
      login: user.login,
      role,
      sessionId: session.sessionId,
    };
  }

  /**
   * Writes an audit entry using the caller's transaction client.
   *
   * Taking the client as an argument is deliberate. An audit trail is only evidence if
   * it cannot drift from the change it describes, so the content write and this write
   * must commit together or not at all. Handing the service its own connection instead
   * would allow a failure here to leave a content change with no record of who made it.
   */
  async writeAudit(tx: Prisma.TransactionClient, entry: AuditEntry): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        ...(entry.detail === undefined ? {} : {detail: entry.detail}),
      },
    });
  }
}
