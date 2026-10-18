# GOVERNANCE.md

Ownership, change authority, phase gates, and the exception process for
`me.palnadu.dev`. This document defines _who may decide what_; `AI_WORKFLOW.md`
defines _how changes are delivered_.

## 1. Ownership model

| Scope                                           | Owner            | Consulted                | Approval required              |
| ----------------------------------------------- | ---------------- | ------------------------ | ------------------------------ |
| Governance documents in this repository         | Repository owner | Any agent or contributor | Repository owner               |
| `packages/contracts`                            | Repository owner | All app owners           | Repository owner + API owner   |
| Domain content (experience, projects, articles) | Repository owner | —                        | Repository owner               |
| `packages/design-tokens`, `packages/ui`         | Repository owner | All app owners           | Repository owner               |
| `apps/web`                                      | Repository owner | —                        | Repository owner               |
| `apps/admin`                                    | Repository owner | API owner                | Repository owner               |
| `apps/api`                                      | Repository owner | —                        | Repository owner               |
| CI workflows and gate thresholds                | Repository owner | —                        | Repository owner               |
| Deployment environments and secrets             | Repository owner | —                        | Repository owner (sole holder) |

This is a single-owner repository. "Owner" means the account that holds the
production credentials and the GitHub admin role. Roles are listed to make authority
explicit for future contributors, not because multiple owners currently exist.

## 2. Change authority

1. **Nobody** may merge to `main` without a pull request that has passed every
   **required** gate in `CI_GATES.md`.
2. Only the owner may change required-gate thresholds, `SECURITY.md` allowlists, or
   the dependency direction in `ARCHITECTURE.md`.
3. An agent may propose changes to any file. An agent may **not** self-approve,
   bypass, or disable a gate to make a run pass.
4. Content writes to production databases are performed through the admin
   application by an authenticated administrator. Direct production data edits
   outside that flow require an owner-approved, documented procedure.

## 3. Phase gates

Work advances only when the exit criteria below are met. Each phase ends with a pull
request or an explicitly recorded blocker.

| Phase                   | Exit criteria                                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Repository discovery | Path, git state, remotes, structure, toolchain, and CI inventory verified with command output                                                            |
| 2. Governance and SSOT  | All governance documents exist, are internally consistent, and every control is labelled required or advisory with an enforcement status                 |
| 3. Architecture         | Dependency direction, package ownership, folder ownership, and import boundaries are documented and mechanically checkable                               |
| 4. CI/CD and security   | The 13 verification areas have workflow definitions; repo settings claimed as enforced are verified via the GitHub API                                   |
| 5. Quality baseline     | Required gates run locally and in CI; confirmed violations are fixed or documented as exceptions                                                         |
| 6. Implementation       | Each app built in dependency order (`contracts` → `design-tokens` → `ui` → `api` → `admin` → `web`) with tests at the layer defined in `TESTING.md`      |
| 7. Verification         | Automated suites, accessibility audit, responsive checks, SEO validation, security checks, and manual desktop/mobile verification complete with evidence |

**Hard entry rule:** Phase 6 may not begin until Phase 2 exits. Governance is not
retro-fitted.

## 4. Decisions and records

Architectural decisions are recorded as Architecture Decision Records in
`docs/adr/`:

```
docs/adr/0001-short-kebab-title.md
```

An ADR is required when a change:

- introduces or removes a runtime dependency,
- changes the dependency direction or a package boundary,
- changes the persistence model or content authority,
- changes the authentication or session model,
- changes a deployment target or environment topology.

ADR status values: `Proposed`, `Accepted`, `Superseded by ADR-NNNN`, `Rejected`.
An ADR may not be edited after `Accepted` to change its conclusion; supersede it.

## 5. Exception process

Exceptions are recorded, never implicit.

1. State the rule being broken (`AGENTS.md` §2/§3 or a document in the index table).
2. State the concrete requirement that makes the rule impossible to satisfy.
3. Describe the blast radius and the compensating control.
4. Add an entry to `docs/exceptions.md` with: rule reference, scope, justification,
   compensating control, owner, creation date, and **expiry review date**.
5. Link the exception from the file that violates it.

Exceptions expire. An exception older than its review date is treated as a defect and
raises a finding in gate 5. Maximum lifetime without re-approval: 90 days.

## 6. Enforcement status vocabulary

Because this repository currently contains specifications only, every control in these
documents carries one of these statuses. They may not be described informally.

| Status        | Meaning                                                                 |
| ------------- | ----------------------------------------------------------------------- |
| `SPECIFIED`   | Written down; no mechanical enforcement exists yet                      |
| `IMPLEMENTED` | Code or workflow exists; not yet proven by a passing run                |
| `ENFORCED`    | Proven by a cited run URL, API response, or reproducible command output |
| `BLOCKED`     | Cannot be implemented; blocker and recommendation recorded              |

Downgrading a status requires the same evidence as upgrading it. A status change is a
pull request that edits the control's status line and cites the evidence.

## 7. Enforcement ledger

Current truth for this repository, as of Phase 2:

| Area       | Control                                          | Status      | Evidence                          |
| ---------- | ------------------------------------------------ | ----------- | --------------------------------- |
| Structure  | Folder and package layout                        | `SPECIFIED` | `ARCHITECTURE.md` §2, §5          |
| SSOT       | Single definition of domain types and rules      | `SPECIFIED` | `SSOT_POLICY.md`                  |
| Boundaries | One-way dependency direction                     | `SPECIFIED` | `ARCHITECTURE.md` §3              |
| CI         | 13 verification areas                            | `SPECIFIED` | `CI_GATES.md`                     |
| PR policy  | Branch protection / required reviews             | `SPECIFIED` | `CI_GATES.md` area 12             |
| Deployment | Environments, secrets, rollback                  | `SPECIFIED` | `DEPLOYMENT_MAP.md`, `RUNBOOK.md` |
| Auth       | GitHub OAuth allowlist + server-side enforcement | `SPECIFIED` | `SECURITY.md` §4                  |

No control in this repository is `ENFORCED`. That statement becomes false only by
proof, and the proof is recorded here and in `CI_GATES.md`.
