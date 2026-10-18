# SSOT_POLICY.md

Single Source of Truth policy. Every rule here is checkable by gate 10 (boundaries)
and gate 8 (dead code / duplication) in `CI_GATES.md`.

## 1. Precedence

When two sources appear to disagree about a shared concept, the higher entry wins and
the lower one is a defect.

| Rank | Concern | Single source of truth |
| --- | --- | --- |
| 1 | Domain types, enums, validation schemas, error codes, pagination, API paths | `packages/contracts` |
| 2 | Visual values: color, type scale, spacing, radius, shadow, motion, breakpoints | `packages/design-tokens` |
| 3 | Calculations and comparators: tenure, reading time, ordering, slug, date ranges | `packages/shared` |
| 4 | Persistence shape | `apps/api/prisma/schema.prisma` |
| 5 | Authored content | MongoDB, via the admin application |
| 6 | Seed and reference content | `content/` (never read at runtime) |
| 7 | Presentation | `apps/web`, `apps/admin` (must consume 1–3) |

Two sources of the same concept at the same rank is duplication, not redundancy.

## 2. What must never be duplicated

| Category | Canonical form | Forbidden duplicate |
| --- | --- | --- |
| Domain type | Zod schema → inferred type in contracts | A local `interface` or `type` for the same entity |
| Enum / string union | `ArticleStatus`, `ExperienceKind`, `ProjectStatus`, `Role`, `ArticleKind` | Literal unions, string arrays, or `Record<string, string>` maps elsewhere |
| Validation rule | Zod schema in contracts | Hand-rolled `if` chains in a handler, controller, or form |
| API contract | Route constants, request/response schemas, error envelope in contracts | Response interfaces in `web` or `admin` |
| Error code | Contract error-code map → `ApiError` in `api` | Inline strings, HTTP 200 with a `"error"` field |
| Calculation | Exported function in `shared` | The same arithmetic in `web`, `admin`, and `api` |
| Comparator | `compareExperience`, `comparePublishedDesc` | Inline `.sort()` with inline logic |
| Design value | Token in `design-tokens` | A hex, `px`, `rem`, or shadow literal in any file |
| Component | Primitive in `packages/ui` | A second button, input, dialog, or field in an app |

## 3. Contracts rules

1. **Zod is the primary schema language.** Types are `z.infer<typeof X>`; hand-written
   interfaces are only permitted for props of purely presentational components that
   have no counterpart in the domain.
2. **Derive, never repeat.** `CreateExperienceInput = z.infer<typeof ExperienceCreateSchema>`;
   never restate the field list.
3. **Schemas are composable.** A patch schema is `Base.partial()`, an update is
   `Base.extend(...)`. Do not copy a base schema to change one field.
4. **Enums are const objects plus a schema**, generated once:
   ```ts
   export const ARTICLE_STATUSES = ['draft', 'published', 'archived'] as const;
   export const ArticleStatusSchema = z.enum(ARTICLE_STATUSES);
   export type ArticleStatus = z.infer<typeof ArticleStatusSchema>;
   ```
5. **Cross-field rules belong in the schema** (`superRefine`), not in the handler:
   `endDate` after `startDate`, `current` implying no `endDate`, required links when a
   project claims an external link.
6. **Schemas must be shared by all three consumers** — the API pipe, admin form types,
   and any seed-file validation — so one edit propagates everywhere.

### Changing the public surface

Adding an optional field is a minor change. Removing or renaming a field, changing a
type, tightening a schema, or adding a new enum member is a **breaking** change and
requires:

1. an ADR (`GOVERNANCE.md` §4),
2. the consuming apps updated in the **same** pull request,
3. a migration note if persisted data changes.

Because `web` and `admin` consume contracts directly, a breaking change cannot be
delivered ahead of its consumers.

## 4. Validation layers

| Layer | Responsibility | Trust |
| --- | --- | --- |
| Contracts (Zod) | The rule itself, defined once | Canonical |
| `apps/api` validation pipe | Enforce the rule at the boundary | **Authoritative** |
| `apps/admin` form validation | Immediate feedback while typing | UX affordance only |
| `apps/web` input hints | Avoid a pointless round trip | Never a security control |

The API re-validates every write even when the client already validated. Client
validation exists to reduce failed round trips, not to establish correctness.

## 5. Derived data

A stored field must be independent of every other stored field.

- **Do store:** `startDate`, `endDate`, `current`, `sortIndex`, `slug`, `publishedAt`.
- **Do not store:** tenure text, reading time, "years of experience", article counts,
  a denormalised status label, or a cached response body.
- Derive with `packages/shared` at render or read time, and cache only in memory with
  an explicit TTL if measurement proves it necessary.

If a value must be denormalised for performance, that is an ADR plus a test that
fails when the source field changes without the derived field being rebuilt.

## 6. Ownership of a concept

Every shared concept has exactly one owning path. When implementing:

- a new entity field starts in contracts, then reaches Prisma, then the UI;
- a new calculation starts in `shared` with a unit test, then is called, never copied;
- a new token starts in `design-tokens`, then is exposed through the Tailwind preset;
- a new route string starts in contracts, so client and server cannot drift.

## 7. Detection

| Violation | Detected by |
| --- | --- |
| Cross-app or wrong-direction import | Gate 10 boundary tests |
| Import cycle | Gate 10 cycle detection |
| Second definition of an enum or status | Gate 10 lint rule plus reviewer checklist |
| Inline sort/filter duplicating a comparator | Gate 8 duplication scan plus review |
| Token literal in app code | Gate 1 `no-restricted-syntax` rules |
| Unused file, export, or dependency | Gate 8 (Knip) |
| Copy-pasted blocks | Gate 8 (jscpd) |
| Stale seed content | Import command diffs `content/` against the database and reports, without mutating |

Findings are triaged before deletion: framework conventions, dynamic imports, route
files, and generated assets legitimately appear unused. Confirm, then delete, then
document — never delete on a single automated finding (`SSOT_POLICY.md` exception
process in `GOVERNANCE.md` §5).

## 8. Resolving pre-existing duplication

When duplication is found in code that predates this policy:

1. Identify the canonical definition using the precedence table in §1.
2. Delete or redirect the duplicate in the same pull request that adopts the
   canonical one. A de-duplication PR that leaves both definitions fails review.
3. If the duplicate cannot yet be removed, record it in `docs/exceptions.md` with an
   expiry review date, and reference it from the duplicate's file header.

## 9. Content integrity as an SSOT concern

Professional claims are not invented. Content that has not been verified by the owner
is `draft` and stays `draft`. This is a data rule with a testable consequence:
`apps/web` requests only published content, and the API refuses to return drafts
without an authenticated, authorized session. See `AGENTS.md` §4.