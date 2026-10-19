import type {INestApplication} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import request from 'supertest';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {
  MediaAssetSchema,
  MediaSignResponseSchema,
  MediaStatusSchema,
  OWNER_EMAIL,
} from '@me-palnadu/contracts';
import {createTestApp, testEnv} from './test-app.js';
import {PrismaService} from '../../src/prisma/prisma.service.js';
import {issueTestToken} from './test-auth-helpers.js';

const ARTICLE = {
  slug: 'testing-a-professional-claim',
  kind: 'tutorial',
  title: 'Testing a professional claim',
  excerpt: 'How a claim is verified before it is published.',
  body: '# Verify first\n\nA claim is evidence, not enthusiasm.',
  tags: ['testing'],
  status: 'draft',
};

describe('media library, audit, and admin sessions', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp(
      testEnv({
        CLOUDINARY_CLOUD_NAME: 'test-cloud',
        CLOUDINARY_API_KEY: 'test-key',
        CLOUDINARY_API_SECRET: 'test-secret',
      }),
    );
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.auditLog.deleteMany({});
    await prisma.adminSession.deleteMany({});
    await prisma.adminUser.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.mediaAsset.deleteMany({});
  });

  const seedAdmin = async (role: 'owner' | 'editor' = 'owner') => {
    const email = role === 'owner' ? OWNER_EMAIL : 'editor@example.com';
    const user = await prisma.adminUser.create({
      data: {
        email,
        passwordHash: 'scrypt$65536$8$1$dummySalt$dummyHash',
        role,
        tokenVersion: 0,
      },
    });
    const sessionId = role === 'owner' ? 'owner-session-under-test' : 'editor-session-under-test';
    const session = await prisma.adminSession.create({
      data: {
        sessionId,
        userId: user.id,
        tokenVersion: user.tokenVersion,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const token = await issueTestToken({sub: user.id, email: user.email, role, sid: sessionId});
    return {user, session, token};
  };

  describe('media library', () => {
    it('reports configuration and signs an upload without revealing the secret', async () => {
      const {token} = await seedAdmin();

      const status = await request(app.getHttpServer())
        .get('/api/admin/media/status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(MediaStatusSchema.safeParse(status.body).success).toBe(true);
      expect(status.body.configured).toBe(true);

      const signed = await request(app.getHttpServer())
        .post('/api/admin/media/sign')
        .set('Authorization', `Bearer ${token}`)
        .send({resourceType: 'image'})
        .expect(200);
      expect(MediaSignResponseSchema.safeParse(signed.body).success).toBe(true);
      expect(signed.body.signature).toMatch(/^[0-9a-f]{40}$/);
      expect(JSON.stringify(signed.body)).not.toContain('test-secret');
    });

    it('registers an asset from this cloud and refuses a foreign URL', async () => {
      const {token} = await seedAdmin();
      const asset = {
        publicId: 'me-palnadu/media/verified-claim',
        secureUrl:
          'https://res.cloudinary.com/test-cloud/image/upload/v1/me-palnadu/media/verified-claim.png',
        format: 'png',
        resourceType: 'image',
        bytes: 2048,
        width: 800,
        height: 600,
        originalFilename: 'verified-claim.png',
        alt: 'A screenshot used as evidence',
      };

      const created = await request(app.getHttpServer())
        .post('/api/admin/media')
        .set('Authorization', `Bearer ${token}`)
        .send(asset)
        .expect(201);
      expect(MediaAssetSchema.safeParse(created.body).success).toBe(true);

      const foreign = await request(app.getHttpServer())
        .post('/api/admin/media')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...asset,
          publicId: 'me-palnadu/media/other',
          secureUrl: 'https://example.com/a.png',
        })
        .expect(422);
      expect(foreign.body.error.code).toBe('VALIDATION_FAILED');

      const list = await request(app.getHttpServer())
        .get('/api/admin/media')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(list.body.items).toHaveLength(1);
    });
  });

  describe('audit and overview', () => {
    it('shows the trail to the owner and refuses an editor', async () => {
      const owner = await seedAdmin('owner');
      await request(app.getHttpServer())
        .post('/api/admin/knowledge')
        .set('Authorization', `Bearer ${owner.token}`)
        .send(ARTICLE)
        .expect(201);

      const list = await request(app.getHttpServer())
        .get('/api/admin/audit')
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);
      expect(list.body.items[0].action).toBe('article_create');

      const editor = await seedAdmin('editor');
      await request(app.getHttpServer())
        .get('/api/admin/audit')
        .set('Authorization', `Bearer ${editor.token}`)
        .expect(403);
    });

    it('counts current rows rather than a stored total', async () => {
      const {token} = await seedAdmin();
      await request(app.getHttpServer())
        .post('/api/admin/knowledge')
        .set('Authorization', `Bearer ${token}`)
        .send(ARTICLE)
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/admin/knowledge')
        .set('Authorization', `Bearer ${token}`)
        .send({...ARTICLE, slug: 'another-claim', status: 'published'})
        .expect(201);

      const overview = await request(app.getHttpServer())
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(overview.body.articles).toEqual({draft: 1, published: 1, archived: 0});
      expect(overview.body.recentActivity[0].action).toBe('article_create');
    });
  });

  describe('administrator sessions', () => {
    it('lists the current session and revokes another one', async () => {
      const owner = await seedAdmin();
      const secondId = randomUUID();
      await prisma.adminSession.create({
        data: {
          sessionId: secondId,
          userId: owner.user.id,
          tokenVersion: owner.user.tokenVersion,
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      const secondToken = await issueTestToken({
        sub: owner.user.id,
        email: owner.user.email,
        sid: secondId,
      });

      const list = await request(app.getHttpServer())
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);
      expect(list.body.sessions).toHaveLength(2);
      expect(
        list.body.sessions.filter((session: {current: boolean}) => session.current),
      ).toHaveLength(1);

      await request(app.getHttpServer())
        .post('/api/auth/sessions/revoke')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({sessionId: secondId})
        .expect(204);

      await request(app.getHttpServer())
        .get('/api/auth/session')
        .set('Authorization', `Bearer ${secondToken}`)
        .expect(401);
    });
  });
});
