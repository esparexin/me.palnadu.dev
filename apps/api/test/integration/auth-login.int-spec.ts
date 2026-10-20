import type {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {
  GENERIC_LOGIN_FAILURE,
  OWNER_EMAIL,
  SESSION_LIFETIME_SECONDS,
  type ApiErrorEnvelope,
} from '@me-palnadu/contracts';
import {createTestApp} from './test-app.js';
import {PrismaService} from '../../src/prisma/prisma.service.js';
import {seedTestOwner} from './test-auth-helpers.js';

describe('Admin authentication login (ADR-0009)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const PASSWORD = 'StrongOwnerPassword2026!';

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

  const seedOwner = (overrides: {active?: boolean; password?: string} = {}) =>
    seedTestOwner(prisma, overrides, PASSWORD);

  describe('POST /api/auth/login', () => {
    it('authenticates valid credentials, creates session, updates lastLoginAt and logs audit', async () => {
      const user = await seedOwner();
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({email: OWNER_EMAIL, password: PASSWORD})
        .expect(200);

      expect(response.body.administrator).toEqual({
        id: user.id,
        email: OWNER_EMAIL,
        role: 'owner',
        sessionId: expect.any(String),
      });
      expect(typeof response.body.token).toBe('string');
      expect(response.body.expiresInSeconds).toBe(SESSION_LIFETIME_SECONDS);

      const session = await prisma.adminSession.findUnique({
        where: {sessionId: response.body.administrator.sessionId},
      });
      expect(session).not.toBeNull();
      expect(session?.userId).toBe(user.id);
      expect(session?.revokedAt).toBeNull();
      expect(session?.tokenVersion).toBe(0);

      const updatedUser = await prisma.adminUser.findUnique({where: {id: user.id}});
      expect(updatedUser?.lastLoginAt).not.toBeNull();
      expect(updatedUser?.failedLoginCount).toBe(0);

      const audit = await prisma.auditLog.findFirst({
        where: {actorId: user.id, action: 'auth_login'},
      });
      expect(audit).not.toBeNull();
      expect(audit?.entityType).toBe('admin');
      expect(audit?.entityId).toBe(user.id);
    });

    it('normalizes email address with whitespace and casing', async () => {
      await seedOwner();
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({email: '  OWNER@me.palnadu.dev  ', password: PASSWORD})
        .expect(200);

      expect(response.body.administrator.email).toBe(OWNER_EMAIL);
    });

    it('rejects incorrect password with generic message and increments failedLoginCount', async () => {
      const user = await seedOwner();
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({email: OWNER_EMAIL, password: 'WrongPassword123!'})
        .expect(401);

      const body = response.body as ApiErrorEnvelope;
      expect(body.error.code).toBe('UNAUTHENTICATED');
      expect(body.error.message).toBe(GENERIC_LOGIN_FAILURE);

      const updatedUser = await prisma.adminUser.findUnique({where: {id: user.id}});
      expect(updatedUser?.failedLoginCount).toBe(1);
      const sessionCount = await prisma.adminSession.count();
      expect(sessionCount).toBe(0);
    });

    it('rejects unknown email with generic message indistinguishable from wrong password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({email: 'nonexistent@me.palnadu.dev', password: 'SomePassword123!'})
        .expect(401);

      const body = response.body as ApiErrorEnvelope;
      expect(body.error.code).toBe('UNAUTHENTICATED');
      expect(body.error.message).toBe(GENERIC_LOGIN_FAILURE);
    });

    it('rejects inactive administrator with generic message', async () => {
      await seedOwner({active: false});
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({email: OWNER_EMAIL, password: PASSWORD})
        .expect(401);

      const body = response.body as ApiErrorEnvelope;
      expect(body.error.code).toBe('UNAUTHENTICATED');
      expect(body.error.message).toBe(GENERIC_LOGIN_FAILURE);
    });

    it('never leaks passwordHash, salt, or secrets in response', async () => {
      await seedOwner();
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({email: OWNER_EMAIL, password: PASSWORD})
        .expect(200);

      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toContain('passwordHash');
      expect(serialized).not.toContain('scrypt');
      expect(serialized).not.toContain(PASSWORD);
    });

    it('rejects malformed email with validation error', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({email: 'not-an-email', password: PASSWORD})
        .expect(422);

      const body = response.body as ApiErrorEnvelope;
      expect(body.error.code).toBe('VALIDATION_FAILED');
    });

    it('does not expose unauthenticated public registration or owner creation endpoints', async () => {
      await request(app.getHttpServer()).post('/api/auth/register').send({}).expect(404);
      await request(app.getHttpServer()).post('/api/auth/signup').send({}).expect(404);
      await request(app.getHttpServer()).post('/api/auth/provision').send({}).expect(404);
    });
  });
});
