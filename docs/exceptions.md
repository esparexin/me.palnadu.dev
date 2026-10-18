# Exception registry

Exceptions to the rules in `AGENTS.md`, `ARCHITECTURE.md`, `SSOT_POLICY.md`,
`CODING_STANDARDS.md`, `UI_UX_STANDARDS.md`, and `CI_GATES.md` are recorded here
(`GOVERNANCE.md` §5). An exception that is not in this file does not exist.

**Current exceptions: 1 (consumed)** — `EXC-0001`, the bootstrap merge of the governance baseline with no automated gates. It expires at the first merge that lands after `CI_GATES.md` area 1 is implemented.

## Rules

1. Every entry names the rule reference, the exact files or job names in scope, the
   concrete requirement that made the rule unsatisfiable, the compensating control, the
   owner, the creation date, and a **review date**.
2. The file that violates the rule links back to its entry here.
3. An exception past its review date is treated as a defect and raises a finding in
   gate 5. Maximum lifetime without re-approval: 90 days.
4. Exceptions are never granted for security controls (authentication, authorization,
   validation, secret handling). Those are fixed, not excepted.

## Entries

### EXC-0001 — Bootstrap merge of the governance baseline with no automated gates

| Field                | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rule                 | `AI_WORKFLOW.md` §1 (merge only when every required gate in `CI_GATES.md` passed on the PR head commit) and `GOVERNANCE.md` §2 item 1 (no merge without required gates passing)                                                                                                                                                                                                                                                                                                                 |
| Scope                | PR #1, `chore/governance-baseline` → `main`. Documentation only. Expires at the first merge that lands after `CI_GATES.md` area 1 is implemented                                                                                                                                                                                                                                                                                                                                                |
| Requirement          | The gates do not exist yet. `gh api repos/esparexin/me.palnadu.dev/actions/workflows` → `total_count: 0`, and `CI_GATES.md` labels all 13 areas `SPECIFIED`. Requiring gates that have not been written would deadlock the repository permanently                                                                                                                                                                                                                                               |
| Justification        | The repository has exactly one commit (an auto-generated README). The change adds no runtime, no schema, no dependency, and no data. Deferring the merge would mean implementing Phase 3 on top of an unmerged governance baseline, which `GOVERNANCE.md` §3 forbids in the other direction                                                                                                                                                                                                     |
| Compensating control | Full mechanical review performed on the PR head commit and its output cited in the PR: 72 section citations checked with 0 broken, 14 required-check names verified unique and mapped to areas 1–7 and 9–11, 21 changed files confirmed to contain no non-governance change, domain decisions verified against DNS, and every document checked for unqualified enforcement claims. Branch protection is separately recorded as unenforced in `CI_GATES.md` area 12 and `DEPLOYMENT_MAP.md` §7.2 |
| Owner                | Repository owner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Created              | 2026-10-18                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Review by            | 2026-10-25, or on implementation of `CI_GATES.md` area 1, whichever is sooner                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Status               | consumed - the Phase 3 pull request implements areas 1-7 and 9-11, so the next merge is subject to them                                                                                                                                                                                                                                                                                                                                                                                         |

This exception covers the merge of the governance baseline only. It is not precedent:
the very next merge must satisfy the gates, and area 12's ruleset must exist before any
further unprotected merge to `main`.

## Entry template

```markdown
### EXC-0001 — <short title>

| Field                | Value                                                 |
| -------------------- | ----------------------------------------------------- |
| Rule                 | `ARCHITECTURE.md` §3 (import matrix)                  |
| Scope                | `apps/web/src/lib/api.ts` (named files only)          |
| Requirement          | <what made the rule unsatisfiable>                    |
| Justification        | <why the exception is correct, not merely convenient> |
| Compensating control | <what limits the blast radius>                        |
| Owner                | Repository owner                                      |
| Created              | YYYY-MM-DD                                            |
| Review by            | YYYY-MM-DD                                            |
| Status               | active / resolved                                     |
```
