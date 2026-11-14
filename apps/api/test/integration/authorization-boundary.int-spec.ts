import type {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {ApiErrorEnvelopeSchema, OWNER_EMAIL, SESSION_LIFETIME_SECONDS} from '@me-palnadu/contracts';
import {createTestApp, TEST_ISSUER as ISSUER, TEST_AUDIENCE as AUDIENCE} from './test-app.js';
import {PrismaService} from '../../src/prisma/prisma.service.js';
import {
  issueTestToken as issueToken,
  seedTestAdmin,
  PROTECTED_EXPERIENCE_ROUTE as PROTECTED,
  TEST_EXPERIENCE_SLUG as SLUG,
} from './test-auth-helpers.js';

describe('authorization boundary', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
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

  const seedAdmin = (overrides: {role?: string; tokenVersion?: number} = {}) =>
    seedTestAdmin(prisma, overrides);

  const seedExperience = (overrides: Record<string, unknown> = {}) =>
    prisma.experience.create({
      data: {
        slug: SLUG,
        org: 'Example Organisation',
        title: 'Endpoint Engineer',
        startDate: '2023-04',
        endDate: '2026-01',
        current: false,
        kind: 'full_time',
        summary: 'Placeholder summary used only in tests.',
        published: true,
        publishedAt: new Date(),
        ...overrides,
      },
    });

  it('refuses a request with no Authorization header', async () => {
    const response = await request(app.getHttpServer()).post(PROTECTED).expect(401);
    expect(ApiErrorEnvelopeSchema.safeParse(response.body).success).toBe(true);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
    expect(response.body.error.requestId).toBeTruthy();
  });

  it('treats a missing credential as an authentication failure, not a body error', async () => {
    const response = await request(app.getHttpServer()).post(PROTECTED).expect(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('refuses a malformed Authorization header', async () => {
    for (const header of ['Basic abc123', 'Bearer', 'Bearer a b', 'token abc']) {
      await request(app.getHttpServer()).post(PROTECTED).set('Authorization', header).expect(401);
    }
  });

  it('refuses a token signed with a different secret', async () => {
    const token = await issueToken(
      {},
      new TextEncoder().encode('a-different-secret-of-sufficient-length'),
    );
    await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('refuses an unsigned token', async () => {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const forged = `${encode({alg: 'none', typ: 'JWT'})}.${encode({
      sub: 'x',
      email: OWNER_EMAIL,
      role: 'owner',
      sid: 's',
      tv: 0,
      iss: ISSUER,
      aud: AUDIENCE,
      iat: now,
      exp: now + SESSION_LIFETIME_SECONDS,
    })}.`;
    await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${forged}`)
      .expect(401);
  });

  it('refuses an expired token', async () => {
    const {user} = await seedAdmin();
    const expired = await issueToken({sub: user.id, exp: Math.floor(Date.now() / 1000) - 60});
    await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
  });

  it('refuses a wrong issuer and a wrong audience', async () => {
    const {user} = await seedAdmin();
    await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${await issueToken({sub: user.id, iss: 'somebody-else'})}`)
      .expect(401);
    await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${await issueToken({sub: user.id, aud: 'somebody-else'})}`)
      .expect(401);
  });

  it('refuses a signed token for a non-administrator with 403', async () => {
    const token = await issueToken({sub: '507f1f77bcf86cd799439011', email: 'unknown@example.com'});
    const response = await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('refuses a deactivated administrator', async () => {
    const {user, token} = await seedAdmin();
    await prisma.adminUser.update({where: {id: user.id}, data: {active: false}});
    await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('refuses a revoked session', async () => {
    const {session, token} = await seedAdmin();
    await prisma.adminSession.update({where: {id: session.id}, data: {revokedAt: new Date()}});
    await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('refuses an expired session record even when the token has not expired', async () => {
    const {user, session} = await seedAdmin();
    await prisma.adminSession.update({
      where: {id: session.id},
      data: {expiresAt: new Date(Date.now() - 1000)},
    });
    const token = await issueToken({
      sub: user.id,
      exp: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS,
    });
    await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('refuses a session that belongs to a different administrator', async () => {
    await seedAdmin();
    const other = await prisma.adminUser.create({
      data: {
        email: 'other-admin@me.palnadu.dev',
        passwordHash: 'scrypt$65536$8$1$dummySalt$dummyHash',
        role: 'owner',
      },
    });
    const token = await issueToken({sub: other.id, email: other.email});
    await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('invalidates every session when the token version is incremented', async () => {
    const {user, token} = await seedAdmin();
    await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    await prisma.adminUser.update({where: {id: user.id}, data: {tokenVersion: 1}});
    await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('ignores a forged role claim in favour of the database', async () => {
    const {user} = await seedAdmin({role: 'editor'});
    await seedExperience({published: false, publishedAt: null});
    const token = await issueToken({sub: user.id, role: 'owner'});

    await request(app.getHttpServer())
      .post(`/api/experience/${SLUG}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const published = await prisma.experience.findUnique({where: {slug: SLUG}});
    expect(published?.published).toBe(true);
  });

  it('fails closed when the stored role is outside the canonical enum', async () => {
    const {user} = await seedAdmin({role: 'editor'});
    await prisma.adminUser.update({where: {id: user.id}, data: {role: 'superuser'}});
    const token = await issueToken({sub: user.id, role: 'owner'});

    const response = await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${token}`)
      .expect(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(response.body)).not.toContain('superuser');
  });

  it('accepts a genuinely valid session', async () => {
    const {token} = await seedAdmin();
    await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});
