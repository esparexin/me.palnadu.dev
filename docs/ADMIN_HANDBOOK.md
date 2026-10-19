# Admin Feature and Functionality Handbook

**Status:** Current-state handbook for the audit remediation branch.

**Baseline:** `feat/admin-full-stack-audit-21st-mcp` at `9eb4191`, plus the uncommitted
remediation described below and recorded in `ADR-0011` and `ADR-0012`.

**Audited:** 2026-10-19.

**Scope:** `apps/admin`, the contracts it consumes, the API modules it calls, and the
operator workflows those pieces implement.

**Method:** Source reading, contract/route inventory, local unit/type/build checks, and
comparison against the repository's own governance. This was not a penetration test and
did not exercise a real browser or database.

**Result:** No direct authentication bypass or missing server-side role check was found.
The admin is a functioning CMS for articles, media metadata, sessions, and audit reading.
The original audit found material defects in session lifetime, inactive-account handling,
media integrity, field accessibility, headers, and documentation. Those P1 items were
remediated in this tree; the remaining verification gap is the absence of admin-level
browser tests.

---

## 1. Scope, evidence, and current state

### 1.1 Evidence used

- All pages, components, server actions, session utilities, and API clients under
  `apps/admin/src`.
- `packages/contracts/src` schemas for auth, credentials, knowledge, media, audit,
  overview, common routes, and enums.
- API controllers, guards, services, mappers, Prisma schema, provisioning CLI, and
  password implementation under `apps/api`.
- Governance and operational documents listed in `AGENTS.md`, including
  `ADR-0009`, `ADR-0010`, `ADR-0011`, and `ADR-0012`.
- Existing unit, integration, and E2E tests; no admin E2E suite exists.

### 1.2 Checks run for this handbook

| Check                                        | Result                    |
| -------------------------------------------- | ------------------------- |
| `pnpm --filter @me-palnadu/contracts test`   | 46 tests passed           |
| `pnpm --filter @me-palnadu/ui test`          | 23 tests passed           |
| `pnpm --filter @me-palnadu/admin test`       | 2 files, 20 tests passed  |
| `pnpm --filter @me-palnadu/api test`         | 4 files, 38 tests passed  |
| `pnpm --filter @me-palnadu/admin typecheck`  | passed                    |
| `pnpm --filter @me-palnadu/api typecheck`    | passed                    |
| `pnpm build`                                 | 7 packages successful     |
| `pnpm db:integration`                        | 7 files, 106 tests passed |
| Repository doc/schema/secret/boundary checks | 0 violations              |
| Public E2E (`pnpm test:e2e`)                 | 46/48; 2 need an API      |
| Admin browser/E2E suite                      | does not exist            |

Local test counts are not CI evidence. A gate is enforced only when a workflow run is
cited (`GOVERNANCE.md` section 6).

### 1.3 Current working tree

The tree contains the completed FAQ removal across the public site, admin, API,
contracts, Prisma schema, tests, and documentation. It also contains unrelated
uncommitted changes that predate the remediation: `apps/web/package.json` and
`pnpm-lock.yaml` add `lucide-react`, and `apps/web/public/profile.png` is untracked.

- The public `/faq` route, admin FAQ screen, API module, contracts, cache tag, overview
  counter, and FAQ tests are removed.
- The `Faq` Prisma model is removed from `schema.prisma` and `baseline.prisma`. The
  MongoDB collection is not dropped; historical audit vocabulary remains readable.
- `ADR-0011` records the removal decision. `ADR-0012` records the session-lifetime and
  inactive-account handling changes.

---

## 2. System map

### 2.1 Request path

```text
Browser
  │  HttpOnly, SameSite=Lax session cookie
  ▼
apps/admin (Next.js server)
  │  Authorization: Bearer <JWT>
  ▼
apps/api (NestJS)
  │  database is the authority on every protected request
  ▼
MongoDB Atlas          Cloudinary (media bytes only)
```

The admin never talks to the database directly. It integrates with the API over HTTP,
uses `packages/contracts` for shapes and validation, and renders `packages/ui`
primitives.

### 2.2 Authentication model

1. The administrator submits email and password to the admin server action.
2. The admin server calls `POST /api/auth/login` server-to-server.
3. The API verifies the scrypt hash, creates an `AdminSession`, writes `auth_login` to
   the audit log in the same transaction, and returns a signed JWT plus the
   administrator identity.
4. The admin server stores the token in an HttpOnly cookie. Browser JavaScript never
   receives it.
5. Every protected API request verifies the JWT, then re-reads the administrator and
   session from MongoDB. A revoked session, a changed `tokenVersion`, an expired
   session, or an inactive account is rejected even if the JWT signature is valid.
6. The JWT, cookie, and database session share one absolute 8-hour lifetime. There is
   no refresh route or sliding expiry (`ADR-0012`).
7. A `401` or `403` from the session endpoint is treated as signed out. The rejected
   cookie is cleared by `/api/session/expired` before the login screen is shown.

The JWT algorithm is HS256. Only the API verifies it; the admin server forwards the
token. The role in the token is advisory; the database role is authoritative.

### 2.3 Role model

The contracts define `owner` and `editor`. In practice this is a single-owner
installation:

- Only `owner` can be provisioned by the CLI.
- No user-management screen exists.
- There is no editor provisioning path.
- Integration tests can seed an editor directly, which is how the editor denial paths
  are exercised.
- The audit trail and all destructive content/media operations are owner-only.
- The editor role is latent, not an operator workflow.

If the product remains single-owner, remove the editor surface or document it explicitly
as test-only. If multiple administrators are intended, add provisioning, user management,
and a real role policy before relying on it.

### 2.4 Data model used by the admin

| Model          | Purpose                           | Key fields                                                               |
| -------------- | --------------------------------- | ------------------------------------------------------------------------ |
| `AdminUser`    | Administrator identity            | `email`, `passwordHash`, `role`, `tokenVersion`, `active`, `lastLoginAt` |
| `AdminSession` | Revocable server-side login       | `sessionId`, `userId`, `ip`, `userAgent`, `expiresAt`, `revokedAt`       |
| `AuditLog`     | Append-only administrative record | `actorId`, `action`, `entityType`, `entityId`, `detail`, `createdAt`     |
| `Article`      | Knowledge Hub content             | `slug`, `kind`, `title`, `excerpt`, `body`, `tags`, `difficulty`, status |
| `MediaAsset`   | Cloudinary metadata               | `publicId`, `secureUrl`, `format`, `resourceType`, `bytes`, `alt`        |
| `Experience`   | Career entries                    | `slug`, `org`, `title`, dates, `highlights`, `tech`, `published`         |

Content statuses are `draft`, `published`, and `archived`. `archived` is a real stored
status for articles; Experience uses a boolean `published` instead.

---

## 3. Menu and route map

The dashboard navigation is defined in `apps/admin/src/components/dashboard/nav.tsx`.

| Route                       | Menu label    | Access        | Purpose                                                     |
| --------------------------- | ------------- | ------------- | ----------------------------------------------------------- |
| `/login`                    | —             | public        | Email/password sign-in                                      |
| `/`                         | —             | redirect      | Redirect to `/dashboard` when signed in, otherwise `/login` |
| `/dashboard`                | Overview      | owner, editor | Counts and the ten most recent administrative writes        |
| `/dashboard/knowledge`      | Knowledge Hub | owner, editor | Article list, filter, pagination                            |
| `/dashboard/knowledge/new`  | —             | owner, editor | Create a draft article                                      |
| `/dashboard/knowledge/[id]` | —             | owner, editor | Edit article, publication transitions, owner-only deletion  |
| `/dashboard/media`          | Media         | owner, editor | Cloudinary status, upload, library, owner-only deletion     |
| `/dashboard/audit`          | Audit         | owner only    | Audit trail, filter and pagination                          |
| `/dashboard/security`       | Security      | owner, editor | Own sessions, revoke, change password                       |

### 3.1 Permission matrix

| Operation                         | Owner | Editor | Enforced by                     |
| --------------------------------- | :---: | :----: | ------------------------------- |
| View overview                     |  yes  |  yes   | API session guard               |
| Read articles                     |  yes  |  yes   | API role guard                  |
| Create/update articles            |  yes  |  yes   | API role guard + contracts      |
| Publish/unpublish/archive content |  yes  |  yes   | API role guard                  |
| Delete article                    |  yes  |   no   | API role guard                  |
| View/sign/register media          |  yes  |  yes   | API role guard                  |
| Delete media                      |  yes  |   no   | API role guard                  |
| View own sessions                 |  yes  |  yes   | API identity scoping            |
| Revoke own session                |  yes  |  yes   | API identity scoping            |
| Change own password               |  yes  |  yes   | API identity scoping            |
| Read audit trail                  |  yes  |   no   | API role guard; nav item hidden |
| Manage administrators             |  no   |   no   | No route or screen exists       |

Hiding a navigation item is not access control. Direct editor access to
`/dashboard/audit` renders a "your role does not permit" notice, and the API independently
returns `403`. The content integration suite proves editor denial for article deletion
and audit reading.

### 3.2 Known inconsistency: overview activity for editors

The overview API and page are available to both roles and always render the latest ten
audit entries. The full audit trail is owner-only. An editor can therefore see a summary
of administrative writes, including authentication events, that the same editor is
denied on `/dashboard/audit`.

Decide whether the overview activity is intentionally sanitized for editors. If not,
return it only to owners or filter it to the editor's own writes.

---

## 4. Operator guide, menu by menu

### 4.1 Sign in — `/login`

**What it does**

- Collects email and password.
- Calls the API login endpoint server-to-server.
- On success, stores the token in an HttpOnly, `SameSite=Lax` cookie and redirects.
- On failure, shows the generic message "Those credentials were not recognised."

**Good properties**

- Unknown email and wrong password produce the same response.
- The account is compared against a decoy hash when it does not exist or is inactive,
  reducing timing leakage.
- The token is never exposed to browser JavaScript.
- Open-redirect attempts are sanitized to `/dashboard`.

**Issues**

- Any non-OK API response, including `429` and `5xx`, is shown as invalid credentials.
  A throttled or unavailable API looks like a wrong password.
- The form marks both fields invalid for every failure, even when the failure is
  infrastructure, not credentials.
- The login response is checked only for a string `token`; `LoginResponseSchema` is not
  used.
- The `redirectTo` target is not restricted to admin routes. A relative public path is
  accepted and will 404 on the admin host.

**Owner provisioning**

Use the CLI. It prompts for the password on a TTY and refuses non-interactive password
input:

```bash
pnpm --filter @me-palnadu/api owner:provision -- --email owner@example.com
pnpm --filter @me-palnadu/api owner:provision -- --email owner@example.com --reset-password
```

There is no HTTP route for creating or resetting an administrator. The documented
`--password` argument is not supported.

### 4.2 Overview — `/dashboard`

**What it shows**

- Published article count, with draft and archived counts.
- Media asset count and recorded storage in KB.
- The ten most recent audit entries: action, entity, timestamp.
- Owner-only link to the full audit trail.

**Actions**

- "New article" goes to the article create page.

**Correctness**

- Counts are computed from MongoDB on every request; nothing is cached.
- The recent-activity query includes authentication events as well as content writes.
- The table is read-only; there is no overview mutation.

**Issues**

- Editors see recent activity despite audit being owner-only.
- The media storage figure is rounded to whole KB; a 512-byte asset displays as `1 KB`.
  This is a display convention, not a data error.
- There is no loading state while the API responds.

### 4.3 Knowledge Hub — `/dashboard/knowledge`

#### List

- Columns: title and slug, kind, status, last updated.
- Filters: status (`draft`, `published`, `archived`) and free text over title, excerpt, or
  tag. The query is a normal GET form, so URLs are shareable.
- Pagination uses Previous/Next and preserves the status and search filters.
- The documented "filter by kind" control does not exist in the UI. The API supports it.
- An invalid status/page/search value silently resets the parsed query to defaults rather
  than showing a validation message.

#### Create — `/dashboard/knowledge/new`

Fields:

| Field      | Notes                                                              |
| ---------- | ------------------------------------------------------------------ |
| Title      | Required, max 160 characters                                       |
| Slug       | Required, lowercase words separated by hyphens; public URL segment |
| Kind       | `tutorial`, `kt_guide`, `troubleshooting`, `interview`             |
| Excerpt    | Required, max 400 characters                                       |
| Tags       | Comma-separated; stored as an array                                |
| Difficulty | Optional except for `interview`, where the contract requires it    |
| Body       | Required Markdown, rendered through the restricted shared parser   |

New articles are always created as `draft`. Publication is a separate action. The API
stamps `publishedAt`; the client does not choose the publication instant.

#### Edit — `/dashboard/knowledge/[id]`

- Shows status, kind, last update, and publication time.
- Shows "View live" only when published.
- Save updates the editable fields without changing status.
- Publication actions:
  - Draft or archived: **Publish**.
  - Published: **Unpublish** (returns to draft) or **Archive**.
  - Archived: **Publish again**.
- Owner-only deletion is confirmed through the shared modal dialog.

There is no dedicated "unarchive to draft" action. Archived items remain editable and can
be republished; otherwise `archived` is terminal.

#### Defects and risks

- A blank difficulty is omitted from the PATCH payload, so an existing difficulty cannot
  be cleared. Selecting "Not specified" leaves the previous value in place.
- A successful save returns no success notice; only a generic top-of-form error is shown
  when something fails.
- "View live" reads `ADMIN_PUBLIC_SITE_URL`, which is absent from `.env.example` and
  `DEPLOYMENT_MAP.md`. Without it, production links fall back to `http://localhost:3000`.
- The public page revalidation is tag-based (`articles`, `sitemap`) plus explicit paths.
  A slug change is likely covered by the tag invalidation, but there is no test proving
  the old path stops serving the old slug.
- The form has no cancel/back action on the create page.
- The article body is Markdown. Raw HTML is treated as text by the shared parser; no
  `dangerouslySetInnerHTML` is used.

### 4.4 FAQ — removed

The FAQ surface was removed under `ADR-0011`. There is no `/dashboard/faq` route, no
public `/faq` page, no API module, no contract, and no cache tag. The historical
`faq_*` audit actions remain readable but cannot be emitted by the current application.

### 4.5 Media — `/dashboard/media`

#### Upload flow

1. The admin calls `POST /api/admin/media/sign` with `image` or `raw`.
2. The API returns a short-lived signature, timestamp, API key, cloud name, upload URL,
   folder, and allowed formats.
3. The browser uploads bytes directly to Cloudinary.
4. The browser sends the returned metadata to `POST /api/admin/media`.
5. The API validates the URL's cloud and folder, records the metadata and audit entry in
   one transaction, and the page refreshes.

The API never receives file bytes. The Cloudinary secret never reaches the browser.

#### Library

- Shows a one-page grid of asset cards.
- Image assets render through `next/image`; PDFs show their format.
- Shows original filename, bytes, format, created time, optional alt text, resource type,
  "Open asset", and owner-only Delete.

#### Defects and risks

- **No pagination.** The API supports `page`, `format`, and `q`; the UI reads only one
  page and ignores `hasMore`. "N shown" is not a total.
- **No media filter/search UI**, despite the API supporting both.
- **Partial failure hides everything.** Status and library are fetched with
  `Promise.all`; if either request fails, both results are discarded and the page shows
  an error with an empty library.
- **Deletion ordering is repaired.** The metadata row and audit entry commit first; the
  provider cleanup is best-effort. A provider failure now logs a warning and leaves an
  orphaned file, which is recoverable, rather than a live row pointing at a deleted file.
- **URL binding is repaired.** Registration requires the `secureUrl` path to resolve to
  the submitted cloud, resource type, format, and public id, including an optional
  version segment. Traversal segments and unrelated URLs are rejected with a unit test.
- **Orphaned upload on registration failure.** If Cloudinary accepts the upload but
  registration fails, the asset remains in the provider with no library row and no
  cleanup path.
- **Alt text is optional for images.** The field is present and stored, but a missing alt
  is accepted.
- The size error message uses the global `MEDIA_MAX_BYTES`, not the status endpoint's
  `maxBytes`, so a lower deployment limit would be described incorrectly.
- Delete buttons are all labelled "Delete"; the filename appears in the confirmation
  dialog, not in the button's accessible name.

### 4.6 Audit — `/dashboard/audit`

**Access:** owner only. An editor who types the URL gets an explanatory notice; the API
also returns `403`.

**What it shows**

- Newest first, paginated.
- Columns: action, entity type and last eight characters of entity id, actor id (last
  eight characters), UTC timestamp, JSON detail.
- Filters: action and entity type.
- Read-only. There is no create, update, or delete route.

**Gaps**

- The API supports `entityId` and `actorId` filters and a detail endpoint; the UI exposes
  neither.
- Entity and actor are shown only as id suffixes; there is no human-readable actor email
  or entity title.
- Detail is raw JSON, which can be wide or hard to read.
- Authentication events (`auth_login`, `auth_logout`, `auth_password_change`,
  `auth_session_revoke`) appear alongside content writes.
- `experience_delete` is a declared audit action but no experience delete route exists,
  so it cannot be emitted through the API.
- There is no audit detail page, despite `GET /api/admin/audit/:id`.

### 4.7 Security — `/dashboard/security`

**Sessions**

- Lists up to 20 non-expired sessions belonging to the current administrator.
- Marks the current session.
- Shows creation time, last seen, expiry, IP, user-agent, and revoked state.
- Allows revoking any listed non-revoked session.
- Revoking the current session signs the administrator out: the API revokes the session,
  and the next request clears the rejected cookie through `/api/session/expired` before
  redirecting to login.

**Change password**

- Requires current password, new password, and confirmation.
- New password policy: at least 12 characters, upper and lower case, and a digit. It does
  not require a symbol.
- Success increments `tokenVersion`, invalidating every session, then clears the cookie
  and redirects to login.

**Defects**

- Wrong current password is an API `401 UNAUTHENTICATED`. `describeActionError` maps every
  `UNAUTHENTICATED` to "Your session has expired. Sign in again." The administrator is
  told their session expired when the real problem is the current password; the session
  may still be valid.
- Password-change success redirects with `?notice=Password changed...`, but the login
  page does not render `notice`. The success message is never shown.
- Revoking the current session redirects to `/dashboard/security?notice=Session revoked`,
  but the revoked cookie causes the layout to redirect to login first. The notice is
  lost.
- Deactivating an administrator causes the API to return `403`, not `401`. The admin
  treats only `401` as signed out; `403` becomes a root error page. Because `/login` also
  calls `getAuthenticatedAdmin`, the affected browser can be trapped on the error page
  with no sign-out control and no way to reach the login form without clearing cookies.
- The security page does not show a sign-out-all-other-sessions control beyond individual
  revocation.
- The page does not explain that the session list includes revoked sessions until their
  expiry.

### 4.8 Sign out

- Calls `POST /api/auth/logout` with the bearer token, then deletes all known session
  cookie names and redirects to `/login`.
- If the API is unreachable, the cookie is still cleared.
- The API logout route writes an audit entry and revokes the session.

---

## 5. Workflows

### 5.1 Article lifecycle

```text
create (draft) → edit → publish → published
                         │
                         ├─ unpublish → draft
                         ├─ archive  → archived → publish again → published
                         └─ delete   → permanent (owner only)
```

- Every write is audited in the same transaction as the row change.
- API `publishedAt` is server-stamped for publish and cleared for unpublish/archive.
- Deletion is permanent. Audit entries remain, with an `entityId` whose subject no longer
  exists.
- Archived content is not automatically deleted and remains editable.
- The admin UI has no status field on the edit form; status changes are separate actions.

### 5.2 FAQ lifecycle — removed

The FAQ lifecycle no longer exists. `ADR-0011` records the decision and the treatment of
historical data. Do not restore a single half of the feature: a public page without
authoring, or authoring without a public destination, is the defect the removal closed.

### 5.3 Media lifecycle

```text
request signature → browser upload to Cloudinary → register metadata → library row
                                                           │
                                                           └─ owner delete → DB + audit delete → provider cleanup
```

The database removal is authoritative and commits before provider cleanup. A provider
failure is logged and leaves an orphaned Cloudinary asset; it cannot leave a live row
pointing at a missing file.

### 5.4 Session and password lifecycle

- Login creates an `AdminSession` with an 8-hour database expiry.
- The JWT, cookie `maxAge`, and database session all use that same 8-hour ceiling.
- There is no refresh route and no sliding expiry. The session ends at the ceiling,
  logout, revocation, a token-version change, or account deactivation (`ADR-0012`).
- `GET /api/auth/session` is called on every render. `401` and `403` both mean signed out;
  the browser is routed through `/api/session/expired`, which clears the cookie.
- Revoking a session takes effect immediately because the API re-reads the session row.
- Changing the password increments `tokenVersion`, which invalidates every JWT.
- Logout revokes the current session.

### 5.5 Audit and revalidation

- Content and audit writes commit together.
- Public cache revalidation is best-effort and never fails the write.
- Article writes revalidate the `articles` and `sitemap` tags plus explicit paths.
- The public web app's article reads are tagged, with a 300-second fallback.
- There is no `sitemap.xml` or `robots.txt` implementation in `apps/web`, despite
  architecture/spec references and the `sitemap` cache tag.

---

## 6. API surface used by the admin

### 6.1 Authentication

| Method | Path                        | Access        | Purpose                                  |
| ------ | --------------------------- | ------------- | ---------------------------------------- |
| POST   | `/api/auth/login`           | public        | Verify credentials, create session       |
| GET    | `/api/auth/session`         | authenticated | Re-check session and return identity     |
| GET    | `/api/auth/sessions`        | authenticated | List the caller's sessions               |
| POST   | `/api/auth/sessions/revoke` | authenticated | Revoke one of the caller's sessions      |
| POST   | `/api/auth/change-password` | authenticated | Change password, invalidate all sessions |
| POST   | `/api/auth/logout`          | authenticated | Revoke current session                   |

### 6.2 Content, media, overview, audit

| Method | Path                                 | Access        | Purpose                         |
| ------ | ------------------------------------ | ------------- | ------------------------------- |
| GET    | `/api/admin/knowledge`               | owner, editor | List all articles               |
| GET    | `/api/admin/knowledge/:id`           | owner, editor | Read one article                |
| POST   | `/api/admin/knowledge`               | owner, editor | Create article                  |
| PATCH  | `/api/admin/knowledge/:id`           | owner, editor | Update article                  |
| POST   | `/api/admin/knowledge/:id/publish`   | owner, editor | Publish                         |
| POST   | `/api/admin/knowledge/:id/unpublish` | owner, editor | Unpublish to draft              |
| POST   | `/api/admin/knowledge/:id/archive`   | owner, editor | Archive                         |
| DELETE | `/api/admin/knowledge/:id`           | owner         | Delete permanently              |
| GET    | `/api/admin/media/status`            | owner, editor | Provider configuration state    |
| POST   | `/api/admin/media/sign`              | owner, editor | Short-lived upload signature    |
| GET    | `/api/admin/media`                   | owner, editor | List media metadata             |
| POST   | `/api/admin/media`                   | owner, editor | Register uploaded metadata      |
| DELETE | `/api/admin/media/:id`               | owner         | Delete asset and metadata       |
| GET    | `/api/admin/overview`                | owner, editor | Dashboard counters and activity |
| GET    | `/api/admin/audit`                   | owner         | List audit entries              |
| GET    | `/api/admin/audit/:id`               | owner         | Read one audit entry            |

Experience has its own API module and public reads, but no admin UI. Its routes are
create, update, publish, and unpublish; there is no delete route, despite an
`experience_delete` audit action.

### 6.3 Validation and SSOT observations

- Admin server actions parse form data with the same contract schemas the API uses. The
  API validates again and remains authoritative.
- API responses are parsed with contract schemas; a shape drift becomes an error rather
  than `undefined` in the UI.
- `loginAction` is the exception: it manually checks only the `token` field instead of
  parsing `LoginSuccessSchema`.
- `ArticleUpdateSchema` accepts `publishedAt` because it is derived from the full shape,
  but the API service ignores it. The contract advertises a writable field that is
  silently discarded.
- List pages silently reset malformed query parameters to defaults instead of surfacing a
  field error. This is a UX choice, but it means a bad filtered URL can look like an
  unfiltered list.

---

## 7. Security assessment

### 7.1 What is sound

- Authorization is enforced by the API, not by hidden controls.
- The guard fails closed for routes without an explicit public annotation.
- The database is re-read on every protected request; JWT claims alone are insufficient.
- Role checks use a guard that reads the database role.
- Destructive operations are owner-only.
- Login is rate-limited by IP; administrative routes have a separate budget.
- Passwords use scrypt with `N=2^16`, `r=8`, `p=1` and a self-describing stored format.
- Login failures are generic, with decoy hashing for unknown/inactive accounts.
- JWTs, cookies, and database sessions share one 8-hour ceiling (`ADR-0012`).
- Session cookies are HttpOnly, `SameSite=Lax`, `Secure` in production, and named with
  `__Secure-` in production.
- The API accepts bearer tokens only; browser cookies are not accepted by the API.
- Audit entries are written in the same transaction as the change and cannot be edited
  through HTTP.
- No raw HTML rendering, no `dangerouslySetInnerHTML`, and no raw form primitives in the
  admin pages.

### 7.2 Gaps and mismatches

- **No admin CSP/header regression test or browser verification.** `apps/admin/next.config.ts`
  now emits CSP, HSTS in production, `X-Frame-Options`, `nosniff`, and related headers, but
  no automated test asserts them and the CSP admits inline scripts because a nonce would
  require request-time middleware.
- **No admin E2E journey and no admin coverage floor.** Browser-level login, session
  expiry, content, media, and audit flows are unproven. A-06 remains open.
- **`403` handling is proven by unit tests only.** The API integration suite covers
  role denial and deactivation, but the admin redirect through `/api/session/expired` has
  no browser-level test.

No secrets are recorded in this handbook.

---

## 8. Accessibility and UX assessment

### 8.1 Strengths

- Every field has a visible, bound `<label>`.
- Skip link, `<main id="main-content">`, and nav landmarks are present.
- Tables use captions and `scope="col"`.
- The active navigation item uses `aria-current="page"`.
- The shared `Dialog` implements `role="dialog"`, `aria-modal`, focus trap, Escape,
  focus return, and a labelled title.
- `Field` links hints and errors with `aria-describedby` and sets `aria-invalid` on the
  control; unit tests cover both paths.
- Destructive actions use the shared dialog rather than `window.confirm`.
- Filters are real GET forms and work without client JavaScript.
- Status is conveyed in text and via badges, not colour alone.
- Focus-visible styling is defined in the UI primitives.
- Errors are summarised with `role="alert"` at the top of forms.

### 8.2 Defects and gaps

- **Field errors are not announced or focused.** The top-level error has `role="alert"`,
  but field-level errors do not, and focus does not move to the alert. The UI standard
  requires an announced summary and focus movement.
- **No loading states.** There is no `loading.tsx`, `Suspense`, or `aria-busy` in the
  admin. Slow API responses render as blank or stale content; the standard names
  `Skeleton` for content.
- **Primary target sizes.** The standard requires 44×44 for primary actions. The shared
  primary `md` button is 40px high and `sm` is 32px. The login submit and article create/publish
  buttons use those sizes. WCAG 2.2 AA's minimum is 24px, so this is a
  project-standard violation rather than an automatic WCAG failure.
- **Mobile navigation scrolls horizontally.** Six items use `overflow-x-auto` in a
  horizontal rail below `lg`. This avoids page overflow but can hide destinations without
  a scroll cue; it has not been browser-tested at 320px.
- **Media alt text is optional for images.** The field is present, but the contract and
  form accept an empty value.
- **Login error treatment is misleading.** Both fields are marked invalid and labelled
  "Check your..." for API outages and rate limits.
- **Difficulty cannot be cleared.** See [§4.3](#43-knowledge-hub--dashboardknowledge).
- **Success is not always stated.** Article saves have no confirmation; password
  change and current-session revoke notices are lost.
- **Interrupted writes and navigation.** Publish/unpublish/archive failures redirect to
  the list with an error, losing the edit context. There is no unsaved-changes warning.

---

## 9. Findings register

Severity is prioritised for operator impact and data integrity, not for exploitability.
No P0 authentication bypass was found.

### P1 — remediated in this tree

| ID   | Finding                                                       | Status and evidence                                                                                   |
| ---- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| A-01 | FAQ admin published to a page deleted in the working tree     | **Resolved** by full removal; `ADR-0011`; no admin/API/public route remains.                          |
| A-02 | Token expired after 15 minutes while cookie/session lasted 8h | **Resolved** by one 8-hour ceiling; `ADR-0012`; API and admin tests assert the value.                 |
| A-03 | Inactive administrator was trapped on a `403` error page      | **Resolved**: `403` is signed out; `/api/session/expired` clears cookies; unit test added.            |
| A-04 | Media deletion destroyed the provider asset first             | **Resolved**: DB and audit commit first; provider cleanup is best-effort and logged.                  |
| A-05 | Field errors and hints were not linked to inputs              | **Resolved** in `Field`; `aria-describedby`/`aria-invalid` are automatic and unit-tested.             |
| A-06 | No admin E2E suite or coverage gate                           | **Open**. Public E2E exists; admin browser journeys and a coverage floor still do not.                |
| A-07 | Provisioning/deactivation docs disagreed with code            | **Resolved** for the audited items: `--password` removed, `403` and password/scrypt values corrected. |

### P2 — correctness, UX, and operational quality

| ID   | Finding                                                        | Evidence                                                                        | Recommended action                                                               |
| ---- | -------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| B-01 | Password-change success notice is never displayed              | Action redirects with `notice`; login page ignores it                           | Render the notice on `/login` and keep it out of the URL if practical.           |
| B-02 | Current-session revoke notice is lost                          | Revoked cookie makes the layout redirect before the notice renders              | Redirect to login with a notice after clearing the cookie, or clear client-side. |
| B-03 | Wrong current password is reported as session expiry           | API returns `401`; `describeActionError` maps all `UNAUTHENTICATED` to expiry   | Return a field error for incorrect current password.                             |
| B-04 | Login masks 429/5xx as bad credentials                         | `loginAction` returns the generic failure for every non-OK response             | Distinguish throttling/outage from credential rejection.                         |
| B-05 | Deep links are lost after sign-in                              | Dashboard layout always calls `requireAdmin('/dashboard')`                      | Pass the current path, or derive it from the request.                            |
| B-06 | Overview exposes recent audit entries to editors               | Overview is owner+editor; audit is owner-only                                   | Hide/sanitize recent activity for editors.                                       |
| B-07 | Media library has no pagination or filters                     | API supports `page`, `format`, `q`; page reads one page                         | Add pagination and filter controls; show total.                                  |
| B-08 | Media partial failure discards both status and library         | `Promise.all` result destructuring; either rejection empties both               | Load independently and render partial state.                                     |
| B-09 | **Resolved:** registration now binds `publicId` to `secureUrl` | Cloud/resource/format/public-id path equality; traversal rejected               | Unit tests cover mismatch, foreign cloud, wrong format, and traversal.           |
| B-10 | Upload registration failure leaves an orphan Cloudinary asset  | Uploader stops after `registerMediaAction` fails                                | Add a cleanup/delete path or a reconciliation job.                               |
| B-11 | Difficulty cannot be cleared                                   | Blank value returns `{}`; no explicit `null`/clear semantics                    | Send an explicit clear value or define nullable difficulty in the contract.      |
| B-12 | Success is not confirmed for article saves                     | Actions return `{}`; no toast/notice                                            | Show a persistent or polite success message.                                     |
| B-13 | Primary action targets are below the project's 44px standard   | `Button` sm=32, md=40; primary buttons use them                                 | Raise primary sizes or exempt specific cases via an approved exception.          |
| B-14 | No loading UI                                                  | No `loading.tsx`, `Suspense`, or `aria-busy`                                    | Add skeletons/streaming states that mirror final layout.                         |
| B-15 | `View live` still falls back to localhost                      | `ADMIN_PUBLIC_SITE_URL` is now documented; code still defaults to localhost     | Validate the variable and fail visibly if missing in production.                 |
| B-16 | Editor role is latent and undocumented as such                 | No provisioning/management; tests seed directly; docs disagree                  | Either remove the role or document and provision it deliberately.                |
| B-17 | Experience API has no admin UI and no delete route             | API module exists; no admin route; `experience_delete` declared                 | Build the screen and delete route, or remove the unused audit action.            |
| B-18 | Audit detail and actor/entity filters are not exposed          | API supports `GET /:id`, `entityId`, `actorId`; UI does not                     | Add filters and a detail view, or remove the unused API surface.                 |
| B-19 | **Resolved:** admin response headers are configured            | `next.config.ts` sets CSP, nosniff, frame denial, referrer policy, HSTS in prod | Add a header regression test; browser verification is still pending.             |
| B-20 | `publishedAt` is accepted by the article update contract       | `ArticleUpdateSchema` includes it; `buildUpdate` ignores it                     | Remove it from the patch shape or honor it deliberately.                         |

### P3 — hygiene and documentation

| ID   | Finding                                                          | Recommended action                                                                            |
| ---- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| C-01 | **Resolved:** duplicate `API_ROUTES.sessions` removed            | One canonical `API_ROUTES.auth.sessions` remains.                                             |
| C-02 | **Resolved:** admin env docs match actual reads                  | `.env.example` and `DEPLOYMENT_MAP.md` list only `ADMIN_API_URL` and `ADMIN_PUBLIC_SITE_URL`. |
| C-03 | Admin docs claim independent JWT verification                    | Correct `SECURITY.md` to describe the actual trust path.                                      |
| C-04 | **Resolved:** password/scrypt docs match code                    | 12–200 characters, upper/lower/digit; `N=65536`, `r=8`, `p=1`.                                |
| C-05 | **Resolved:** `ADMIN_ALLOWLIST` claim removed                    | `SECURITY.md` describes the `AdminUser` row and the current role model.                       |
| C-06 | **Resolved:** role denial is documented as implemented           | Owner-only article/media deletion and audit reading are tested.                               |
| C-07 | `ARCHITECTURE.md` says the article list filters by kind          | Add the control or correct the document.                                                      |
| C-08 | **Resolved:** `TESTING.md` no longer asserts `/faq`              | `/faq` is absent from the public and admin journey lists.                                     |
| C-09 | `apps/admin/package.json` and README claim absent screens        | Correct the descriptions to the implemented scope.                                            |
| C-10 | Test counts in `SECURITY.md` are stale (16 vs 19)                | Update the recorded count or remove the count.                                                |
| C-11 | No sitemap/robots despite architecture claims                    | Implement or correct the claims and the `sitemap` cache tag.                                  |
| C-12 | **Resolved:** FAQ cache target removed                           | `CACHE_TAGS.faq` and the FAQ writes no longer exist.                                          |
| C-13 | `formatDate` is timezone-dependent while `formatDateTime` is UTC | Pin both to the same display timezone.                                                        |
| C-14 | Media size error uses the global maximum, not the status maximum | Use the server-reported `maxBytes` in the message.                                            |

---

## 10. Documentation reconciliation

The audit found documentation that described controls or screens which did not exist.
The following were corrected in this change:

| Area                   | Correction                                                                  |
| ---------------------- | --------------------------------------------------------------------------- |
| FAQ                    | Removed from `ARCHITECTURE.md`, `TESTING.md`, `RUNBOOK.md`, and this guide. |
| Session lifetime       | 15-minute access and 8-hour cookie claims replaced by the 8-hour ceiling.   |
| Password policy        | 12–200 characters, upper/lower/digit; no symbol requirement.                |
| scrypt parameters      | Documented as `N=65536`, `r=8`, `p=1`, 64-byte key.                         |
| Provisioning           | `--password` removed; the CLI prompts on a TTY.                             |
| Inactive account       | Existing sessions are rejected with `403`, not `401`.                       |
| Admin environment keys | Only `ADMIN_API_URL` and `ADMIN_PUBLIC_SITE_URL` are documented as read.    |
| Admin scope            | Package/README descriptions list knowledge, media, audit, and sessions.     |

Remaining documentation debt is tracked by the open P2/P3 findings above. In
particular, the article list still does not expose the API's `kind` filter, and
`ADMIN_PUBLIC_SITE_URL` is documented but not validated at runtime.

## 11. Test coverage assessment

### 11.1 What exists

- Contract schemas and their tests.
- API unit tests for media signing and ownership validation, revalidation, and selected
  behavior.
- API integration tests for authorization, content transitions, auth, rate limits,
  body limits, and HTTP hardening. These require a real test database.
- Public-site E2E, floating-menu E2E, and public-route axe tests.
- Admin unit tests for session helpers, deactivated-account handling, and login/logout
  actions.
- UI unit tests for `Field` hint/error associations.

### 11.2 What does not exist

- No admin E2E journey in `tests/e2e`.
- No admin page/component test.
- No admin form, media, content-action, or security-action test.
- No admin axe run.
- No enforced admin coverage floor.
- No test for the wrong-current-password message.
- No test for deep-link preservation.
- No test for media provider cleanup failure after the database commit.
- No response-header regression test.
- No test for the fixed 8-hour session ceiling against a real API response.

The absence of admin E2E is the largest verification gap. The strongest guarantees in
this system are API-side; the operator-facing browser behavior is comparatively unproven.

---

## 12. Remediation status

### Completed

1. Removed the FAQ surface end-to-end and recorded the decision in `ADR-0011`.
2. Aligned JWT, cookie, and database sessions to one 8-hour ceiling; recorded the
   trade-off in `ADR-0012`.
3. Treated `403` as signed out and cleared the rejected cookie through a Route Handler.
4. Committed media metadata removal before provider cleanup and bound `secureUrl` to the
   submitted public id with unit tests.
5. Wired `aria-describedby` and `aria-invalid` through the `Field` primitive.
6. Added admin CSP and related response headers.
7. Corrected provisioning, password, scrypt, session, deactivation, admin-env, and FAQ
   documentation.
8. Added regression tests for the inactive-account path, session constant, and media
   ownership validation.

### Open

1. Add admin E2E and axe journeys, then enforce an admin coverage floor.
2. Add a response-header regression test and confirm the CSP in a real browser.
3. Resolve the remaining P2/P3 operator-experience and scope items.
4. Give the public E2E suite an API fixture; its missing-article journey currently
   depends on an externally running API and fails without one.

Do not describe a gate as enforced until its run is cited.

## 13. Operator quick reference

### Create and publish an article

1. **Knowledge Hub → New article.**
2. Fill title, slug, kind, excerpt, tags, optional difficulty, and body.
3. **Create draft.**
4. Review the edit page.
5. **Publish.** The public page is revalidated through the API.
6. Use **Unpublish** to return to draft or **Archive** to hide it.

### Upload media

1. **Media.**
2. If setup is required, configure all three Cloudinary variables on the API and restart.
3. Choose an allowed file, add alt text, and **Upload asset**.
4. The browser uploads to Cloudinary; the API records metadata.
5. Use **Open asset** to verify the URL.
6. Owner-only **Delete** asks for confirmation, removes the row and audit record first, then asks Cloudinary to remove the file.

### Change password

1. **Security → Change password.**
2. Enter current password, new password, and confirmation.
3. Submit. All sessions are invalidated and the browser is sent to login.
4. Current caveat: a wrong current password may be reported as "session expired"; the
   success notice is not displayed.

### Revoke a session

1. **Security → Sessions.**
2. Choose **Revoke** or **Sign out this session**.
3. Revoking the current session signs you out. The success notice is currently lost due
   to the layout redirect.

### Troubleshoot

| Symptom                                                | Likely cause / action                                                        |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Signed out after roughly 8 hours                       | The absolute session ceiling was reached. Sign in again.                     |
| "Session expired" after wrong password                 | Known error-mapping defect; verify the current password.                     |
| Login says credentials invalid during an outage        | Generic login failure masks API 429/5xx; check API health.                   |
| "View live" opens localhost                            | `ADMIN_PUBLIC_SITE_URL` is missing; set the public web origin.               |
| Media upload unavailable                               | Cloudinary keys absent; configure all three on the API and restart.          |
| Media is gone from the library but still in Cloudinary | Provider cleanup failed; remove the orphan from the Cloudinary console.      |
| Inactive account is signed out                         | The account is deactivated; the API returns `403` and the cookie is cleared. |
| Audit link missing                                     | The signed-in role is `editor`; audit is owner-only.                         |

---

## 14. Bottom line

The admin is not a mock: it has real authentication, server-side authorization, audited
transactions, contract validation, and working content/media workflows. Its strongest
part is the API boundary. Its weakest parts are the browser-facing session lifecycle,
error communication, media integrity around an external provider, and the absence of
admin-level end-to-end verification.

The Faq surface is now removed rather than half-present, and the original P1 session,
inactive-account, media-ordering, field-association, and documentation defects are
remediated in this tree. The full `pnpm verify` chain and the real-database integration
suite pass on the final tree. The next engineering change should be verification breadth,
not feature expansion: admin browser journeys and a response-header regression test.
