import type {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {ApiErrorEnvelopeSchema, ExperienceSchema} from '@me-palnadu/contracts';
import {createTestApp} from './test-app.js';
import {PrismaService} from '../../src/prisma/prisma.service.js';
import {
  seedTestAdmin,
  TEST_EXPERIENCE_SLUG as SLUG,
  VALID_EXPERIENCE_BODY as VALID_BODY,
} from './test-auth-helpers.js';

describe('authorization protected writes', () => {
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

  it('creates an experience entry and records an audit entry', async () => {
    const {user, token} = await seedAdmin();
    const response = await request(app.getHttpServer())
      .post('/api/experience')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_BODY)
      .expect(201);

    expect(ExperienceSchema.safeParse(response.body).success).toBe(true);
    expect(response.body.published).toBe(false);

    const audits = await prisma.auditLog.findMany();
    expect(audits).toHaveLength(1);
    expect(audits[0]?.action).toBe('experience_create');
    expect(audits[0]?.actorId).toBe(user.id);
  });

  it('rejects an invalid body with the contract error envelope', async () => {
    const {token} = await seedAdmin();
    const response = await request(app.getHttpServer())
      .post('/api/experience')
      .set('Authorization', `Bearer ${token}`)
      .send({...VALID_BODY, startDate: '2023-13', kind: 'not-a-kind'})
      .expect(422);

    expect(ApiErrorEnvelopeSchema.safeParse(response.body).success).toBe(true);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.details?.map((detail: {path: string}) => detail.path)).toEqual(
      expect.arrayContaining(['startDate', 'kind']),
    );
    expect(await prisma.experience.count()).toBe(0);
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it('rejects a cross-field violation defined in the contract', async () => {
    const {token} = await seedAdmin();
    await request(app.getHttpServer())
      .post('/api/experience')
      .set('Authorization', `Bearer ${token}`)
      .send({...VALID_BODY, current: true})
      .expect(422);
    expect(await prisma.experience.count()).toBe(0);
  });

  it('does not persist a field the contract does not declare', async () => {
    const {token} = await seedAdmin();
    await request(app.getHttpServer())
      .post('/api/experience')
      .set('Authorization', `Bearer ${token}`)
      .send({...VALID_BODY, isAdmin: true})
      .expect(201);

    const stored = await prisma.experience.findFirst();
    expect(JSON.stringify(stored)).not.toContain('isAdmin');
  });

  it('publishes and unpublishes, stamping and clearing publishedAt', async () => {
    const {token} = await seedAdmin();
    await seedExperience({published: false, publishedAt: null});

    await request(app.getHttpServer())
      .post(`/api/experience/${SLUG}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const published = await prisma.experience.findUnique({where: {slug: SLUG}});
    expect(published?.published).toBe(true);
    expect(published?.publishedAt).toBeInstanceOf(Date);

    await request(app.getHttpServer())
      .post(`/api/experience/${SLUG}/unpublish`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const unpublished = await prisma.experience.findUnique({where: {slug: SLUG}});
    expect(unpublished?.published).toBe(false);
    expect(unpublished?.publishedAt).toBeNull();
  });

  it('writes an audit entry for each administrative action', async () => {
    const {token} = await seedAdmin();
    await seedExperience({published: false, publishedAt: null});

    await request(app.getHttpServer())
      .post(`/api/experience/${SLUG}/publish`)
      .set('Authorization', `Bearer ${token}`);
    await request(app.getHttpServer())
      .post(`/api/experience/${SLUG}/unpublish`)
      .set('Authorization', `Bearer ${token}`);

    const actions = (await prisma.auditLog.findMany()).map((entry) => entry.action).sort();
    expect(actions).toEqual(['experience_publish', 'experience_unpublish']);
  });

  it('updates only the supplied fields', async () => {
    const {token} = await seedAdmin();
    await seedExperience();

    await request(app.getHttpServer())
      .patch(`/api/experience/${SLUG}`)
      .set('Authorization', `Bearer ${token}`)
      .send({title: 'Staff Endpoint Engineer'})
      .expect(200);

    const stored = await prisma.experience.findUnique({where: {slug: SLUG}});
    expect(stored?.title).toBe('Staff Endpoint Engineer');
    expect(stored?.org).toBe('Example Organisation');
    expect(stored?.published).toBe(true);
  });

  it('returns the contract error envelope for a missing record', async () => {
    const {token} = await seedAdmin();
    const response = await request(app.getHttpServer())
      .post('/api/experience/does-not-exist/publish')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    expect(ApiErrorEnvelopeSchema.safeParse(response.body).success).toBe(true);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns CONFLICT for a duplicate slug', async () => {
    const {token} = await seedAdmin();
    await seedExperience();
    const response = await request(app.getHttpServer())
      .post('/api/experience')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_BODY)
      .expect(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('records no audit entry when the write itself fails', async () => {
    const {token} = await seedAdmin();
    await seedExperience();

    await request(app.getHttpServer())
      .post('/api/experience')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_BODY)
      .expect(409);

    expect(await prisma.auditLog.count()).toBe(0);
  });
});
