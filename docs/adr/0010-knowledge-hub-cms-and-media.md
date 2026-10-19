# ADR-0010 — Knowledge Hub CMS, FAQ, media library, and cache revalidation

- **Status:** Accepted
- **Date:** 2026-10-19
- **Decision owner:** Repository owner
- **Related:** `ADR-0002` (MongoDB as content store), `ADR-0006` (Prisma pin and schema management), `ADR-0007` (rate limiting), `ADR-0009` (owner authentication)
- **Phase:** 6G, Knowledge Hub vertical slice
- **Note:** The FAQ portion of this decision is superseded by `ADR-0011`.

## Context

The repository had a Knowledge Hub contract but no persisted content, no admin
authoring, no FAQ, no media storage, and no cache invalidation. The public site
served scaffold routes. This ADR records the decisions required to ship the
Knowledge Hub, FAQ, and media library as a working vertical slice without
inventing features that the repository cannot support.

Three constraints shape every decision below:

1. Prisma's MongoDB connector has no migration history (`ADR-0006`). A schema
   change is a `db push`, and `apps/api/prisma/baseline.prisma` plus
   `scripts/check-schema.mjs` are the only record of what was reviewed.
2. The repository must not add a dependency without a concrete requirement
   (`AGENTS.md` §2.10). A markdown renderer, an upload SDK, and a job scheduler
   all fail that test today.
3. A control may only be described as enforced when a run proves it
   (`GOVERNANCE.md` §6). This ADR separates what is implemented from what is
   still specified.

## Decision

### 1. Blog data model

A single `Article` collection. Fields:

| Field         | Type          | Notes                                                                   |
| ------------- | ------------- | ----------------------------------------------------------------------- |
| `slug`        | unique string | Public URL identity; kebab-case, from `SlugSchema`                      |
| `kind`        | string        | Canonical `ArticleKind`: tutorial, kt_guide, troubleshooting, interview |
| `title`       | string        | ≤ 160 characters                                                        |
| `excerpt`     | string        | ≤ 400 characters; written by the author, never auto-generated           |
| `body`        | string        | Markdown source, ≤ 60,000 characters                                    |
| `tags`        | string[]      | ≤ 12, each ≤ 40 characters                                              |
| `difficulty`  | string?       | Required for `interview`, optional otherwise                            |
| `status`      | string        | Canonical `ContentStatus`: draft, published, archived                   |
| `publishedAt` | DateTime?     | Set when status becomes `published`; cleared on unpublish               |
| `createdAt`   | DateTime      | Prisma default                                                          |
| `updatedAt`   | DateTime      | Prisma `@updatedAt`                                                     |

`publishedAt` changes from a date-only ISO string in the existing contract to a
full ISO datetime. No article data exists, so this is not a breaking data change;
it is recorded here because the contract is a public surface.

There is no `scheduled` status. No scheduler exists, and a status that nothing
transitions would be a lie in the UI. Publishing is an explicit action.

### 2. Markdown storage and rendering

Markdown is stored as source and rendered on the server. The renderer is a small
in-repository function in `packages/shared` that supports the subset the
Knowledge Hub needs:

- headings (`##` through `####`), paragraphs, lists, fenced code blocks, inline
  code, blockquotes, links, emphasis, and horizontal rules;
- no raw HTML passthrough, no embedded scripts, no iframes.

The renderer returns a restricted AST, and `apps/web` renders that AST with React
elements. `dangerouslySetInnerHTML` is never used. This avoids adding a markdown
dependency, keeps XSS impossible by construction rather than by sanitizer
configuration, and keeps the output typed.

Article headings render at `h2` and below because the page title is `h1`
(`UI_UX_STANDARDS.md` §7.4).

### 3. FAQ

A `Faq` collection with `question`, `answer` (Markdown, same renderer), `category`,
`sortIndex`, `status`, and `publishedAt`. FAQ entries are published and unpublished
individually; there is no separate FAQ page versioning.

### 4. Media library

Cloudinary is the storage provider. The API never proxies file bytes:

1. The admin server action requests a short-lived signature from
   `POST /api/admin/media/sign`.
2. The browser uploads directly to Cloudinary with that signature.
3. The admin server action registers the resulting asset with
   `POST /api/admin/media`, which stores a `MediaAsset` row.

Signing uses `node:crypto` SHA1 over the Cloudinary parameter string. No SDK is
added. `CLOUDINARY_API_SECRET` exists only in the API process and is never
returned by a route. When the three Cloudinary keys are absent, the media routes
return a `SETUP_REQUIRED` state instead of failing obscurely; the admin UI shows
that state plainly.

`MediaAsset` stores `publicId`, `secureUrl`, `format`, `bytes`, `width`, `height`,
`resourceType`, `originalFilename`, `alt`, and `createdAt`. Uploads are restricted
to images (`jpg`, `png`, `webp`, `avif`) and PDFs, with a 10 MB ceiling. The API
re-validates the registered URL's host and extension; it does not trust the
browser's claim.

### 5. Cache revalidation

`apps/web` exposes `POST /api/revalidate`, protected by a shared
`REVALIDATE_SECRET` compared in constant time. It accepts a bounded list of tags
and paths and calls `revalidateTag` / `revalidatePath`.

The API calls this route after a publish, unpublish, archive, or delete. The call
is best-effort: a failure is logged and does not fail the write. The write is the
source of truth; the cache is derived and self-heals on the next revalidation or
TTL expiry.

Tags are defined once in `packages/contracts` so the API and web app cannot
disagree about a tag name.

### 6. Audit

Every administrative write records an `AuditLog` entry in the same transaction as
the write (`SECURITY.md` §4). The audit log is read-only over HTTP: list and
detail only. No delete or update route exists.

### 7. Sessions and security overview

The admin settings screen shows the current administrator, the active sessions,
and the ability to revoke another session. Revocation is owner-only and audited.
There is no user-management screen: the repository has exactly one administrator
(`ADR-0009`).

## Explicitly not implemented

The following were requested or implied but have no data model or API, so no
screen is created for them:

- profile/site settings, projects, skills, resume sections, and resume documents;
- contact message inbox;
- scheduled publishing;
- a media transform/CDN management UI beyond registering an uploaded asset.

Fabricating placeholder screens would violate `AGENTS.md` §4 and would make the
admin UI claim capability the API does not have.

## Consequences

- The Knowledge Hub and FAQ become real, editable, cache-aware content.
- Markdown rendering is a repository-owned, dependency-free subset. If a future
  requirement needs tables, footnotes, or raw HTML, that is a new ADR.
- Cloudinary becomes an external dependency for media only. Losing it does not
  break article rendering, because articles reference absolute URLs.
- Revalidation is best-effort by design; a stale page is possible until the next
  successful call or TTL expiry. That is accepted over failing a content write.
- The schema adds three collections and must be applied with `db push`. The
  baseline is updated in the same change, and the diff is the review record.
