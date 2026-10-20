import {describe, expect, it} from 'vitest';
import {
  AdminEmailSchema,
  PasswordSchema,
  passwordProblems,
  LoginRequestSchema,
  ChangePasswordRequestSchema,
  OWNER_EMAIL,
  SESSION_COOKIE_NAME,
  SessionClaimsSchema,
} from './index.js';

describe('administrator credentials (ADR-0009)', () => {
  it('normalizes email addresses and rejects invalid ones', () => {
    expect(AdminEmailSchema.parse('  Owner@Me.Palnadu.Dev  ')).toBe('owner@me.palnadu.dev');
    expect(AdminEmailSchema.safeParse('not-an-email').success).toBe(false);
    expect(AdminEmailSchema.safeParse('@missing-local.com').success).toBe(false);
    expect(AdminEmailSchema.safeParse('owner@').success).toBe(false);
  });

  it('enforces password policy rules', () => {
    expect(PasswordSchema.safeParse('Short1!').success).toBe(false);
    expect(PasswordSchema.safeParse('alllowercaseletters123').success).toBe(false);
    expect(PasswordSchema.safeParse('ALLUPPERCASELETTERS123').success).toBe(false);
    expect(PasswordSchema.safeParse('LettersWithoutDigits').success).toBe(false);
    expect(PasswordSchema.safeParse('password1234').success).toBe(false);

    const email = 'owner@me.palnadu.dev';
    const problemsWithEmail = passwordProblems('StrongOwnerPassword123!', email);
    expect(
      problemsWithEmail.some((problem) => problem.includes('must not contain the email address')),
    ).toBe(true);

    expect(PasswordSchema.safeParse('CorrectHorseBattery2026!').success).toBe(true);
  });

  it('accepts valid login and password change requests', () => {
    const login = LoginRequestSchema.parse({
      email: '  OWNER@me.palnadu.dev  ',
      password: 'any-password-string',
    });
    expect(login.email).toBe('owner@me.palnadu.dev');
    expect(login.password).toBe('any-password-string');

    const change = ChangePasswordRequestSchema.safeParse({
      currentPassword: 'old-password',
      newPassword: 'CorrectHorseBattery2026!',
    });
    expect(change.success).toBe(true);
  });

  it('exposes valid owner email and cookie name constants', () => {
    expect(AdminEmailSchema.safeParse(OWNER_EMAIL).success).toBe(true);
    expect(SESSION_COOKIE_NAME).toMatch(/^__Secure-/);
  });
});

describe('session claims (ADR-0009)', () => {
  const claims = {
    sub: 'admin_1',
    email: 'owner@me.palnadu.dev',
    role: 'owner',
    sid: 'sess_1',
    tv: 0,
    iss: 'me-palnadu-admin',
    aud: 'me-palnadu-api',
    iat: 1_700_000_000,
    exp: 1_700_000_900,
  };

  it('accepts a well-formed claim set', () => {
    expect(SessionClaimsSchema.safeParse(claims).success).toBe(true);
  });

  it('requires a token version so revocation can be compared', () => {
    expect(SessionClaimsSchema.safeParse({...claims, tv: undefined}).success).toBe(false);
  });

  it('requires a valid email address claim', () => {
    expect(SessionClaimsSchema.safeParse({...claims, email: 'invalid-email'}).success).toBe(false);
  });

  it('rejects an unknown role', () => {
    expect(SessionClaimsSchema.safeParse({...claims, role: 'superuser'}).success).toBe(false);
  });
});
