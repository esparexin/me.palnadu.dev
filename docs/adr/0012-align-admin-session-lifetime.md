# ADR-0012 — Align the administrator token lifetime with the session ceiling

- **Status:** Accepted
- **Date:** 2026-10-19
- **Decision owner:** Repository owner
- **Related:** `ADR-0009` (email and password owner authentication), `ADR-0011` (FAQ removal)
- **Phase:** Post-audit remediation

## Context

`ADR-0009` retained a 15-minute access token and an 8-hour server-side session. The
admin application stores the token only in an `HttpOnly` cookie, and there is no
refresh route. As a result the token expired every 15 minutes while the cookie and
the `AdminSession` row remained valid for 8 hours. The administrator was silently
signed out mid-task and had to sign in again, even though the session the API still
held had not been revoked.

The audit also found that the admin server treated an API `403` (a deactivated
account) as an outage. That surfaced an error boundary instead of signing the
administrator out, and the rejected cookie was never cleared because a Server
Component cannot mutate cookies during render.

## Decision

1. Set `SESSION_LIFETIME_SECONDS` to 8 hours and make `SESSION_MAX_AGE_SECONDS`
   equal it. The JWT, the cookie `maxAge`, and the `AdminSession.expiresAt` value
   therefore describe the same absolute ceiling.
2. Do not add a refresh route and do not implement sliding expiry. A session begins
   at sign-in and ends at the 8-hour ceiling, at logout, on revocation, on a token
   version change, or when the account is deactivated.
3. Treat API `401` and `403` as signed out in the admin server. Route rejected
   dashboard traffic through `/api/session/expired`, a Route Handler that clears the
   session cookies and redirects to `/login` with a sanitized return path.
4. Keep the API's per-request database check. A token that is still within its
   lifetime is never sufficient on its own: the user, session, revocation state,
   expiry, and token version are re-read for every protected request.

## Consequences

- The administrator can work for the full session lifetime without a broken
  re-authentication loop.
- A stolen token now has up to 8 hours of nominal validity instead of 15 minutes.
  Revocation and deactivation still take effect on the next API request, and the
  cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` in production. This trade-off is
  accepted for a single-owner administration tool with no refresh mechanism.
- The session is an absolute ceiling, not an idle timeout. An unattended browser
  remains signed in until the ceiling is reached unless the operator signs out.
- The login API's `expiresInSeconds` now reports 28,800 seconds.

## Alternatives considered

- **Add a refresh endpoint and rotate tokens.** This would preserve a short access
  token, but it needs a refresh credential, rotation rules, replay handling, and more
  tests. The additional attack surface is not justified before a concrete requirement
  exists.
- **Keep 15 minutes and silently re-issue on activity.** This is a hidden sliding
  session with no revocable refresh artefact and no clear ceiling in the UI.
- **Raise only the cookie lifetime.** That was the original defect: it left three
  components disagreeing about when the session ends.

## Supersedes

This ADR supersedes the 15-minute access-lifetime decision and the success-flow
wording in `ADR-0009` §4.2–4.3. The authentication method, password hashing, session
storage, and revocation model in `ADR-0009` remain accepted.
