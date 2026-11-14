import {z} from 'zod';
import {NonEmptyTextSchema} from './common.js';

/**
 * Administrator credentials (ADR-0009).
 *
 * Authentication moved from GitHub OAuth to an email address and password. These
 * schemas are the single source of truth for both the API and the admin form, so the
 * two cannot disagree about what a valid credential looks like (SSOT_POLICY 4).
 *
 * The policy is defined here rather than in the admin application because a client-side
 * check is a convenience, never a control: the API re-applies every rule below.
 */

/**
 * Normalizes an email address for storage and comparison.
 *
 * Lower-cased with surrounding whitespace removed, so `Owner@Example.COM` and
 * `owner@example.com` cannot become two administrators. Nothing cleverer is done to
 * the local part: Gmail-style dot and plus-tag folding is a provider convention, not
 * a standard, and applying it would make one address compare unequal to another.
 */
export const normalizeEmail = (value: string): string => value.trim().toLowerCase();

export const AdminEmailSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  // Deliberately permissive about the shape and strict about the boundaries. A full
  // RFC 5322 parser rejects addresses that are legal in practice; this rejects only
  // what is unambiguously wrong.
  .regex(/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/u, 'must be a valid email address')
  .transform(normalizeEmail);

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 200;

/**
 * Small, exact-match list of passwords that appear in every credential-stuffing list.
 *
 * This is not a complete breached-password service and does not pretend to be. It
 * catches the passwords that a length rule alone would accept, which is the realistic
 * case for a single known account.
 */
export const COMMON_PASSWORDS: readonly string[] = [
  'password1234',
  'password12345',
  'qwertyuiop12',
  'administrator',
  'letmein12345',
  'welcome12345',
  'changeme1234',
  'passw0rd1234',
  'iloveyou1234',
  'monkey123456',
];

/**
 * Validates a candidate password.
 *
 * Returns the list of failures rather than a boolean so the provisioning command can
 * tell the owner exactly what to fix, while the login endpoint ignores the detail
 * entirely.
 */
export const passwordProblems = (password: string, email?: string): string[] => {
  const problems: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    problems.push(`must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    problems.push(`must be at most ${PASSWORD_MAX_LENGTH} characters`);
  }
  if (!/[a-z]/u.test(password)) problems.push('must contain a lowercase letter');
  if (!/[A-Z]/u.test(password)) problems.push('must contain an uppercase letter');
  if (!/[0-9]/u.test(password)) problems.push('must contain a digit');

  const lowered = password.toLowerCase();
  if (COMMON_PASSWORDS.includes(lowered)) {
    problems.push('is one of the most commonly used passwords');
  }

  if (email !== undefined) {
    const localPart = email.split('@')[0]?.toLowerCase() ?? '';
    if (localPart.length >= 4 && lowered.includes(localPart)) {
      problems.push('must not contain the email address');
    }
  }

  return problems;
};

export const PasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH)
  .refine((value) => passwordProblems(value).length === 0, {
    message: 'password does not meet the policy',
  });

export const LoginRequestSchema = z.object({
  email: AdminEmailSchema,
  // Deliberately NOT `PasswordSchema`. A login must not echo policy failures back to
  // the caller: that would confirm the password is the problem and turn login into an
  // oracle. The value is accepted as any string and judged only by the hash.
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  newPassword: PasswordSchema,
});

/** Public shape of the signed-in administrator. Never contains the hash. */
export const AdminIdentitySchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.enum(['owner', 'editor']),
  sessionId: z.string(),
});

export type AdminIdentity = z.infer<typeof AdminIdentitySchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

/**
 * The message returned for every failed sign-in.
 *
 * One string for an unknown address and for a wrong password. If these differ, login
 * becomes an account-enumeration oracle: an attacker can discover which addresses have
 * accounts without ever guessing a password.
 */
export const GENERIC_LOGIN_FAILURE = 'Those credentials were not recognised.';

export const LoginSuccessSchema = z.object({
  administrator: AdminIdentitySchema,
  /** Session lifetime in seconds; the browser stores an opaque cookie, not this. */
  expiresInSeconds: z.number().int().positive(),
});

export const AdminSessionResponseSchema = z.object({
  administrator: AdminIdentitySchema,
});
export type AdminSessionResponse = z.infer<typeof AdminSessionResponseSchema>;

export const NonEmptyString = NonEmptyTextSchema;
