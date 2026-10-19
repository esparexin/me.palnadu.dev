import {Inject, Injectable, type CanActivate, type ExecutionContext} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {jwtVerify} from 'jose';
import {SessionClaimsSchema, type SessionClaims} from '@me-palnadu/contracts';
import {ApiError} from '../common/api-error.js';
import {ENV} from '../common/tokens.js';
import type {Env} from '../config/env.js';
import type {AuthenticatedAdmin} from './admin-context.js';
import {IS_PUBLIC_KEY} from './public.decorator.js';
import {AdminService} from '../modules/auth/admin.service.js';

/**
 * The API authorization boundary (SECURITY.md section 4).
 *
 * Design rule, and the reason this class exists in this shape: **the database is the
 * authority, never the token.** A JWT proves who signed in once; it cannot express a
 * revocation. So the guard verifies the signature first, then re-reads the
 * administrator and the session from the database on every protected request. That
 * costs one lookup per request and buys immediate revocation.
 *
 * The guard fails closed. A controller without `@Public()` is protected by default,
 * so forgetting an annotation produces a 401 rather than an open door.
 */
@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(AdminService) private readonly admin: AdminService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) return true;

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();

    const token = extractBearerToken(request.headers['authorization']);
    if (token === null) {
      throw ApiError.unauthenticated('Missing credentials.', [
        {path: 'authorization', message: 'a bearer token is required'},
      ]);
    }

    const claims = await this.verifyToken(token);
    const principal = await this.admin.resolveSession(claims);

    // Attach after every check has passed, so a partially authenticated request can
    // never reach a handler.
    (request as {admin?: AuthenticatedAdmin}).admin = principal;
    return true;
  }

  /**
   * Verifies the signature only. Everything about *authority* is decided later,
   * against the database.
   */
  private async verifyToken(token: string): Promise<SessionClaims> {
    const secret = this.env.AUTH_SECRET;
    if (secret === undefined) {
      // Production configuration already refuses to boot without it; this is the
      // guard for any other environment that reaches it.
      throw new Error('AUTH_SECRET is required to verify administrator sessions');
    }

    let payload: unknown;
    try {
      const result = await jwtVerify(token, new TextEncoder().encode(secret), {
        // Pinned: an unsigned or algorithm-substituted token is rejected outright.
        algorithms: ['HS256'],
        issuer: this.env.AUTH_ISSUER,
        audience: this.env.AUTH_AUDIENCE,
        clockTolerance: 0,
      });
      payload = result.payload;
    } catch {
      // Every failure - bad signature, wrong secret, wrong issuer, expired,
      // malformed, alg:none - is the same answer to the caller, so the response
      // cannot be used as an oracle to distinguish which check failed.
      //
      // An earlier draft tried to separate "the token is bad" from "verification is
      // broken" by inspecting the error type. That does not work: jose derives almost
      // every rejection from JOSEError, so the branch turned ordinary bad tokens into
      // 500s and handed an attacker exactly the oracle this comment rules out.
      // Genuine misconfiguration is caught above, before verification is attempted.
      throw new ApiError('UNAUTHENTICATED', 'The session token is not valid.');
    }

    // jwtVerify already checked the signature; the shape is still untrusted input,
    // so it goes through the contract schema rather than being trusted by position.
    const claims: Record<string, unknown> = {...(payload as Record<string, unknown>)};
    const parsed = SessionClaimsSchema.safeParse({
      sub: claims['sub'],
      gh_id: claims['gh_id'],
      role: claims['role'],
      sid: claims['sid'],
      tv: claims['tv'],
      iss: claims['iss'],
      aud: claims['aud'],
      iat: claims['iat'],
      exp: claims['exp'],
    });
    if (!parsed.success) {
      throw new ApiError('UNAUTHENTICATED', 'The session token is not valid.');
    }
    return parsed.data;
  }
}

const extractBearerToken = (header: string | string[] | undefined): string | null => {
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== 'string') return null;
  const [scheme, token, ...rest] = value.trim().split(/\s+/u);
  if (rest.length > 0) return null;
  if (scheme === undefined || scheme.toLowerCase() !== 'bearer' || token === undefined) return null;
  return token.length === 0 ? null : token;
};
