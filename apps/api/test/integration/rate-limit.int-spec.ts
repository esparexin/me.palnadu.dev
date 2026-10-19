import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import request from 'supertest';
import {SignJWT} from 'jose';
import {ApiErrorEnvelopeSchema, SESSION_LIFETIME_SECONDS} from '@me-palnadu/contracts';
import {createTestApp, TEST_AUTH_SECRET, TEST_ISSUER, TEST_AUDIENCE} from './test-app.js';
import {
  ADMIN_LIMIT_PER_WINDOW,
  PUBLIC_LIMIT_PER_WINDOW,
  RATE_LIMIT_WINDOW_MS,
} from '../../src/auth/throttling.js';
import {PrismaService} from '../../src/prisma/prisma.service.js';

/**
 * Rate limiting tests.
 *
 * These observe real refusals. A test that only reads the configured numbers would
 * prove the configuration parses; it would not prove anything is enforced. The
 * assertions here are that request N+1 receives 429 with the contract envelope, and
 * that requests up to N do not.
 *
 * Counters are in-memory per application instance (ADR-0007), so each test builds a
 * fresh app rather than sharing one and inheriting another test's budget. That is also
 * why these tests are slower than they look: 121 and 301 real requests are made.
 */

let app: Awaited<ReturnType<typeof createTestApp>>;
let prisma: PrismaService;

const newApp = async () => {
  const created = await createTestApp();
  return created;
};

beforeAll(async () => {
  app = await newApp();
  prisma = app.get(PrismaService);
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await prisma.auditLog.deleteMany({});
  await prisma.adminSession.deleteMany({});
  await prisma.adminUser.deleteMany({});
  await prisma.experience.deleteMany({});
});

/** Issues a valid administrator token with a live session. */
const seedAdmin = async () => {
  const user = await prisma.adminUser.create({
    data: {githubId: 230946749, login: 'esparexin', role: 'owner', tokenVersion: 0},
  });
  await prisma.adminSession.create({
    data: {
      sessionId: 'throttle-session',
      userId: user.id,
      tokenVersion: 0,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  const token = await new SignJWT({
    gh_id: user.githubId,
    role: user.role,
    sid: 'throttle-session',
    tv: 0,
  })
    .setProtectedHeader({alg: 'HS256'})
    .setSubject(user.id)
    .setIssuer(TEST_ISSUER)
    .setAudience(TEST_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS)
    .sign(new TextEncoder().encode(TEST_AUTH_SECRET));
  return {user, token};
};

describe('rate limiting configuration', () => {
  it('matches the limits documented in SECURITY.md 5', () => {
    expect(PUBLIC_LIMIT_PER_WINDOW).toBe(120);
    expect(ADMIN_LIMIT_PER_WINDOW).toBe(300);
    expect(RATE_LIMIT_WINDOW_MS).toBe(60_000);
  });
});

describe('public rate limiting', () => {
  it('refuses the request after the documented number of public reads', async () => {
    // A fresh app per test: counters are per instance and per process, so a shared app
    // would make this assertion depend on test order.
    const limited = await newApp();
    try {
      for (let attempt = 0; attempt < PUBLIC_LIMIT_PER_WINDOW; attempt += 1) {
        await request(limited.getHttpServer()).get('/api/experience').expect(200);
      }
      const refused = await request(limited.getHttpServer()).get('/api/experience').expect(429);

      expect(ApiErrorEnvelopeSchema.safeParse(refused.body).success).toBe(true);
      expect(refused.body.error.code).toBe('RATE_LIMITED');
      expect(refused.body.error.requestId).toBeTruthy();
    } finally {
      await limited.close();
    }
  }, 60_000);

  it('does not throttle a public read that has not reached the limit', async () => {
    const limited = await newApp();
    try {
      for (let attempt = 0; attempt < PUBLIC_LIMIT_PER_WINDOW - 1; attempt += 1) {
        const response = await request(limited.getHttpServer()).get('/api/experience');
        expect(response.status).toBe(200);
      }
    } finally {
      await limited.close();
    }
  }, 60_000);
});

describe('administrative rate limiting', () => {
  it('refuses an administrative write after the documented number of requests', async () => {
    const {token} = await seedAdmin();
    const limited = await newApp();
    try {
      // `publish` on a missing record answers 404, which proves the request reached the
      // handler and was counted; a 429 before that would prove nothing.
      for (let attempt = 0; attempt < ADMIN_LIMIT_PER_WINDOW; attempt += 1) {
        const response = await request(limited.getHttpServer())
          .post('/api/experience/does-not-exist/publish')
          .set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(404);
      }

      const refused = await request(limited.getHttpServer())
        .post('/api/experience/does-not-exist/publish')
        .set('Authorization', `Bearer ${token}`)
        .expect(429);

      expect(ApiErrorEnvelopeSchema.safeParse(refused.body).success).toBe(true);
      expect(refused.body.error.code).toBe('RATE_LIMITED');
    } finally {
      await limited.close();
    }
  }, 120_000);

  it('runs authentication before the throttler and spends no administrator budget', async () => {
    const {token} = await seedAdmin();
    const limited = await newApp();
    try {
      // ADMIN_LIMIT_PER_WINDOW + 10 unauthenticated attempts. The count is the point:
      // an earlier version of this test made 20, which sits below the 300/min
      // administrative limit and therefore could not tell "authentication ran first"
      // apart from "the throttler simply had not been reached yet".
      //
      // Two claims are proven together. Every response is 401 and never 429, so the
      // throttler did not run first. The administrator still has a full budget
      // afterwards, so none of it was charged to an anonymous caller - which, if it
      // could be, would let anyone lock the single administrator out.
      for (let attempt = 0; attempt < ADMIN_LIMIT_PER_WINDOW + 10; attempt += 1) {
        const anonymous = await request(limited.getHttpServer()).post(
          '/api/experience/does-not-exist/publish',
        );
        expect(anonymous.status).toBe(401);
      }

      const response = await request(limited.getHttpServer())
        .post('/api/experience/does-not-exist/publish')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(404);
    } finally {
      await limited.close();
    }
  }, 120_000);
});
