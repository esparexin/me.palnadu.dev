# ADR-0007 — Rate limiting with `@nestjs/throttler` and in-memory storage

- **Status:** Accepted
- **Date:** 2026-10-19
- **Decision owner:** Repository owner
- **Amends:** `ADR-0001` (stack) — adds one runtime dependency; nothing else
- **Phase:** 6E, rate limiting

## Context

`SECURITY.md` §5 specifies rate limits — public reads 120/min per IP, contact
submission 5/hour per IP, admin writes 300/min per user — and names
`@nestjs/throttler` as the mechanism. None of it was implemented, and no control in
this repository may be called enforced without a test that observes it.

Two things had to be settled before writing code, because both are decisions rather
than implementation details.

**1. Is there a version compatible with Nest 12?** The repository pins exact versions
(`ADR-0001`, `ADR-0006`), and Nest was pinned at 12.1.3. Verified against the registry
on 2026-10-19:

| Fact                                                                      | Evidence                                      |
| ------------------------------------------------------------------------- | --------------------------------------------- |
| `@nestjs/throttler@latest` resolves to `6.7.1`                            | `npm view @nestjs/throttler version`          |
| It declares `@nestjs/core: ^7 \|\| ^8 \|\| ^9 \|\| ^10 \|\| ^11 \|\| ^12` | `npm view @nestjs/throttler peerDependencies` |
| Same range for `@nestjs/common`                                           | same command                                  |
| The repository has no known vulnerabilities today                         | `pnpm audit --audit-level high` → none        |

The declared range covers the pinned 12.1.3, so no version conflict exists. Pinned to
exactly `6.7.1`, consistent with every other dependency here.

**2. Where do counters live?** `SECURITY.md` §5 already states the limitation and the
reason: in-memory per instance, limits are per instance, horizontal scaling weakens
them, and the API is therefore pinned to a single instance with that rationale
documented.

## Decision

Use `@nestjs/throttler@6.7.1`, pinned exactly, with in-memory storage.

Two named throttlers rather than one global limit, because the limits differ by two
orders of magnitude and by what identifies the caller:

| Throttler | Limit                 | Tracked by        | Applies to                          |
| --------- | --------------------- | ----------------- | ----------------------------------- |
| `public`  | 120 requests / minute | client IP address | `@Public()` reads                   |
| `admin`   | 300 requests / minute | administrator id  | authenticated administrative writes |

Tracking administrative writes by administrator rather than by IP is the point of the
split: the limit's purpose is to bound one account's activity, and several requests
from one administrator behind one address is the case worth bounding.

The `admin` throttler depends on `request.admin`, which `AdminSessionGuard` resolves
from the database. The guard runs first, so the identifier exists; throttlers that run
before it would have nothing to key on.

## Consequences

- **The limits are per instance.** Documented in `SECURITY.md` §5 and unchanged here.
  Moving to a shared store requires an ADR, because it changes the deployment
  assumption the single-instance pin rests on.
- **Counters reset on restart.** Accepted: a restart is an operator action, and the
  failure mode is a brief window of unthrottled traffic, not a permanently broken
  limiter.
- **In-memory storage keeps the limiter in the same process**, so a limiter failure
  cannot present as a dependency outage.
- **The dependency is justified**: it implements exactly the documented limits against
  Nest's own guard pipeline, and the alternative — a hand-rolled counter — would mean
  re-implementing IP attribution and a time window, which is more code to audit and
  less trustworthy than the maintained package.

## Alternatives considered

| Alternative                          | Why rejected                                                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Hand-rolled in-memory limiter        | More code to audit; IP attribution and time windows re-implemented by hand                                           |
| Redis or another shared store        | Unnecessary at the documented single instance; adds an operational dependency for a portfolio with one administrator |
| Rate limiting at the platform or CDN | Cannot distinguish administrator writes from public reads, and adds an external control this repository cannot test  |
| One global limit                     | Cannot express two limits that differ by 150x and by identifier                                                      |

## Verification

The control is not called enforced on the strength of this ADR. It is enforced when a
test observes a real request being refused with `429 RATE_LIMITED` after the
documented number of requests, and fails when the throttler is removed. See
`SECURITY.md` §9.5.
