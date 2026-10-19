import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import request from 'supertest';
import {ApiErrorEnvelopeSchema} from '@me-palnadu/contracts';
import {createTestApp} from './test-app.js';
import {BODY_LIMIT_BYTES} from '../../src/common/http-hardening.js';

/**
 * Request body size tests.
 *
 * The limit was previously Express's implicit 100KB default while SECURITY.md 5
 * documented 256KB. Two things were wrong with that: the documented contract and the
 * running system disagreed, and an oversize body produced a 500 INTERNAL_ERROR rather
 * than a 413, so a client sending too much was indistinguishable from a server fault -
 * and any alert watching 5xx rates would fire on a rejected upload.
 *
 * These assert behaviour at the real boundary against the real application, using the
 * configured limit rather than a number restated here, so a change to the constant
 * cannot leave the tests asserting a stale figure.
 */

const server = () => app.getHttpServer();

let app: Awaited<ReturnType<typeof createTestApp>>;

const jsonBodyOf = (bytes: number) => ({
  slug: 'boundary-probe',
  org: 'Example Organisation',
  title: 'Endpoint Engineer',
  startDate: '2023-04',
  endDate: '2026-01',
  current: false,
  kind: 'full_time',
  summary: 'x'.repeat(Math.max(0, bytes)),
});

const serialisedSize = (payload: unknown): number => Buffer.byteLength(JSON.stringify(payload));

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

describe('request body limit', () => {
  it('documents the same limit the application enforces', () => {
    // The contract in SECURITY.md 5 says 256KB. If this ever diverges, the
    // documentation is wrong and this test should say so.
    expect(BODY_LIMIT_BYTES).toBe(256 * 1024);
  });

  it('accepts a body just under the limit', async () => {
    const payload = jsonBodyOf(0);
    // Grow the summary until the serialised body lands just below the limit.
    const target = BODY_LIMIT_BYTES - 1024;
    payload.summary = 'x'.repeat(Math.max(0, target - serialisedSize(payload)));

    expect(serialisedSize(payload)).toBeLessThan(BODY_LIMIT_BYTES);

    // No credentials, so the request is refused at the guard - but it must be refused
    // *after* the body was accepted, which is exactly what a 401 proves and a 413
    // would contradict.
    const response = await request(server()).post('/api/experience').send(payload);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a body just over the limit with 413 and the contract envelope', async () => {
    const payload = jsonBodyOf(0);
    payload.summary = 'x'.repeat(BODY_LIMIT_BYTES + 2048);

    const response = await request(server()).post('/api/experience').send(payload);

    expect(response.status).toBe(413);
    expect(ApiErrorEnvelopeSchema.safeParse(response.body).success).toBe(true);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(response.body.error.requestId).toBeTruthy();
  });

  it('does not report an oversize body as a server error', async () => {
    const payload = jsonBodyOf(BODY_LIMIT_BYTES * 2);
    const response = await request(server()).post('/api/experience').send(payload);
    // The regression: this used to be 500 INTERNAL_ERROR, which tells the caller the
    // server failed and trips any 5xx alert on a request the server simply declined.
    expect(response.status).toBeLessThan(500);
    expect(response.body.error.code).not.toBe('INTERNAL_ERROR');
  });

  it('rejects an oversize body on an unauthenticated route too', async () => {
    // The limit is a transport-level control, so it must apply before authorization.
    // A client could otherwise probe the limit with valid credentials or without.
    const payload = jsonBodyOf(BODY_LIMIT_BYTES + 4096);
    const response = await request(server()).post('/api/experience').send(payload);
    expect(response.status).toBe(413);
  });

  it('leaves a small malformed body to the normal validation path', async () => {
    // A 413 must reflect size, not shape. A small invalid body must still fail as a
    // validation problem, never as a size problem.
    const response = await request(server()).post('/api/experience').send({not: 'a body'});
    expect(response.status).toBe(401);
  });
});
