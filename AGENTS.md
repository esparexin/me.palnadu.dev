# AGENTS.md — me.palnadu.dev

Binding rules for every human and AI agent (IDE, CLI, or review bot) working in this
repository. If an instruction here conflicts with convenience, the instruction wins.

**Status of this repository at the time of writing:** governance baseline only. No
application code, dependencies, or CI workflows exist yet. Every control described in
these documents is **specified, not enforced**. Enforcement evidence is tracked in
`CI_GATES.md` and may only be claimed by running the gate and citing the run URL.

## 1. Read before you change anything

| Document | Governs |
| --- | --- |
| `GOVERNANCE.md` | Ownership, change authority, phase gates, exceptions |
| `AI_WORKFLOW.md` | Mandatory delivery workflow, branches, commits, PR rules |
| `ARCHITECTURE.md` | Apps, packages, dependency direction, folder ownership |
| `SSOT_POLICY.md` | Single source of truth for types, enums, rules, validation |
| `CODING_STANDARDS.md` | TypeScript, naming, imports, errors, no-bans |
| `UI_UX_STANDARDS.md` | Design tokens, accessibility, interaction specs |
| `SECURITY.md` | Threat model, admin auth, session design, secret handling |
| `TESTING.md` | Test layers, coverage floors, what must pass |
| `CI_GATES.md` | The 13 verification areas and their enforcement state |
| `DEPLOYMENT_MAP.md` / `RUNBOOK.md` | Environments, secrets, deploy and rollback |

## 2. Non-negotiable rules

1. **`packages/contracts` is the only source of shared truth.** Domain types, enums,
   validation schemas, error codes, and pagination shapes are defined exactly once,
   there. Everything else consumes them.
2. **Never duplicate** a domain type, enum, business rule, calculation, API contract,
   or validation schema in a second app or package. Duplication is a defect.
3. **Dependency direction is one-way** (see `ARCHITECTURE.md` §3). No cycles. No
   `web → admin`, `web → api`, or `admin → api` source imports. Apps integrate only
   over HTTP and shared packages.
4. **Design tokens live in `packages/design-tokens` only.** No app-level or
   component-level color, font, spacing, radius, or shadow literals. Tailwind theme
   extension is allowed; Tailwind theme *additions of new primitives* are not.
5. **Validation happens at the API boundary using contracts schemas.** Client-side
   validation is a UX affordance only and is never trusted.
6. **Authorization is server-side, always.** Hiding a button is not access control. Every
   protected API operation re-checks identity and role.
7. **No secret ever enters the repository**, including in docs, examples, fixtures, or
   commit messages. `.env.example` documents keys; values live in provider secret
   stores only.
8. **Do not weaken a gate to get green.** No skipped tests, no lowered thresholds, no
   `continue-on-error`, no `|| true`, no swallowed non-zero exits.
9. **No unverified claims.** Do not state that a test passed, a check is enforced, a
   deploy happened, or branch protection is active without citing the run, the API
   response, or the command output that proves it.
10. **Prefer deletion over accumulation.** Do not add a dependency, abstraction, config
    file, or wrapper unless a concrete requirement in this repository needs it. Every
    addition must justify itself in the PR description.

## 3. Hard bans

Source-level bans, enforced by lint rules and gate 1 / gate 10:

- Raw palette utilities (`slate-*`, `gray-*`, `zinc-*`, `red-*`, `emerald-*`,
  `blue-*`, `purple-*`) and arbitrary color values (`bg-[#...]`, `text-[#...]`,
  `style={{ color: '#...' }}`). Use tokens.
- Arbitrary spacing/typography/radius/shadow escapes (`p-[13px]`, `text-[11px]`,
  `rounded-[7px]`, `shadow-[...]`) where a token exists. `text-[11px]` is banned
  outright — it is not accessible at any viewport.
- `!important` and inline `style` for visual values (exceptions documented in
  `UI_UX_STANDARDS.md` §7).
- Raw `<input>`, `<select>`, `<textarea>`, `<button>` in `apps/admin` — use
  `packages/ui` primitives.
- `any`, `@ts-ignore`, `@ts-expect-error` without a linked issue and an adjacent
  comment justifying the cast.
- `console.log` in shipped application code (scripts and CLI tools may use it).
- Direct `fetch` to the database, or Prisma/Mongo imports outside `apps/api`.
- Client-side secret handling: no `NEXT_PUBLIC_*` value may hold a non-public value.
  Every `NEXT_PUBLIC_` key is treated as public and is reviewed accordingly.

## 4. Content integrity

Career history, projects, skills, resume data, and Knowledge Hub articles are
professional claims.

- **Never invent** employers, job titles, employment dates, certifications,
  achievements, clients, or metrics.
- Unverified material is seeded as `draft` and stays draft until reviewed.
- Seed content in `content/` is **approved reference material**, never a second live
  content store. The database is the single source of truth for published content.

## 5. Definition of done for any change

A change is done only when:

1. It complies with `SSOT_POLICY.md` and `ARCHITECTURE.md` (no new duplication, no
   boundary crossing).
2. Its behavior is covered by a test at the layer defined in `TESTING.md`.
3. Lint, typecheck, build, and tests pass locally, with the output pasted in the PR.
4. Documentation is updated if behavior, contracts, or standards changed.
5. UI changes satisfy `UI_UX_STANDARDS.md`, including keyboard and reduced-motion paths.
6. Security-relevant changes update `SECURITY.md` and are reviewed explicitly.

## 6. Escalation

Stop work and report instead of guessing when: a required decision is missing (domain,
callback URLs, subdomain names), a security control cannot meet its requirement, an
approved dependency has no safe current version, or a requested change would violate
Sections 2–4. Report the evidence, the blocker, and the recommended resolution.