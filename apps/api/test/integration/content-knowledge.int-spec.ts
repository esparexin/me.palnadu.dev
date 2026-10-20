import type {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {
  ApiErrorEnvelopeSchema,
  ArticleSchema,
  OWNER_EMAIL,
  PublicArticleSummarySchema,
} from '@me-palnadu/contracts';
import {createTestApp, testEnv} from './test-app.js';
import {PrismaService} from '../../src/prisma/prisma.service.js';
import {issueTestToken} from './test-auth-helpers.js';

const ARTICLE = {
  slug: 'testing-a-professional-claim',
  kind: 'tutorial',
  title: 'Testing a professional claim',
  excerpt: 'How a claim is verified before it is published.',
  body: '# Verify first\n\nA claim is evidence, not enthusiasm.\n\n## Checklist\n\n- cite the source\n- date the evidence',
  tags: ['testing'],
  status: 'draft',
};

describe('Knowledge Hub authoring and publication', () => {
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

  it('keeps a draft out of every public response', async () => {
    const {token} = await seedAdmin();

    const created = await request(app.getHttpServer())
      .post('/api/admin/knowledge')
      .set('Authorization', `Bearer ${token}`)
      .send(ARTICLE)
      .expect(201);

    expect(ArticleSchema.safeParse(created.body).success).toBe(true);
    expect(created.body.status).toBe('draft');
    expect(created.body.publishedAt).toBeUndefined();

    const publicList = await request(app.getHttpServer()).get('/api/knowledge').expect(200);
    expect(publicList.body.items).toEqual([]);

    const publicRead = await request(app.getHttpServer())
      .get(`/api/knowledge/${ARTICLE.slug}`)
      .expect(404);
    expect(ApiErrorEnvelopeSchema.safeParse(publicRead.body).success).toBe(true);
  });

  it('publishes, serves, unpublishes, and deletes through the documented transitions', async () => {
    const {token} = await seedAdmin();
    const created = await request(app.getHttpServer())
      .post('/api/admin/knowledge')
      .set('Authorization', `Bearer ${token}`)
      .send(ARTICLE)
      .expect(201);

    const published = await request(app.getHttpServer())
      .post(`/api/admin/knowledge/${created.body.id}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(published.body.status).toBe('published');
    expect(published.body.publishedAt).toBeDefined();

    const publicItem = await request(app.getHttpServer())
      .get(`/api/knowledge/${ARTICLE.slug}`)
      .expect(200);
    expect(publicItem.body.title).toBe(ARTICLE.title);

    const publicList = await request(app.getHttpServer()).get('/api/knowledge').expect(200);
    expect(publicList.body.items).toHaveLength(1);
    expect(PublicArticleSummarySchema.safeParse(publicList.body.items[0]).success).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/admin/knowledge/${created.body.id}/unpublish`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer()).get(`/api/knowledge/${ARTICLE.slug}`).expect(404);

    await request(app.getHttpServer())
      .delete(`/api/admin/knowledge/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
    await request(app.getHttpServer())
      .get(`/api/admin/knowledge/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('validates canonical kind and difficulty constraints at the API boundary', async () => {
    const {token} = await seedAdmin();

    const badKind = await request(app.getHttpServer())
      .post('/api/admin/knowledge')
      .set('Authorization', `Bearer ${token}`)
      .send({...ARTICLE, kind: 'invalid_kind'})
      .expect(422);
    expect(badKind.body.error.code).toBe('VALIDATION_FAILED');

    const badInterview = await request(app.getHttpServer())
      .post('/api/admin/knowledge')
      .set('Authorization', `Bearer ${token}`)
      .send({...ARTICLE, kind: 'interview'})
      .expect(422);
    expect(badInterview.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects an interview without a difficulty and a duplicate slug', async () => {
    const {token} = await seedAdmin();
    await request(app.getHttpServer())
      .post('/api/admin/knowledge')
      .set('Authorization', `Bearer ${token}`)
      .send(ARTICLE)
      .expect(201);

    const duplicate = await request(app.getHttpServer())
      .post('/api/admin/knowledge')
      .set('Authorization', `Bearer ${token}`)
      .send(ARTICLE)
      .expect(409);
    expect(duplicate.body.error.code).toBe('CONFLICT');
  });

  it('records an audit entry with the article identifier', async () => {
    const {token} = await seedAdmin();
    const created = await request(app.getHttpServer())
      .post('/api/admin/knowledge')
      .set('Authorization', `Bearer ${token}`)
      .send(ARTICLE)
      .expect(201);

    const audit = await prisma.auditLog.findFirst({where: {action: 'article_create'}});
    expect(audit?.entityId).toBe(created.body.id);
  });
});
