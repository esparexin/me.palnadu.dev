# ADR-0008 — Single-owner administrator authentication

- **Status:** Superseded by ADR-0009
- **Date:** 2026-10-19
- **Decision owner:** Repository owner
- **Refines:** `ADR-0003` (GitHub OAuth with a database-backed allowlist) — confirms the mechanism after an evidence audit, and adds the CSRF stance, the break-glass mitigation, and implementation verification requirements
- **Phase:** 6F, authentication architecture

## Context

An evidence audit was carried out before any authentication code was written. The
repository's API authorization boundary is implemented and verified; the authentication
_issuance_ flow is entirely absent.

Findings, each verified against the repository rather than asserted:

| Finding                                                                                  | Evidence                                                              |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| No production JWT issuance or OAuth callback                                             | `SignJWT` appears nowhere in `apps/api/src` outside tests             |
| No functional authentication handlers or middleware in the admin application             | no `route.ts`, no `middleware.ts`, no auth dependency in `apps/admin` |
| The administrator login page is a placeholder                                            | `apps/admin/src/app/login/page.tsx` renders a static "Phase 6" notice |
| API authorization validates signed bearer tokens and rechecks state against the database | `apps/api/src/auth/admin-session.guard.ts`, 33 integration tests      |
| Expiry, revocation and `tokenVersion` are covered                                        | individual tests per failure mode                                     |
| The numeric `ADMIN_ALLOWLIST` is the intended identity authority                         | `packages/contracts/src/auth.ts`                                      |

**There is currently no way to sign in.** That is the accurate statement of the
baseline: the verification half is built and proven, the issuance half does not exist.
The complete sign-in lifecycle must not be described as implemented until a real OAuth
flow has been exercised end to end.

`ADR-0003` already selected GitHub OAuth with a numeric-ID allowlist. This ADR does not
reverse it. It confirms that choice against the evidence above, and closes the gaps
`ADR-0003` left open: it named a lost client secret as a lockout risk but not a lost
_account_, it recorded `SameSite=Lax` without stating what that does and does not prove
about CSRF, and it set no bar for verifying a future implementation.

## Decision

Adopt **GitHub OAuth with an immutable numeric GitHub account-ID allowlist** as the
authentication mechanism for the single-owner administration interface.

The application will not implement custom password storage, password recovery, or public
registration. A managed identity provider remains a rejected alternative unless
requirements change.

The decisive factor is total security surface, not feature count. OAuth places
credential lifecycle, MFA and account recovery outside this repository: there is no
password to store and no password-handling code to write or get wrong. For a
single-owner system that is strictly less risk than either alternative, and it costs
nothing in recurring fees or client bundle.

## Alternatives considered

| Alternative                      | Decision       | Rationale                                                                                                                                                                    |
| -------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub OAuth + numeric allowlist | **Accepted**   | Delegates credential management, MFA and recovery to GitHub. No password storage or reset infrastructure. Immutable numeric id rather than a mutable login. No subscription. |
| Managed identity provider        | Rejected (now) | Viable, but adds a vendor, a configuration surface, a client SDK and potentially recurring cost for a one-owner interface. Reconsider if organizational requirements expand. |
| Custom password or passkey       | Rejected (now) | Introduces password storage, reset flow, lockout and recovery responsibilities with no demonstrated requirement.                                                             |

## Session architecture

Proposed flow, subject to implementation audit and verification:

1. The administrator initiates GitHub OAuth through the Next.js admin application.
2. The OAuth callback validates `state` and exchanges the authorization code using the
   provider credentials.
3. The application obtains the authenticated user's immutable numeric GitHub ID.
4. The server checks that ID against the administrator allowlist.
5. The application creates the database-backed `AdminUser` and `AdminSession` records
   according to the approved lifecycle rules.
6. The browser receives an opaque, `HttpOnly`, `Secure`, `SameSite=Lax` session cookie.
7. The Next.js server reads the session and calls the API using a signed bearer token in
   the `Authorization` header.
8. The API verifies the token and revalidates administrator status, session validity,
   expiry, revocation and `tokenVersion` against the database on every protected request.

The browser must never receive or store the API signing secret or the API bearer JWT.

This preserves the boundary the code already encodes: `SESSION_COOKIE_NAME` is a
`__Secure-` cookie, the API reads only the `Authorization` header, and CORS sets
`credentials: false`. Because the browser never holds the JWT, the API needs no CSRF
defence — a bearer header is not ambient.

Do not change the API's bearer-only authentication boundary without a separate decision
and security review.

## Session lifecycle

Preserve the existing documented policy unless implementation audit demonstrates a
mismatch:

- 15-minute JWT lifetime.
- 8-hour maximum session age.
- Database-backed revocation through `revokedAt`.
- Global revocation through `tokenVersion`.
- Server-side validation on every protected API request.

Verify actual configuration, cookie lifetime, token lifetime and database enforcement
before claiming these values are implemented end to end. The contract declares them; the
issuance path that would apply them does not exist yet.

## CSRF decision

The API's bearer-token endpoints are not authenticated by ambient browser cookies. Do
not add cookie-based API authentication as part of this ADR.

Cookie-authenticated routes and actions in the Next.js admin application require an
explicit CSRF threat assessment. `SameSite=Lax` alone must not be treated as universal
proof of CSRF protection: it is required for the OAuth redirect to return the cookie, so
the strongest available cookie prefix is `__Secure-` rather than `__Host-`, and
`SameSite` is a defence in depth rather than the whole control.

Before enabling authentication, document and test the chosen framework's `state`
validation, origin protections, session-cookie behaviour and applicable CSRF controls.

## Accepted risks

1. **GitHub availability dependency.** A GitHub outage prevents administrator sign-in
   but does not prevent visitors from reading the public portfolio.

2. **Owner account loss.** Losing access to the GitHub account can lock the owner out of
   administration. `ADR-0003` recorded a lost _client secret_; this is a stronger risk,
   because the secret can be replaced while the account cannot be.

   **Mitigation:** a documented break-glass procedure restoring the authorized
   administrator record through the secured database administration process, with
   identity verification, backup and recovery precautions, and an audit trail. Do not
   implement an unauthenticated recovery endpoint.

3. **OAuth secret management.** The client secret must remain in deployment secret
   configuration, never in source control or application logs. A rotation procedure must
   be defined.

## Explicitly out of scope

- Multi-administrator management UI.
- Owner-only routes without a genuine domain requirement.
- Public registration.
- Custom password storage and recovery.
- Cookie-based API authentication.
- OAuth implementation, in this ADR-only change.
- Content deletion, preview, and additional content persistence models.

The missing delete route, preview workflow and non-`Experience` content models are
tracked as separate implementation requirements.

## Verification requirements for the future implementation

The implementation PR must test:

- OAuth `state` validation and callback errors.
- Token exchange failure.
- Disallowed numeric GitHub account IDs.
- Successful session issuance.
- Secure cookie attributes, and absence of JWT exposure to the browser.
- Session expiry, logout, revocation and `tokenVersion` changes.
- Unauthorized and forged-session requests.
- Actual authenticated API requests through the real application bootstrap.
- Applicable CSRF protections for admin routes and actions.

Tests that mint tokens directly with `jose` remain valuable for API authorization
coverage but do not prove that the OAuth sign-in flow works.

## Consequences

Administrator access becomes dependent on the owner's GitHub account and on GitHub's
availability. In exchange, this repository stores no administrator password and owns no
credential lifecycle, and the verified API authorization boundary is preserved unchanged.

The decision can be revisited if ownership, recovery or organizational requirements
change.
