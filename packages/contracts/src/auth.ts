import {z} from 'zod';
import {RoleSchema, type Role} from './enums.js';
import {AdminEmailSchema} from './credentials.js';

/**
 * Administrator identity and session claims (SECURITY.md §4).
 *
 * Identity moved from GitHub OAuth to email and password in `ADR-0009`. The GitHub
 * numeric id is gone: `sub` is the `AdminUser` id and `email` is carried for audit
 * and for display, never for authorization — the API re-reads the database on every
 * protected request.
 */

/**
 * The owner address, used by the provisioning command and its tests.
 *
 * There is no allowlist in the database sense any more. Authentication is an
 * `AdminUser` row; this constant exists so the provisioning command and the test
 * fixtures agree on a value without hardcoding it in several places.
 */
export const OWNER_EMAIL = 'owner@me.palnadu.dev';

export const AdminRoleSchema = RoleSchema;

/**
 * Decoded session claims. `role` is advisory only: the API re-reads the database and
 * the stored role is what decides.
 */
export const SessionClaimsSchema = z.object({
  /** The `AdminUser` id. */
  sub: z.string().min(1),
  /** Carried for audit and display. Not an authorization input. */
  email: AdminEmailSchema,
  role: RoleSchema,
  /** The `AdminSession.sessionId` this token was issued against. */
  sid: z.string().min(1),
  /** Token version at issue; a mismatch invalidates the session. */
  tv: z.number().int().min(0),
  iss: z.string().min(1),
  aud: z.string().min(1),
  iat: z.number().int(),
  exp: z.number().int(),
});
export type SessionClaims = z.infer<typeof SessionClaimsSchema>;

export const SESSION_LIFETIME_SECONDS = 15 * 60;
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
export const JWT_ALGORITHM = 'HS256' as const;

/**
 * The browser cookie.
 *
 * `__Secure-` rather than `__Host-`: the OAuth redirect previously required
 * `SameSite=Lax` so the cookie would survive the return trip, and `__Host-` forbids
 * that combination.
 */
export const SESSION_COOKIE_NAME = '__Secure-me-palnadu-admin.session';

export type {Role};
