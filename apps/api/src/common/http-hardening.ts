import type {NestExpressApplication} from '@nestjs/platform-express';
import type {NextFunction, Request, Response} from 'express';
import {allowedOrigins, type Env} from '../config/env.js';
import {RequestIdMiddleware} from './api-exception.filter.js';

/**
 * HTTP surface hardening: cross-origin policy and response headers.
 *
 * This module exists because both controls used to be configured, if at all, inside
 * `main.ts`. That made them invisible to tests: the integration suite builds its own
 * Nest application and never calls `bootstrap()`, so it ran with no CORS configured
 * at all - a test could assert anything about cross-origin behaviour and be green.
 * Configuration that only exists in the entrypoint is configuration that is not
 * verified. Both the server and the tests now call `configureHttp`.
 *
 * The header policy is written out here rather than pulled from a dependency
 * (AGENTS.md 2.10, prefer deletion over accumulation). It is small, the values are
 * fixed by SECURITY.md 5, and an explicit list is reviewable in a diff.
 */

/**
 * Headers applied to every response, success or failure.
 *
 * Deliberately excludes `Cross-Origin-Resource-Policy`: the public web application
 * fetches this API cross-origin, so a `same-origin` policy there would break the site
 * that is the whole point of the API.
 */
const PERMANENT_HEADERS: Readonly<Record<string, string>> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  // A JSON API serves no documents, so the most restrictive policy that still permits
  // the response to be read is the correct one. This is not a copy of a web app's CSP
  // with `default-src 'self'`; there are no scripts here to allow.
  'Content-Security-Policy':
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/**
 * HSTS is sent only when the deployment terminates TLS.
 *
 * Browsers ignore the header over plain HTTP, so sending it in development would be
 * harmless - but "harmless today" is how a policy that is wrong for local work becomes
 * a policy nobody questions in production. It is gated so its presence is a decision
 * rather than an accident, and so a test can assert both branches.
 */
const STRICT_TRANSPORT_SECURITY = 'max-age=31536000; includeSubDomains';

/**
 * Maximum accepted JSON body, matching the limit documented in SECURITY.md section 5.
 *
 * Express defaults to 100KB. That is a different number from the documented contract,
 * and an implicit default means the limit is whatever a framework decides rather than
 * something this repository chose and can test. Stated here so it is a decision.
 */
export const BODY_LIMIT_BYTES = 256 * 1024;

/**
 * Sets the hardening headers on the way out.
 *
 * Registered as ordinary middleware so the headers are present on error responses
 * too. A 401 or 404 that arrives without `nosniff` would still be a response a browser
 * sniffs, which is the whole purpose of the header.
 *
 * Why not `app.useSecurityHeaders()`, which Nest 12 provides? Measured against this
 * application, its defaults emit:
 *
 *   cross-origin-resource-policy: same-origin   <- would break the public site
 *   content-security-policy: default-src 'self'; ... upgrade-insecure-requests
 *   strict-transport-security: max-age=31536000; includeSubDomains  <- unconditionally
 *   referrer-policy: no-referrer                <- SECURITY.md 5 asks for
 *                                                 strict-origin-when-cross-origin
 *   x-frame-options: SAMEORIGIN                 <- this policy uses DENY
 *
 * The resource policy is decisive on its own: this API is fetched cross-origin by the
 * public site, so `same-origin` would break the site the API exists to serve. The CSP
 * is helmet's document policy - correct for an HTML page, wrong for JSON, and
 * `upgrade-insecure-requests` would rewrite http to https.
 *
 * Nor is `Permissions-Policy` expressible there: it is absent from Nest's option
 * table entirely, and SECURITY.md 5 requires it. Using the built-in would mean
 * disabling six defaults, restating the rest, and still keeping a middleware for the
 * one header it cannot set.
 */
export const securityHeaders =
  (env: Env) =>
  (request: Request, response: Response, next: NextFunction): void => {
    for (const [header, value] of Object.entries(PERMANENT_HEADERS)) {
      response.setHeader(header, value);
    }
    if (env.NODE_ENV === 'production') {
      response.setHeader('Strict-Transport-Security', STRICT_TRANSPORT_SECURITY);
    }
    next();
  };

/**
 * The single definition of the HTTP surface, shared by the server and the tests.
 *
 * Middleware order matters: headers first, then the request id, so the id is present
 * on every response including a cross-origin preflight that is rejected before any
 * route runs.
 */
export const configureHttp = (app: NestExpressApplication, env: Env): void => {
  app.use(securityHeaders(env));

  // Applied explicitly rather than inherited from Express's 100KB default.
  app.useBodyParser('json', {limit: BODY_LIMIT_BYTES});

  // No global Nest ValidationPipe here, deliberately.
  //
  // Phase 6C found that the one registered in `main.ts` was broken: it requires
  // `class-validator` and `class-transformer`, which are not dependencies, so
  // Nest's package loader threw at startup. Moving it into `configureHttp` surfaced
  // the failure as a non-zero exit from the integration suite.
  //
  // Restoring it by installing those packages would be the wrong fix. `ValidationPipe`
  // only validates when a handler parameter carries a DTO metatype, and no route in
  // this application has one - `@Body` takes a `ZodValidationPipe` over a contracts
  // schema instead. So the pipe was a no-op that cost two dependencies to run.
  //
  // Contracts schemas remain the single validation mechanism (SSOT_POLICY 4). Adding a
  // second validator that can disagree with them would trade a latent startup failure
  // for a subtler one: two answers to the same question about whether a body is valid.

  app.enableCors({
    origin: allowedOrigins(env),
    // The API authenticates by bearer token. If credentials were enabled, a browser
    // would attach ambient credentials to a cross-origin request and the origin
    // allowlist would stop being a security boundary.
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'x-request-id'],
    maxAge: 600,
  });

  const requestId = new RequestIdMiddleware();
  app.use((request: Request, response: Response, next: NextFunction) => {
    requestId.use(request, response, next);
  });
};
