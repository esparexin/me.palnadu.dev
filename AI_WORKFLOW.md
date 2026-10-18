# AI_WORKFLOW.md

The mandatory delivery workflow for humans and AI agents. Work that skips a step is
rejected at review, regardless of how small the change is.

## 1. The chain

```
Evidence Audit → Implementation → Manual Verification Gate → Pull Request
      → Merge → Branch Cleanup → Trunk Sync
```

| Step                     | Owner | Requirement                                                                      |
| ------------------------ | ----- | -------------------------------------------------------------------------------- |
| Evidence Audit           | Agent | State what exists today with command output. No claims from memory or assumption |
| Implementation           | Agent | Small, auditable commits on a dedicated branch                                   |
| Manual Verification Gate | Agent | Exercise the change as a user; record what was done and observed                 |
| Pull Request             | Agent | Descriptive title, summary, evidence, risks, rollback                            |
| Merge                    | Owner | Only when every required gate in `CI_GATES.md` passed on the PR head commit      |
| Branch Cleanup           | Agent | `git branch -d` merged branches locally; delete the remote branch                |
| Trunk Sync               | Agent | Local `main` matches `origin/main`; no stale feature branches remain             |

**Branch naming:** `<type>/<kebab-case-description>` where `type` is one of `feat`,
`fix`, `docs`, `refactor`, `test`, `ci`, `chore`, `perf`, `build`.

**Never** commit directly to `main`. The one exception is a repository owner
performing a documented emergency change, which requires a written justification in
the commit body.

## 2. Commit conventions

Format: Conventional Commits 1.0.0.

```
<type>(<scope>): <imperative summary under 72 chars>

<why the change is needed, and what it deliberately does not do>

Refs: <document or gate reference>
```

| Scope           | Use for                                    |
| --------------- | ------------------------------------------ |
| `contracts`     | `packages/contracts` schemas, types, enums |
| `design-tokens` | `packages/design-tokens`                   |
| `ui`            | `packages/ui`                              |
| `shared`        | `packages/shared`                          |
| `web`           | `apps/web`                                 |
| `admin`         | `apps/admin`                               |
| `api`           | `apps/api`                                 |
| `ci`            | GitHub Actions and gate scripts            |
| `docs`          | Governance and documentation               |

Rules:

1. **One logical change per commit.** A refactor and a feature change in one commit
   is rejected; the reviewer cannot verify intent.
2. **No `--amend` on shared branches** and no force-push to `main`. If a commit is
   wrong, add a fix commit; the history is the audit trail.
3. **No secrets in messages**, including partial values, tokens, or credential
   identifiers that would reduce an attacker's search space.
4. Generated output, build artefacts, and lockfile churn caused by an unrelated
   upgrade must not ride along with a feature commit.
5. A commit that changes behaviour without changing or adding a test violates
   `TESTING.md` unless the PR description states why no test is applicable.

## 3. Evidence Audit requirements

Before implementing, the agent must produce and paste:

- `git status`, `git log --oneline`, current branch, and remotes,
- the file inventory of every path it intends to modify,
- the current enforcement state of any control it intends to rely on.

If the audit reveals a contradiction between a requirement and the repository (for
example, a workflow that does not exist but is assumed enforced), the agent reports
the contradiction and stops rather than working around it.

## 4. Manual Verification Gate

Automated suites do not replace this step. The agent must:

1. Run the changed surface manually (dev server or deployed preview).
2. Exercise the **keyboard-only** path and the **reduced-motion** path for any UI
   change (`UI_UX_STANDARDS.md` §6).
3. Exercise the **mobile** path for responsive changes, including the floating menu
   open, outside-tap close, navigation close, and `Escape` close.
4. For API changes, call the endpoint and paste the real response, including the
   error response for an unauthorized actor.
5. Record the exact commands or URLs used and what was observed, including what was
   **not** verified.

A verification section that lists only what passed is incomplete. If something could
not be verified, say so.

## 5. Pull Request requirements

Every PR must contain:

- **Title:** Conventional Commit format.
- **Summary:** what changed and why, in plain language.
- **Scope:** files and packages touched; new dependencies with justification.
- **Evidence:** pasted local command output for lint, typecheck, build, and tests.
- **Manual verification:** what was exercised and observed.
- **Governance impact:** which documents changed and which rules were applied.
- **Risks and rollback:** what could break, and the exact way back.
- **Not done:** anything intentionally deferred, and where it is tracked.

## 6. Prohibited agent actions

An agent must never:

- mark a gate as passing, a deploy as done, or a control as `ENFORCED` without cited
  evidence,
- edit a CI workflow to skip, ignore, or neutralize a failing check in the same PR
  that introduces the failure,
- lower a coverage threshold, add `continue-on-error`, append `|| true`, or convert a
  failing exit code into a warning,
- disable or delete a test to make a suite pass,
- write production data directly to the production database outside the admin flow,
- create or modify secrets, or print secret values into CI logs,
- deploy to a production environment without an owner request recorded in the issue or
  PR that requests it,
- invent professional content (see `AGENTS.md` §4).

## 7. Dependency-aware ordering

Changes are delivered in dependency order so that the tree is always buildable:

```
packages/contracts → packages/design-tokens → packages/shared → packages/ui
→ apps/api → apps/admin → apps/web
```

A PR that depends on an unmerged upstream change must either be stacked and labelled
as such, or be held. It may not reach `main` in a broken state.
