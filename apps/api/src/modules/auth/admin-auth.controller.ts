import {Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Req} from '@nestjs/common';
import {
  AdminIdentitySchema,
  AdminSessionListSchema,
  ChangePasswordRequestSchema,
  LoginRequestSchema,
  RevokeSessionSchema,
  SESSION_LIFETIME_SECONDS,
  type ChangePasswordRequest,
  type LoginRequest,
  type RevokeSession,
} from '@me-palnadu/contracts';
import {AdminService} from './admin.service.js';
import {Public} from '../../auth/public.decorator.js';
import {LoginRateLimit} from '../../auth/throttling.js';
import {ApiError} from '../../common/api-error.js';
import {ZodValidationPipe} from '../../common/zod-validation.pipe.js';
import type {RequestWithAdmin} from '../../auth/admin-context.js';

/**
 * Administrator authentication over HTTP (ADR-0009).
 *
 * The token is returned in the response body for the admin server to place in an
 * `HttpOnly` cookie. It is never returned to browser JavaScript: the admin application
 * calls this from a server route handler, so the value transits server-to-server.
 */
@Controller('api/auth')
export class AdminAuthController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}

  /**
   * Returns the current authenticated administrator session.
   *
   * Protected by `AdminSessionGuard`: the database is re-checked on every request.
   */
  @Get('session')
  @HttpCode(HttpStatus.OK)
  getSession(@Req() request: RequestWithAdmin) {
    const principal = this.requirePrincipal(request);
    return {
      administrator: AdminIdentitySchema.parse(principal),
    };
  }

  /**
   * Signs in.
   *
   * `@Public()` because a caller with no session is precisely the caller who needs
   * this route; the guard would otherwise reject everyone. Protection comes from the
   * rate limiter below and from the credential check, not from the session guard.
   *
   * Returns no cookie itself. Setting one is the admin application's job, and having
   * two layers write cookies for the same session is how they diverge.
   */
  @Public()
  @LoginRateLimit()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(LoginRequestSchema)) body: LoginRequest,
    @Req() request: RequestWithAdmin,
  ) {
    const userAgent = request.headers?.['user-agent'];
    const {admin, token} = await this.admin.authenticate(body.email, body.password, {
      ...(request.ip === undefined ? {} : {ip: request.ip}),
      ...(typeof userAgent === 'string' ? {userAgent: userAgent.slice(0, 400)} : {}),
    });
    return {
      administrator: AdminIdentitySchema.parse(admin),
      token,
      expiresInSeconds: SESSION_LIFETIME_SECONDS,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() request: RequestWithAdmin) {
    const principal = this.requirePrincipal(request);
    await this.admin.logout(principal.sessionId, principal.id);
  }

  /** Lists the caller's live sessions, marking the one this request used. */
  @Get('sessions')
  @HttpCode(HttpStatus.OK)
  async sessions(@Req() request: RequestWithAdmin) {
    const principal = this.requirePrincipal(request);
    return AdminSessionListSchema.parse(
      await this.admin.listSessions(principal.id, principal.sessionId),
    );
  }

  /** Revokes one of the caller's sessions. Revoking the current one signs out. */
  @Post('sessions/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @Body(new ZodValidationPipe(RevokeSessionSchema)) body: RevokeSession,
    @Req() request: RequestWithAdmin,
  ) {
    const principal = this.requirePrincipal(request);
    await this.admin.revokeSession(principal.id, body.sessionId);
  }

  /**
   * Changes the password and invalidates every session, including this one.
   *
   * The caller is expected to sign in again afterwards; that is the intended
   * consequence of `tokenVersion` being incremented.
   */
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Body(new ZodValidationPipe(ChangePasswordRequestSchema)) body: ChangePasswordRequest,
    @Req() request: RequestWithAdmin,
  ) {
    const principal = this.requirePrincipal(request);
    await this.admin.changePassword(principal.id, body.currentPassword, body.newPassword);
  }

  private requirePrincipal(request: RequestWithAdmin) {
    const principal = request.admin;
    if (principal === undefined) {
      throw new ApiError('UNAUTHENTICATED', 'The session token is not valid.');
    }
    return principal;
  }
}
