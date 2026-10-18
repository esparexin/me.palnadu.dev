# ADR-0004 — Deployment topology: Vercel, Render, Atlas

- **Status:** Accepted
- **Date:** 2026-10-18
- **Decision owner:** Repository owner

## Context

Three deployables must run, with a public site that is fast and cacheable, an
administration interface that is isolated, and an API that holds the only database
credential. Releases must be reproducible, rollback must be fast, and environments must
be separated so that a preview build can never read production data or secrets.

## Decision

| Component | Platform | Environment variables |
| --- | --- | --- |
| `apps/web` | Vercel | `NEXT_PUBLIC_*` only, no secrets |
| `apps/admin` | Vercel, **separate project** | OAuth credentials, `AUTH_SECRET`, server-side API URL |
| `apps/api` | Render, **single instance** | `DATABASE_URL`, `AUTH_SECRET`, CORS allowlist |
| Database | MongoDB Atlas, separate clusters per environment | Credentials per environment |
| Orchestration | GitHub Actions, build once and promote | Provider tokens as environment secrets |

Supporting decisions:

- **The API is pinned to a single instance.** Rate limiting is in-memory per instance
  (`SECURITY.md` §5); horizontal scaling would silently weaken it. A shared store is
  out of scope until an ADR justifies it.
- **Build once, promote the artefact.** No rebuild at deploy time, so production runs
  exactly what CI verified.
- **Environment separation is enforced by GitHub environments.** Production secrets are
  environment-scoped, so a pull-request job cannot read them.
- **Domains.** `me.palnadu.dev` for the public site; the admin and API domains are
  recorded in `DEPLOYMENT_MAP.md` §7 as unresolved and must be fixed before the release
  workflow is written.

## Consequences

**Positive**

- No server to operate; platform-managed TLS, previews, and rollbacks for the frontends.
- Preview deployments per pull request give reviewers a real URL for manual verification.
- Atlas provides managed backups, point-in-time restore, and network access lists
  without additional infrastructure.
- Render's deploy history plus Vercel's instant redeploy satisfy the rollback
  requirement in `RUNBOOK.md` §3.

**Negative**

- Three providers means three credential sets, three access reviews, and three potential
  failure modes during an incident.
- A single-instance API caps throughput and removes in-process redundancy; a restart is
  a brief outage.
- Cold starts on Render affect API latency after idle periods. Readiness-based routing
  and warm health checks mitigate this; if it proves material, moving to a persistent
  instance type is a configuration change, not an architecture change.
- Provider-specific configuration is not reproducible in the repository, so
  `DEPLOYMENT_MAP.md` must stay accurate or it becomes fiction.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| All three apps on Vercel | The API becomes serverless or a hosted container, which removes the single-instance predictability that the rate-limit decision relies on |
| All apps on Render behind a proxy | Fewer providers, but forfeits Vercel's edge caching for the public site |
| Container images on a single VPS | Full control, but introduces host patching, TLS renewal, backup scheduling, and a second on-call surface for one-person operation |
| Self-hosted MongoDB | Rejected: backups, upgrades, and failover would become the project's primary operational burden |

## References

`DEPLOYMENT_MAP.md`, `RUNBOOK.md` §1–§3, `SECURITY.md` §5 and §8, `CI_GATES.md` area 13.