import { z } from 'zod';
import { RoleSchema, type Role } from './enums.js';
import { NonEmptyTextSchema } from './common.js';

/**
 * Administrator allowlist seed (SECURITY.md 4.1).
 *
 * The immutable numeric GitHub id is the identity. A login can be renamed; an id
 * cannot be transferred. This array is only the seed: `AdminUser` in the database
 * is the authority, and a GitHub identity absent from the database cannot write
 * anything regardless of what any token claims.
 */
export const ADMIN_ALLOWLIST = [
  { githubId: 230946749, login: 'esparexin', role: 'owner' },
] as const;

export const AdminAllowlistEntrySchema = z.object({
  githubId: z.number().int().positive(),
  login: NonEmptyTextSchema.max(60),
  role: RoleSchema,
});
export type AdminAllowlistEntry = z.infer<typeof AdminAllowlistEntrySchema>;

/** Decoded session claims. `role` is advisory: the API re-reads the database. */
export const SessionClaimsSchema = z.object({
  sub: z.string().min(1),
  gh_id: z.number().int().positive(),
  role: RoleSchema,
  sid: z.string().min(1),
  tv: z.number().int().min(0),
  iss: z.string().min(1),
  aud: z.string().min(1),
  iat: z.number().int(),
  exp: z.number().int(),
});
export type SessionClaims = z.infer<typeof SessionClaimsSchema>;

export const SESSION_LIFETIME_SECONDS = 15 * 60;
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
export const SESSION_COOKIE_NAME = '__Secure-me-palnadu-admin.session';
export const JWT_ALGORITHM = 'HS256' as const;

/** True when the GitHub identity is seeded as an administrator. */
export const isAllowlistedGithubId = (
  githubId: number,
): boolean => ADMIN_ALLOWLIST.some((entry) => entry.githubId === githubId);

export type { Role };