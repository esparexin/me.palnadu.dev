import {randomUUID} from 'node:crypto';
import {SignJWT} from 'jose';
import {OWNER_EMAIL, SESSION_LIFETIME_SECONDS} from '@me-palnadu/contracts';
import {TEST_AUTH_SECRET, TEST_ISSUER, TEST_AUDIENCE} from './test-app.js';
import type {PrismaService} from '../../src/prisma/prisma.service.js';
import {hashPassword} from '../../src/auth/password.js';

export const SECRET_BYTES = new TextEncoder().encode(TEST_AUTH_SECRET);
export const PROTECTED_EXPERIENCE_ROUTE = '/api/experience/anything/publish';
export const TEST_EXPERIENCE_SLUG = 'example-org-endpoint-engineer';

export const VALID_EXPERIENCE_BODY = {
  slug: TEST_EXPERIENCE_SLUG,
  org: 'Example Organisation',
  title: 'Endpoint Engineer',
  location: 'Remote',
  startDate: '2023-04',
  endDate: '2026-01',
  current: false,
  kind: 'full_time',
  summary: 'Placeholder summary used only in tests.',
  highlights: [],
  tech: [],
  sortIndex: 0,
  published: false,
};

export const issueTestToken = async (
  overrides: Partial<{
    sub: string;
    email: string;
    role: string;
    sid: string;
    tv: number;
    exp: number;
    iss: string;
    aud: string;
  }> = {},
  secret: Uint8Array = SECRET_BYTES,
): Promise<string> =>
  new SignJWT({
    email: overrides.email ?? OWNER_EMAIL,
    role: overrides.role ?? 'owner',
    sid: overrides.sid ?? 'session-under-test',
    tv: overrides.tv ?? 0,
  })
    .setProtectedHeader({alg: 'HS256'})
    .setSubject(overrides.sub ?? 'placeholder-subject')
    .setIssuer(overrides.iss ?? TEST_ISSUER)
    .setAudience(overrides.aud ?? TEST_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(overrides.exp ?? Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS)
    .sign(secret);

export const seedTestAdmin = async (
  prisma: PrismaService,
  overrides: {role?: string; tokenVersion?: number} = {},
) => {
  const user = await prisma.adminUser.create({
    data: {
      email: OWNER_EMAIL,
      passwordHash: 'scrypt$65536$8$1$dummySalt$dummyHash',
      role: overrides.role ?? 'owner',
      tokenVersion: overrides.tokenVersion ?? 0,
    },
  });
  const session = await prisma.adminSession.create({
    data: {
      sessionId: 'session-under-test',
      userId: user.id,
      tokenVersion: user.tokenVersion,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  const token = await issueTestToken({sub: user.id, email: user.email, tv: user.tokenVersion});
  return {user, session, token};
};

export const seedTestOwner = async (
  prisma: PrismaService,
  overrides: {active?: boolean; password?: string} = {},
  password = 'StrongOwnerPassword2026!',
) => {
  const passwordHash = await hashPassword(overrides.password ?? password);
  return prisma.adminUser.create({
    data: {
      email: OWNER_EMAIL,
      passwordHash,
      role: 'owner',
      tokenVersion: 0,
      active: overrides.active ?? true,
    },
  });
};

export const seedTestSession = async (
  prisma: PrismaService,
  user: {id: string; email: string; tokenVersion: number; role: string},
) => {
  const sessionId = randomUUID();
  const session = await prisma.adminSession.create({
    data: {
      sessionId,
      userId: user.id,
      tokenVersion: user.tokenVersion,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  const token = await issueTestToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    sid: sessionId,
    tv: user.tokenVersion,
  });
  return {session, token, sessionId};
};
