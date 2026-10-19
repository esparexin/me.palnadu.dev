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
   (GitHub OAuth)      │   Bearer    │
                       │   session   └──▶ AuditLog
                       └──▶ MongoDB Atlas (read sessions only)

 GitHub (identity provider) ──▶ apps/admin callback ──▶ apps/api
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

| Threat                       | Control                                                                                                                                                | Verification                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Unauthorized content write   | Bearer session verified by `AdminSessionGuard` + DB allowlist lookup per request                                                                       | API test with no token, bad token, expired token, revoked allowlist    |
| Forged role claim            | Role re-read from MongoDB per request; token `role` is advisory                                                                                        | Test with a token carrying an elevated role for a non-allowlisted user |
| Stolen session token         | 15-minute expiry, `httpOnly` cookie, server-side session record, `tokenVersion` revocation, `Escape`/timeout logout                                    | Revocation test + expiry test                                          |
| XSS in article body          | No `dangerouslySetInnerHTML`; Markdown sanitised server-side; React escaping; CSP without `unsafe-html`                                                | Render test asserting no script executes; header check                 |
| CSRF against a write         | API accepts `Authorization: Bearer` only and never authenticates by cookie, so browser credentials are never ambient; a custom header forces preflight | Cross-origin request test returns 401/403                              |
| Cross-origin data theft      | Explicit CORS allowlist, `credentials: false`                                                                                                          | Preflight test from a disallowed origin                                |
| Spam on the contact form     | Per-IP rate limit, honeypot field, length caps, no HTML rendering of submissions                                                                       | Rate-limit test; honeypot test                                         |
| Content scraping of drafts   | Draft filter applied in the API query, not in the UI                                                                                                   | Unauthenticated request for a draft returns 404                        |
| Secret committed to Git      | `.gitignore` + gate 12 secret scan + `gh secret set` only, never a value in a file                                                                     | Scan run + `git log -p` audit                                          |
| Dependency compromise        | Lockfile with `--frozen-lockfile`, advisory audit gate, minimal dependency count                                                                       | Gate 7 run                                                             |
| Pipeline injection           | `permissions: contents: read`, actions pinned to commit SHAs, no secret interpolation into `run:` blocks, no `pull_request_target` checkout of PR code | Workflow review + gate 6                                               |
| Mass assignment              | Write schemas are explicit `z.object` allowlists; `unknown` keys rejected                                                                              | Test posting an unexpected field                                       |
| Prototype/JSON pollution     | Nest body parser limits, schemas strip unknown keys                                                                                                    | Test with `__proto__` payload                                          |
| Denial of service on the API | Rate limits, request body size limits, pagination caps                                                                                                 | Load check in staging                                                  |
| Audit trail tampering        | Audit writes are append-only from the application; the API exposes no delete/update route for `AuditLog`                                               | Route inventory test                                                   |

## 4. Administrator authentication

**Decision (ADR-0003):** Auth.js with the GitHub OAuth provider. No password is ever
stored, transmitted, or hashed, because no local credential exists.

### 4.1 Allowlist

Administration is granted **only** to explicitly enumerated GitHub accounts, matched on
the immutable numeric GitHub user id — never on the login, which can be renamed.

| GitHub id   | Login       | Name               | Role    |
| ----------- | ----------- | ------------------ | ------- |
| `230946749` | `esparexin` | Kalyan V Medaboina | `owner` |

```ts
// packages/contracts — the allowlist is a contract, so client and server agree.
export const ADMIN_ALLOWLIST = [{githubId: 230946749, login: 'esparexin', role: 'owner'}] as const;
```

Rules:

- The allowlist in contracts is the **seed**; the `AdminUser` collection is the
  **authority**. A GitHub account absent from the database cannot write anything,
  regardless of what any token claims.
- Adding an administrator is a code change (seed) **and** a database change, both
  audited. There is no self-service invitation, no public registration, and no
  user-management UI.
- If the GitHub OAuth app is compromised, GitHub still only asserts an identity; the
  database allowlist still rejects unknown ids.

### 4.2 Sign-in flow

1. Administrator visits `/login` on the admin host and selects "Sign in with GitHub".
2. Auth.js redirects to GitHub with `state`, `nonce`, `PKCE`, and
   `redirect_uri = https://<ADMIN_DOMAIN>/api/auth/callback/github`.
3. GitHub returns the code; Auth.js exchanges it server-side for the token, fetches
   `/user` for the numeric id, and verifies the id against the allowlist.
4. **Allowlist failure** ⇒ no session is created, no cookie is set, and the event is
   recorded as a rejected attempt. The failure response is deliberately generic.
5. Success ⇒ a signed session token is issued and a session record is created.

### 4.3 Token and cookie properties

| Property          | Value                                                                                              | Reason                                                                                                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strategy          | Auth.js JWT (no database session adapter needed)                                                   | One fewer component; sessions are still recorded in the API's own `AdminSession` collection for revocation and audit                                                                         |
| Signing           | HS256, `AUTH_SECRET` ≥ 32 bytes, identical value in admin and API environments                     | Both components verify independently; rotation invalidates all sessions by design                                                                                                            |
| Access lifetime   | 15 minutes                                                                                         | Limits the value of a stolen token                                                                                                                                                           |
| Session lifetime  | 8 hours absolute, refreshed at most every 15 minutes                                               | Bounded administrator workday                                                                                                                                                                |
| Algorithm pinning | `algorithms: ['HS256']` on verification                                                            | Blocks `alg: none` and algorithm-confusion attacks                                                                                                                                           |
| Claims            | `sub` (internal user id), `gh_id`, `role`, `sid`, `tv` (token version), `iss`, `aud`, `iat`, `exp` | Identity, authority hint, session handle, revocation version                                                                                                                                 |
| Cookie flags      | `httpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, host-only, `__Secure-` prefix                      | `Lax` is required for the OAuth redirect to return the session cookie; `__Host-` is impossible with `SameSite=Lax` plus an OAuth round trip, so `__Secure-` is the strongest workable prefix |
| Rotation          | Changing `AUTH_SECRET` invalidates every session immediately                                       | Emergency revocation lever                                                                                                                                                                   |

`AUTH_SECRET`, the GitHub client id, and the GitHub client secret exist only in the
Vercel and Render environment stores. `.env.example` documents the key names with empty
values.

### 4.4 Session validation between `apps/admin` and `apps/api`

This is the control most likely to be implemented wrongly, so it is specified
end-to-end.

**Principle: the API never trusts the admin frontend, and the browser never holds the
API credential in a way an attacker can read.**

1. The OAuth cookie is scoped to the **admin host only** and is never readable by
   JavaScript (`httpOnly`). It is never sent to the API.
2. Server-side code in `apps/admin` (route handlers, server actions) reads the session
   and calls the API with an `Authorization: Bearer <token>` header.
3. `apps/api` applies `AdminSessionGuard` to every non-public controller, in this exact
   order:
   1. Extract the bearer token. Absent or malformed ⇒ `UNAUTHENTICATED`.
   2. `jwtVerify` with the pinned algorithm, expected `iss` and `aud`, and the shared
      secret. Failure ⇒ `UNAUTHENTICATED`.
   3. Load `AdminUser` by the token's `gh_id`. Missing, inactive, or not matching the
      claim ⇒ `FORBIDDEN`.
   4. Load `AdminSession` by `sid`. Revoked, expired, or belonging to another user ⇒
      `UNAUTHENTICATED`.
   5. Compare `AdminUser.tokenVersion` with the token's `tv`. Mismatch ⇒
      `UNAUTHENTICATED` (this is how mass revocation works).
   6. Attach the freshly loaded user to the request. The guard, not the handler,
      reads the role.
4. **Why the database is consulted on every request:** role changes and allowlist
   revocations take effect immediately, instead of waiting for a token to expire. A
   purely stateless check would accept a token for up to 15 minutes after revocation.
5. **Why the token is not forwarded to the browser:** a browser-side token would be
   reachable by injected script and by any XSS. Keeping it server-to-server removes an
   entire class of session theft.
6. Public routes are opted in explicitly (`@Public()`). There is no "forgot the guard"
   failure mode, because a route that forgets the decorator fails closed.
7. Logout deletes the `AdminSession` record and rotates `AUTH_SECRET` if the session
   was suspected stolen. `sid` is written to `AuditLog` for sign-in, sign-out, and every
   subsequent write.

**Known limitation, accepted and documented:** `AdminSession` lookups add one database
round trip per admin request. This is acceptable for a single-administrator portfolio
and is the deliberate cost of immediate revocation.

**Resolved dependency:** the domains are fixed — `admin.me.palnadu.dev` for the admin
application and `api.me.palnadu.dev` for the API, with no existing DNS record on either
(`DEPLOYMENT_MAP.md` §7.1). The production cookie scope is host-only on
`admin.me.palnadu.dev` and the OAuth callback is
`https://admin.me.palnadu.dev/api/auth/callback/github`. Implementation of §4 may begin
once the GitHub OAuth app exists; until then this control remains `SPECIFIED`.

## 5. Public surface hardening

| Control            | Implementation                                                                                                                                                                                                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Security headers   | CSP (`default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, no `unsafe-eval` in production), `Strict-Transport-Security` (max-age ≥ 31536000, includeSubDomains), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` denying camera, microphone, geolocation |
| CORS               | Explicit origin allowlist per environment; `credentials: false`; `Access-Control-Max-Age: 600`                                                                                                                                                                                                                                                         |
| Rate limiting      | `@nestjs/throttler` — public reads 120/min per IP, contact submission 5/hour per IP, admin writes 300/min per user                                                                                                                                                                                                                                     |
| Rate-limit storage | In-memory per API instance. **Limitation:** limits are per instance, so horizontal scaling weakens them. The API is therefore pinned to a single instance with this documented rationale; moving to a shared store requires an ADR                                                                                                                     |
| Body limits        | JSON body capped at 256KB (`BODY_LIMIT_BYTES`, set explicitly rather than inherited from Express's 100KB default); Markdown fields capped by schema length. Rejection is `PAYLOAD_TOO_LARGE`/413                                                                                                                                                       |
| Input              | Every write validated by a contracts schema; unknown keys rejected; no dynamic `Object.assign` onto persisted documents                                                                                                                                                                                                                                |
| Rendering          | React escaping only; Markdown → sanitised HTML on the API; no raw HTML injection                                                                                                                                                                                                                                                                       |
| Files              | No public upload path in the public app; admin media uploads are stored outside the document root, validated by MIME and size, and served with `Content-Disposition` and a fixed content type                                                                                                                                                          |
| Draft isolation    | Draft filtering in the API query builder; unauthenticated draft access returns 404, never 403 (403 would confirm existence)                                                                                                                                                                                                                            |
| Error responses    | Contract error envelope only; no stack traces, driver messages, or collection names                                                                                                                                                                                                                                                                    |

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

| Class                                                     | Storage                                                             | Never                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `AUTH_SECRET` | Vercel and Render environment stores; GitHub Actions secrets for CI | In any file, including `.env.example` values, fixtures, and docs |
| `DATABASE_URL` (Atlas URI)                                | Render and Vercel environment stores                                | Committed; the URI embeds credentials                            |
| OAuth callback and CORS URLs                              | Environment values                                                  | Hardcoded in source                                              |
| Third-party tokens (analytics, email)                     | Provider stores                                                     | Committed                                                        |

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

**Proven by `pnpm db:integration` (67 passing: 33 authorization, 18 cross-origin and
headers, 16 persistence).** The §4.4 API authorization boundary runs on every
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

- GitHub OAuth sign-in, callback handling, and session issuance (§4.1–4.3). The tests
  mint tokens directly with `jose`; nothing here proves a real sign-in flow works.
- CSRF protection on the session cookie, and cookie issuance itself.
- Security headers, CORS, and rate limiting (§5).
- Role-based _denial_. Every Experience write route admits both `owner` and `editor`,
  so no route exists on which the two roles differ. The forged-claim test proves the
  role is read from the database; it cannot yet prove that a lower role is refused an
  owner-only operation. This closes as soon as an owner-only operation is defined.

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

- Rate limiting. `@nestjs/throttler` is not a dependency. Separate workstream: it needs
  a dependency rationale in an ADR, a Nest 12 compatibility check, and tests that
  observe actual throttling.
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

**Unchanged from Phase 6B:** GitHub OAuth sign-in, callback handling, session issuance,
and CSRF remain unproven and unimplemented. The tests mint tokens with `jose` directly.
CSRF remains inapplicable only while authentication is bearer-only; it must be reassessed
when cookie-based authentication is introduced.

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

**Still outstanding:** rate limiting; OAuth sign-in and session issuance; CSRF
reassessment once cookie authentication arrives; and the owner-only role-denial gap from
Phase 6B.
