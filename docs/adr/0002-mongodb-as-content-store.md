# ADR-0002 — MongoDB as the canonical content store

- **Status:** Accepted
- **Date:** 2026-10-18
- **Decision owner:** Repository owner

## Context

Content is authored through an authenticated admin application and read by the public
site: career timeline entries, projects, skills, resume records, and Knowledge Hub
articles (tutorials, KT guides, troubleshooting articles, interview questions). It must
support explicit draft and publish workflows, an audit trail, and search-friendly
reading URLs.

Two candidate shapes:

1. **File-based content** — Markdown in the repository, edited either directly or
   through an admin that commits to the repository.
2. **Database-backed content** — the admin writes structured records; the public site
   reads them.

The requirement that the admin application manages content through authenticated API
operations is decisive: an admin that edits files in a git repository is a code
deployment in disguise, it cannot be authorized per field, and it produces a commit
history that mixes editorial and engineering changes.

## Decision

MongoDB is the single source of truth for publishable content, accessed through Prisma.

- `content/` holds **approved seed content and reference material only**. It is never
  imported by application code at runtime and never acts as a second live store.
- Imports are explicit commands, idempotent, staged, audited (`AuditLog` action
  `content.import`), and never create or delete records implicitly.
- Draft and published are the same records with a status; the API filters drafts out of
  every public query, so visibility is a data-access concern rather than a UI concern.
- Collection definitions are in `ARCHITECTURE.md` §7.
- Environments use **separate** Atlas clusters; production data is never copied to
  another environment.

## Consequences

**Positive**

- The admin can publish immediately, with per-field authorization and an audit trail,
  without a code change or a deployment.
- Structured records support the timeline, filtering by article kind, ordering, and
  faceted navigation without parsing Markdown at request time.
- The public site reads one authority, which removes the class of bugs where a file and
  a record disagree.

**Negative**

- Publishing depends on the API and the database, so a database outage affects both the
  public site and the admin. Mitigated by Atlas availability and by caching published
  reads at the edge with explicit invalidation on publish.
- Editorial history lives in `AuditLog`, not in a VCS diff, so it requires an audit view
  in the admin to remain navigable.
- Prisma's MongoDB connector is in preview. **Verification required before relying on
  it:** that the features actually used — `@unique` on `slug` and `githubId`,
  compound unique constraints, indexes, and transactions across documents — behave as
  documented on the chosen Atlas deployment. If any is unsupported, the fallback is
  application-enforced uniqueness plus an index, recorded here by a new ADR rather than
  by silently working around it.

## Alternatives considered

| Alternative                                                | Why not                                                                                                                                                                                |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Markdown/MDX files edited by the admin through git commits | Every publish becomes a deployment; per-field authorization is impossible; PR history conflates editorial and engineering change                                                       |
| File content with a headless CMS service                   | Adds a vendor, an API key, and a second authority for content shape; the contracts package already provides the schema source                                                          |
| PostgreSQL with Prisma                                     | Mature connector and better transaction semantics. Rejected because no relational querying requirement exists and the operational footprint is larger than the deployment list permits |

## References

`ARCHITECTURE.md` §7 and §8, `SECURITY.md` §3, `RUNBOOK.md` §7.
