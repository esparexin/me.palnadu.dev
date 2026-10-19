# ADR-0006 — Prisma pin, MongoDB schema management, and canonical enum ownership

- **Status:** Accepted
- **Date:** 2026-10-19
- **Decision owner:** Repository owner
- **Amends:** `ADR-0001` (stack) — the version and schema-management detail only
- **Phase:** 6A, persistence foundation

## Context

`ADR-0001` chose "MongoDB via Prisma" without a version and stated that schema
changes are applied as Prisma migrations. Phase 6A had to verify whether that is
possible before building on it. Two findings changed the plan.

**Finding 1 — the current Prisma line is not usable for MongoDB.** Verified against
the registry and the Prisma documentation on 2026-10-18/19:

| Fact                                                                                                                                                                  | Evidence                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `prisma@latest` resolves to `8.0.0-rc.23`                                                                                                                             | `npm view prisma dist-tags` → `latest: 8.0.0-rc.23` |
| `@prisma/client@latest` resolves to `7.10.1`                                                                                                                          | The two packages' `latest` tags disagree            |
| Prisma's MongoDB page states v7 support "is coming in the near future" and instructs: "please use Prisma ORM v6.19 (the latest v6 release) when working with MongoDB" | Prisma documentation, MongoDB connector page        |
| `6.19.3` exists, with `engines.node >= 18.18`                                                                                                                         | `npm view prisma@6.19.3 engines`                    |

Installing `latest` would have put a release candidate on the critical path and paired
it with a client from a different major.

**Finding 2 — `prisma migrate` does not exist for MongoDB.** Prisma's documentation
states there are "no plans to add support for Prisma Migrate as MongoDB projects do not
rely on internal schemas", and that unique-index management "is realized through
`db push`". `DEPLOYMENT_MAP.md` §6, `RUNBOOK.md` §1/§3, and `ARCHITECTURE.md` §6 all
promised migration-based releases with backwards-compatible migrations and a rollback
path for data. Those promises are unimplementable as written.

Connector capabilities were verified by validating schemas with the pinned CLI rather
than by reading documentation alone:

| Capability                                         | Result                | Verbatim error                                                                            |
| -------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------- |
| `enum` blocks                                      | supported             | —                                                                                         |
| `@unique`, `@@unique`, `@@index`                   | supported             | —                                                                                         |
| `Json`, `@updatedAt`, `@default(now())`, relations | supported             | —                                                                                         |
| compound `@@id`                                    | not supported         | "The current connector does not support compound ids."                                    |
| `autoincrement()`                                  | not supported         | "The `autoincrement()` default value is used with a datasource that does not support it." |
| `Decimal`                                          | not supported         | "The current connector does not support the Decimal type."                                |
| transactions                                       | require a replica set | standalone deployments fail with "Transactions are not supported by this deployment"      |

## Decision

1. **Pin `prisma` and `@prisma/client` to exactly `6.19.3`**, synchronised in every
   manifest, with no caret, no `latest`, and no prerelease. A CI check asserts both
   resolve to exactly that version.
2. **Schema changes are applied with `prisma db push`, never `prisma migrate`.** The
   word "migration" is not used for this workflow anywhere in the documentation.
3. **A destructive-change gate replaces the missing migration history.**
   `scripts/check-schema.mjs` compares `apps/api/prisma/baseline.prisma` with
   `apps/api/prisma/schema.prisma` and blocks on removed models or fields, type
   changes, newly required fields without a default, and unique-constraint changes.
   An exception requires the exact target plus a recovery plan, in
   `apps/api/prisma/schema-exceptions.json`.
4. **Enum-like fields are `String` in the persistence schema.** Allowed values live
   once in `packages/contracts`; the API boundary validates them.
5. **The Experience slice gains a unique `slug`** in the contracts, because
   persistence needs a stable unique key to make writes idempotent and to report a
   conflict instead of silently duplicating a career entry.
6. **Integration tests run against an ephemeral single-node replica set** started by
   `scripts/db/replica-set.mjs`, on a dedicated port, loopback-only, with a dedicated
   data directory and a test-only database name.

## Consequences

**Positive**

- The persistence layer is built on a release line the vendor explicitly supports for
  MongoDB, pinned so it cannot drift.
- Destructive schema edits are blocked mechanically, in CI and locally, rather than by
  reviewer vigilance.
- Integration tests exercise real transaction, unique-index, and ordering behaviour
  instead of asserting configuration.
- Enum values have exactly one definition, in contracts.

**Negative, and stated plainly**

- **No migration history.** `db push` applies the schema; there is no record of what a
  collection looked like last month other than the committed baseline file.
- **No data rollback.** Rolling back the application does not roll back the database.
  Recovery is forward repair, or a restore from an Atlas point-in-time backup. Any
  document claiming otherwise is wrong and must be corrected.
- **The schema gate is a guardrail, not a guarantee.** It cannot detect a rename that
  preserves the type, a change in value semantics, or an application incompatibility.
- **Enum values are not enforced by the database.** A write that bypasses the API can
  store a value the contracts reject. The integration suite asserts this limitation
  rather than pretending it away.
- **Tests require a local `mongod`.** The suite fails if it is unavailable; it never
  skips.

## Alternatives considered

| Alternative                 | Why not                                                                                                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma 7 or 8               | MongoDB support is not available on those lines; 8's `latest` is a release candidate                                                                                                            |
| Prisma 6.18                 | Older than the 6.19 the vendor names for MongoDB, with no offsetting benefit                                                                                                                    |
| PostgreSQL with Prisma      | Gives real migrations and transactions, but `ADR-0002` chose MongoDB for the document model and a smaller operational footprint. Revisiting that decision would reopen `ADR-0002`, not this ADR |
| Mongoose                    | Hand-written schemas and no static types; duplicates the contracts rather than consuming them                                                                                                   |
| Prisma `enum` blocks        | Supported by the connector, but would duplicate the contract enums, which `SSOT_POLICY` §1 forbids                                                                                              |
| Atlas for integration tests | Requires cloud provisioning and credentials, which Phase 6A explicitly excludes                                                                                                                 |
| `mongodb-memory-server`     | Downloads a database binary at install time, which conflicts with the install-script policy in `pnpm-workspace.yaml` and adds an opaque binary to the dependency graph                          |

## References

`ADR-0001`, `ADR-0002`, `ARCHITECTURE.md` §5–§8, `SSOT_POLICY.md` §1 and §5,
`DEPLOYMENT_MAP.md` §6, `RUNBOOK.md` §1 and §3, `scripts/check-schema.mjs`,
`scripts/db/replica-set.mjs`, `apps/api/prisma/schema.prisma`.
