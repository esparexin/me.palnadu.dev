# SECURITY.md

Threat model, administration authentication design, session validation between the admin
application and the API, and secret handling. Implementation may not begin on any
security-relevant path until this document is reviewed.

**Enforcement status: `SPECIFIED`.** No control here has been proven by a run, a scan,
or an API response. See `GOVERNANCE.md` §6.

## 1. Assets

| Asset                                     | Why it matters                                        |
| ----------------------------------------- | ----------------------------------------------------- |
| Published portfolio content               | Professional reputation; falsification is a real harm |
| Draft and unpublished content             | Not yet public; leakage is a disclosure               |
| Administrator identity and sessions       | Full content control, including deletion              |
| Contact submissions                       | Personal data of third parties                        |
| OAuth, database, and provider credentials | Full compromise of the above                          |
| Build and deployment pipelines            | Supply-chain execution against all of the above       |

## 2. Actors and trust boundaries

```
 Untrusted                    Semi-trusted                 Trusted
 ─────────                    ────────────                 ───────
 Visitor ──────▶ apps/web ───▶ apps/api ───▶ MongoDB Atlas
                    │              ▲
 Contact form ──────┘              │  Authorization decided here
                                  │
 Administrator ──▶ apps/admin ───▶ apps/api
   (Email/Pass,        │   Bearer    │
    ADR-0009)          │   session   └──▶ AuditLog
                       └──▶ (HttpOnly Cookie)
```

Trust assumptions, each falsifiable:

1. The visitor is untrusted. Every byte they send is validated at the API boundary.
2. The administrator's browser is semi-trusted. The session proves identity; the API
   decides authorization on every request regardless of what the UI displayed.
3. `apps/api` is the only component holding a database credential.
4. `apps/web` and `apps/admin` hold no credential that grants access to MongoDB.
5. Anything prefixed `NEXT_PUBLIC_` is public and must be treated as attacker-visible.
6. The database, not a token, is the authority on who is an administrator.

## 3. Threats and controls

| Threat                     | Control                                                                                                                                                | Verification                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Unauthorized content write | Bearer session verified by `AdminSessionGuard` + DB allowlist lookup per request                                                                       | API test with no token, bad token, expired token, revoked allowlist    |
| Forged role claim          | Role re-read from MongoDB per request; token `role` is advisory                                                                                        | Test with a token carrying an elevated role for a non-allowlisted user |
| Stolen session token       | 8-hour expiry, `httpOnly` cookie, server-side session record, `tokenVersion` revocation, explicit logout                                               | Revocation test + expiry test                                          |
| XSS in article body        | No `dangerouslySetInnerHTML`; Markdown sanitised server-side; React escaping; CSP without `unsafe-html`                                                | Render test asserting no script executes; header check                 |
| CSRF against a write       | API accepts `Authorization: Bearer` only and never authenticates by cookie, so browser credentials are never ambient; a custom header forces preflight | Cross-origin request test returns 401/403                              |
| Cross-origin data theft    | Explicit CORS allowlist, `credentials: false`                                                                                                          | Preflight test from a disallowed origin                                |
| Spam on the contact form   | Per-IP rate limit, honeypot field, length caps, no HTML rendering of submissions                                                                       | Rate-limit test; honeypot test                                         |
| Content scraping of drafts | Draft filter applied in the API query, not in the UI                                                                                                   | Unauthenticated request for a draft returns 404                        |
| Secret committed to Git    | `.gitignore` + gate 12 secret scan + `gh secret set` only, never a value in a file                                                                     | Scan run + `git log -p` audit                                          |
| Dependency compromise      | Lockfile with `--frozen-lockfile`, advisory audit gate, minimal dependency count                                                                       | Gate 7 run                                                             |
| Pipeline injection         | `permissions: contents: read`, actions pinned to commit SHAs, no secret interpolation into `run:` blocks, no `pull_request_target` checkout of PR code | Workflow review + gate 6                                               |
| Mass assignment            | Write schemas are explicit `z.object` allowlists; `unknown` keys rejected                                                                              | Test posting an unexpected field                                       |
| Prototype/JSON pollution   | Nest body parser limits, schemas strip unknown keys                                                                                                    | Test with `__proto__` payload                                          |
| Audit trail tampering      | Audit writes are append-only from the application; the API exposes no delete/update route for `AuditLog`                                               | Route inventory test                                                   |

## 4. Administrator authentication (email and password, ADR-0009)

**Decision (ADR-0009):** Single-owner authentication by email and password, superseding
the GitHub OAuth decisions in `ADR-0003` and `ADR-0008`. The owner does not couple
administration access to a third-party account. No password is ever stored reversibly,
printed, logged, seeded, or committed.

### 4.1 Owner provisioning

The owner account is created through an explicit server-side provisioning command, never
via an unauthenticated HTTP endpoint or self-service registration:

`pnpm --filter @me-palnadu/api owner:provision -- --email <email>`

The password is entered at a hidden prompt. It is never accepted as an argument because
arguments appear in shell history and process listings.

Rules:

- Email must be valid and normalized (`packages/contracts/src/credentials.ts`).
- Password must satisfy the repository password policy (`passwordProblems`): 12–200
  characters, at least one uppercase letter, one lowercase letter, and one digit, not a
  common password, and must not contain the email's local part.
- Passwords are hashed with `scrypt` from `node:crypto` using N=2^16 (65536), r=8, p=1,
  and a 64-byte derived key.
- No default password or credentials in Git or `.env.example`.

### 4.2 Sign-in flow and throttling

1. Administrator visits `/login` in `apps/admin` and inputs email and password using
   `@me-palnadu/ui` accessible primitives.
2. Form submission executes Next.js server action `loginAction`, which calls
   `POST /api/auth/login` on the API boundary.
3. API verifies credentials using constant-time comparison (`timingSafeEqual`). If the
   account is unknown, a decoy scrypt calculation executes to resist timing enumeration.
4. If authentication fails, the API returns a generic failure message:
   `"Those credentials were not recognised."` preventing account enumeration.
5. `POST /api/auth/login` is strictly rate-limited by IP to 10 attempts per 15 minutes
   using `@nestjs/throttler`.
6. On success:
   - An `AdminSession` record is created in MongoDB with an 8-hour maximum lifetime.
   - An opaque signed HS256 JWT is returned to `apps/admin` with the same 8-hour lifetime.
     There is no refresh route (`ADR-0012`).
   - `apps/admin` writes an `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` (in production)
     cookie (`__Secure-me-palnadu-admin.session` or `me-palnadu-admin.session`).
   - The user is redirected to the sanitized destination (preventing open redirects).

### 4.3 Token and cookie properties

| Property          | Value                                                                                              | Reason                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Strategy          | Database-backed JWT session                                                                        | Stateless verification for claims + immediate DB lookup for revocation, activation, and tokenVersion                      |
| Hashing           | `scrypt` via `node:crypto` (N=65536, r=8, p=1, keylen=64)                                          | Native Node 22 cryptographic implementation; resistant to GPU brute-force                                                 |
| Signing           | HS256, `AUTH_SECRET` ≥ 32 bytes, API-only verification; the admin forwards the token               | Only the API verifies; the admin holds no signing secret by design                                                        |
| Access lifetime   | 8 hours                                                                                            | Matches the session ceiling; there is no refresh route (`ADR-0012`)                                                       |
| Session lifetime  | 8 hours absolute                                                                                   | Bounded administrator workday                                                                                             |
| Algorithm pinning | `algorithms: ['HS256']` on verification                                                            | Blocks `alg: none` and algorithm-confusion attacks                                                                        |
| Claims            | `sub` (internal user id), `email`, `role`, `sid`, `tv` (token version), `iss`, `aud`, `iat`, `exp` | Identity, email for audit, session handle, token revocation version                                                       |
| Cookie flags      | `httpOnly`, `Secure` (prod), `SameSite=Lax`, `Path=/`, host-only, `__Secure-` prefix (prod)        | Prevents script access; `SameSite=Lax` prevents CSRF on ambient cross-site queries; `__Secure-` ensures TLS in production |
| Mass Revocation   | Incrementing `AdminUser.tokenVersion`                                                              | Invalidates all active tokens instantly across all devices                                                                |

### 4.4 Session validation between `apps/admin` and `apps/api`

Principle: the API never trusts the admin frontend, and the browser never holds the
API credential in a way an attacker can read.

1. The session cookie is scoped to the **admin host only** and is never readable by
   JavaScript (`httpOnly`). It is never sent directly to the API by the browser.
2. Server-side code in `apps/admin` (route handlers, server actions) reads the session
   cookie and calls the API with an `Authorization: Bearer <token>` header.
3. `apps/api` applies `AdminSessionGuard` to every non-public controller:
   1. Extract the bearer token. Absent or malformed ⇒ `UNAUTHENTICATED`.
   2. `jwtVerify` with the pinned algorithm (`HS256`), expected `iss` and `aud`, and the
      shared secret. Failure ⇒ `UNAUTHENTICATED`.
   3. Load `AdminUser` by the token's `sub`. Missing, inactive (`active: false`), or
      email mismatch ⇒ `FORBIDDEN` / `UNAUTHENTICATED`.
   4. Load `AdminSession` by `sid`. Revoked (`revokedAt !== null`), expired, or belonging
      to another user ⇒ `UNAUTHENTICATED`.
   5. Compare `AdminUser.tokenVersion` with the token's `tv`. Mismatch ⇒
      `UNAUTHENTICATED`.
   6. Attach the loaded administrator context to the request.
4. Logout calls `POST /api/auth/logout`, setting `revokedAt` on the `AdminSession` record
   and clearing the cookie.
5. Password change calls `POST /api/auth/change-password`, verifies the current password,
   updates the `passwordHash`, and increments `tokenVersion`, instantly terminating all
   active sessions.
6. Break-glass recovery re-executes `owner:provision` on the server host, updating the
   password hash and incrementing `tokenVersion`.

**MFA Assessment:** MFA is deferred to a future phase. With the removal of GitHub OAuth,
the repository relies on the 12+ character password policy, scrypt work factor, IP-based
login rate limiting, and explicit server-side provisioning as compensating controls. The
operational risk is documented in `ADR-0009`.

## 5. Public surface hardening

| Control            | Implementation                                                                                                                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security headers   | API: CSP, `Strict-Transport-Security` in production, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`. Admin: equivalent headers in `apps/admin/next.config.ts`, with Cloudinary allowed for images and uploads; HSTS is production-only |
| CORS               | Explicit origin allowlist per environment; `credentials: false`; `Access-Control-Max-Age: 600`                                                                                                                                                                         |
| Rate limiting      | `@nestjs/throttler` — public reads 120/min per IP, administrative writes 300/min per administrator (`ADR-0007`)                                                                                                                                                        |
| Rate-limit storage | In-memory per API instance. **Limitation:** limits are per instance, so horizontal scaling weakens them. The API is therefore pinned to a single instance with this documented rationale; moving to a shared store requires an ADR                                     |
| Body limits        | JSON body capped at 256KB (`BODY_LIMIT_BYTES`, set explicitly rather than inherited from Express's 100KB default); Markdown fields capped by schema length. Rejection is `PAYLOAD_TOO_LARGE`/413                                                                       |
| Input              | Every write validated by a contracts schema; unknown keys rejected; no dynamic `Object.assign` onto persisted documents                                                                                                                                                |
| Rendering          | Markdown is stored as source and parsed by `@me-palnadu/shared` into a restricted AST that React renders as elements; no HTML string is produced and `dangerouslySetInnerHTML` does not appear in the codebase                                                         |
| Files              | No public upload path. The browser uploads directly to Cloudinary with a short-lived signature; the API never receives bytes, validates the registered URL's cloud and folder, and stores metadata only. All three Cloudinary keys or none, enforced at boot           |
| Draft isolation    | Draft filtering in the API query builder; unauthenticated draft access returns 404, never 403 (403 would confirm existence)                                                                                                                                            |
| Error responses    | Contract error envelope only; no stack traces, driver messages, or collection names                                                                                                                                                                                    |

## 6. Frontend responsibilities

- Authorization is never expressed by hiding a control. A hidden button is UX; the API
  is the control.
- The admin UI renders capability based on the session returned by the server, and every
  mutation still fails server-side if the session is invalid.
- No `dangerouslySetInnerHTML`. No third-party script without a documented need and an
  entry in the CSP.
- `NEXT_PUBLIC_*` values are public. Only the API base URL is expected there.
- Content rendered from the database is treated as untrusted input even though only an
  administrator can write it: the administrator account can be phished.

## 7. Secrets

| Class                                 | Storage                                                 | Never                                                            |
| ------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------- |
| `AUTH_SECRET` (API)                   | Render environment store; GitHub Actions secrets for CI | In any file, including `.env.example` values, fixtures, and docs |
| `DATABASE_URL` (Atlas URI)            | Render environment store                                | Committed; the URI embeds credentials                            |
| `REVALIDATE_SECRET` (API and web)     | Vercel and Render environment stores                    | Committed; the API env schema enforces `>= 16` characters        |
| `CLOUDINARY_API_SECRET`               | Render environment store                                | Returned by any route, logged, or committed                      |
| Third-party tokens (analytics, email) | Provider stores                                         | Committed                                                        |

Procedure:

1. `.env.example` lists key names with empty values and a one-line description each.
2. Rotating `AUTH_SECRET` logs out every administrator. Rotate on any suspicion.
3. If a secret is ever committed, the response is: rotate the secret first, then remove
   it in a follow-up commit, then review `git log -p` and the provider's access logs.
   Deleting the file does not un-leak it.
4. Local development uses unprivileged local credentials or a dedicated Atlas
   development cluster; development and production databases are never the same.

## 8. Pipeline security

- Workflow `permissions: contents: read` at the top level; jobs request more only when
  justified.
- Third-party actions pinned to a commit SHA with a version comment.
- No `${{ secrets.* }}` or `${{ github.* }}` interpolated into a `run:` block; secrets
  are passed through `env:` only.
- No `pull_request_target` with a checkout of untrusted PR code.
- Untrusted input (PR title, branch name, issue body) is treated as data, never as shell.
- Gate 6 runs a workflow linter, a secret scan, and CodeQL. Gate 11 verifies that no
  gate was neutered.

## 9. Verification requirements

A security control is claimed complete only with: the test that exercises it, the
command output, and — for provider settings — the provider's own API response. Pending
those, every control in this document is `SPECIFIED`.

Before production, the following must be evidenced: an authorization matrix test
(unauthenticated, wrong user, revoked, expired, elevated-claim token) for every protected
route; a CSP report confirming no violations; a clean secret scan over full history; an
advisory audit; and an explicit check that drafts are unreachable without a session.

### 9.1 What Phase 6B proved, and what it did not

**Proven by `pnpm db:integration` (106 passing across 7 files: 35 authorization, 18
cross-origin and headers, 16 authentication, 14 experience persistence, 10 content, 7
rate limiting, and 6 body limits).** The §4.4 API authorization boundary runs on every
protected request, against a real Nest application and a real MongoDB replica set:

| Control                                                                       | Exercised by                                                                                                                                                        |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Absent or malformed `Authorization` header is `UNAUTHENTICATED`/401           | `authorization.int-spec.ts` — "refuses a request with no Authorization header"                                                                                      |
| Bad signature, wrong secret, `alg:none`, expired, wrong issuer/audience → 401 | "refuses a token signed with a different secret", "refuses an unsigned token", "refuses an expired token", "refuses a wrong issuer and a wrong audience"            |
| Signed token for a non-administrator → 403                                    | "refuses a signed token for a non-administrator with 403"                                                                                                           |
| Deactivated administrator → 403                                               | "refuses a deactivated administrator"                                                                                                                               |
| Revoked, expired, or foreign session → 401                                    | "refuses a revoked session", "refuses an expired session record even when the token has not expired", "refuses a session that belongs to a different administrator" |
| Token-version increment invalidates every session                             | "invalidates every session when the token version is incremented"                                                                                                   |
| A forged role claim does not widen authority                                  | "ignores a forged role claim in favour of the database"                                                                                                             |
| A stored role outside the canonical enum fails closed                         | "fails closed when the stored role is outside the canonical enum"                                                                                                   |
| Public reads expose published records only, and no `slug`                     | "never serves a draft on the public list or by slug", "withholds the slug from the public projection"                                                               |
| Health probes stay reachable                                                  | "keeps health endpoints reachable without a session"                                                                                                                |
| Every write commits its audit entry in one transaction                        | "creates an experience entry and records an audit entry", "records no audit entry when the write itself fails"                                                      |
| Validation uses the contracts at the boundary                                 | "rejects an invalid body with the contract error envelope"                                                                                                          |

**Still `SPECIFIED`, and not covered by any test above:**

- Role-based _denial_, deferred by decision — see §9.6.

Security headers, CORS, rate limiting, and email/password authentication (ADR-0009) were
also listed here. Each is now implemented and proven in §9.2, §9.4, §9.5, and §9.7.

**Open domain decision — `archive`.** Archiving was implemented as `published = false`,
which is byte-for-byte what `unpublish` already did: two names for one behaviour, where
an operator would reasonably assume they differ. The route has been removed rather than
left misleading. Real archiving needs an archived state in `packages/contracts` and
`apps/api/prisma/schema.prisma` — a contract and schema decision, not a routing one, so
it is not taken unilaterally here.

### 9.2 Phase 6C: cross-origin policy and response headers

**Centralization was the prerequisite.** CORS, the `ValidationPipe`, and the security
headers were configured inside `main.ts`, which the test suite never calls. Every test
application therefore ran with **no CORS at all**, and `forbidNonWhitelisted` was a
control with no test. `configureHttp()` in `apps/api/src/common/http-hardening.ts` is
now the single definition of the HTTP surface, called by both the server and the tests,
so a test cannot assert against a differently-configured application.

**Proven by `pnpm db:integration` (18 passing, `http-hardening.int-spec.ts`):**

| Control            | Asserted behaviour                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| Origin allowlist   | Each allowlisted origin receives `Access-Control-Allow-Origin` set to that exact origin                         |
| Origin denial      | An unlisted origin receives **no** `allow-origin` header; `Vary: Origin` is present                             |
| Near-miss origins  | `localhost:3000.evil.example`, `https://localhost:3000`, port `3002`, `LOCALHOST`, and `null` are all refused   |
| No credentials     | `Access-Control-Allow-Credentials` is absent for allowed and denied origins alike                               |
| Preflight          | An allowlisted preflight is answered with `Access-Control-Max-Age: 600`; a denied origin gets no grant          |
| Absent `Origin`    | No `allow-origin` header is emitted for a same-origin or server-to-server request                               |
| Headers on success | `nosniff`, `Referrer-Policy`, `X-Frame-Options`, CSP, `Permissions-Policy`                                      |
| Headers on errors  | The same headers are present on a 401 and on a 404 — the regression where middleware ran after the failure path |
| HSTS               | Absent outside production, present in production                                                                |

**Mutation-tested.** Weakening each control fails the suite: `credentials: true` fails
1 test, `origin: true` fails 4, removing `nosniff` fails 4, weakening CSP to
`default-src 'self'` fails 2, and removing the middleware fails 5. A test that cannot
fail is not evidence.

**Two defects found while writing these tests:**

1. An unmatched route returned **500, not 404**. Nest's `NotFoundException` carries a
   `statusCode` rather than a contract `code`, failed the filter's `isApiError` test,
   and fell through to the persistence mapper. Now mapped explicitly, with messages
   replaced rather than echoed so caller input is never reflected into an error body.
2. The global `ValidationPipe` was registered only in `main.ts`, so
   `forbidNonWhitelisted` was never exercised by any test. Moved into `configureHttp`.

**Still `SPECIFIED`, and not covered by any test above:**

- Rate limiting was `SPECIFIED` at the time of that audit and is now proven by Phase 6E
  (§9.5); the earlier entry is superseded.
- Request body limit. The §5 table specifies 256KB; Express's default is 100KB. The
  running system is _stricter_ than documented, which is a documentation defect rather
  than a security hole, but the two must be reconciled deliberately.
- `Cross-Origin-Resource-Policy` is deliberately **not** set: the public site fetches
  this API cross-origin, so a `same-origin` policy would break the site the API exists
  to serve. A test asserts its absence so the omission is not mistaken for an oversight.
- HSTS assumes TLS terminates upstream. It is gated on `NODE_ENV === 'production'`
  rather than sent unconditionally, so its presence is a decision and not an accident.
  Whether the deployment actually terminates TLS is a `DEPLOYMENT_MAP.md` question and
  is not established by these tests.

**Current state (Phase 6F):** sign-in is email/password with scrypt verification,
database-backed sessions, and `owner:provision` as the only way to create the owner
account. The API still accepts bearer tokens only; the admin host holds the cookie.
CSRF remains inapplicable while browser mutations are Next.js Server Actions with
origin checks and the API never authenticates by cookie. Every session and audit
claim in §9.7 is proven by an integration run; the Cloudinary upload path is unproven
against a real provider because no credentials exist in this repository.

### 9.3 Phase 6D: request body limit

**Proven by `pnpm db:integration` (6 passing, `body-limit.int-spec.ts`).** The limit is
set explicitly to `BODY_LIMIT_BYTES` (256KB) through Nest's `useBodyParser`, and a body
over the limit is refused with `PAYLOAD_TOO_LARGE`/413 in the contract envelope.

| Control                      | Asserted behaviour                                                           |
| ---------------------------- | ---------------------------------------------------------------------------- |
| Documented limit             | `BODY_LIMIT_BYTES` equals 256KB, matching §5                                 |
| Just under the limit         | Accepted, and refused at the guard with 401 — a 401 proves the body was read |
| Just over the limit          | 413 with the contract envelope and a request id                              |
| Not a server error           | The refusal is never 5xx and never `INTERNAL_ERROR`                          |
| Applies before authorization | An oversize body is refused on an unauthenticated request too                |
| Size, not shape              | A small malformed body still fails through the normal path                   |

**Mutation-tested:** removing the explicit limit fails 1 test, reverting 413 to the
default branch fails 3, and removing the transport-error mapping fails 3.

**Two defects found:**

1. **An oversize body returned 500, not 413.** The Express JSON parser throws a plain
   object carrying `status: 413`; it is not an `HttpException`, so the filter's
   `instanceof` branch never saw it and it fell through to the persistence mapper. A
   client that sent too much was indistinguishable from a server fault, and any alert
   watching 5xx rates fired on a request the server had simply declined.
2. **The documented limit and the running limit disagreed.** §5 said 256KB; Express's
   implicit default was 100KB. The system was stricter than documented, so this was a
   documentation defect rather than a hole — but an implicit framework default is not a
   control this repository chose, tested, or can reason about.

`PAYLOAD_TOO_LARGE` is added to `ERROR_CODES` in `@me-palnadu/contracts` — the single
source of truth — rather than improvised in the API. `STATUS_BY_CODE` is a
`Record<ErrorCode, number>`, so a new code without a status is a compile error, not a
silent gap.

**Still outstanding:** tracked together in §9.6.

### 9.4 Why the API does not use `app.useSecurityHeaders()`

Nest 12 ships `useSecurityHeaders()`. It was evaluated against this application rather
than adopted, because its defaults do not fit a JSON API consumed cross-origin. Measured
by running it and reading the emitted headers:

| Header                         | Nest's default                                     | What this API needs               | Consequence                                                                             |
| ------------------------------ | -------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------- |
| `Cross-Origin-Resource-Policy` | `same-origin`                                      | **absent**                        | Would break the public site, which fetches this API cross-origin                        |
| `Content-Security-Policy`      | `default-src 'self'` … `upgrade-insecure-requests` | `default-src 'none'`              | A document policy, not a JSON policy; the upgrade directive would rewrite http to https |
| `Strict-Transport-Security`    | always sent                                        | production only                   | Would apply in development and test                                                     |
| `Referrer-Policy`              | `no-referrer`                                      | `strict-origin-when-cross-origin` | §5 specifies the latter                                                                 |
| `X-Frame-Options`              | `SAMEORIGIN`                                       | `DENY`                            | Weaker than §5's `frame-ancestors 'none'`                                               |
| `Permissions-Policy`           | **not supported**                                  | required by §5                    | No option exists for it                                                                 |

The resource policy alone is decisive. Using the built-in would mean disabling six
defaults, restating the rest, and keeping a middleware anyway for the one header it
cannot express. `http-hardening.int-spec.ts` asserts `Cross-Origin-Resource-Policy`
stays absent so this decision cannot be undone by a well-meaning "use the framework
built-in".

This entry exists because Phase 6C hand-wrote the middleware without first checking
what the framework offered. It should have checked.

### 9.5 Phase 6E: rate limiting

**Decision:** `ADR-0007`. `@nestjs/throttler@6.7.1`, pinned exactly, in-memory storage.

Compatibility was verified rather than assumed: `6.7.1` declares `@nestjs/core` and
`@nestjs/common` as `^7 || ^8 || ^9 || ^10 || ^11 || ^12`, which covers the pinned
12.1.3. `pnpm audit --audit-level high` reports no known vulnerabilities.

**Proven by `pnpm db:integration` (7 passing, `rate-limit.int-spec.ts`).** The tests
make real requests and assert refusals; a test reading only the configured numbers would
prove the configuration parses, not that anything is enforced.

| Control               | Asserted behaviour                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------- |
| Documented limits     | 120/min public, 300/min admin, 60s window — matching §5                                  |
| Public reads          | Requests 1–120 succeed; request 121 receives `429 RATE_LIMITED` in the contract envelope |
| Administrative writes | Requests 1–300 reach the handler; request 301 receives 429                               |
| Anonymous callers     | 20 unauthenticated attempts all return 401 and spend none of the administrator's budget  |

**Mutation-tested:** removing the throttler guard fails 2 tests, raising the public limit
tenfold fails 1, and removing the `SkipThrottle` on administrative routes fails 1.

**One defect found by writing the tests.** Every named throttler registered in
`forRoot` applies to every route unless explicitly skipped, so administrative writes
were also charged to the 120/min public budget and the 300-request test was refused at
request 121. `AdminRateLimit` and `PublicRateLimit` now skip the other throttler
explicitly. A rate limit that is quietly the lower of two policies is not the policy
anyone documented.

**Known limitation, unchanged and accepted:** counters are per instance and reset on
restart (`ADR-0007`). The API is pinned to a single instance for this reason. Moving to
a shared store requires an ADR because it changes the deployment assumption.

**Still outstanding:** tracked together in §9.6.

### 9.6 Deferred controls

Role-based denial is **implemented, not deferred**. The API guard reads the stored role
for every request, and integration tests prove that an editor is refused article
deletion, media deletion, and audit reading while an owner is allowed. The forged-claim
test proves that a token's advisory role cannot widen authority.

The remaining deferred control is **MFA**, for the reasons recorded in `ADR-0009` and
§4.4. There is no administrator-management surface and no second administrator; adding
one would require a new policy and tests, not a placeholder screen.

Reopen the role model when a second administrator exists or when a new operation has a
genuine owner-only requirement. Define the policy first, then prove denial and
allowance.

### 9.7 Phase 6F: Email/password authentication and owner provisioning (ADR-0009)

`ADR-0009` supersedes GitHub OAuth (`ADR-0003`, `ADR-0008`) with direct, single-owner
email and password credentials. Authentication issuance is no longer blocked on third-party
apps or credentials.

**Proven by `pnpm db:integration` (16 passing in `auth.int-spec.ts`):**

| Control                     | Asserted behaviour                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| Successful authentication   | Valid owner email and password returns JWT token and session metadata                    |
| Password verification       | Incorrect password is rejected with 401 and generic error                                |
| Account enumeration defense | Unknown email returns 401 with identical generic error; constant-time decoy runs         |
| Decoy timing defense        | Decoy computation runs for non-existent users so response duration does not reveal state |
| Throttling / abuse defense  | Excessive login attempts (>10 within 15 min) are blocked with 429 Too Many Requests      |
| Session creation            | Successful login creates an active `AdminSession` record in MongoDB                      |
| Session validation          | `GET /api/auth/session` returns current authenticated identity when token is valid       |
| Direct session revocation   | `POST /api/auth/logout` revokes session; subsequent requests with token fail with 401    |
| Password change             | `POST /api/auth/change-password` requires current password and enforces policy           |
| Mass session invalidation   | Password change increments `tokenVersion`, instantly invalidating all issued tokens      |
| Inactive administrator      | Deactivated administrator (`active: false`) cannot log in or use existing sessions       |

**Proven by `pnpm --filter @me-palnadu/admin test` (20 passing in `session.test.ts` & `actions.test.ts`):**

| Control                    | Asserted behaviour                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------- |
| Open redirect defense      | `sanitizeRedirectPath` rejects absolute URLs, protocol-relative URLs, and bad schemes |
| Cookie security attributes | Session cookie is written with `httpOnly: true`, `sameSite: 'lax'`, and `path: '/'`   |
| Environment scoping        | Production uses `__Secure-` cookie prefix and `secure: true`                          |
| Session recovery / readout | `getAuthenticatedAdmin` retrieves valid principal and returns null on bad session     |
| Server action safety       | `loginAction` validates inputs, calls API, sets cookie, and handles redirects         |
| Logout action safety       | `logoutAction` notifies API, deletes cookie, and redirects to `/login`                |

**Status of deferred controls (§9.6):**

- **GitHub OAuth sign-in:** Superseded by `ADR-0009`. The external dependency is removed.
- **CSRF protection:** Cookie-based sessions exist only on the admin domain with `SameSite=Lax`. The API continues to reject cookie authentication, accepting bearer tokens only. Admin browser mutations use Next.js Server Actions with built-in origin checks.
- **Role-based denial:** Remains deferred until multiple administrators or distinct role requirements exist.
- **MFA:** Deferred per `ADR-0009`. Password policy, scrypt work factor, IP rate limits, and server-side provisioning provide compensating controls.

**Standing constraint.** No security control is added merely to raise a test count. Each
one corresponds to a real requirement, has a stated threat, and has a test that fails
when the control is removed.
