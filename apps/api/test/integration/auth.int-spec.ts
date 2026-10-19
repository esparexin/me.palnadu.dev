import type {INestApplication} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import {SignJWT} from 'jose';
import request from 'supertest';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {GENERIC_LOGIN_FAILURE, OWNER_EMAIL, type ApiErrorEnvelope} from '@me-palnadu/contracts';
import {createTestApp, TEST_AUTH_SECRET} from './test-app.js';
import {PrismaService} from '../../src/prisma/prisma.service.js';
import {hashPassword} from '../../src/auth/password.js';

describe('Admin authentication endpoints (ADR-0009)', () => {
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

  const seedOwner = async (overrides: {active?: boolean; password?: string} = {}) => {
    const passwordHash = await hashPassword(overrides.password ?? PASSWORD);
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

  const seedSession = async (user: {
    id: string;
    email: string;
    tokenVersion: number;
    role: string;
  }) => {
    const sessionId = randomUUID();
    const session = await prisma.adminSession.create({
      data: {
        sessionId,
        userId: user.id,
        tokenVersion: user.tokenVersion,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const issuedAt = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({
      email: user.email,
      role: user.role,
      sid: sessionId,
      tv: user.tokenVersion,
    })
      .setProtectedHeader({alg: 'HS256'})
      .setSubject(user.id)
      .setIssuer('me-palnadu-admin')
      .setAudience('me-palnadu-api')
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + 900)
      .sign(new TextEncoder().encode(TEST_AUTH_SECRET));

    return {session, token, sessionId};
  };

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
      expect(response.body.expiresInSeconds).toBe(900);

      // Verify database session record
      const session = await prisma.adminSession.findUnique({
        where: {sessionId: response.body.administrator.sessionId},
      });
      expect(session).not.toBeNull();
      expect(session?.userId).toBe(user.id);
      expect(session?.revokedAt).toBeNull();
      expect(session?.tokenVersion).toBe(0);

      // Verify user lastLoginAt updated and failedLoginCount is 0
      const updatedUser = await prisma.adminUser.findUnique({where: {id: user.id}});
      expect(updatedUser?.lastLoginAt).not.toBeNull();
      expect(updatedUser?.failedLoginCount).toBe(0);

      // Verify audit log
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

      // Verify failedLoginCount incremented and no session was created
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

  describe('POST /api/auth/logout', () => {
    it('revokes the session and prevents subsequent authorized requests', async () => {
      const user = await seedOwner();
      const {token, sessionId} = await seedSession(user);

      // Verify token can access protected route
      await request(app.getHttpServer())
        .post('/api/experience/anything/publish')
        .set('Authorization', `Bearer ${token}`)
        .expect(404); // 404 means authenticated, but resource not found

      // Logout
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      // Verify database session is marked revoked
      const session = await prisma.adminSession.findUnique({where: {sessionId}});
      expect(session?.revokedAt).not.toBeNull();

      // Verify audit log for logout
      const audit = await prisma.auditLog.findFirst({
        where: {action: 'auth_logout', entityId: sessionId},
      });
      expect(audit).not.toBeNull();

      // Verify token is now rejected on protected route
      await request(app.getHttpServer())
        .post('/api/experience/anything/publish')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('rejects logout without bearer token', async () => {
      await request(app.getHttpServer()).post('/api/auth/logout').expect(401);
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('changes password, updates tokenVersion, revokes prior sessions, and allows login with new password', async () => {
      const user = await seedOwner();
      const {token: oldToken} = await seedSession(user);
      const NEW_PASSWORD = 'NewStrongSecretPassword2026!';

      // Change password
      await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${oldToken}`)
        .send({
          currentPassword: PASSWORD,
          newPassword: NEW_PASSWORD,
        })
        .expect(204);

      // Verify user tokenVersion incremented
      const updatedUser = await prisma.adminUser.findUnique({where: {id: user.id}});
      expect(updatedUser?.tokenVersion).toBe(1);

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: {actorId: user.id, action: 'auth_password_change'},
      });
      expect(audit).not.toBeNull();

      // Old token is now rejected because tokenVersion changed
      await request(app.getHttpServer())
        .post('/api/experience/anything/publish')
        .set('Authorization', `Bearer ${oldToken}`)
        .expect(401);

      // Old password no longer works for login
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({email: OWNER_EMAIL, password: PASSWORD})
        .expect(401);

      // New password succeeds
      const newLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({email: OWNER_EMAIL, password: NEW_PASSWORD})
        .expect(200);

      expect(newLogin.body.token).toBeDefined();
    });

    it('rejects password change if current password is wrong', async () => {
      const user = await seedOwner();
      const {token} = await seedSession(user);

      await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'IncorrectPassword123!',
          newPassword: 'BrandNewSecretPassword2026!',
        })
        .expect(401);
    });

    it('rejects password change if new password does not satisfy policy', async () => {
      const user = await seedOwner();
      const {token} = await seedSession(user);

      await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: PASSWORD,
          newPassword: 'short',
        })
        .expect(422);
    });
  });

  describe('GET /api/auth/session', () => {
    it('returns the authenticated administrator profile for a valid session', async () => {
      const user = await seedOwner();
      const {token, sessionId} = await seedSession(user);

      const response = await request(app.getHttpServer())
        .get('/api/auth/session')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.administrator).toEqual({
        id: user.id,
        email: OWNER_EMAIL,
        role: 'owner',
        sessionId,
      });
    });

    it('rejects unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).get('/api/auth/session').expect(401);
    });

    it('rejects revoked session with 401', async () => {
      const user = await seedOwner();
      const {token, sessionId} = await seedSession(user);
      await prisma.adminSession.update({
        where: {sessionId},
        data: {revokedAt: new Date()},
      });

      await request(app.getHttpServer())
        .get('/api/auth/session')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });
  });
});
