import type {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {OWNER_EMAIL} from '@me-palnadu/contracts';
import {createTestApp} from './test-app.js';
import {PrismaService} from '../../src/prisma/prisma.service.js';
import {seedTestOwner, seedTestSession} from './test-auth-helpers.js';

describe('Admin authentication session lifecycle (ADR-0009)', () => {
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

  const seedSession = (user: {id: string; email: string; tokenVersion: number; role: string}) =>
    seedTestSession(prisma, user);

  describe('POST /api/auth/logout', () => {
    it('revokes the session and prevents subsequent authorized requests', async () => {
      const user = await seedOwner();
      const {token, sessionId} = await seedSession(user);

      await request(app.getHttpServer())
        .post('/api/experience/anything/publish')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const session = await prisma.adminSession.findUnique({where: {sessionId}});
      expect(session?.revokedAt).not.toBeNull();

      const audit = await prisma.auditLog.findFirst({
        where: {action: 'auth_logout', entityId: sessionId},
      });
      expect(audit).not.toBeNull();

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

      await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${oldToken}`)
        .send({
          currentPassword: PASSWORD,
          newPassword: NEW_PASSWORD,
        })
        .expect(204);

      const updatedUser = await prisma.adminUser.findUnique({where: {id: user.id}});
      expect(updatedUser?.tokenVersion).toBe(1);

      const audit = await prisma.auditLog.findFirst({
        where: {actorId: user.id, action: 'auth_password_change'},
      });
      expect(audit).not.toBeNull();

      await request(app.getHttpServer())
        .post('/api/experience/anything/publish')
        .set('Authorization', `Bearer ${oldToken}`)
        .expect(401);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({email: OWNER_EMAIL, password: PASSWORD})
        .expect(401);

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
