# me.palnadu.dev

Personal professional portfolio: public site, administration interface, and API, with
shared contracts and a design-token source of truth.

> **Status: Phase 3 — workspace scaffolded and gated; content arrives next.**
> The monorepo, shared contracts, design tokens, UI primitives, and the three apps now
> exist and build. Ten local gates pass, and the corresponding GitHub Actions workflows
> are written but **not yet proven by a run**, so no control is `ENFORCED`
> (`GOVERNANCE.md` §6). `main` has no branch protection.

## Read first

| Document                                   | Governs                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| [AGENTS.md](AGENTS.md)                     | Binding rules for any human or AI agent working here                         |
| [AI_WORKFLOW.md](AI_WORKFLOW.md)           | Evidence Audit → Implementation → Manual Verification → PR → Merge → Cleanup |
| [GOVERNANCE.md](GOVERNANCE.md)             | Ownership, phase gates, exceptions, enforcement vocabulary                   |
| [ARCHITECTURE.md](ARCHITECTURE.md)         | Apps, packages, dependency direction, folder ownership                       |
| [SSOT_POLICY.md](SSOT_POLICY.md)           | Single source of truth for types, enums, rules, validation                   |
| [CODING_STANDARDS.md](CODING_STANDARDS.md) | TypeScript, naming, imports, errors, forbidden patterns                      |
| [UI_UX_STANDARDS.md](UI_UX_STANDARDS.md)   | Design direction, tokens, WCAG 2.2 AA, interaction specs                     |
| [SECURITY.md](SECURITY.md)                 | Threat model, admin auth, session validation, secrets                        |
| [TESTING.md](TESTING.md)                   | Test layers, coverage floors, critical e2e journeys                          |
| [CI_GATES.md](CI_GATES.md)                 | The 13 verification areas and their enforcement state                        |
| [DEPLOYMENT_MAP.md](DEPLOYMENT_MAP.md)     | Environments, domains, configuration keys, secrets                           |
| [RUNBOOK.md](RUNBOOK.md)                   | Release, verification, rollback, incident, content operations                |
| [docs/adr/](docs/adr/)                     | Architecture decision records                                                |
| [docs/exceptions.md](docs/exceptions.md)   | Rule exceptions (currently none)                                             |

## Target architecture

```
apps/web         public portfolio — hero CTAs, career timeline, projects, resume, Knowledge Hub
apps/admin       administration — experience, projects, skills, resume, knowledge, messages, audit
apps/api         NestJS — the only authority for validation, authorization, and persistence

packages/contracts       Zod schemas, domain types, enums, error codes, API paths  (SSOT)
packages/design-tokens  colour, type, spacing, radius, elevation, motion, breakpoints
packages/ui             accessible React primitives shared by both apps
packages/shared         framework-free calculations and comparators

content/                 approved seed content and reference material (never a live store)
scripts/ tests/          gate scripts and cross-cutting suites
```

Dependencies flow one way: apps → `ui` → `design-tokens`, and everything →
`contracts`. No app imports another app's source; they integrate over HTTP only
(`ARCHITECTURE.md` §3).

## Design direction

White background, minimal, generous whitespace, system font stack, one accent colour,
short optional motion, WCAG 2.2 AA. Required interactions: **View Resume** and
**Explore Experience** hero CTAs; a floating menu fixed at the right-centre of mobile
screens closing on outside tap, navigation selection, its close control, and `Escape`; a
horizontal desktop timeline with hover previews and an independently scrollable popup;
and a mobile swipe slider where swipe-up moves to newer experience and swipe-down to
earlier, with visible navigation controls. Full specification in
[UI_UX_STANDARDS.md](UI_UX_STANDARDS.md) §7.

| #   | Gate                          | Command                                        | Local result                      |
| --- | ----------------------------- | ---------------------------------------------- | --------------------------------- |
| 1   | Lint and formatting           | `pnpm lint`, `prettier --check`                | pass                              |
| 2   | Type safety                   | `pnpm typecheck`                               | pass                              |
| 3   | Production build              | `pnpm build`                                   | pass, 7 workspaces                |
| 4   | Unit, contract, e2e, a11y     | `pnpm test`, `pnpm test:e2e`, `pnpm test:a11y` | 67 unit/contract, 28 e2e, 14 a11y |
| 5   | Governance and documentation  | `pnpm run check:docs`                          | pass                              |
| 6   | Secrets and workflow security | `pnpm run check:secrets`, `check:workflows`    | pass                              |
| 7   | Dependency and licence audit  | `pnpm audit --audit-level high`                | CI only, not yet run              |
| 9   | Workspace and lockfile        | `pnpm install --frozen-lockfile`               | pass                              |
| 10  | Boundaries and cycles         | `pnpm run check:boundaries`                    | pass                              |
| 11  | Pipeline integrity            | `pnpm run check:ci`                            | pass                              |

Run everything with `pnpm verify`, which exits non-zero on the first failing gate.

## Current phase

| Phase                         | State                                                             |
| ----------------------------- | ----------------------------------------------------------------- |
| 1. Repository discovery       | Complete — empty repository confirmed, nothing to reuse           |
| 2. Governance and SSOT        | Complete and merged                                               |
| 3. Architecture and structure | Complete — workspace, packages, apps, and toolchain exist         |
| 4. CI/CD and security         | Workflows written; awaiting first run and ruleset creation        |
| 5. Quality baseline           | Partly done — Knip and jscpd run by hand during Phase 5           |
| 6. Implementation             | Not started — content, timeline, and admin authoring              |
| 7. Verification               | Partly done — e2e and a11y run locally; manual gate still pending |

## Local setup

Requires Node >= 22.12 and pnpm 11.

```bash
pnpm install --frozen-lockfile
pnpm verify            # every gate; exits non-zero on the first failure
pnpm dev               # all apps in dependency order
pnpm test:e2e          # critical journeys against a production build
```

Copy `.env.example` to `.env` for local API runs. The API starts without a database
and reports `degraded` on readiness until `DATABASE_URL` is set, which is why a
half-configured environment fails visibly instead of silently.

## Working on this repository

Read [AGENTS.md](AGENTS.md) before changing anything. Work on a
`<type>/<kebab-case>` branch in small commits that follow Conventional Commits, and
open a pull request that contains evidence, not assertions. Breaking changes to
contracts need an ADR and a consumer update in the same pull request
([SSOT_POLICY.md](SSOT_POLICY.md) §3).
