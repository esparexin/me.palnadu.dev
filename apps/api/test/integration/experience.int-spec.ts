import {afterAll, afterEach, beforeAll, describe, expect, it} from 'vitest';
import {compareExperience} from '@me-palnadu/shared';
import {
  ExperienceCreateSchema,
  ExperienceUpdateSchema,
  PublicExperienceSchema,
} from '@me-palnadu/contracts';
import {parseEnv} from '../../src/config/env.js';
import {PrismaService} from '../../src/prisma/prisma.service.js';
import {ExperienceService} from '../../src/modules/experience/experience.service.js';
import {AdminService} from '../../src/modules/auth/admin.service.js';
import {auditFor, baseExperienceRecord as baseRecord} from './experience-fixture.js';

const databaseUrl = process.env['DATABASE_URL'];
if (databaseUrl === undefined || databaseUrl.length === 0) {
  throw new Error(
    'DATABASE_URL is not set. Integration tests require the replica-set harness (pnpm test:integration) and must never fall back to a default.',
  );
}

const env = parseEnv({NODE_ENV: 'test', DATABASE_URL: databaseUrl});
const prisma = new PrismaService(env);
const service = new ExperienceService(prisma, new AdminService(prisma, env));

beforeAll(async () => {
  await prisma.experience.create({
    data: {
      slug: 'transaction-probe',
      org: 'Probe',
      title: 'Probe',
      startDate: '2000-01',
      current: true,
      kind: 'freelance',
      summary: 'probe',
      published: false,
    },
  });
  await prisma.experience.delete({where: {slug: 'transaction-probe'}});
});

afterAll(async () => {
  await prisma.$disconnect();
});

afterEach(async () => {
  await prisma.experience.deleteMany({});
});

describe('Experience persistence', () => {
  it('creates a record and reads it back through the contract shape', async () => {
    const created = await service.create(baseRecord(), auditFor('test'));
    expect(created.slug).toBe('example-org-endpoint-engineer');
    expect(created.current).toBe(false);

    const fetched = await service.findBySlug('example-org-endpoint-engineer');
    expect(fetched?.id).toBe(created.id);
    expect(PublicExperienceSchema.safeParse(fetched).success).toBe(true);
  });

  it('survives a reconnect, proving the write reached the database and not a cache', async () => {
    await service.create(baseRecord(), auditFor('test'));
    await prisma.$disconnect();
    const reconnected = new PrismaService(env);
    try {
      const found = await reconnected.experience.findUnique({
        where: {slug: 'example-org-endpoint-engineer'},
      });
      expect(found?.org).toBe('Example Organisation');
    } finally {
      await reconnected.$disconnect();
    }
  });

  it('rejects a duplicate slug with a CONFLICT, not a second row', async () => {
    await service.create(baseRecord(), auditFor('test'));
    await expect(service.create(baseRecord(), auditFor('test'))).rejects.toMatchObject({
      code: 'CONFLICT',
    });

    const count = await prisma.experience.count();
    expect(count).toBe(1);
  });

  it('reports NOT_FOUND when updating or deleting an unknown slug', async () => {
    await expect(
      service.update('does-not-exist', {summary: 'x'}, auditFor('test')),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(service.delete('does-not-exist')).rejects.toMatchObject({code: 'NOT_FOUND'});
  });

  it('exposes only published records on the public path', async () => {
    await service.create(baseRecord({slug: 'published-entry', published: true}), auditFor('test'));
    await service.create(baseRecord({slug: 'draft-entry', published: false}), auditFor('test'));
    await service.create(
      baseRecord({slug: 'current-draft-entry', published: false, current: true}),
      auditFor('test'),
    );

    const published = await service.listPublished();
    expect(published.map((entry) => entry.slug)).toEqual(['published-entry']);
    expect(published.every((entry) => entry.published)).toBe(true);
  });

  it('returns drafts to an internal listing but never to the public one', async () => {
    await service.create(baseRecord({slug: 'draft-entry', published: false}), auditFor('test'));
    expect((await service.listAll()).map((entry) => entry.slug)).toEqual(['draft-entry']);
    expect(await service.listPublished()).toEqual([]);
  });

  it('applies a partial update without touching untouched fields', async () => {
    await service.create(baseRecord(), auditFor('test'));
    const parsed = ExperienceUpdateSchema.safeParse({title: 'Senior Endpoint Engineer'});
    expect(parsed.success).toBe(true);

    const updated = await service.update(
      'example-org-endpoint-engineer',
      parsed.data ?? {},
      auditFor('test'),
    );
    expect(updated.title).toBe('Senior Endpoint Engineer');
    expect(updated.summary).toBe('Placeholder summary used only in tests.');
    expect(updated.tech).toEqual(['Jamf Pro', 'Intune']);
  });

  it('stamps publishedAt on publish and clears it on unpublish', async () => {
    await service.create(baseRecord({published: false}), auditFor('test'));
    const unpublishedRow = await prisma.experience.findUnique({
      where: {slug: 'example-org-endpoint-engineer'},
    });
    expect(unpublishedRow?.publishedAt).toBeNull();

    const published = await service.update(
      'example-org-endpoint-engineer',
      {published: true},
      auditFor('test'),
    );
    expect(published.published).toBe(true);

    const publishedRow = await prisma.experience.findUnique({
      where: {slug: 'example-org-endpoint-engineer'},
    });
    expect(publishedRow?.publishedAt).toBeInstanceOf(Date);

    await service.update('example-org-endpoint-engineer', {published: false}, auditFor('test'));
    const reverted = await prisma.experience.findUnique({
      where: {slug: 'example-org-endpoint-engineer'},
    });
    expect(reverted?.publishedAt).toBeNull();
  });

  it('sets createdAt once and advances updatedAt on change', async () => {
    await service.create(baseRecord(), auditFor('test'));
    const created = await prisma.experience.findUnique({
      where: {slug: 'example-org-endpoint-engineer'},
    });
    expect(created?.createdAt).toBeInstanceOf(Date);

    await new Promise((resolve) => setTimeout(resolve, 25));
    await service.update(
      'example-org-endpoint-engineer',
      {summary: 'A different summary.'},
      auditFor('test'),
    );
    const updated = await prisma.experience.findUnique({
      where: {slug: 'example-org-endpoint-engineer'},
    });

    expect(updated?.createdAt.getTime()).toBe(created?.createdAt.getTime());
    expect(updated?.updatedAt.getTime()).toBeGreaterThan(created?.updatedAt.getTime() ?? 0);
  });

  it('orders public reads identically to the canonical comparator', async () => {
    await service.create(
      baseRecord({slug: 'oldest', startDate: '2019-01', endDate: '2020-01'}),
      auditFor('test'),
    );
    await service.create(
      baseRecord({slug: 'middle', startDate: '2022-01', endDate: '2023-01'}),
      auditFor('test'),
    );
    await service.create(
      baseRecord({slug: 'newest-finished', startDate: '2024-01', endDate: '2025-01'}),
      auditFor('test'),
    );
    await service.create(
      baseRecord({slug: 'newest-current', startDate: '2024-01', current: true}),
      auditFor('test'),
    );

    const fromDatabase = await service.listPublished();
    const byComparator = [...fromDatabase].sort(compareExperience);

    expect(fromDatabase.map((entry) => entry.slug)).toEqual(
      byComparator.map((entry) => entry.slug),
    );
    expect(fromDatabase.map((entry) => entry.slug)).toEqual([
      'newest-current',
      'newest-finished',
      'middle',
      'oldest',
    ]);
  });

  it('stores enum-like values without a database-level enum, per the canonical-ownership decision', async () => {
    await prisma.experience.create({
      data: {
        slug: 'out-of-contract-value',
        org: 'Example',
        title: 'Example',
        startDate: '2020-01',
        current: true,
        kind: 'a_kind_the_contracts_reject',
        summary: 'inserted directly, bypassing the API boundary',
        published: false,
      },
    });
    const row = await prisma.experience.findUnique({where: {slug: 'out-of-contract-value'}});
    expect(row?.kind).toBe('a_kind_the_contracts_reject');

    const valid = baseRecord();
    const rejected = ExperienceCreateSchema.safeParse({
      org: valid.org,
      title: valid.title,
      startDate: valid.startDate,
      endDate: valid.endDate,
      current: valid.current,
      kind: 'a_kind_the_contracts_reject',
      summary: valid.summary,
      highlights: valid.highlights,
      tech: valid.tech,
      sortIndex: valid.sortIndex,
      published: valid.published,
    });
    expect(rejected.success).toBe(false);
  });
});
