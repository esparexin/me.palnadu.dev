# DEPLOYMENT_MAP.md

Environments, domains, configuration keys, and secrets for `me.palnadu.dev`. Every
value here is a **key name or a placeholder**. No secret value is recorded in this
repository (`SECURITY.md` §7).

**Status: `SPECIFIED`.** No environment has been provisioned. Nothing in this document
has been verified against a provider. Section 7 lists the decisions that block
provisioning.

## 1. Topology

| Component    | Platform       | Public address         | Notes                                                                                   |
| ------------ | -------------- | ---------------------- | --------------------------------------------------------------------------------------- |
| `apps/web`   | Vercel         | `me.palnadu.dev`       | Public portfolio, CDN edge, static + ISR                                                |
| `apps/admin` | Vercel         | `admin.me.palnadu.dev` | Separate Vercel project; authorization enforced by the API, not by the URL              |
| `apps/api`   | Render         | `api.me.palnadu.dev`   | Single instance by documented design (`SECURITY.md` §5), private network where possible |
| Database     | MongoDB Atlas  | `*.mongodb.net`        | Separate clusters per environment                                                       |
| CI/CD        | GitHub Actions | —                      | Verification, then controlled release                                                   |

`apps/web` and `apps/admin` are separate Vercel projects so that an admin build can
have its own protection, its own environment scope, and its own access review without
touching the public surface.

## 2. Environments

| Environment  | Purpose                        | Data                                                 | Who may trigger            | Protection                               |
| ------------ | ------------------------------ | ---------------------------------------------------- | -------------------------- | ---------------------------------------- |
| `local`      | Development                    | Local container or Atlas development cluster         | Anyone with the repo       | None                                     |
| `preview`    | Per-pull-request verification  | Ephemeral, seeded                                    | Automated on PR            | None; never production credentials       |
| `staging`    | Release candidate verification | Atlas staging cluster with non-personal seed content | Owner, from CI             | Owner approval on the GitHub environment |
| `production` | Live site                      | Atlas production cluster                             | Owner, from CI after merge | Owner approval, required status checks   |

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

| Key                    | Public | Purpose                                                 |
| ---------------------- | ------ | ------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`  | Yes    | API base URL for browser requests; public by definition |
| `NEXT_PUBLIC_SITE_URL` | Yes    | Canonical origin, used for metadata, sitemap, JSON-LD   |
| `NEXT_PUBLIC_GA_ID`    | Yes    | Analytics identifier; empty means analytics disabled    |

### `apps/admin`

| Key                          | Public | Purpose                                                        |
| ---------------------------- | ------ | -------------------------------------------------------------- |
| `AUTH_SECRET`                | No     | Session signing key, ≥ 32 bytes; identical to the API's value  |
| `AUTH_GITHUB_ID`             | No     | GitHub OAuth client id                                         |
| `AUTH_GITHUB_SECRET`         | No     | GitHub OAuth client secret                                     |
| `AUTH_TRUST_HOST`            | No     | `true` only behind a trusted proxy                             |
| `ADMIN_API_URL`              | No     | Server-side API base URL for route handlers and server actions |
| `ADMIN_ALLOWED_ORIGINS`      | No     | Comma-separated CORS allowlist for the admin origin            |
| `NEXT_PUBLIC_ADMIN_SITE_URL` | Yes    | Canonical admin origin, used for the OAuth callback display    |

### `apps/api`

| Key               | Public | Purpose                                                 |
| ----------------- | ------ | ------------------------------------------------------- |
| `NODE_ENV`        | No     | `production` in production; gates error detail          |
| `PORT`            | No     | Bind port                                               |
| `DATABASE_URL`    | No     | Atlas connection string with credentials                |
| `AUTH_SECRET`     | No     | Same value as the admin's; used to verify bearer tokens |
| `AUTH_ISSUER`     | No     | Expected JWT issuer                                     |
| `AUTH_AUDIENCE`   | No     | Expected JWT audience                                   |
| `ALLOWED_ORIGINS` | No     | Comma-separated exact origins permitted by CORS         |
| `RATE_LIMIT_MAX`  | No     | Default ceiling for the throttler                       |
| `TRUST_PROXY`     | No     | Set only when running behind a known proxy              |
| `LOG_LEVEL`       | No     | `info` in production, never `debug`                     |

### CI/CD (GitHub Actions)

`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_WEB`, `VERCEL_PROJECT_ID_ADMIN`,
`RENDER_API_KEY`, `ATLAS_PRODUCTION_URI`, `ATLAS_STAGING_URI`, plus the same runtime
secrets needed to build and smoke-test. All are GitHub **environment** secrets, never
repository secrets, so that a pull-request-triggered job cannot read production values.

## 4. CORS policy

| Environment  | Allowed origins                                                          |
| ------------ | ------------------------------------------------------------------------ |
| `local`      | `http://localhost:3000`, `http://localhost:3001`                         |
| `preview`    | The exact preview origin issued by Vercel, injected at build time        |
| `staging`    | The staging web origin and `https://admin-staging.me.palnadu.dev`, exact |
| `production` | `https://me.palnadu.dev` and `https://admin.me.palnadu.dev`, exact       |

Rules: exact-match strings, never a wildcard; `credentials: false` because the API does
not authenticate by cookie (§ `SECURITY.md` §4.4); `Access-Control-Max-Age: 600`;
methods restricted to `GET, POST, PATCH, DELETE, OPTIONS`. A preflight from an
unlisted origin receives no CORS headers and is rejected by the client — and the API
must also reject the actual request, since CORS is a browser control and not an
authorization mechanism.

## 5. OAuth configuration

One GitHub OAuth app per environment, so a staging compromise cannot reach production.

| Environment  | Callback URL                                                    |
| ------------ | --------------------------------------------------------------- |
| `local`      | `http://localhost:3001/api/auth/callback/github`                |
| `staging`    | `https://admin-staging.me.palnadu.dev/api/auth/callback/github` |
| `production` | `https://admin.me.palnadu.dev/api/auth/callback/github`         |

The OAuth app authorises exactly the `read:user` scope; no repository, organisation, or
email scope is requested. The allowlist in `SECURITY.md` §4.1 is what actually grants
administration — the OAuth app alone grants nothing.

## 6. Health checks and data safety

| Check             | Path or method                                                       | Expectation                                                              |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Liveness          | `GET /health/live`                                                   | `200` while the process is up; touches no database                       |
| Readiness         | `GET /health/ready`                                                  | `200` only when the database is reachable; Render routes traffic on this |
| Post-deploy smoke | `GET /` and `GET /health/ready` on the production API and web origin | Content present, no draft leakage                                        |

Data safety: Atlas continuous backup with a 30-day retention on production, point-in-time
restore enabled, and a quarterly restore drill recorded in `RUNBOOK.md` §7.

Schema changes use `prisma db push` as an explicit, owner-approved release step. This
is **not** a migration workflow:

- `prisma migrate` does not exist for the MongoDB connector (`ADR-0006`), so there is
  no migration history and no per-change rollback.
- `db push` is never run against production from an ordinary CI workflow or a
  developer machine. It runs only from an owner-approved release, against staging
  first.
- A verified backup or point-in-time snapshot, plus a written recovery procedure, is a
  precondition for a production schema change.
- Where practical, changes follow expand-and-contract so that the previous and the new
  application version can both run against the intermediate schema.
- **Rolling back the application does not roll back the database.** Data recovery is
  forward repair or a restore from a snapshot.

## 7. Decision log

### 7.1 Resolved

| #   | Decision                  | Value                                                                        | Verified                                          | Resolved   |
| --- | ------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------- | ---------- |
| 1   | Production admin domain   | `admin.me.palnadu.dev`                                                       | DNS: no existing A or CNAME record; free to claim | 2026-10-18 |
| 2   | API subdomain             | `api.me.palnadu.dev`                                                         | DNS: no existing A or CNAME record; free to claim | 2026-10-18 |
| 3   | Admin origin reachability | Publicly reachable, protected by the API allowlist; the URL is not a control | `SECURITY.md` §2 assumption 2 and §4.1            | 2026-10-18 |

DNS verification performed on 2026-10-18:

```
$ dig +short NS palnadu.dev
dns1.registrar-servers.com.
dns2.registrar-servers.com.
$ dig +short A palnadu.dev
216.198.79.1                    # registrar parking; apex not in use
$ for h in me admin.me api.me.palnadu.dev -> dig +short A|CNAME $h
                                # no records exist for any of the three
```

Interpretation and its limits. The apex domain is registered and delegated to
registrar-hosted nameservers, and none of the three subdomains currently holds a DNS
record, so none of them is in use and none will conflict with a future CNAME. What this
does **not** prove: that the repository owner controls the DNS account, that the
registrar permits adding these records, or that Vercel and Render will accept them.
Those are verified when the records are created and the deployments are provisioned, and
recorded here at that time. Until then the entries above are `SPECIFIED`, not `ENFORCED`.

Derived values fixed by these decisions:

| Value                                 | Value                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Production cookie scope               | host-only on `admin.me.palnadu.dev`                                                               |
| Production API origin allowed by CORS | `https://api.me.palnadu.dev` is the target; the two allowed _origins_ are the web and admin sites |
| Production OAuth callback             | `https://admin.me.palnadu.dev/api/auth/callback/github`                                           |

### 7.2 Still open (blocking provisioning of those specific items)

| #   | Decision                        | Recommended default                                          | Consequence if left open                            |
| --- | ------------------------------- | ------------------------------------------------------------ | --------------------------------------------------- |
| 4   | Render region and Atlas region  | Same region, nearest the audience                            | Latency and, for Atlas, data-residency              |
| 5   | Staging necessity and retention | Keep staging; delete its cluster when not in use for 30 days | `CI_GATES.md` area 13 has nothing to verify against |
| 6   | DNS account ownership and MFA   | Single owner account, MFA required, change log kept here     | Incident response and rollback timing               |
| 7   | Production deploy approval      | Owner approval on the `production` GitHub environment        | Whether release is automatic after merge or manual  |

`SECURITY.md` §4.4 implementation is no longer blocked by items 1 and 2. It remains
blocked by item 7 for deployment and by the absence of a provisioned GitHub OAuth app.

## 8. Ownership

| Area                                        | Owner                                  |
| ------------------------------------------- | -------------------------------------- |
| Vercel projects and domains                 | Repository owner                       |
| Render service                              | Repository owner                       |
| Atlas clusters, users, network access lists | Repository owner                       |
| DNS                                         | Repository owner                       |
| GitHub environments, secrets, rulesets      | Repository owner                       |
| Content publishing                          | Repository owner, through `apps/admin` |

There is a single credential holder today. Adding a second operator is an ADR: it must
define who holds provider access, who approves production releases, and who is
responsible for quarterly access review.
