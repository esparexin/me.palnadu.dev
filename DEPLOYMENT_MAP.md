# DEPLOYMENT_MAP.md

Environments, domains, configuration keys, and secrets for `me.palnadu.dev`. Every
value here is a **key name or a placeholder**. No secret value is recorded in this
repository (`SECURITY.md` §7).

**Status: `SPECIFIED`.** No environment has been provisioned. Nothing in this document
has been verified against a provider. Section 7 lists the decisions that block
provisioning.

## 1. Topology

| Component | Platform | Public address | Notes |
| --- | --- | --- | --- |
| `apps/web` | Vercel | `me.palnadu.dev` | Public portfolio, CDN edge, static + ISR |
| `apps/admin` | Vercel | **unresolved** (§7) | Separate Vercel project; authorization enforced by the API, not by the URL |
| `apps/api` | Render | **unresolved** (§7) | Single instance by documented design (`SECURITY.md` §5), private network where possible |
| Database | MongoDB Atlas | `*.mongodb.net` | Separate clusters per environment |
| CI/CD | GitHub Actions | — | Verification, then controlled release |

`apps/web` and `apps/admin` are separate Vercel projects so that an admin build can
have its own protection, its own environment scope, and its own access review without
touching the public surface.

## 2. Environments

| Environment | Purpose | Data | Who may trigger | Protection |
| --- | --- | --- | --- | --- |
| `local` | Development | Local container or Atlas development cluster | Anyone with the repo | None |
| `preview` | Per-pull-request verification | Ephemeral, seeded | Automated on PR | None; never production credentials |
| `staging` | Release candidate verification | Atlas staging cluster with non-personal seed content | Owner, from CI | Owner approval on the GitHub environment |
| `production` | Live site | Atlas production cluster | Owner, from CI after merge | Owner approval, required status checks |

Rules:

1. Data never crosses environments. Staging uses synthetic content with no real
   personal data and no production contact submissions.
2. Production is reachable only through promotion of an artefact built in CI, never a
   local build (`CI_GATES.md` area 13).
3. Preview and staging never receive production secrets.
4. Every environment is listed here with its own variable scope. A key added to one
   environment and not documented here is a defect.

## 3. Configuration keys

No values. `description` only.

### `apps/web`

| Key | Public | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Yes | API base URL for browser requests; public by definition |
| `NEXT_PUBLIC_SITE_URL` | Yes | Canonical origin, used for metadata, sitemap, JSON-LD |
| `NEXT_PUBLIC_GA_ID` | Yes | Analytics identifier; empty means analytics disabled |

### `apps/admin`

| Key | Public | Purpose |
| --- | --- | --- |
| `AUTH_SECRET` | No | Session signing key, ≥ 32 bytes; identical to the API's value |
| `AUTH_GITHUB_ID` | No | GitHub OAuth client id |
| `AUTH_GITHUB_SECRET` | No | GitHub OAuth client secret |
| `AUTH_TRUST_HOST` | No | `true` only behind a trusted proxy |
| `ADMIN_API_URL` | No | Server-side API base URL for route handlers and server actions |
| `ADMIN_ALLOWED_ORIGINS` | No | Comma-separated CORS allowlist for the admin origin |
| `NEXT_PUBLIC_ADMIN_SITE_URL` | Yes | Canonical admin origin, used for the OAuth callback display |

### `apps/api`

| Key | Public | Purpose |
| --- | --- | --- |
| `NODE_ENV` | No | `production` in production; gates error detail |
| `PORT` | No | Bind port |
| `DATABASE_URL` | No | Atlas connection string with credentials |
| `AUTH_SECRET` | No | Same value as the admin's; used to verify bearer tokens |
| `AUTH_ISSUER` | No | Expected JWT issuer |
| `AUTH_AUDIENCE` | No | Expected JWT audience |
| `ALLOWED_ORIGINS` | No | Comma-separated exact origins permitted by CORS |
| `RATE_LIMIT_MAX` | No | Default ceiling for the throttler |
| `TRUST_PROXY` | No | Set only when running behind a known proxy |
| `LOG_LEVEL` | No | `info` in production, never `debug` |

### CI/CD (GitHub Actions)

`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_WEB`, `VERCEL_PROJECT_ID_ADMIN`,
`RENDER_API_KEY`, `ATLAS_PRODUCTION_URI`, `ATLAS_STAGING_URI`, plus the same runtime
secrets needed to build and smoke-test. All are GitHub **environment** secrets, never
repository secrets, so that a pull-request-triggered job cannot read production values.

## 4. CORS policy

| Environment | Allowed origins |
| --- | --- |
| `local` | `http://localhost:3000`, `http://localhost:3001` |
| `preview` | The exact preview origin issued by Vercel, injected at build time |
| `staging` | The staging web origin and the staging admin origin, exact |
| `production` | `https://me.palnadu.dev` and the production admin origin, exact |

Rules: exact-match strings, never a wildcard; `credentials: false` because the API does
not authenticate by cookie (§ `SECURITY.md` §4.4); `Access-Control-Max-Age: 600`;
methods restricted to `GET, POST, PATCH, DELETE, OPTIONS`. A preflight from an
unlisted origin receives no CORS headers and is rejected by the client — and the API
must also reject the actual request, since CORS is a browser control and not an
authorization mechanism.

## 5. OAuth configuration

One GitHub OAuth app per environment, so a staging compromise cannot reach production.

| Environment | Callback URL |
| --- | --- |
| `local` | `http://localhost:3001/api/auth/callback/github` |
| `staging` | `https://<ADMIN_STAGING_DOMAIN>/api/auth/callback/github` |
| `production` | `https://<ADMIN_DOMAIN>/api/auth/callback/github` |

The OAuth app authorises exactly the `read:user` scope; no repository, organisation, or
email scope is requested. The allowlist in `SECURITY.md` §4.1 is what actually grants
administration — the OAuth app alone grants nothing.

## 6. Health checks and data safety

| Check | Path or method | Expectation |
| --- | --- | --- |
| Liveness | `GET /health/live` | `200` while the process is up; touches no database |
| Readiness | `GET /health/ready` | `200` only when the database is reachable; Render routes traffic on this |
| Post-deploy smoke | `GET /` and `GET /health/ready` on the production API and web origin | Content present, no draft leakage |

Data safety: Atlas continuous backup with a 30-day retention on production, point-in-time
restore enabled, and a quarterly restore drill recorded in `RUNBOOK.md` §7. Schema
changes are Prisma migrations applied as an explicit release step, never automatically
on application start; every migration must be backwards-compatible with the previous
application version so that a rollback does not require a data rollback.

## 7. Unresolved decisions (blocking provisioning)

| # | Decision | Recommended default | Consequence if left open |
| --- | --- | --- | --- |
| 1 | Production admin domain | A separate Vercel project on a dedicated subdomain, with access additionally gated by the API allowlist | The OAuth callback URL, CORS allowlist, and cookie scope cannot be configured |
| 2 | API subdomain | `api.<domain>` with TLS and Render's managed certificate | The client base URL, CORS allowlist, and smoke tests cannot be written |
| 3 | Whether the admin origin is publicly reachable | Keep it reachable but allowlist-protected; if obscurity is desired, add an identity-aware proxy — never rely on the URL for security | Affects `SECURITY.md` §4 and the threat model |
| 4 | Render region and Atlas region | Same region, nearest the audience | Latency and, for Atlas, data-residency |
| 5 | Staging necessity and retention | Keep staging; delete its cluster when not in use for 30 days | `CI_GATES.md` area 13 has nothing to verify against |
| 6 | DNS ownership | Single owner account, MFA required, change log kept here | Incident response and rollback timing |
| 7 | Production deploy approval | Owner approval on the `production` GitHub environment | Whether release is automatic after merge or manual |

Until items 1 and 2 are decided, `SECURITY.md` §4.4 implementation and any deployment
workflow remain blocked, as required by that document.

## 8. Ownership

| Area | Owner |
| --- | --- |
| Vercel projects and domains | Repository owner |
| Render service | Repository owner |
| Atlas clusters, users, network access lists | Repository owner |
| DNS | Repository owner |
| GitHub environments, secrets, rulesets | Repository owner |
| Content publishing | Repository owner, through `apps/admin` |

There is a single credential holder today. Adding a second operator is an ADR: it must
define who holds provider access, who approves production releases, and who is
responsible for quarterly access review.