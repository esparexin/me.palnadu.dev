import {SignJWT} from 'jose';
import {SESSION_LIFETIME_SECONDS, type SessionClaims} from '@me-palnadu/contracts';
import type {Env} from '../../config/env.js';

/**
 * Signs the bearer token the admin server forwards to the API.
 *
 * HS256, pinned algorithm, matching issuer and audience. The token and the session
 * row share `SESSION_LIFETIME_SECONDS`; the API still re-reads the row so revocation
 * takes effect before the signature expires.
 */
export const issueAdminToken = async (
  claims: Omit<SessionClaims, 'iss' | 'aud' | 'iat' | 'exp'>,
  env: Env,
): Promise<string> => {
  const secret =
    env.AUTH_SECRET ??
    (env.NODE_ENV !== 'production'
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
    .setIssuer(env.AUTH_ISSUER)
    .setAudience(env.AUTH_AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_LIFETIME_SECONDS)
    .sign(new TextEncoder().encode(secret));
};
