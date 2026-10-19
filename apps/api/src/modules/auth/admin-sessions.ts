import {
  RoleSchema,
  type AdminSessionList,
  type AdminSessionSummary,
  type SessionClaims,
} from '@me-palnadu/contracts';
import {ApiError} from '../../common/api-error.js';
import {mapPersistenceError} from '../../common/persistence-error.js';
import type {PrismaService} from '../../prisma/prisma.service.js';
import type {AuthenticatedAdmin} from '../../auth/admin-context.js';

/**
 * Revokes one session.
 *
 * The row is kept with `revokedAt` set rather than deleted, so "signed out at" stays
 * answerable after the fact.
 */
export const logoutAdminSession = async (
  prisma: PrismaService,
  sessionId: string,
  actorId: string,
): Promise<void> => {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.adminSession.update({
        where: {sessionId},
        data: {revokedAt: new Date()},
      });
      await tx.auditLog.create({
        data: {actorId, action: 'auth_logout', entityType: 'admin', entityId: sessionId},
      });
    });
  } catch (error) {
    throw mapPersistenceError(error).error;
  }
};

/**
 * Resolves a session claim to a live administrator.
 *
 * Order follows SECURITY.md §4: the user must exist and be active, the session must
 * exist and belong to them, must not be revoked or expired, and must have been
 * issued under the current token version.
 */
export const resolveAdminSession = async (
  prisma: PrismaService,
  claims: SessionClaims,
): Promise<AuthenticatedAdmin> => {
  let user: {
    id: string;
    email: string;
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
    lastSeenAt: Date;
  } | null;

  try {
    [user, session] = await Promise.all([
      prisma.adminUser.findUnique({where: {id: claims.sub}}),
      prisma.adminSession.findUnique({where: {sessionId: claims.sid}}),
    ]);
  } catch (error) {
    throw mapPersistenceError(error).error;
  }

  if (user === null || user.active === false) {
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

  // Activity telemetry, written at most every five minutes per session. The
  // update is not awaited: a failure to record it must not reject a request the
  // session has already passed every authority check for.
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    void prisma.adminSession
      .update({where: {sessionId: session.sessionId}, data: {lastSeenAt: new Date()}})
      .catch(() => undefined);
  }

  return {
    id: user.id,
    email: user.email,
    role: RoleSchema.parse(user.role),
    sessionId: session.sessionId,
  };
};

/**
 * Sessions belonging to the signed-in administrator, newest first.
 *
 * A session is only ever listed to its owner, and only the owner's id is used in
 * the query, so a session id from another account cannot be enumerated.
 */
export const listAdminSessions = async (
  prisma: PrismaService,
  userId: string,
  currentSessionId: string,
): Promise<AdminSessionList> => {
  try {
    const rows = await prisma.adminSession.findMany({
      where: {userId, expiresAt: {gt: new Date()}},
      orderBy: [{createdAt: 'desc'}, {id: 'asc'}],
      take: 20,
    });
    return {
      sessions: rows.map((row): AdminSessionSummary => ({
        id: row.id,
        sessionId: row.sessionId,
        createdAt: row.createdAt.toISOString(),
        lastSeenAt: row.lastSeenAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
        ...(row.revokedAt === null ? {} : {revokedAt: row.revokedAt.toISOString()}),
        current: row.sessionId === currentSessionId,
        ...(row.ip === null ? {} : {ip: row.ip}),
        ...(row.userAgent === null ? {} : {userAgent: row.userAgent}),
      })),
    };
  } catch (error) {
    throw mapPersistenceError(error).error;
  }
};

/**
 * Revokes one of the caller's sessions.
 *
 * The predicate includes `userId`, so a session id belonging to someone else is
 * reported as missing rather than revoked (or confirmed to exist). Revoking the
 * current session is permitted and signs the caller out.
 */
export const revokeAdminSession = async (
  prisma: PrismaService,
  userId: string,
  sessionId: string,
): Promise<void> => {
  try {
    const session = await prisma.adminSession.findFirst({where: {sessionId, userId}});
    if (session === null) throw ApiError.notFound('No session with that identifier exists.');

    await prisma.$transaction(async (tx) => {
      await tx.adminSession.update({
        where: {sessionId},
        data: {revokedAt: session.revokedAt ?? new Date()},
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'auth_session_revoke',
          entityType: 'admin',
          entityId: sessionId,
        },
      });
    });
  } catch (error) {
    throw mapPersistenceError(error).error;
  }
};
