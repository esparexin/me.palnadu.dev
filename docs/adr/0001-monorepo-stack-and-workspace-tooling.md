# ADR-0001 — Monorepo stack and workspace tooling

- **Status:** Accepted
- **Date:** 2026-10-18
- **Decision owner:** Repository owner

## Context

The project is a single portfolio site with three deployables (public web, admin, API)
and four shared packages. It must build three times, run many checks, and stay
consistent under a strict single-source-of-truth policy. The tooling choice determines
whether those guarantees are mechanically enforceable.

Requirements: strict TypeScript everywhere, one canonical place for schemas and tokens,
dependency direction that can be tested, and CI that runs the same way locally and in
GitHub Actions.

## Decision

Use **pnpm workspaces + Turborepo** as the monorepo, with:

| Concern     | Choice                                                                  |
| ----------- | ----------------------------------------------------------------------- |
| Public site | Next.js, App Router, TypeScript, Tailwind CSS                           |
| Admin       | Next.js, App Router, TypeScript, Tailwind CSS, `packages/ui` primitives |
| API         | NestJS, TypeScript                                                      |
| Persistence | MongoDB via Prisma (`ADR-0002`)                                         |
| Contracts   | Zod schemas in `packages/contracts` (`ADR-0003` for auth)               |
| Node        | 22 LTS, pinned in `.nvmrc`                                              |

Task orchestration runs through Turborepo with dependency-aware caching keyed on inputs
and the lockfile hash.

## Consequences

**Positive**

- One `pnpm install` produces a consistent tree; `--frozen-lockfile` is a real gate
  (`CI_GATES.md` area 9).
- The dependency graph is explicit in `pnpm-workspace.yaml` and checkable against the
  matrix in `ARCHITECTURE.md` §3.
- Identical local and CI task definitions, so "works on my machine" has a mechanical
  meaning.

**Negative**

- Four tools in the loop (pnpm, Turborepo, Next.js, NestJS) is a real learning and
  upgrade surface.
- Prisma's MongoDB connector is officially in preview; its capabilities must be
  verified against the features actually used (see `ADR-0002`).

## Alternatives considered

| Alternative                                                      | Why not                                                                                                                                                           |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm or Yarn workspaces                                           | No built-in strictness advantage; pnpm's isolated store and install-time scripts policy are a better fit for supply-chain control                                 |
| Nx                                                               | Stronger framework for large graphs; unnecessary for four packages, and its plugin machinery would add configuration to audit                                     |
| Single Next.js app with route handlers instead of a separate API | Fewer deployables, but it would collapse the authorization boundary and mix public rendering with administration logic; the task also mandates a separate backend |
| Separate repositories per app                                    | Breaks the SSOT: contracts, tokens, and UI could not be versioned together                                                                                        |

## References

`ARCHITECTURE.md`, `CI_GATES.md` areas 9 and 10, `TESTING.md` §1.
