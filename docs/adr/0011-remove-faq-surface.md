# ADR-0011 — Remove the FAQ surface

- **Status:** Accepted
- **Date:** 2026-10-19
- **Decision owner:** Repository owner
- **Related:** `ADR-0010` (Knowledge Hub CMS, FAQ, media library), `ADR-0002` (MongoDB as content store), `ADR-0006` (Prisma pin and schema management)
- **Phase:** Post-audit remediation

## Context

`ADR-0010` introduced a public FAQ page, an admin authoring surface, an API module,
and a `Faq` Prisma collection. The public FAQ route was later removed, but the admin
route, API module, contracts, overview counter, cache tag, and tests remained. The
result was an administration screen for content that had no public destination.

The repository owner reviewed the audit findings and decided that the FAQ feature
should be removed entirely rather than restored. No production environment has been
provisioned, and there is no approved FAQ content to preserve.

## Decision

1. Delete the public and administrative FAQ routes, the admin form and actions, the
   NestJS FAQ module, and the FAQ contracts (types, schemas, categories, route
   constants, and cache tag).
2. Remove the `Faq` model from `apps/api/prisma/schema.prisma` and
   `apps/api/prisma/baseline.prisma` in the same change.
3. Do **not** issue a MongoDB collection drop. Prisma does not drop a collection when
   a model is removed from the schema. Any pre-existing documents remain in place,
   and an export can be taken before deployment if an environment is found to contain
   data.
4. Retain the `faq_*` audit actions and the `faq` audit entity type. The audit log is
   append-only: rows written before this decision must remain readable, and removing
   vocabulary would make historical records unparseable without rewriting them.
5. Remove FAQ assertions from integration and end-to-end tests, and record the
   removal in `ARCHITECTURE.md`, `TESTING.md`, `RUNBOOK.md`, and `README.md`.

## Consequences

- The admin navigation no longer advertises a feature that cannot reach the public
  site, and the API no longer exposes routes for it.
- The contracts package is smaller, but this is a breaking public-surface change for
  any external consumer. There are none in this repository, and the removal is
  recorded here.
- Historical FAQ audit rows remain readable, but the records themselves are no longer
  reachable through the application. Recovering the content requires restoring the
  model or exporting the collection directly.
- The schema baseline and schema change together, so `scripts/check-schema.mjs` sees
  no destructive drift. The collection is nevertheless retained deliberately.

## Alternatives considered

- **Restore the public FAQ page.** Rejected by the owner: the feature is not wanted,
  and restoring it would preserve an unmaintained surface.
- **Keep the database model without an application surface.** Rejected as the default:
  it leaves generated client methods and an implied capability with no owner. The
  collection is retained physically, which is the only part needed for recovery.
- **Delete historical audit enum values.** Rejected: it would corrupt the meaning of
  an append-only audit trail.
