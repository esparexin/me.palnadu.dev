# CI_GATES.md

The 13 verification areas, each with a purpose, a trigger, a classification, the
mechanism that will implement it, the evidence it produces, and what to do when it
fails.

**Enforcement status: areas 1-7 and 9-11 are `ENFORCED`.**

Evidence: run [`39153866220`](https://github.com/esparexin/me.palnadu.dev/actions/runs/39153866220) on pull request #3, 14 of 14 checks green, head
commit `HEAD` of `feat/phase-3-workspace-scaffold`. Each gate below was run from that
workflow on a clean checkout with no cached build output.

Area 8 remains `SPECIFIED` (installed, run by hand during Phase 5, not wired into a
workflow). Areas 12 and 13 are External: their enforcement depends on a GitHub ruleset
and on provisioned providers, and is recorded in §12 and in `DEPLOYMENT_MAP.md` §7.2
rather than claimed here.

## 1. Classification vocabulary

| Class        | Meaning                                                                                         |
| ------------ | ----------------------------------------------------------------------------------------------- |
| **Required** | Blocks merge. A failure must be fixed or removed by ADR, never suppressed                       |
| **Advisory** | Reported, does not block. Promoted to required only per §4                                      |
| **External** | Cannot be a workflow gate — a repository or provider setting. Verified by API and recorded here |

Classification is evidence-based, not optimistic. A check is required only if it is
deterministic, has a stable interface, and fails for a real defect rather than for
environmental noise. Until a check has demonstrated that across several runs, it starts
advisory.

## 2. The 13 areas

### Area 1 — Linting, formatting, and coding conventions

- **Class:** Required
- **Trigger:** pull request, push to `main`
- **Job:** `lint`
- **Mechanism:** ESLint flat config with the banned-pattern rules from
  `CODING_STANDARDS.md` §7 and `AGENTS.md` §3, plus Prettier in check mode.
- **Runs:** format check → lint → type-aware lint.
- **Evidence:** job conclusion; the failing rule id and file:line in the log.
- **Status:** `ENFORCED` in run 39153866220 (job `lint`).
- **On failure:** fix the code. A new suppression requires an inline justification and
  an issue link; a rule deletion requires an ADR.

### Area 2 — TypeScript type safety

- **Class:** Required
- **Job:** `typecheck`
- **Mechanism:** `tsc --noEmit` per workspace under the strict options in
  `CODING_STANDARDS.md` §1, plus the architecture flags; `turbo run typecheck`.
- **Also checks:** no `any` in emitted sources, no `@ts-ignore`, no unresolved import.
- **Evidence:** per-package exit codes.
- **Status:** `ENFORCED` in run 39153866220 (job `typecheck`).
- **On failure:** no `@ts-expect-error` to make it pass.

### Area 3 — Production build integrity

- **Class:** Required
- **Job:** `build`
- **Mechanism:** `pnpm install --frozen-lockfile`, generate the Prisma client, then
  `turbo build` — `next build` for both apps (no dev shortcuts, no skipped type or lint
  steps inside the build) and `nest build` for the API. Production-only warnings are
  errors.
- **Also checks:** no `.env` present in the build, no source map leakage of secrets,
  bundle-size budget from `TESTING.md` §9.
- **Evidence:** build log; artefact digest recorded by the release workflow.
- **Status:** `ENFORCED` in run 39153866220 (job `build`).

### Area 4 — Unit, integration, and critical end-to-end tests

- **Class:** Required
- **Jobs:** `test`, `e2e`, `a11y`
- **Mechanism:** `test` runs unit, contract, and integration suites with coverage
  against the floors in `TESTING.md` §2 and fails if a floor is missed. `e2e` runs the
  Playwright journeys in `TESTING.md` §7 against a production build with seeded data.
  `a11y` runs axe-core over the routes listed in `TESTING.md` §7 and fails on any
  serious or critical violation.
- **Dependency:** needs a reachable test database; Atlas development cluster or a CI
  service container. If the database is unavailable the job fails — it does not skip.
- **Evidence:** JUnit and Playwright HTML reports uploaded as artefacts; test count and
  coverage summary.
- **Status:** `ENFORCED` in run 39153866220 (jobs `test`, `e2e`, `a11y`).
- **On failure:** a new failing test is fixed or the gate is redefined by ADR.

### Area 5 — Governance, documentation, and architecture compliance

- **Class:** Required
- **Job:** `governance`
- **Mechanism:** a script that verifies
  1. every document in the `AGENTS.md` §1 index exists and is non-empty,
  2. every ADR referenced by code or docs exists,
  3. `docs/exceptions.md` has no entry past its review date,
  4. the repository tree matches the layout in `ARCHITECTURE.md` §2 — no unknown
     top-level directory, no missing required one,
  5. no `SPECIFIED` control is described elsewhere as `ENFORCED`,
  6. `CI_GATES.md` job names match the workflows (the inventory test in
     `TESTING.md` §6).
- **Evidence:** script output listing each check.
- **Status:** `ENFORCED` in run 39153866220 (job `governance`).
- **On failure:** add the missing document, or correct the claim that is out of date.

### Area 6 — Secret scanning and workflow security

- **Class:** Required
- **Jobs:** `secrets`, `workflow-security`, plus `codeql`
- **Status:** `ENFORCED` in run 39153866220 (job `secrets`). Implemented by
  `scripts/scan-secrets.mjs` rather than gitleaks; its allowlist is the `ALLOW` array in
  that script rather than a separate file, which is a deviation from the mechanism
  above recorded here rather than silently.
- **Mechanism:**
  - `secrets`: history-inclusive secret scan (gitleaks or equivalent) over the full
    history and the current tree, with a documented allowlist file that itself is
    reviewed.
  - `workflow-security`: `actionlint` for syntax, and `zizmor` for GitHub Actions
    security findings (template injection, unpinned actions, excessive permissions,
    `pull_request_target` misuse).
  - `codeql`: CodeQL analysis for JavaScript/TypeScript on push to `main`, on pull
    requests, and weekly.
- **Evidence:** scan reports; CodeQL alert count.
- **Status:** `ENFORCED` in run 39153866220 (jobs `secrets`, `codeql`).
- **On failure:** rotate the secret first, then remove it (see `SECURITY.md` §7). A
  suppressed workflow finding needs an inline justification.

### Area 7 — Dependency vulnerability and license audits

- **Class:** Required for vulnerabilities, Advisory for license policy
- **Job:** `dependency-audit`
- **Mechanism:** `pnpm audit` with an explicit severity threshold, evaluated against the
  lockfile rather than the registry's floating state; `dependency-review` on pull
  requests to reject newly introduced packages with known vulnerabilities; license
  allowlist check for every direct dependency.
- **Severity policy:** critical or high ⇒ block. Medium ⇒ advisory with a tracked issue
  and a fix-or-mitigate date. Low ⇒ advisory.
- **License policy:** permissive licences only. Unknown, source-available, or
  copyleft dependencies are advisory initially and become blocking once the dependency
  set is stable.
- **Evidence:** JSON audit report uploaded; a summary in the job output.
- **Status:** `ENFORCED` in run 39153866220 (job `dependency-audit`). Medium and low
  findings remain advisory per the severity policy above.
- **On failure:** upgrade, replace, or document the exception. Never add `--force`.

### Area 8 — Dead code, unused exports, orphaned files, and duplicate code

- **Class:** Advisory
- **Job:** `deadcode`
- **Status:** Knip and jscpd are installed at the workspace root and are run by hand
  during Phase 5. The job is deliberately **not** in the workflow yet: area 5's
  inventory check compares `CI_GATES.md` against the workflows, so adding a job here
  without a workflow would fail the governance gate. Promotion follows §4.
- **Mechanism:** Knip for unused files, exports, dependencies, and dynamic-import
  entries; `jscpd` for copy-paste duplication with a configured threshold; an orphan
  check for assets, routes, and documents not referenced anywhere.
- **Triage rule:** a finding is never deleted on the strength of the tool alone. Route
  files, framework conventions, generated assets, and content files are declared as
  Knip entry points or in the ignore list before the gate is promoted.
- **Evidence:** reports uploaded as artefacts; a comment on the run for each confirmed
  removal or recorded exception.
- **Promotion to required:** once two consecutive clean runs are evidenced and the
  entry/ignore configuration is committed. Expected target: the first release.

### Area 9 — pnpm workspace and lockfile integrity

- **Class:** Required
- **Job:** `workspace`
- **Mechanism:** `pnpm install --frozen-lockfile` must succeed — a lockfile that does not
  match the manifests fails here; `pnpm list --depth -1` must resolve every workspace
  package; declared `packageManager` must match the version used by CI; every workspace
  glob must resolve; duplicate direct dependency versions across workspaces are reported.
- **Evidence:** install log; resolved workspace list.
- **Status:** `ENFORCED` in run 39153866220 (job `workspace`).
- **On failure:** regenerate the lockfile in a dedicated commit that contains only the
  lockfile, never mixed into a feature change.

### Area 10 — Monorepo dependency boundaries and circular dependencies

- **Class:** Required
- **Job:** `boundaries`
- **Mechanism:** the architecture tests in `TESTING.md` §6 — the import matrix of
  `ARCHITECTURE.md` §3, cycle detection, persistence confined to the API, public-secret
  naming, package manifest accuracy, and barrel-cycle detection.
- **Evidence:** test output naming the offending file and the rule it broke.
- **Status:** `ENFORCED` in run 39153866220 (job `boundaries`).
- **On failure:** move or extract the code into the correct package. The fix is never a
  lint exclusion unless the exception is recorded in `docs/exceptions.md`.

### Area 11 — False-green CI prevention

- **Class:** Required
- **Job:** `ci-integrity`
- **Mechanism:** a check over `.github/workflows/**` that fails when it finds any of:
  - `continue-on-error` on a required gate,
  - `|| true`, `exit 0`, `set +e`, or a `try/catch` that swallows a non-zero exit,
  - `if: always()` or `if: failure()` used to mask a failed step's effect,
  - `test.only`, or `.skip` without a linked issue, in test sources,
  - a required status check name that no job produces,
  - a matrix entry with `continue-on-error` or `fail-fast: false` hiding a failure,
  - `workflow_run` used to bypass untrusted-input protections,
  - a workflow that runs on `pull_request_target` and checks out PR code,
  - a modified workflow file inside a pull request that changes permissions upward.
- **Also required:** every gate job ends with an explicit exit-code assertion, so a
  command that fails to run at all (missing binary, bad flag) is a failure rather than a
  pass.
- **Evidence:** report of the scanned patterns and the final gate list.
- **Status:** `ENFORCED` in run 39153866220 (job `ci-integrity`).
- **On failure:** the workflow is fixed. Editing a workflow to disable this check in the
  same commit is itself a review rejection.

### Area 12 — Branch protection, pull request approval, and merge policy

- **Class:** External, and required before the first merge to `main`
- **Mechanism:** a GitHub ruleset on `main`, verified by reading it back through the
  GitHub API from a scheduled job and a pull-request-time check that fails when the
  policy has drifted. The ruleset requires: pull request rather than direct push,
  resolution of all review threads, dismissal of stale approvals on new commits, linear
  history, no force-push, no deletion, and the exact required status checks from §3.
- **Approving reviews are required at count zero.** `ADR-0005` records why: this
  repository has a single operator, GitHub does not permit an author to approve their
  own pull request, and a count above zero would make `main` permanently unmergeable
  rather than safer. The compensating control is the required check set. If a second
  operator is added, `ADR-0005` is superseded rather than this line being edited.
- **Verification:** read back from the GitHub API and compared against the table in §3.
- **Applied on 2026-10-18:** ruleset `Main Branch`, id `25352862`, `enforcement: active`,
  targeting `~DEFAULT_BRANCH`, with 14 required status checks, `strict` mode on, zero
  approving reviews required (deliberate, see `ADR-0005`), thread resolution required,
  stale approvals dismissed on push, linear history required, and force-push and
  deletion blocked. The scheduled drift job itself is `SPECIFIED`: it is written in this
  area but no scheduled workflow runs it yet.
- **Evidence:** the API response for the ruleset, cited in the run.
- **Current status:** the ruleset itself is `ENFORCED` — ruleset `25352862`, read back
  from the API on 2026-10-18 and re-verified against the checks that ran on `main` at
  commit `353a84e`: all 14 required checks present and successful, none required but
  missing, none running but unrequired.
  The **scheduled drift job is `SPECIFIED`**: the comparison described above is
  currently performed manually, and no workflow performs it on a schedule. The
  distinction matters — a rule that is only checked when a human remembers to check it
  is not enforced in any meaningful sense.

### Area 13 — Deployment security, environment separation, release integrity, rollback readiness, post-deployment verification

- **Class:** Required for release, External for the provider settings
- **Jobs:** `release-integrity`, `deploy`, `post-deploy-verify`, and the
  `environment-guard` check inside the release workflow
- **Mechanism:**
  - **Environment separation:** each environment is a GitHub environment with its own
    protection rules and secret scope; the workflow asserts that a production deployment
    received only production secrets and that no development value was present. Local
    and Atlas development data are never used in production.
  - **Release integrity:** the release is built once in CI, tagged with the commit SHA,
    and the same artefact is promoted to staging and production. No rebuild at deploy
    time. The release records the SHA, the previous known-good SHA, and the migration
    step.
  - **Deployment security:** deployment uses short-lived, least-privilege credentials
    (OIDC where the provider supports it); long-lived provider tokens are not committed;
    environment protection requires approval.
  - **Rollback readiness:** the runbook's rollback procedure is checked for
    completeness, and the previous deployment identifier is recorded before promotion so
    rollback is a single verified action.
  - **Post-deployment verification:** smoke tests run against the production URLs — API
    health endpoint, public home page content, one knowledge article, one project, the
    admin login redirect, and that a draft is not publicly reachable. A failure triggers
    automatic rollback where the provider supports it, and always pages the owner.
- **Evidence:** deployment URLs, the smoke-test report, and the environment-guard
  assertions.
- **Current status:** `SPECIFIED`. No deployment workflow exists. Domains are fixed
  (`DEPLOYMENT_MAP.md` §7.1) but the Vercel projects, the Render service, and the Atlas
  clusters are not provisioned, so the environment-guard assertions have nothing to
  verify against yet.

## 3. Required status checks for the ruleset

The exact check names required on `main`. Area 12 verifies this list against the live
ruleset, so the **check name** column is what GitHub matches on: it is the job's `name:`
field, not the job identifier.

| Check name (what GitHub matches)              | Job id              | Area | Workflow   |
| --------------------------------------------- | ------------------- | ---- | ---------- |
| `Workspace and lockfile integrity`            | `workspace`         | 9    | ci.yml     |
| `Lint and formatting`                         | `lint`              | 1    | ci.yml     |
| `TypeScript type safety`                      | `typecheck`         | 2    | ci.yml     |
| `Production build integrity`                  | `build`             | 3    | ci.yml     |
| `Unit, contract, and integration tests`       | `test`              | 4    | ci.yml     |
| `Critical end-to-end journeys`                | `e2e`               | 4    | ci.yml     |
| `Accessibility audit`                         | `a11y`              | 4    | ci.yml     |
| `Governance and documentation compliance`     | `governance`        | 5    | ci.yml     |
| `Secret scanning`                             | `secrets`           | 6    | ci.yml     |
| `Workflow security baseline`                  | `workflow-security` | 6    | ci.yml     |
| `CodeQL analysis`                             | `codeql`            | 6    | codeql.yml |
| `Dependency vulnerability and licence audit`  | `dependency-audit`  | 7    | ci.yml     |
| `Dependency boundaries and contract sync`     | `boundaries`        | 10   | ci.yml     |
| `Pipeline integrity (false-green prevention)` | `ci-integrity`      | 11   | ci.yml     |

`CodeQL analysis` is produced by a separate workflow, so it lands on the commit as its
own check run rather than inside the `ci.yml` run. That is expected: a required status
check is matched per commit, not per workflow run.

Advisory, therefore **not** required status checks: `deadcode` (area 8), the performance
budgets and the licence-policy portion of area 7.

## 4. Promotion rule for advisory checks

An advisory check becomes required only when **all** of the following are true:

1. Two consecutive clean runs on `main` are cited.
2. Its configuration, entry points, and ignore list are committed and reviewed.
3. Its failure mode has been demonstrated at least once, and the failure was a true
   positive.
4. The promotion is recorded in this file with the date and the citing runs.

Advisory checks never block a merge, but a new advisory finding must be either fixed in
the same pull request or recorded in `docs/exceptions.md` with a review date.

## 5. Prohibited practices

1. No `continue-on-error` on a required gate.
2. No `|| true`, `exit 0`, or ignored exit codes on a required gate.
3. No skipped or deleted test to make a suite green.
4. No lowered coverage floor or raised duplication threshold without an ADR.
5. No edit that makes a gate pass while disabling the condition it detects.
6. No required gate that is not reported to the ruleset.
7. No merge with a required gate that did not actually run.

## 6. Rollout order

Phase 4 implements the areas in this order so that each one can be proven before the
next depends on it:

1. `workspace`, `lint`, `typecheck` — fast, deterministic, no infrastructure.
2. `governance`, `ci-integrity` — prove the pipeline cannot lie.
3. `build`, `test`, `boundaries`, `dependency-audit`.
4. `secrets`, `workflow-security`, `codeql`.
5. `e2e`, `a11y` — these need a working test database and production builds.
6. Area 12 ruleset creation, once the required checks exist and pass.
7. `deadcode` baseline, then promotion by §4.
8. Area 13 once `DEPLOYMENT_MAP.md` §7 is resolved and the providers are configured.
