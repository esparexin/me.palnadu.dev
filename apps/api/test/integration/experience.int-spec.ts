import {afterAll, afterEach, beforeAll, describe, expect, it} from 'vitest';
import {compareExperience} from '@me-palnadu/shared';
import {
  ExperienceCreateSchema,
  ExperienceUpdateSchema,
  PublicExperienceSchema,
  type ExperienceCreateInput,
} from '@me-palnadu/contracts';
import {parseEnv} from '../../src/config/env.js';
import {PrismaService} from '../../src/prisma/prisma.service.js';
import {ExperienceService} from '../../src/modules/experience/experience.service.js';
import {mapPersistenceError} from '../../src/common/persistence-error.js';

/**
 * Integration tests for the Experience slice, executed against a real
 * single-node MongoDB replica set (B3).
 *
 * These are integration tests, not unit tests: they talk to a real database, which
 * is the only way to prove transaction support, unique-constraint behaviour,
 * timestamp handling, and query ordering as MongoDB actually implements them.
 *
 * They are excluded from the unit test run. `pnpm test` uses vitest with an
 * include pattern that only picks up *.test.ts, and the database suite is
 * test/integration/*.int-spec.ts, run exclusively by
 * `pnpm test:integration` against the harness.
 */

const databaseUrl = process.env['DATABASE_URL'];
if (databaseUrl === undefined || databaseUrl.length === 0) {
  throw new Error(
    'DATABASE_URL is not set. Integration tests require the replica-set harness (pnpm test:integration) and must never fall back to a default.',
  );
}

const env = parseEnv({NODE_ENV: 'test', DATABASE_URL: databaseUrl});

/**
 * A real client, constructed the way the application constructs it: from a
 * validated environment, never from a hardcoded URL.
 */
const prisma = new PrismaService(env);
const service = new ExperienceService(prisma);

const baseRecord = (overrides: Partial<ExperienceCreateInput> = {}): ExperienceCreateInput => {
  const candidate: Record<string, unknown> = {
    slug: 'example-org-endpoint-engineer',
    org: 'Example Organisation',
    title: 'Endpoint Engineer',
    location: 'Remote',
    startDate: '2023-04',
    endDate: '2026-01',
    current: false,
    kind: 'full_time',
    summary: 'Placeholder summary used only in integration tests.',
    highlights: ['Placeholder highlight'],
    tech: ['Jamf Pro', 'Intune'],
    sortIndex: 0,
    published: true,
    ...overrides,
  };

  // The contract requires a current role to carry no end date, and a finished role
  // to carry one. Fixtures are normalised here so a test cannot accidentally create
  // a fixture the API would have rejected.
  if (candidate['current'] === true) {
    delete candidate['endDate'];
  } else if (candidate['endDate'] === undefined) {
    candidate['endDate'] = '2026-01';
  }

  const parsed = ExperienceCreateSchema.safeParse(candidate);
  if (!parsed.success)
    throw new Error(
      `fixture is not a valid contract value: ${JSON.stringify(parsed.error.issues)}`,
    );
  return parsed.data;
};

beforeAll(async () => {
  // Proves the deployment can execute a transaction, which Prisma requires. If
  // the harness ever regressed to a standalone server, this would fail here.
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
    const created = await service.create(baseRecord());
    expect(created.slug).toBe('example-org-endpoint-engineer');
    expect(created.current).toBe(false);

    const fetched = await service.findBySlug('example-org-endpoint-engineer');
    expect(fetched?.id).toBe(created.id);
    expect(PublicExperienceSchema.safeParse(fetched).success).toBe(true);
  });

  it('survives a reconnect, proving the write reached the database and not a cache', async () => {
    await service.create(baseRecord());
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
    await service.create(baseRecord());
    await expect(service.create(baseRecord())).rejects.toMatchObject({code: 'CONFLICT'});

    const count = await prisma.experience.count();
    expect(count).toBe(1);
  });

  it('reports NOT_FOUND when updating or deleting an unknown slug', async () => {
    await expect(service.update('does-not-exist', {summary: 'x'})).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(service.delete('does-not-exist')).rejects.toMatchObject({code: 'NOT_FOUND'});
  });

  it('exposes only published records on the public path', async () => {
    await service.create(baseRecord({slug: 'published-entry', published: true}));
    await service.create(baseRecord({slug: 'draft-entry', published: false}));
    await service.create(baseRecord({slug: 'archived-entry', published: false, current: true}));

    const published = await service.listPublished();
    expect(published.map((entry) => entry.slug)).toEqual(['published-entry']);
    expect(published.every((entry) => entry.published)).toBe(true);
  });

  it('returns drafts to an internal listing but never to the public one', async () => {
    await service.create(baseRecord({slug: 'draft-entry', published: false}));
    expect((await service.listAll()).map((entry) => entry.slug)).toEqual(['draft-entry']);
    expect(await service.listPublished()).toEqual([]);
  });

  it('applies a partial update without touching untouched fields', async () => {
    await service.create(baseRecord());
    const parsed = ExperienceUpdateSchema.safeParse({title: 'Senior Endpoint Engineer'});
    expect(parsed.success).toBe(true);

    const updated = await service.update('example-org-endpoint-engineer', parsed.data ?? {});
    expect(updated.title).toBe('Senior Endpoint Engineer');
    expect(updated.summary).toBe('Placeholder summary used only in integration tests.');
    expect(updated.tech).toEqual(['Jamf Pro', 'Intune']);
  });

  it('stamps publishedAt on publish and clears it on unpublish', async () => {
    await service.create(baseRecord({published: false}));
    const unpublishedRow = await prisma.experience.findUnique({
      where: {slug: 'example-org-endpoint-engineer'},
    });
    expect(unpublishedRow?.publishedAt).toBeNull();

    const published = await service.update('example-org-endpoint-engineer', {published: true});
    expect(published.published).toBe(true);

    const publishedRow = await prisma.experience.findUnique({
      where: {slug: 'example-org-endpoint-engineer'},
    });
    expect(publishedRow?.publishedAt).toBeInstanceOf(Date);

    await service.update('example-org-endpoint-engineer', {published: false});
    const reverted = await prisma.experience.findUnique({
      where: {slug: 'example-org-endpoint-engineer'},
    });
    expect(reverted?.publishedAt).toBeNull();
  });

  it('sets createdAt once and advances updatedAt on change', async () => {
    await service.create(baseRecord());
    const created = await prisma.experience.findUnique({
      where: {slug: 'example-org-endpoint-engineer'},
    });
    expect(created?.createdAt).toBeInstanceOf(Date);

    await new Promise((resolve) => setTimeout(resolve, 25));
    await service.update('example-org-endpoint-engineer', {summary: 'A different summary.'});
    const updated = await prisma.experience.findUnique({
      where: {slug: 'example-org-endpoint-engineer'},
    });

    expect(updated?.createdAt.getTime()).toBe(created?.createdAt.getTime());
    expect(updated?.updatedAt.getTime()).toBeGreaterThan(created?.updatedAt.getTime() ?? 0);
  });

  it('orders public reads identically to the canonical comparator', async () => {
    await service.create(baseRecord({slug: 'oldest', startDate: '2019-01', endDate: '2020-01'}));
    await service.create(baseRecord({slug: 'middle', startDate: '2022-01', endDate: '2023-01'}));
    await service.create(
      baseRecord({slug: 'newest-finished', startDate: '2024-01', endDate: '2025-01'}),
    );
    await service.create(baseRecord({slug: 'newest-current', startDate: '2024-01', current: true}));

    const fromDatabase = await service.listPublished();
    const byComparator = [...fromDatabase].sort(compareExperience);

    // If these diverge, the index-backed order has drifted from the SSOT comparator.
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
    // MongoDB accepts any string in a String field. That is a recorded limitation,
    // not something to pretend away: this test proves the database does NOT enforce
    // the value set, and proves the contract is what rejects it.
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

    // Built explicitly rather than by destructuring a slug out of the fixture,
    // which leaves an unused binding behind.
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

  it('maps an unknown persistence failure to an opaque INTERNAL_ERROR', () => {
    // A failure shape the mapper does not recognise must not leak driver detail.
    const {error, logMessage} = mapPersistenceError(
      new Error('mongodb://user:placeholder@127.0.0.1:27017/db failed'),
    );
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.message).toBe('Internal server error');
    expect(logMessage).toContain('unmapped');
    expect(error.message).not.toContain('mongodb://');
  });

  it('maps a unique-constraint violation to a CONFLICT without driver text', () => {
    const {error} = mapPersistenceError({code: 'P2002', meta: {target: ['slug']}});
    expect(error.code).toBe('CONFLICT');
    expect(error.message).toContain('slug');
    expect(error.message).not.toMatch(/P2002|prisma/i);
  });

  it('maps an unreachable database to an opaque INTERNAL_ERROR', () => {
    const {error} = mapPersistenceError({code: 'P1001'});
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.message).toBe('The data store is unavailable.');
  });
});
