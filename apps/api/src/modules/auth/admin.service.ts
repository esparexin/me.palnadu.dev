import {Inject, Injectable, Logger} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import {
  RoleSchema,
  type AdminSessionList,
  type AdminSessionSummary,
  type AuditAction,
  type AuditEntityType,
  type Role,
  type SessionClaims,
} from '@me-palnadu/contracts';
import {SignJWT} from 'jose';
import type {Prisma} from '@prisma/client';
import {ApiError} from '../../common/api-error.js';
import {mapPersistenceError} from '../../common/persistence-error.js';
import {PrismaService} from '../../prisma/prisma.service.js';
import type {AuthenticatedAdmin} from '../../auth/admin-context.js';
import {hashPassword, verifyAgainstDecoy, verifyPassword} from '../../auth/password.js';
import {ENV} from '../../common/tokens.js';
import type {Env} from '../../config/env.js';
import {
  GENERIC_LOGIN_FAILURE,
  SESSION_LIFETIME_SECONDS,
  SESSION_MAX_AGE_SECONDS,
  normalizeEmail,
  passwordProblems,
} from '@me-palnadu/contracts';

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

/**
 * Administrator identity, sessions and audit (ADR-0009).
 *
 * Authentication is an email address and a scrypt password hash. The database is the
 * authority: a token proves who signed in once, it cannot express a revocation, so
 * `AdminSessionGuard` re-reads the user and the session on every protected request.
 *
 * The sign-in path deliberately performs the same amount of work whether or not the
 * account exists, and returns one message for every failure. See `authenticate`.
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Validates credentials and, on success, issues a session.
   *
   * Every failure path produces the same `ApiError` with the same message. Three
   * specific defences are in play:
   *
   * 1. Unknown address and wrong password are indistinguishable in the response.
   * 2. An unknown address still performs a scrypt verification against a decoy hash,
   *    so the two paths take comparable time. Equal bodies with unequal timing is
   *    still an enumeration oracle.
   * 3. The failure is logged server-side with the reason, because an operator needs
   *    it and the client must not receive it.
   */
  async authenticate(
    email: string,
    password: string,
    context?: {ip?: string; userAgent?: string},
  ): Promise<{admin: AuthenticatedAdmin; token: string}> {
    const normalized = normalizeEmail(email);
    let admin: {
      id: string;
      email: string;
      role: string;
      tokenVersion: number;
      active: boolean;
      passwordHash: string;
    } | null;

    try {
      admin = await this.prisma.adminUser.findUnique({where: {email: normalized}});
    } catch (error) {
      throw mapPersistenceError(error).error;
    }

    if (admin === null) {
      await verifyAgainstDecoy(password);
      throw this.loginFailure('unknown address');
    }

    const passwordMatches = await verifyPassword(password, admin.passwordHash);
    if (!passwordMatches) {
      // The counter is recorded but never acted on: acting on it would give an
      // attacker a denial-of-service against the single administrator.
      await this.recordFailedAttempt(admin.id);
      throw this.loginFailure('wrong password');
    }

    if (!admin.active) {
      await verifyAgainstDecoy(password);
      throw this.loginFailure('inactive administrator');
    }

    const authenticatedAdmin = admin;
    const role: Role = RoleSchema.parse(authenticatedAdmin.role);
    const sessionId = randomUUID();
    const now = Date.now();
    const expiresAt = new Date(now + SESSION_MAX_AGE_SECONDS * 1000);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.adminSession.create({
          data: {
            sessionId,
            userId: authenticatedAdmin.id,
            tokenVersion: authenticatedAdmin.tokenVersion,
            expiresAt,
            ...(context?.ip === undefined ? {} : {ip: context.ip}),
            ...(context?.userAgent === undefined ? {} : {userAgent: context.userAgent}),
          },
        });
        await tx.adminUser.update({
          where: {id: authenticatedAdmin.id},
          data: {lastLoginAt: new Date(now), failedLoginCount: 0},
        });
        await tx.auditLog.create({
          data: {
            actorId: authenticatedAdmin.id,
            action: 'auth_login',
            entityType: 'admin',
            entityId: authenticatedAdmin.id,
          },
        });
      });
    } catch (error) {
      throw mapPersistenceError(error).error;
    }

    const token = await this.issueToken({
      sub: authenticatedAdmin.id,
      email: authenticatedAdmin.email,
      role,
      sid: sessionId,
      tv: authenticatedAdmin.tokenVersion,
    });

    return {
      admin: {id: authenticatedAdmin.id, email: authenticatedAdmin.email, role, sessionId},
      token,
    };
  }

  /**
   * The one failure the caller ever sees.
   *
   * `INTERNAL_ERROR` is not used: a 500 would say the server broke, and would stand
   * out in a log against ordinary client errors.
   */
  private loginFailure(reason: string): ApiError {
    this.logger.warn(`admin sign-in refused: ${reason}`);
    return ApiError.unauthenticated(GENERIC_LOGIN_FAILURE);
  }

  private async recordFailedAttempt(userId: string): Promise<void> {
    try {
      await this.prisma.adminUser.update({
        where: {id: userId},
        data: {failedLoginCount: {increment: 1}},
      });
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  /**
   * Signs the bearer token the admin server forwards to the API.
   *
   * HS256, pinned algorithm, matching issuer and audience. The token lives for
   * `SESSION_LIFETIME_SECONDS` regardless of how long the session row lives: the row
   * is the ceiling, and a short-lived token limits the value of one that leaks.
   */
  private async issueToken(
    claims: Omit<SessionClaims, 'iss' | 'aud' | 'iat' | 'exp'>,
  ): Promise<string> {
    const secret =
      this.env.AUTH_SECRET ??
      (this.env.NODE_ENV !== 'production'
        ? 'me-palnadu-development-auth-secret-key-32-chars-min'
        : undefined);
    if (secret === undefined) {
      throw new Error('AUTH_SECRET is required to issue administrator sessions');
    }
    const issuedAt = Math.floor(Date.now() / 1000);
    return new SignJWT({
      email: claims.email,
      role: claims.role,
      sid: claims.sid,
      tv: claims.tv,
    })
      .setProtectedHeader({alg: 'HS256'})
      .setSubject(claims.sub)
      .setIssuer(this.env.AUTH_ISSUER)
      .setAudience(this.env.AUTH_AUDIENCE)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + SESSION_LIFETIME_SECONDS)
      .sign(new TextEncoder().encode(secret));
  }

  /**
   * Revokes one session.
   *
   * The row is kept with `revokedAt` set rather than deleted, so "signed out at" stays
   * answerable after the fact.
   */
  async logout(sessionId: string, actorId: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
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
  }

  /**
   * Changes the password and invalidates every existing session.
   *
   * `tokenVersion` is incremented in the same transaction as the hash write. Keeping
   * a session alive after the credential it came from has changed is what makes a
   * password change feel broken, and it leaves a stolen token usable until it expires.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    let admin: {id: string; email: string; passwordHash: string; tokenVersion: number} | null;
    try {
      admin = await this.prisma.adminUser.findUnique({where: {id: userId}});
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
    if (admin === null) throw ApiError.unauthenticated('The session token is not valid.');
    if (!(await verifyPassword(currentPassword, admin.passwordHash))) {
      throw ApiError.unauthenticated('The current password is not correct.');
    }

    const problems = passwordProblems(newPassword, admin.email);
    if (problems.length > 0) {
      throw ApiError.validationFailed(
        'The new password does not meet the policy.',
        problems.map((problem) => ({path: 'newPassword', message: problem})),
      );
    }

    const targetAdmin = admin;
    const passwordHash = await hashPassword(newPassword);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.adminUser.update({
          where: {id: targetAdmin.id},
          data: {passwordHash, tokenVersion: {increment: 1}},
        });
        await tx.auditLog.create({
          data: {
            actorId: targetAdmin.id,
            action: 'auth_password_change',
            entityType: 'admin',
            entityId: targetAdmin.id,
          },
        });
      });
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  /**
   * Resolves a session claim to a live administrator.
   *
   * Order follows SECURITY.md §4: the user must exist and be active, the session must
   * exist and belong to them, must not be revoked or expired, and must have been
   * issued under the current token version.
   */
  async resolveSession(claims: SessionClaims): Promise<AuthenticatedAdmin> {
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
        this.prisma.adminUser.findUnique({where: {id: claims.sub}}),
        this.prisma.adminSession.findUnique({where: {sessionId: claims.sid}}),
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
      void this.prisma.adminSession
        .update({where: {sessionId: session.sessionId}, data: {lastSeenAt: new Date()}})
        .catch(() => undefined);
    }

    return {
      id: user.id,
      email: user.email,
      role: RoleSchema.parse(user.role),
      sessionId: session.sessionId,
    };
  }

  /**
   * Sessions belonging to the signed-in administrator, newest first.
   *
   * A session is only ever listed to its owner, and only the owner's id is used in
   * the query, so a session id from another account cannot be enumerated.
   */
  async listSessions(userId: string, currentSessionId: string): Promise<AdminSessionList> {
    try {
      const rows = await this.prisma.adminSession.findMany({
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
  }

  /**
   * Revokes one of the caller's sessions.
   *
   * The predicate includes `userId`, so a session id belonging to someone else is
   * reported as missing rather than revoked (or confirmed to exist). Revoking the
   * current session is permitted and signs the caller out.
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    try {
      const session = await this.prisma.adminSession.findFirst({where: {sessionId, userId}});
      if (session === null) throw ApiError.notFound('No session with that identifier exists.');

      await this.prisma.$transaction(async (tx) => {
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
  }

  /** Writes an audit entry using the caller's transaction client (ADR-0006 §4). */
  async writeAudit(tx: Prisma.TransactionClient, entry: AuditEntry): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorId: entry.actorId,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        ...(entry.detail === undefined ? {} : {detail: entry.detail}),
      },
    });
  }
}
