# ADR-0003 — GitHub OAuth with a database-backed allowlist

- **Status:** Accepted
- **Date:** 2026-10-18
- **Decision owner:** Repository owner

## Context

Administration must be restricted to explicitly named people. The site has no public
accounts, no self-service registration, and no user-management feature, so the problem
is "may this one identity write content", not "manage a user base".

Requirements: no local passwords, no public registration, immediate revocation of an
administrator, per-request authorization at the API, and secrets that never enter the
repository.

## Decision

Auth.js with the GitHub OAuth provider, with authorization decided by a **database-backed
allowlist keyed on the immutable numeric GitHub user id**.

- Match on numeric id (`gh_id`), never on the login, because logins can be renamed.
- The allowlist in `packages/contracts` is the seed; `AdminUser` in MongoDB is the
  authority. A GitHub identity absent from the database cannot write anything.
- The session is a signed token held in an `httpOnly`, `Secure`, `SameSite=Lax` cookie
  scoped to the admin host. The browser never receives the token as a readable value.
- Server-side code in `apps/admin` forwards the token to the API as
  `Authorization: Bearer`. The API does **not** accept cookie authentication, so browser
  credentials are never ambient and CSRF has no foothold.
- `apps/api` verifies on every protected request: signature (algorithm pinned), issuer,
  audience, then a fresh database lookup of the user, the session record, and the
  `tokenVersion` claim. Revocation therefore takes effect immediately rather than at
  token expiry.
- Sessions are limited to 15 minutes and are revocable individually (`AdminSession`) or
  globally (`tokenVersion`, or rotating `AUTH_SECRET`).
- Full specification: `SECURITY.md` §4.

## Consequences

**Positive**

- No password to store, phish, reuse, or leak; no credential-stuffing surface.
- Adding or removing an administrator is a deliberate, reviewed, audited change.
- Immediate revocation, which a purely stateless token cannot give.
- Server-to-server token forwarding removes token theft via XSS as a practical concern.

**Negative**

- Administration depends on GitHub's availability and on a maintainer keeping an OAuth
  app configured; a lost client secret locks out the admin until it is replaced.
- Every protected request costs one database lookup. Accepted for the immediacy of
  revocation in a single-administrator system.
- `SameSite=Lax` is required for the OAuth redirect to return the cookie, so the
  strongest available cookie prefix is `__Secure-` rather than `__Host-`.

**Blocking dependency:** ~~the admin domain and API domain must be fixed before
implementation~~ — **resolved 2026-10-18** by amendment: `admin.me.palnadu.dev` and
`api.me.palnadu.dev` (`DEPLOYMENT_MAP.md` §7.1). Implementation of the session design
proceeds; it still requires a provisioned GitHub OAuth app before it can be exercised
end to end.

## Alternatives considered

| Alternative                                            | Why not                                                                                                  |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Local email and password                               | Password storage, reset flow, and credential-stuffing surface, for a single-administrator system         |
| Shared secret or bearer token in the admin UI          | No per-identity attribution, no revocation granularity, and it would end up in a browser-reachable place |
| Full RBAC with multiple administrators and invitations | The requirement is an allowlist. User management is explicitly out of scope                              |
| Self-hosted OIDC provider                              | Additional infrastructure with no benefit for one provider                                               |
| A separate identity provider (Clerk, WorkOS, Auth0)    | Third-party dependency holding all site credentials, and no requirement it would satisfy                 |

## References

`SECURITY.md` §4, `DEPLOYMENT_MAP.md` §5, `CI_GATES.md` areas 6 and 12.
