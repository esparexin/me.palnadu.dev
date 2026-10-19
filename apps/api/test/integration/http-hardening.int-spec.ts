import type {INestApplication} from '@nestjs/common';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import request from 'supertest';
import {ApiErrorEnvelopeSchema} from '@me-palnadu/contracts';
import {createTestApp, testEnv} from './test-app.js';

/**
 * Cross-origin policy and response header tests.
 *
 * A CORS test that only checks a status code proves nothing: a browser decides whether
 * to let a response through by reading the response headers, and ignores the status
 * entirely. Every assertion here is therefore about a specific header value, and the
 * negative cases assert the *absence* of a header, which is what an origin check
 * actually does.
 *
 * These run without a database. They exercise middleware that runs before any route,
 * so no model, session, or collection is involved - which also means they cannot pass
 * by accident because some seeded row happened to exist.
 */

const ALLOWED = 'http://localhost:3000';
/** A protected route. GET /api/experience is `@Public()` and returns 200 by design. */
const PROTECTED = '/api/experience/anything/publish';
const ALSO_ALLOWED = 'http://localhost:3001';
const DENIED = 'https://evil.example';

let app: INestApplication;
const server = (): unknown => app.getHttpServer();

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

describe('CORS', () => {
  it('grants an allowlisted origin', async () => {
    const response = await request(server()).get('/health/live').set('Origin', ALLOWED).expect(200);
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED);
  });

  it('grants the second allowlisted origin as well', async () => {
    // An allowlist that only ever matched its first entry would still pass the test
    // above, so the second entry is asserted explicitly.
    const response = await request(server())
      .get('/health/live')
      .set('Origin', ALSO_ALLOWED)
      .expect(200);
    expect(response.headers['access-control-allow-origin']).toBe(ALSO_ALLOWED);
  });

  it('does not grant an unlisted origin', async () => {
    const response = await request(server()).get('/health/live').set('Origin', DENIED).expect(200);
    // The response itself may still succeed - the point is that the browser is not
    // given permission to read it. Absence of this header is the entire control.
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['vary']).toMatch(/origin/i);
  });

  it('does not grant a near-miss origin', async () => {
    // Subdomain and scheme variants are the realistic bypass attempts.
    for (const origin of [
      'http://localhost:3000.evil.example',
      'https://localhost:3000',
      'http://localhost:3002',
      'http://LOCALHOST:3000',
      'null',
    ]) {
      const response = await request(server()).get('/health/live').set('Origin', origin);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    }
  });

  it('never allows credentials', async () => {
    // With bearer-token auth this must stay off. If it were ever turned on, an
    // ambient credential would ride along on cross-origin requests and the origin
    // allowlist would stop being a boundary.
    for (const origin of [ALLOWED, DENIED]) {
      const response = await request(server()).get('/health/live').set('Origin', origin);
      expect(response.headers['access-control-allow-credentials']).toBeUndefined();
    }
  });

  it('answers a preflight from an allowlisted origin with the configured methods', async () => {
    const response = await request(server())
      .options('/api/experience')
      .set('Origin', ALLOWED)
      .set('Access-Control-Request-Method', 'POST');

    expect(response.status).toBeLessThan(300);
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(response.headers['access-control-max-age']).toBe('600');
    expect(response.headers['vary']).toMatch(/origin/i);
  });

  it('does not answer a preflight from an unlisted origin', async () => {
    const response = await request(server())
      .options('/api/experience')
      .set('Origin', DENIED)
      .set('Access-Control-Request-Method', 'POST');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('emits no allow-origin header when the request carries no Origin', async () => {
    // A same-origin or server-to-server request must not be handed a CORS grant; that
    // would make the header meaningless to a browser.
    const response = await request(server()).get('/health/live');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does not grant cross-origin access on an error response', async () => {
    const response = await request(server()).post(PROTECTED).set('Origin', DENIED).expect(401);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does not grant cross-origin access on an unauthenticated admin route for an allowed origin', async () => {
    // An allowlisted origin still needs a session. CORS is not authorization, and a
    // test that blurred the two would let a regression in either pass.
    const response = await request(server()).post(PROTECTED).set('Origin', ALLOWED).expect(401);
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('security headers', () => {
  it('sets the hardening headers on a successful response', async () => {
    const response = await request(server()).get('/health/live').expect(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['content-security-policy']).toBe(
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'",
    );
    expect(response.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
  });

  it('sets the same headers on an error response', async () => {
    // The regression this guards: middleware registered after the failure path, so
    // errors arrived bare.
    const response = await request(server()).post(PROTECTED).expect(401);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
    expect(response.headers['x-frame-options']).toBe('DENY');
  });

  it('sets the same headers on a not-found route', async () => {
    const response = await request(server()).get('/no-such-route').expect(404);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('answers an unmatched route with the contract 404, not a 500', async () => {
    // Regression: Nest's NotFoundException used to fail the `isApiError` test and fall
    // through to the persistence mapper, so a mistyped URL returned 500.
    const response = await request(server()).get('/no-such-route').expect(404);
    expect(ApiErrorEnvelopeSchema.safeParse(response.body).success).toBe(true);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.requestId).toBeTruthy();
  });

  it('sets the headers on a protected route that fails validation', async () => {
    const response = await request(server()).post('/api/experience').send({}).expect(401);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
  });

  it('omits HSTS outside production', async () => {
    const response = await request(server()).get('/health/live').expect(200);
    expect(response.headers['strict-transport-security']).toBeUndefined();
  });

  it('sets HSTS in production', async () => {
    const productionApp = await createTestApp(
      testEnv({NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://admin.me.palnadu.dev'}),
    );
    try {
      const response = await request(productionApp.getHttpServer()).get('/health/live').expect(200);
      expect(response.headers['strict-transport-security']).toBe(
        'max-age=31536000; includeSubDomains',
      );
    } finally {
      await productionApp.close();
    }
  });

  it('does not set Cross-Origin-Resource-Policy', async () => {
    // The public site fetches this API cross-origin. `same-origin` here would break
    // the site the API exists to serve, so its absence is deliberate.
    const response = await request(server()).get('/health/live').expect(200);
    expect(response.headers['cross-origin-resource-policy']).toBeUndefined();
  });
});
