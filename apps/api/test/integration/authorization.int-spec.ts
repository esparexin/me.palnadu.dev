import type {INestApplication} from '@nestjs/common';
import {Test} from '@nestjs/testing';
import {SignJWT} from 'jose';
import request from 'supertest';
import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  ADMIN_ALLOWLIST,
  ApiErrorEnvelopeSchema,
  ExperienceSchema,
  PublicExperienceSchema,
  SESSION_LIFETIME_SECONDS,
} from '@me-palnadu/contracts';
import {AppModule} from '../../src/app.module.js';
import {ENV} from '../../src/common/tokens.js';
import {parseEnv} from '../../src/config/env.js';
import {ApiExceptionFilter, RequestIdMiddleware} from '../../src/common/api-exception.filter.js';
import {PrismaService} from '../../src/prisma/prisma.service.js';
import {AdminService} from '../../src/modules/auth/admin.service.js';

/**
 * Authorization and HTTP contract tests against a real Nest application and a real
 * MongoDB replica set.
 *
 * These are HTTP-level rather than unit-level on purpose. The question that matters is
 * not "does the guard return false" but "does an unauthenticated request receive 401
 * with the contract envelope" - that is the property a client actually depends on, and
 * a unit test cannot observe the guards, the pipes and the filter composing into it.
 *
 * Authorization assertions deliberately target protected routes. An earlier draft of
 * this file asserted them against `GET /api/experience`, which is `@Public()` and
 * correctly returned 200; a test that fails because it probed the wrong surface is a
 * test that teaches the wrong lesson.
 */

const AUTH_SECRET = 'test-secret-value-that-is-long-enough-32';
const ISSUER = 'me-palnadu-admin';
const AUDIENCE = 'me-palnadu-api';
const SECRET_BYTES = new TextEncoder().encode(AUTH_SECRET);
const GITHUB_ID = ADMIN_ALLOWLIST[0].githubId;

/** A protected, body-less route. Guards run before pipes, so a body is never needed. */
const PROTECTED = '/api/experience/anything/publish';

const SLUG = 'example-org-endpoint-engineer';

const VALID_BODY = {
  slug: SLUG,
  org: 'Example Organisation',
  title: 'Endpoint Engineer',
  location: 'Remote',
  startDate: '2023-04',
  endDate: '2026-01',
  current: false,
  kind: 'full_time',
  summary: 'Placeholder summary used only in tests.',
  highlights: [],
  tech: [],
  sortIndex: 0,
  published: false,
};

let app: INestApplication;
let prisma: PrismaService;

const issueToken = async (
  overrides: Partial<{
    sub: string;
    gh_id: number;
    role: string;
    sid: string;
    tv: number;
    exp: number;
    iss: string;
    aud: string;
  }> = {},
  secret: Uint8Array = SECRET_BYTES,
) =>
  new SignJWT({
    gh_id: overrides.gh_id ?? GITHUB_ID,
    role: overrides.role ?? 'owner',
    sid: 'session-under-test',
    tv: overrides.tv ?? 0,
  })
    .setProtectedHeader({alg: 'HS256'})
    .setSubject(overrides.sub ?? 'placeholder-subject')
    .setIssuer(overrides.iss ?? ISSUER)
    .setAudience(overrides.aud ?? AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(overrides.exp ?? Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS)
    .sign(secret);

beforeAll(async () => {
  const env = parseEnv({
    NODE_ENV: 'test',
    DATABASE_URL: process.env['DATABASE_URL'],
    AUTH_SECRET,
    AUTH_ISSUER: ISSUER,
    AUTH_AUDIENCE: AUDIENCE,
    ALLOWED_ORIGINS: 'http://localhost:3000',
  });

  const moduleRef = await Test.createTestingModule({imports: [AppModule]})
    .overrideProvider(ENV)
    .useValue(env)
    .compile();

  app = moduleRef.createNestApplication();
  app.useGlobalFilters(new ApiExceptionFilter());
  const requestId = new RequestIdMiddleware();
  app.use((req, res, next) => requestId.use(req, res, next));
  await app.init();

  prisma = app.get(PrismaService);
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  // Sessions before users: the relation is required, so the order is not cosmetic.
  await prisma.auditLog.deleteMany({});
  await prisma.adminSession.deleteMany({});
  await prisma.adminUser.deleteMany({});
  await prisma.experience.deleteMany({});
});

/** Seeds an administrator and a live session, returning a valid token for them. */
const seedAdmin = async (overrides: {role?: string; tokenVersion?: number} = {}) => {
  const user = await prisma.adminUser.create({
    data: {
      githubId: GITHUB_ID,
      login: 'esparexin',
      role: overrides.role ?? 'owner',
      tokenVersion: overrides.tokenVersion ?? 0,
    },
  });
  const session = await prisma.adminSession.create({
    data: {
      sessionId: 'session-under-test',
      userId: user.id,
      tokenVersion: user.tokenVersion,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  const token = await issueToken({sub: user.id, tv: user.tokenVersion});
  return {user, session, token};
};

const seedExperience = (overrides: Partial<typeof VALID_BODY> = {}) =>
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

describe('authorization boundary', () => {
  it('refuses a request with no Authorization header', async () => {
    const response = await request(app.getHttpServer()).post(PROTECTED).expect(401);
    expect(ApiErrorEnvelopeSchema.safeParse(response.body).success).toBe(true);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
    expect(response.body.error.requestId).toBeTruthy();
  });

  it('treats a missing credential as an authentication failure, not a body error', async () => {
    // Regression: this was reported as VALIDATION_FAILED/422, which tells a client to
    // fix a request body it never sent and makes the status useless for deciding
    // whether to re-authenticate.
    const response = await request(app.getHttpServer()).post(PROTECTED).expect(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('refuses a malformed Authorization header', async () => {
    for (const header of ['Basic abc123', 'Bearer', 'Bearer a b', 'token abc']) {
      await request(app.getHttpServer()).post(PROTECTED).set('Authorization', header).expect(401);
    }
  });

  it('refuses a token signed with a different secret', async () => {
    const token = await issueToken(
      {},
      new TextEncoder().encode('a-different-secret-of-sufficient-length'),
    );
    await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('refuses an unsigned token', async () => {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const forged = `${encode({alg: 'none', typ: 'JWT'})}.${encode({
      sub: 'x',
      gh_id: GITHUB_ID,
      role: 'owner',
      sid: 's',
      tv: 0,
      iss: ISSUER,
      aud: AUDIENCE,
      iat: now,
      exp: now + 900,
    })}.`;
    await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${forged}`)
      .expect(401);
  });

  it('refuses an expired token', async () => {
    const {user} = await seedAdmin();
    const expired = await issueToken({sub: user.id, exp: Math.floor(Date.now() / 1000) - 60});
    await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
  });

  it('refuses a wrong issuer and a wrong audience', async () => {
    const {user} = await seedAdmin();
    await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${await issueToken({sub: user.id, iss: 'somebody-else'})}`)
      .expect(401);
    await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${await issueToken({sub: user.id, aud: 'somebody-else'})}`)
      .expect(401);
  });

  it('refuses a signed token for a non-administrator with 403', async () => {
    // The token is genuinely signed, so the caller is authenticated. They are simply
    // not permitted, which is 403 rather than 401.
    const token = await issueToken({sub: 'someone', gh_id: 1});
    const response = await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('refuses a deactivated administrator', async () => {
    const {user, token} = await seedAdmin();
    await prisma.adminUser.update({where: {id: user.id}, data: {active: false}});
    await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('refuses a revoked session', async () => {
    const {session, token} = await seedAdmin();
    await prisma.adminSession.update({where: {id: session.id}, data: {revokedAt: new Date()}});
    await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('refuses an expired session record even when the token has not expired', async () => {
    const {user, session} = await seedAdmin();
    await prisma.adminSession.update({
      where: {id: session.id},
      data: {expiresAt: new Date(Date.now() - 1000)},
    });
    const token = await issueToken({sub: user.id, exp: Math.floor(Date.now() / 1000) + 900});
    await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('refuses a session that belongs to a different administrator', async () => {
    await seedAdmin();
    const other = await prisma.adminUser.create({
      data: {githubId: 999, login: 'someone-else', role: 'owner'},
    });
    // The session row belongs to the first admin; the token names the second.
    const token = await issueToken({sub: other.id, gh_id: 999});
    await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('invalidates every session when the token version is incremented', async () => {
    const {user, token} = await seedAdmin();
    await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    // Revoking all sessions is a user-level increment; no session row is touched.
    await prisma.adminUser.update({where: {id: user.id}, data: {tokenVersion: 1}});
    await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('ignores a forged role claim in favour of the database', async () => {
    // The token claims 'owner'; the database says 'editor'. The editor's permissions
    // are what apply, and a claim of ownership must not widen them.
    //
    // Coverage gap, stated rather than hidden: every Experience write route currently
    // admits both `owner` and `editor`, so there is no route on which the two roles
    // differ and this cannot be asserted as a denial. It becomes decisive as soon as
    // an owner-only operation is defined - see the archive question in the PR.
    const {user} = await seedAdmin({role: 'editor'});
    await seedExperience({published: false, publishedAt: null});
    const token = await issueToken({sub: user.id, role: 'owner'});

    await request(app.getHttpServer())
      .post(`/api/experience/${SLUG}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const published = await prisma.experience.findUnique({where: {slug: SLUG}});
    expect(published?.published).toBe(true);
  });

  it('fails closed when the stored role is outside the canonical enum', async () => {
    const {user} = await seedAdmin({role: 'editor'});
    await prisma.adminUser.update({where: {id: user.id}, data: {role: 'superuser'}});
    const token = await issueToken({sub: user.id, role: 'owner'});

    // A role the contracts do not define is a data-integrity fault. It must not be
    // granted by omission, so the request is refused rather than admitted.
    const response = await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${token}`)
      .expect(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(response.body)).not.toContain('superuser');
  });

  it('accepts a genuinely valid session', async () => {
    const {token} = await seedAdmin();
    // 404 rather than 401: authorization passed, the record simply does not exist.
    await request(app.getHttpServer())
      .post(PROTECTED)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});

describe('public surface', () => {
  it('serves published experience without a session', async () => {
    await seedExperience();
    const response = await request(app.getHttpServer()).get('/api/experience').expect(200);
    expect(response.body).toHaveLength(1);
    expect(PublicExperienceSchema.safeParse(response.body[0]).success).toBe(true);
  });

  it('withholds the slug from the public projection', async () => {
    // The public shape omits `slug` deliberately; asserting it prevents a later
    // widening of the projection from going unnoticed.
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

    // A draft is reported as missing rather than forbidden, so its existence is not
    // confirmed to an unauthenticated caller.
    const draft = await request(app.getHttpServer()).get('/api/experience/draft-entry').expect(404);
    expect(draft.body.error.code).toBe('NOT_FOUND');
  });

  it('keeps health endpoints reachable without a session', async () => {
    // Without `@Public()` these return 401 and an orchestrator would restart a healthy
    // process - the outage the probe exists to detect.
    //
    // The protected-route assertion below is what makes this a real test. Status 200
    // on its own would also pass if the guards were never registered at all, so it
    // would be a green light for a completely open API.
    const live = await request(app.getHttpServer()).get('/health/live').expect(200);
    expect(live.body.status).toBe('ok');
    expect(typeof live.body.uptimeSeconds).toBe('number');

    const ready = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(ready.body.status).toBe('ready');

    // The guards are active in this same application; health is exempt, not unguarded.
    await request(app.getHttpServer()).post(PROTECTED).expect(401);
  });
});

describe('protected writes', () => {
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
    expect(audits[0]?.action).toBe('experience.create');
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

    // `ExperienceBaseSchema` is not `.strict()`, so an unknown key is stripped rather
    // than rejected. What matters is that it cannot reach the database.
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
    expect(actions).toEqual(['experience.publish', 'experience.unpublish']);
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

    // The duplicate is refused, so there is no change to attribute to anybody.
    expect(await prisma.auditLog.count()).toBe(0);
  });
});

describe('audit atomicity', () => {
  it('rolls the content write back when the audit entry cannot be written', async () => {
    // The PR claims content and audit commit in one transaction. Asserting that both
    // appear on success does not prove it: moving the audit write outside the
    // transaction would still pass every other test in this file. This test is the one
    // that distinguishes the two, by making the audit write fail and requiring that the
    // content change does not survive.
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

    // Neither half may persist: an unaudited career entry is exactly the state this
    // design exists to prevent.
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
  it('uses an allowlisted administrator in these tests', async () => {
    // Guards against the suite drifting from the canonical allowlist.
    expect(ADMIN_ALLOWLIST).toHaveLength(1);
    expect(GITHUB_ID).toBeGreaterThan(0);
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
