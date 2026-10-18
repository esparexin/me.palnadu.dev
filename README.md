# me.palnadu.dev

Personal professional portfolio: public site, administration interface, and API, with
shared contracts and a design-token source of truth.

> **Status: Phase 2 — governance baseline complete. No application code exists yet.**
> Every control in this repository is specified and none is enforced. Nothing here may
> be reported as passing until a run or an API response proves it
> (`GOVERNANCE.md` §6).

## Read first

| Document | Governs |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Binding rules for any human or AI agent working here |
| [AI_WORKFLOW.md](AI_WORKFLOW.md) | Evidence Audit → Implementation → Manual Verification → PR → Merge → Cleanup |
| [GOVERNANCE.md](GOVERNANCE.md) | Ownership, phase gates, exceptions, enforcement vocabulary |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Apps, packages, dependency direction, folder ownership |
| [SSOT_POLICY.md](SSOT_POLICY.md) | Single source of truth for types, enums, rules, validation |
| [CODING_STANDARDS.md](CODING_STANDARDS.md) | TypeScript, naming, imports, errors, forbidden patterns |
| [UI_UX_STANDARDS.md](UI_UX_STANDARDS.md) | Design direction, tokens, WCAG 2.2 AA, interaction specs |
| [SECURITY.md](SECURITY.md) | Threat model, admin auth, session validation, secrets |
| [TESTING.md](TESTING.md) | Test layers, coverage floors, critical e2e journeys |
| [CI_GATES.md](CI_GATES.md) | The 13 verification areas and their enforcement state |
| [DEPLOYMENT_MAP.md](DEPLOYMENT_MAP.md) | Environments, domains, configuration keys, secrets |
| [RUNBOOK.md](RUNBOOK.md) | Release, verification, rollback, incident, content operations |
| [docs/adr/](docs/adr/) | Architecture decision records |
| [docs/exceptions.md](docs/exceptions.md) | Rule exceptions (currently none) |

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

## Current phase

| Phase | State |
| --- | --- |
| 1. Repository discovery | Complete — empty repository confirmed, nothing to reuse |
| 2. Governance and SSOT | **Complete** — documents, decisions, and gate definitions written |
| 3. Architecture and structure | Complete as specification; enforced once the tree exists |
| 4. CI/CD and security | Specified, not implemented |
| 5. Quality baseline | Not started |
| 6. Implementation | Not started |
| 7. Verification | Not started |

## Local setup

Not yet available — the workspace has no `package.json` and no dependencies. Toolchain
targets are recorded in [ADR-0001](docs/adr/0001-monorepo-stack-and-workspace-tooling.md):
Node 22 LTS (`.nvmrc`), pnpm 11, Turborepo.

## Working on this repository

Read [AGENTS.md](AGENTS.md) before changing anything. Work on a
`<type>/<kebab-case>` branch in small commits that follow Conventional Commits, and
open a pull request that contains evidence, not assertions. Breaking changes to
contracts need an ADR and a consumer update in the same pull request
([SSOT_POLICY.md](SSOT_POLICY.md) §3).