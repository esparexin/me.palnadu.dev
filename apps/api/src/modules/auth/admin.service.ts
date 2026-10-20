import {Inject, Injectable, Logger} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import {
  RoleSchema,
  type AdminSessionList,
  type Role,
  type SessionClaims,
  GENERIC_LOGIN_FAILURE,
  SESSION_MAX_AGE_SECONDS,
  normalizeEmail,
} from '@me-palnadu/contracts';
import type {Prisma} from '@prisma/client';
import {ApiError} from '../../common/api-error.js';
import {mapPersistenceError} from '../../common/persistence-error.js';
import {PrismaService} from '../../prisma/prisma.service.js';
import type {AuthenticatedAdmin} from '../../auth/admin-context.js';
import {verifyAgainstDecoy, verifyPassword} from '../../auth/password.js';
import {ENV} from '../../common/tokens.js';
import type {Env} from '../../config/env.js';
import {type AuditEntry, writeAuditEntry} from './admin-audit.js';
import {issueAdminToken} from './admin-token.js';
import {
  listAdminSessions,
  logoutAdminSession,
  resolveAdminSession,
  revokeAdminSession,
} from './admin-sessions.js';
import {changeAdminPassword} from './admin-password.js';

export {type AuditEntry, writeAuditEntry};

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

    const token = await issueAdminToken(
      {
        sub: authenticatedAdmin.id,
        email: authenticatedAdmin.email,
        role,
        sid: sessionId,
        tv: authenticatedAdmin.tokenVersion,
      },
      this.env,
    );

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
   * Revokes one session.
   *
   * The row is kept with `revokedAt` set rather than deleted, so "signed out at" stays
   * answerable after the fact.
   */
  async logout(sessionId: string, actorId: string): Promise<void> {
    return logoutAdminSession(this.prisma, sessionId, actorId);
  }

  /**
   * Changes the password and invalidates every existing session.
   *
   * `tokenVersion` is incremented in the same transaction as the hash write.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    return changeAdminPassword(this.prisma, userId, currentPassword, newPassword);
  }

  /**
   * Resolves a session claim to a live administrator.
   *
   * Order follows SECURITY.md §4: the user must exist and be active, the session must
   * exist and belong to them, must not be revoked or expired, and must have been
   * issued under the current token version.
   */
  async resolveSession(claims: SessionClaims): Promise<AuthenticatedAdmin> {
    return resolveAdminSession(this.prisma, claims);
  }

  /**
   * Sessions belonging to the signed-in administrator, newest first.
   *
   * A session is only ever listed to its owner, and only the owner's id is used in
   * the query, so a session id from another account cannot be enumerated.
   */
  async listSessions(userId: string, currentSessionId: string): Promise<AdminSessionList> {
    return listAdminSessions(this.prisma, userId, currentSessionId);
  }

  /**
   * Revokes one of the caller's sessions.
   *
   * The predicate includes `userId`, so a session id belonging to someone else is
   * reported as missing rather than revoked (or confirmed to exist). Revoking the
   * current session is permitted and signs the caller out.
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    return revokeAdminSession(this.prisma, userId, sessionId);
  }

  /** Writes an audit entry using the caller's transaction client (ADR-0006 §4). */
  async writeAudit(tx: Prisma.TransactionClient, entry: AuditEntry): Promise<void> {
    return writeAuditEntry(tx, entry);
  }
}
