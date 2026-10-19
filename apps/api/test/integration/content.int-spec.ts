import type {INestApplication} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import {SignJWT} from 'jose';
import request from 'supertest';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {
  ApiErrorEnvelopeSchema,
  ArticleSchema,
  FaqSchema,
  MediaAssetSchema,
  MediaSignResponseSchema,
  MediaStatusSchema,
  OWNER_EMAIL,
  PaginatedResponseSchema,
  PublicArticleSummarySchema,
  PublicFaqSchema,
  SESSION_LIFETIME_SECONDS,
} from '@me-palnadu/contracts';
import {createTestApp, testEnv} from './test-app.js';
import {PrismaService} from '../../src/prisma/prisma.service.js';

/**
 * HTTP-level coverage for the Knowledge Hub, FAQ, media, audit, overview and
 * session surfaces.
 *
 * The assertions deliberately go through the same guards, pipes and response
 * schemas a client uses. A service unit test cannot prove that a draft is absent
 * from the public response, which is the property that matters.
 */

const AUTH_SECRET = 'test-secret-value-that-is-long-enough-32';
const OWNER_SESSION = 'owner-session-under-test';

const ARTICLE = {
  slug: 'testing-a-professional-claim',
  kind: 'tutorial',
  title: 'Testing a professional claim',
  excerpt: 'How a claim is verified before it is published.',
  body: '# Verify first\n\nA claim is evidence, not enthusiasm.\n\n## Checklist\n\n- cite the source\n- date the evidence',
  tags: ['testing'],
  status: 'draft',
};

const FAQ = {
  question: 'Do you take contract work?',
  answer: 'Usually **yes**, subject to availability.',
  category: 'general',
  sortIndex: 1,
  status: 'draft',
};

let app: INestApplication;
let prisma: PrismaService;

const issueToken = async (overrides: {
  sub: string;
  email: string;
  role?: string;
  sid: string;
  tv?: number;
}) => {
  const issuedAt = Math.floor(Date.now() / 1000);
  return new SignJWT({
    email: overrides.email,
    role: overrides.role ?? 'owner',
    sid: overrides.sid,
    tv: overrides.tv ?? 0,
  })
    .setProtectedHeader({alg: 'HS256'})
    .setSubject(overrides.sub)
    .setIssuer('me-palnadu-admin')
    .setAudience('me-palnadu-api')
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_LIFETIME_SECONDS)
    .sign(new TextEncoder().encode(AUTH_SECRET));
};

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
  const sessionId = role === 'owner' ? OWNER_SESSION : 'editor-session-under-test';
  const session = await prisma.adminSession.create({
    data: {
      sessionId,
      userId: user.id,
      tokenVersion: user.tokenVersion,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  const token = await issueToken({sub: user.id, email: user.email, role, sid: sessionId});
  return {user, session, token};
};

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
  await prisma.faq.deleteMany({});
  await prisma.mediaAsset.deleteMany({});
});

describe('Knowledge Hub authoring and publication', () => {
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
    const id = created.body.id as string;

    const published = await request(app.getHttpServer())
      .post(`/api/admin/knowledge/${id}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(published.body.status).toBe('published');
    expect(typeof published.body.publishedAt).toBe('string');

    const publicList = await request(app.getHttpServer()).get('/api/knowledge').expect(200);
    expect(
      PaginatedResponseSchema(PublicArticleSummarySchema).safeParse(publicList.body).success,
    ).toBe(true);
    expect(publicList.body.items).toHaveLength(1);

    const publicRead = await request(app.getHttpServer())
      .get(`/api/knowledge/${ARTICLE.slug}`)
      .expect(200);
    expect(publicRead.body.body).toBe(ARTICLE.body);

    const unpublished = await request(app.getHttpServer())
      .post(`/api/admin/knowledge/${id}/unpublish`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(unpublished.body.status).toBe('draft');
    expect(unpublished.body.publishedAt).toBeUndefined();

    await request(app.getHttpServer())
      .delete(`/api/admin/knowledge/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
    expect(await prisma.article.count()).toBe(0);
  });

  it('rejects an interview without a difficulty and a duplicate slug', async () => {
    const {token} = await seedAdmin();

    const invalid = await request(app.getHttpServer())
      .post('/api/admin/knowledge')
      .set('Authorization', `Bearer ${token}`)
      .send({...ARTICLE, kind: 'interview'})
      .expect(422);
    expect(invalid.body.error.code).toBe('VALIDATION_FAILED');

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

  it('allows an editor to write but not to delete', async () => {
    const {token} = await seedAdmin('editor');
    const created = await request(app.getHttpServer())
      .post('/api/admin/knowledge')
      .set('Authorization', `Bearer ${token}`)
      .send(ARTICLE)
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/admin/knowledge/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('records the create in the audit trail with the created id', async () => {
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

describe('FAQ authoring and publication', () => {
  it('publishes a FAQ entry and hides it again on unpublish', async () => {
    const {token} = await seedAdmin();
    const created = await request(app.getHttpServer())
      .post('/api/admin/faq')
      .set('Authorization', `Bearer ${token}`)
      .send(FAQ)
      .expect(201);
    expect(FaqSchema.safeParse(created.body).success).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/admin/faq/${created.body.id}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const publicList = await request(app.getHttpServer()).get('/api/faq').expect(200);
    expect(publicList.body.items).toHaveLength(1);
    expect(PublicFaqSchema.safeParse(publicList.body.items[0]).success).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/admin/faq/${created.body.id}/unpublish`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const after = await request(app.getHttpServer()).get('/api/faq').expect(200);
    expect(after.body.items).toEqual([]);
  });
});

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
      .send({...asset, publicId: 'me-palnadu/media/other', secureUrl: 'https://example.com/a.png'})
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
    const secondToken = await issueToken({
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
