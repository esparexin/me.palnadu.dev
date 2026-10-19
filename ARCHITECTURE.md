# ARCHITECTURE.md

Application boundaries, package ownership, folder ownership, and import boundaries
for `me.palnadu.dev`. Machine-checkable rules live in `tests/architecture/` and are
executed by gate 10 (`CI_GATES.md` area 10).

## 1. Principles

1. **One direction.** Dependencies flow inward toward `packages/contracts`. Nothing
   flows back out.
2. **Contracts before code.** A shape crossing a process or package boundary is
   defined in `packages/contracts` and nowhere else.
3. **Apps integrate over HTTP.** `web`, `admin`, and `api` are separate deployables.
   They share packages, never source.
4. **The database is the content authority.** `content/` holds seeds and reference
   material only.
5. **Authorization lives in the API.** `admin` renders capability; `api` decides it.
6. **Add nothing without a requirement.** An empty package is worse than no package.

## 2. Repository layout

```
me.palnadu.dev/
├── apps/
│   ├── web/                  # Public portfolio (Next.js App Router)
│   ├── admin/                # Administration UI (Next.js App Router)
│   └── api/                  # REST API (NestJS)
├── packages/
│   ├── contracts/            # SSOT: Zod schemas, domain types, enums, error codes
│   ├── design-tokens/        # SSOT: color, type, spacing, radius, shadow, motion
│   ├── ui/                   # Accessible React primitives
│   └── shared/               # Framework-free utilities (slug, dates, comparators)
├── content/                  # Approved seed content + import/export reference
├── scripts/                  # Gate scripts (structure, boundaries, secrets, ...)
├── tests/                    # Cross-cutting suites (architecture, e2e, a11y)
│   ├── architecture/
│   └── e2e/
├── docs/
│   ├── adr/
│   └── exceptions.md
├── .github/workflows/        # The 13 verification areas
├── AGENTS.md  AI_WORKFLOW.md  ARCHITECTURE.md  SSOT_POLICY.md
├── CODING_STANDARDS.md  UI_UX_STANDARDS.md  TESTING.md  SECURITY.md
├── CI_GATES.md  DEPLOYMENT_MAP.md  RUNBOOK.md
├── package.json  pnpm-workspace.yaml  turbo.json
└── .env.example              # Keys only. Never values.
```

Deliberately absent: no `queue`, no `worker`, no second database, no shared ORM
package, no monorepo-wide `constants` dumping ground. `packages/shared` is not a
`utils` junk drawer; it holds only functions with a named owner and a unit test.

## 3. Dependency direction

```
        ┌──────────────┐
        │  contracts   │  ← leaf. imports no internal package
        └──────┬───────┘
               │  ▲
   ┌───────────┼─┴───────────┐
   │           │             │
┌──▼─────┐ ┌───▼──────┐ ┌────▼───────┐
│ shared │ │  tokens  │ │    ui      │
│        │ │          │ │ (React)    │
└────────┘ └──────────┘ └────┬───────┘
                              │  ▲          ▲
                              │  │          │
                     ┌────────┴──┴───┐  ┌───┴──────┐
                     │      web      │  │  admin   │
                     └────────┬──────┘  └─────┬────┘
                              │               │
                     HTTP     │      HTTP     │
                              ▼               ▼
                          ┌──────────────────┐
                          │       api        │
                          └────────┬─────────┘
                                   │  ▲
                                   │  │
                          ┌────────┴──┴──────┐
                          │     contracts    │  (schemas, DTOs, enums)
                          └──────────────────┘
```

Allowed import matrix. Anything not listed is forbidden.

| Importer → Imported    | contracts | design-tokens | shared   | ui  | web        | admin      | api        |
| ---------------------- | --------- | ------------- | -------- | --- | ---------- | ---------- | ---------- |
| **contracts**          | —         | no            | no       | no  | no         | no         | no         |
| **design-tokens**      | no        | —             | no       | no  | no         | no         | no         |
| **shared**             | yes       | no            | —        | no  | no         | no         | no         |
| **ui**                 | yes       | yes           | optional | —   | no         | no         | no         |
| **api**                | yes       | no            | yes      | no  | no         | no         | —          |
| **admin**              | yes       | yes           | yes      | yes | **no**     | —          | **no**     |
| **web**                | yes       | yes           | yes      | yes | —          | **no**     | **no**     |
| **scripts**            | optional  | no            | optional | no  | no         | no         | no         |
| **tests/architecture** | yes       | no            | yes      | no  | reads only | reads only | reads only |
| **tests/e2e**          | no        | no            | no       | no  | black-box  | black-box  | black-box  |

Forbidden, without exception:

- `web → admin`, `admin → web`, `web → api`, `admin → api`, `api → web`, `api → admin`
- `ui → apps/*`, `shared → apps/*`, `contracts → apps/*`, `tokens → apps/*`
- any import from `packages/*` into `apps/api/prisma` or the Prisma client
- any relative import that reaches above a workspace package boundary
  (`../../apps/web/...`) — use the package name or the `@/` alias _within_ a package

Cross-app integration is HTTP only, through the typed client in `packages/contracts`.

## 4. Package contracts

### `packages/contracts`

**Owns:** Zod schemas, domain types inferred from them, all enums and string unions
(`ExperienceKind`, `ArticleKind`, `ArticleStatus`, `ProjectStatus`, `Role`), error codes
and the API error envelope, pagination and sort shapes, API route path constants, and
the typed HTTP client factory.

**May import:** `zod`. Nothing else.
**Must not import:** any internal package, `react`, `@nestjs/*`, Prisma, Mongo, `next`,
Node-only built-ins beyond `zod`'s needs.
**Public surface:** one entry point re-exporting everything.

### `packages/design-tokens`

**Owns:** the token definitions — color, typography scale, spacing, radius, shadow,
motion durations and easings, breakpoints, z-index — emitted as TypeScript constants
for runtime consumers and CSS custom properties for the design system. Owns the
Tailwind preset consumed by both Next.js apps.

**May import:** nothing internal.
**Must not import:** React, Next, Nest.
**Rule:** a token is added here or nowhere. Apps consume the preset; they never add
theme primitives of their own.

### `packages/shared`

**Owns:** framework-free functions with a single named purpose and a unit test —
`slugify`, `computeTenure`, `computeReadingTime`, `compareExperience`, `comparePublishedDesc`,
`formatDateRange`, `clampPage`, plus small result types.

**May import:** `zod` types from contracts where needed; nothing else.
**Must not import:** React, Next, Nest, Prisma, Mongo, browser or Node globals.
**Rule:** if a utility needs a framework, it does not belong here.

### `packages/ui`

**Owns:** accessible primitives — `Button`, `IconButton`, `Input`, `Textarea`, `Select`,
`Checkbox`, `Dialog`, `Popover`, `Tabs`, `Badge`, `Card`, `SectionHeading`, `Container`,
`Prose`, `Skeleton`, `Toast` — plus the `cn` class-merge helper and shared
`data-testid` conventions.

**May import:** `contracts`, `design-tokens`, and the framework it is built for
(React). Peer-only where the app supplies the implementation.
**Must not import:** any `apps/*` package, `next/navigation`, `next/link`, or any
router-coupled behaviour. A primitive that needs the router belongs in the app.

## 5. Application boundaries

### `apps/web` — public portfolio

Responsive, SEO-first, read-only against the API. Routes:

| Route                                        | Purpose                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `/`                                          | Hero with **View Resume** and **Explore Experience** CTAs, highlights                                         |
| `/experience`                                | Career timeline — desktop horizontal, mobile swipe slider                                                     |
| `/projects` and `/projects/[slug]`           | Project index and detail                                                                                      |
| `/knowledge-hub` and `/knowledge-hub/[slug]` | Published Knowledge Hub articles by kind, title search, and pagination; Markdown rendered from the shared AST |
| `/knowledge-hub/rss.xml`                     | RSS 2.0 feed of the latest published articles                                                                 |
| `/faq`                                       | Published FAQ entries grouped by category                                                                     |
| `/knowledge`                                 | Permanent redirect (308) to `/knowledge-hub`                                                                  |
| `/resume`                                    | Structured resume rendered from resume records                                                                |
| `/contact`                                   | Contact form posting to the API                                                                               |
| `/api/revalidate`                            | `POST` on-demand cache invalidation, authenticated by `REVALIDATE_SECRET`                                     |

Requirements: metadata API on every route, `sitemap.xml`, `robots.txt`, JSON-LD for
`Person` and `CreativeWork`, no interactive element that blocks normal page scrolling.
Only `draft`-free published content is requested; the API is the filter.

### `apps/admin` — administration UI

Session-authenticated authoring for content, media, and settings. Routes:

| Route                  | Purpose                                                                          |
| ---------------------- | -------------------------------------------------------------------------------- |
| `/login`               | Administrator sign-in (email/password, ADR-0009)                                 |
| `/dashboard`           | Overview: content counts and recent audited writes                               |
| `/dashboard/knowledge` | Articles, filtered by kind and status; create/edit, explicit publish transitions |
| `/dashboard/faq`       | FAQ entries, filtered by category and status                                     |
| `/dashboard/media`     | Media library: signed direct upload, registration, listing, delete               |
| `/dashboard/audit`     | Audit trail (owner only), filterable by action and entity                        |
| `/dashboard/security`  | Sessions with revoke, and password change (which signs out every session)        |

Screens for experience, projects, skills, resume, and the message inbox do not exist:
the API has no route for them, and `ADR-0010` forbids placeholder screens that imply
capability the system does not have.

Rules: no public registration, no user-management screens, every form validated with
contracts schemas before submit **and** re-validated by the API, no raw HTML input
elements, and no assumption that a hidden control equals an authorization decision.

### `apps/api` — the only authority

Owns business logic, validation enforcement, persistence, authorization decisions,
audit logging, and the media pipeline. Structure:

```
apps/api/src/
├── main.ts, app.module.ts
├── common/            # guards, pipes, interceptors, decorators, filters
├── config/            # env schema + validation
├── prisma/            # PrismaService
└── modules/           # one folder per domain
    ├── auth/          # credential verification, sessions, revocation
    ├── experience/
    ├── knowledge/ faq/
    ├── media/         # signing and metadata only; never file bytes
    ├── audit/ overview/ revalidation/
    └── health/
```

Rules: every route is either public by explicit annotation or protected by the session
guard; the guard is applied at the controller, not per handler; validation uses a
single contracts-backed pipe; every write emits an audit entry; Prisma is imported
**only** under `apps/api`.

## 6. Folder ownership

| Path                            | Owner           | Rule                                                                                                            |
| ------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------- |
| `packages/contracts/src/**`     | contracts owner | No edits without an ADR if the public surface changes shape                                                     |
| `packages/design-tokens/**`     | design owner    | Token values change here and nowhere else                                                                       |
| `packages/ui/src/components/**` | design owner    | One component per file, named after the file                                                                    |
| `packages/shared/src/**`        | contracts owner | Each file has a test in `__tests__/`                                                                            |
| `apps/api/src/modules/**`       | api owner       | One module per domain collection                                                                                |
| `apps/api/prisma/**`            | api owner       | Schema changes update `baseline.prisma` in the same reviewed PR, and a destructive change needs a recovery plan |
| `apps/web/src/app/**`           | web owner       | Route segments only; logic in `lib/` or components                                                              |
| `apps/admin/src/app/**`         | admin owner     | Server actions must re-check session                                                                            |
| `content/**`                    | owner           | Seed/reference only; never imported by app code at runtime                                                      |
| `scripts/**`                    | ci owner        | Gate scripts must exit non-zero on failure                                                                      |
| `tests/architecture/**`         | ci owner        | Boundary tests live here                                                                                        |
| `docs/adr/**`                   | owner           | Append-only in meaning; supersede rather than rewrite                                                           |
| `.github/workflows/**`          | owner           | No weakening edits without an ADR and an ADR-linked PR                                                          |

An owner is the only party who may approve changes in their path. This is enforced by
review discipline in Phase 2 and by branch protection once configured (gate 12).

## 7. Persistence and domain model

MongoDB via Prisma, one collection per entity. MongoDB Atlas for all environments;
local development uses a container or a separate Atlas development cluster. The
choice is recorded in `docs/adr/0002`.

| Collection       | Purpose                                              | Key fields                                                                                                  |
| ---------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `AdminUser`      | The single administrator (ADR-0009)                  | `email` (unique), `passwordHash`, `role`, `tokenVersion`, `active`, `lastLoginAt`                           |
| `AdminSession`   | Server-side session records for revocation and audit | `sid` (unique), `userId`, `ip`, `userAgent`, `createdAt`, `lastSeenAt`, `revokedAt`                         |
| `Experience`     | Career timeline entries                              | `org`, `title`, `startDate`, `endDate`, `current`, `highlights[]`, `tech[]`, `sortIndex`, `published`       |
| `Project`        | Portfolio projects                                   | `slug` (unique), `title`, `summary`, `body`, `role`, `tech[]`, `links`, `status`, `featured`, `publishedAt` |
| `Skill`          | Skill taxonomy                                       | `name`, `category`, `proficiency`, `sortIndex`                                                              |
| `ResumeSection`  | Ordered resume blocks                                | `kind`, `heading`, `body`, `sortIndex`                                                                      |
| `ResumeDocument` | Versioned resume                                     | `version`, `headline`, `fileUrl`, `isCurrent`                                                               |
| `Article`        | Knowledge Hub content                                | `slug` (unique), `kind`, `title`, `excerpt`, `body`, `tags[]`, `status`, `publishedAt`                      |
| `Faq`            | Frequently asked questions                           | `question`, `answer` (Markdown), `category`, `sortIndex`, `status`, `publishedAt`                           |
| `MediaAsset`     | Uploaded Cloudinary metadata                         | `publicId` (unique), `secureUrl`, `format`, `resourceType`, `bytes`, `width`, `height`, `alt`               |
| `ContactMessage` | Public form submissions                              | `name`, `email`, `message`, `status`, `createdAt`                                                           |
| `AuditLog`       | Every administrative write                           | `actorId`, `action`, `entityType`, `entityId`, `at`, `meta`                                                 |

### Persistence schema and the missing migration history

The MongoDB connector has no `prisma migrate` (`ADR-0006`). Three consequences are
load-bearing and are not negotiable implementation details:

- `apps/api/prisma/baseline.prisma` is the durable record of the reviewed schema. It
  is updated in the same pull request as the schema itself, so the diff is the record
  of what was accepted.
- `scripts/check-schema.mjs` compares the baseline with the intended schema and blocks
  destructive changes. It is a guardrail, not a guarantee.
- **Application rollback is not database rollback.** A rollback restores code only.
  Data recovery is forward repair, or a restore from a point-in-time backup.

Derived values are never stored as independent sources of truth. Tenure length,
reading time, and ordering are **computed** by `packages/shared` from the fields
above, so a date change cannot leave a stale duplicate behind. A field is stored only
if it is genuinely independent of the others.

Ordering is defined once: `compareExperience` (start date descending, then `sortIndex`
ascending, then id for stability) and `comparePublishedDesc`. `web`, `admin`, and `api`
all call these; none re-implements them.

## 8. Content authority

```
Authoring (admin) ──▶ API (validates + writes) ──▶ MongoDB  ← single source of truth
                                              ▲
                            content/ ─────────┘  seeds + reference only, applied
                                                   by an explicit import command
```

- `content/` files are never imported by application code at runtime.
- Imports are idempotent, run from a documented command, and are logged in
  `AuditLog` with a `content.import` action.
- Existing records are updated only when the file declares its target `slug`; imports
  never create or delete records implicitly.
- A `draft` record is invisible to `web` regardless of API response caching.

## 9. Integration topology

`apps/web` and `apps/admin` call the API over HTTPS at an API subdomain
(`API_BASE_URL`, name recorded in `DEPLOYMENT_MAP.md`). Browser-visible values are
`NEXT_PUBLIC_API_URL`, which is public by definition and must contain no credential.
The admin session is presented as an `httpOnly` cookie scoped to the admin host and
forwarded to the API as a bearer credential; the exact flow is specified in
`SECURITY.md` §4.

CORS is an explicit origin allowlist per environment. `web` and `admin` never call the
database, and neither Next.js app holds a database credential.

## 10. How the boundaries are checked

Gate 10 (`CI_GATES.md` area 10) fails on:

1. any import that violates the matrix in §3,
2. any import cycle within or across packages,
3. any `apps/*` file importing Prisma, Mongo, or `bcrypt`,
4. any `NEXT_PUBLIC_*` variable whose name suggests a secret,
5. any package importing a peer it does not declare,
6. an architecture test file that no longer discovers a package it should cover.

`tests/architecture/` holds one test per matrix row and per banned pattern, so a new
app or package cannot be added without a corresponding boundary decision.

## 11. Allowed exceptions

An exception is permitted only when recorded in `docs/exceptions.md` per
`GOVERNANCE.md` §5. Known candidates at the time of writing, none approved:

| Candidate                                  | Why it might be needed              | Compensating control                                                                                                                                       |
| ------------------------------------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web → api` DTO reuse in server components | Avoiding a duplicated response type | Import the type from `contracts`, not the controller; the boundary test targets value imports of app code, not type-only imports of the published contract |
| Prisma-generated types in `api`            | Persistence fidelity                | `api` only; the DTO layer converts Prisma rows to contract types before they leave the module                                                              |

Any exception must name the exact files it covers. Blanket exceptions are defects.

## 12. Non-goals

Explicitly out of scope unless a documented requirement appears: caching layer,
message queue, background worker, second database, public API for third parties,
multi-tenant support, public user accounts, and a CMS other than the admin
application. Introducing any of these requires an ADR.
