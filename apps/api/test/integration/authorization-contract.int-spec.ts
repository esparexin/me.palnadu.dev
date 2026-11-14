import type {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {PublicExperienceSchema, OWNER_EMAIL} from '@me-palnadu/contracts';
import {createTestApp, TEST_AUTH_SECRET as AUTH_SECRET} from './test-app.js';
import {PrismaService} from '../../src/prisma/prisma.service.js';
import {AdminService} from '../../src/modules/auth/admin.service.js';
import {
  seedTestAdmin,
  PROTECTED_EXPERIENCE_ROUTE as PROTECTED,
  TEST_EXPERIENCE_SLUG as SLUG,
  VALID_EXPERIENCE_BODY as VALID_BODY,
} from './test-auth-helpers.js';

describe('authorization contracts and surfaces', () => {
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

  describe('public surface', () => {
    it('serves published experience without a session', async () => {
      await seedExperience();
      const response = await request(app.getHttpServer()).get('/api/experience').expect(200);
      expect(response.body).toHaveLength(1);
      expect(PublicExperienceSchema.safeParse(response.body[0]).success).toBe(true);
    });

    it('withholds the slug from the public projection', async () => {
      await seedExperience();
      const response = await request(app.getHttpServer()).get('/api/experience').expect(200);
      expect(response.body[0]).not.toHaveProperty('slug');
      expect(response.body[0].org).toBe('Example Organisation');
    });

    it('never serves a draft on the public list or by slug', async () => {
      await seedExperience();
      await seedExperience({slug: 'draft-entry', published: false, publishedAt: null});

      const list = await request(app.getHttpServer()).get('/api/experience').expect(200);
      expect(list.body.map((entry: {org: string}) => entry.org)).toEqual(['Example Organisation']);

      const draft = await request(app.getHttpServer())
        .get('/api/experience/draft-entry')
        .expect(404);
      expect(draft.body.error.code).toBe('NOT_FOUND');
    });

    it('keeps health endpoints reachable without a session', async () => {
      const live = await request(app.getHttpServer()).get('/health/live').expect(200);
      expect(live.body.status).toBe('ok');
      expect(typeof live.body.uptimeSeconds).toBe('number');

      const ready = await request(app.getHttpServer()).get('/health/ready').expect(200);
      expect(ready.body.status).toBe('ready');

      await request(app.getHttpServer()).post(PROTECTED).expect(401);
    });
  });

  describe('audit atomicity', () => {
    it('rolls the content write back when the audit entry cannot be written', async () => {
      const {token} = await seedAdmin();
      const admin = app.get(AdminService);
      const failing = vi
        .spyOn(admin, 'writeAudit')
        .mockRejectedValueOnce(new Error('audit storage unavailable'));

      try {
        await request(app.getHttpServer())
          .post('/api/experience')
          .set('Authorization', `Bearer ${token}`)
          .send(VALID_BODY)
          .expect(500);
      } finally {
        failing.mockRestore();
      }

      expect(await prisma.experience.count()).toBe(0);
      expect(await prisma.auditLog.count()).toBe(0);
    });

    it('restores normal behaviour once the audit store recovers', async () => {
      const {token} = await seedAdmin();
      await request(app.getHttpServer())
        .post('/api/experience')
        .set('Authorization', `Bearer ${token}`)
        .send(VALID_BODY)
        .expect(201);

      expect(await prisma.experience.count()).toBe(1);
      expect(await prisma.auditLog.count()).toBe(1);
    });
  });

  describe('contract conformance', () => {
    it('uses the canonical owner email address in these tests', async () => {
      expect(OWNER_EMAIL).toBe('owner@me.palnadu.dev');
    });

    it('echoes a request id so a client can correlate an error', async () => {
      const response = await request(app.getHttpServer())
        .post(PROTECTED)
        .set('x-request-id', 'test-correlation-id')
        .expect(401);
      expect(response.body.error.requestId).toBe('test-correlation-id');
      expect(response.headers['x-request-id']).toBe('test-correlation-id');
    });

    it('does not leak internals in an error response', async () => {
      const {token} = await seedAdmin();
      const response = await request(app.getHttpServer())
        .post('/api/experience/does-not-exist/publish')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      const serialized = JSON.stringify(response.body);
      for (const secret of ['mongodb://', AUTH_SECRET, 'AdminSession', 'at Object.', '/Users/']) {
        expect(serialized).not.toContain(secret);
      }
    });
  });
});
