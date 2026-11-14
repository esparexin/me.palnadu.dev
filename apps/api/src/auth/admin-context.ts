import type {Role} from '@me-palnadu/contracts';

/**
 * The authenticated principal, attached to the request by `AdminSessionGuard`.
 *
 * Every field is read from the database on the request that carries it, never from the
 * token. `role` in particular is the stored role: a token claiming `owner` does not
 * make the caller an owner.
 */
export interface AuthenticatedAdmin {
  id: string;
  email: string;
  role: Role;
  /** The `AdminSession` this request's token was issued against. */
  sessionId: string;
}

/**
 * The Express request as seen by guards, controllers and the throttler.
 *
 * `admin` is present only after `AdminSessionGuard` has resolved the session against
 * the database.
 */
export interface RequestWithAdmin {
  admin?: AuthenticatedAdmin;
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
}
