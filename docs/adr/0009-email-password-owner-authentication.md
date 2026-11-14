# ADR-0009 — Single-owner administrator authentication by email and password

- **Status:** Accepted
- **Date:** 2026-10-19
- **Decision owner:** Repository owner
- **Supersedes:** `ADR-0003` (GitHub OAuth with a database-backed allowlist) and `ADR-0008` (single-owner administrator authentication), both of which selected GitHub OAuth. Those ADRs are retained as history and are not deleted.
- **Phase:** 6F, authentication implementation

## Context

`ADR-0003` and `ADR-0008` both selected GitHub OAuth with a numeric account-id
allowlist, on the reasoning that delegating credential lifecycle, MFA and account
recovery to GitHub leaves this repository storing no password and owning no
credential code.

That reasoning was sound and is recorded here rather than discarded. This ADR changes
the decision anyway, at the owner’s direction, and the change is not free: it moves
credential storage, verification and recovery **into** this repository.

What is unchanged, and deliberately so:

- The API remains the sole database authority. No database access from `apps/admin` or
  `apps/web`.
- Database-backed session validation, revocation and `tokenVersion` are preserved.
- The bearer-only API boundary is unchanged. The browser never holds the API JWT.
- The 15-minute token lifetime and 8-hour maximum session age are retained.

## Decision

The owner authenticates with an email address and a password. There is no public
registration, no self-service account creation, and no user-management interface.

**No password is ever stored reversibly, printed, logged, seeded, or committed.**
Provisioning is an explicit server-side operation, never an HTTP endpoint.

## Why this was selected

Stated plainly, including what it costs:

- The owner does not want to couple administration access to a third-party account.
- The OAuth application, its secret, and its callback registration are external moving
  parts that this ADR removes.
- A single owner with one credential has a much smaller user-management problem than
  the designs `ADR-0003` was written for.

The cost is real and is accepted knowingly: this repository now owns password
storage, verification, lockout behaviour, recovery and — because GitHub’s two-factor
authentication is no longer in the path — **the entire burden of second-factor
protection sits with the password policy alone.** That is the single largest security
consequence of this decision and is recorded under _Accepted risks_.

## Password hashing

**Choice: scrypt via `node:crypto`.** Not Argon2id.

Argon2id is the preferred algorithm, and this ADR was written to use it. It cannot be
used here without a new dependency, for a verified reason:

| Fact                                                     | Evidence                                            |
| -------------------------------------------------------- | --------------------------------------------------- |
| `crypto.argon2` exists in the local runtime              | `node -v` → v26.10.0; `crypto.argon2Sync` resolves  |
| `crypto.argon2` **does not exist** on the pinned runtime | API added in Node 24.7.0; `.nvmrc` pins Node **22** |
| No Argon2 package is installed                           | `node_modules/.pnpm` contains no `argon*`           |

Using `crypto.argon2` would therefore **pass locally and fail in CI** — the exact class
of defect this repository’s gates exist to catch. Argon2id would require a native
dependency (`argon2` or `@node-rs/argon2`), which AGENTS.md §2.10 disfavours and which
introduces a compile step and a supply-chain surface for one function.

scrypt is memory-hard, is listed by OWASP as an acceptable password hashing function,
and ships in the runtime — no dependency, no native build, identical behaviour on every
supported Node.

Parameters, held next to the implementation so the two can be compared:

- `N = 2^16`, `r = 8`, `p = 1` (≈64 MiB per hash)
- 32-byte random salt per hash, 64-byte derived key
- Stored format encodes algorithm, parameters and salt, so parameters can be raised
  later and old hashes keep verifying
- Verification is constant-time via `timingSafeEqual`
- Hashing is asynchronous via `scrypt` so it never blocks the event loop

## Owner provisioning

Provisioning is a server-side command, never an HTTP route:

```
pnpm --filter @me-palnadu/api owner:provision -- --email <address>
```

- Requires `DATABASE_URL` and an interactive terminal.
- Reads the initial password from a hidden prompt; never a command-line argument,
  because arguments appear in shell history and process listings.
- Refuses to run if an owner already exists.
- Refuses a weak password against the same policy login enforces.
- Creates the administrator with `active: true` and `tokenVersion: 0`.

There is no unauthenticated owner-creation endpoint and no public registration. A
route that could create an administrator would be the largest hole this application
could have.

## Password policy

Enforced in `@me-palnadu/contracts` so the API and the admin form cannot disagree:

- minimum 12 characters, maximum 200
- at least one lowercase, one uppercase, and one digit
- rejected if it contains the email local-part
- compared against a small list of well-known breached passwords by exact match

Length is the dominant factor, so the minimum is set high rather than adding symbol
classes that mostly produce `Passw0rd!` variants.

## Login throttling and lockout

Reuses `@nestjs/throttler` (`ADR-0007`) with a third, stricter named throttler:

| Throttler | Limit       | Tracked by       |
| --------- | ----------- | ---------------- |
| `login`   | 10 / 15 min | client IP        |
| `public`  | 120 / min   | client IP        |
| `admin`   | 300 / min   | administrator id |

Login is throttled by address because the administrator is not authenticated yet, and
an address key is the only identifier available before credentials are checked.

Responses are **identical** for an unknown email and a wrong password: same status,
same message, same shape. The distinction is only ever recorded in the server log.
Distinguishable responses turn login into an account-enumeration oracle.

Deactivating the administrator (`active: false`) blocks sign-in **and** invalidates
existing sessions, because `AdminSessionGuard` re-reads the user on every request.

## Multi-factor authentication

**Deferred, with the risk recorded rather than implied absent-safe.**

With GitHub OAuth, two-factor authentication was inherited from GitHub. It is no longer
in the path. A password alone is now the whole of the second line of defence.

Compensating controls in place:

- a 12-character minimum with a breach-list check;
- scrypt at a memory-hard cost, making offline cracking expensive;
- login throttling at 10 attempts per 15 minutes per address;
- generic failure responses, removing the enumeration oracle;
- session revocation and `tokenVersion` for immediate lockout;
- database-backed `active` flag, independent of the credential.

**Residual risk:** credential stuffing and phishing are no longer mitigated by a second
factor. Time-based one-time passwords are the natural next control and are deliberately
**not** implemented here, because they require a new dependency, an enrolment and
recovery-code flow, and additional UI — a separate workstream with its own ADR. This
risk is accepted and must not be described as mitigated.

## Session lifecycle

Unchanged from `SECURITY.md` §4 and `ADR-0003`:

- 15-minute JWT lifetime
- 8-hour maximum session age
- per-session revocation through `AdminSession.revokedAt`
- global revocation through `AdminUser.tokenVersion`
- server-side validation on every protected request

**A password change increments `tokenVersion`**, invalidating every existing session
immediately. Keeping a password-valid session alive after the credential it came from
has changed is the behaviour that makes password change feel broken.

Logout sets `revokedAt` on the session and clears the browser cookie.

## Password recovery

**No public password-reset mechanism exists.** A reset endpoint is a remote
password-write primitive; shipping one without verified email delivery and a single-use
token lifecycle would be a worse outcome than having none.

Recovery is a controlled operator procedure:

1. Verify the requester’s identity out of band.
2. Run the provisioning command with `--reset-password`, which requires the
   administrator to be inactive or to confirm the current password.
3. The procedure increments `tokenVersion`, invalidating every existing session.

## Break-glass recovery

If the credential is lost and the owner cannot complete the procedure above, the
administrator record is restored directly through secured database administration
(`Atlas`), with identity verification, a recorded reason, and an `AuditLog` entry.

There is deliberately no unauthenticated recovery endpoint and no backdoor. Database
access is the recovery path, and it is audited.

## CSRF

Unchanged in principle and unchanged in implementation: the API accepts bearer tokens
only and CORS sets `credentials: false`, so browser credentials are never ambient there.

The admin application is cookie-authenticated and therefore **does** require CSRF
defences. Those are implemented with server actions and an origin check on every
mutating request, plus `SameSite=Lax` as defence in depth. `SameSite` alone is not
treated as the control.

## Accepted risks

1. **No second factor.** Recorded in full under _Multi-factor authentication_. This is
   the principal risk of this ADR.
2. **Password storage in the database.** Mitigated by scrypt, but a database
   compromise now yields password hashes that can be attacked offline. Under
   `ADR-0008` a compromise would have yielded session rows only.
3. **Recovery requires an operator.** A forgotten password cannot be self-served. This
   is a deliberate trade for not shipping a reset endpoint.
4. **Credential reuse.** A reused password elsewhere is now directly relevant, because
   the owner’s GitHub two-factor no longer stands between this login and that breach.
5. **Lockout is address-based.** A shared network address can throttle the legitimate
   owner. Accepted over per-account lockout, which permits denial of service against
   the single administrator.

## Consequences

This repository now owns password storage, verification, lockout, recovery and
break-glass. That is strictly more security surface than `ADR-0008`, chosen knowingly.

In exchange, administration no longer depends on a third-party account or an OAuth
application, and the only credential in the system is one the owner controls directly.

## Consequences for the schema

`AdminUser.githubId` and `AdminUser.login` are removed and replaced by `email` (unique)
and `passwordHash`. That is a destructive change and is recorded in `docs/exceptions.md`
as a reviewed exception with its own approval, per `ADR-0006`. No production database
is modified; the change is applied to local and ephemeral test databases only.
