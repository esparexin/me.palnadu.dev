# ADR-0005 — Merge policy for a single-operator repository

- **Status:** Accepted
- **Date:** 2026-10-18
- **Decision owner:** Repository owner

## Context

`GOVERNANCE.md` §2 requires a pull request with a passing required gate before any
merge to `main`, and `CI_GATES.md` area 12 requires a GitHub ruleset that demands at
least one approving review from a code owner.

This repository has exactly one operator: the account that holds the production
credentials, the GitHub admin role, and the only signing identity. That account also
pushes the branches and opens the pull requests.

GitHub does not permit an author to approve their own pull request. A ruleset with
`required_approving_review_count` greater than zero would therefore make `main`
permanently unmergeable for this repository — the pipeline would deadlock on the first
commit rather than protecting it.

The genuine risk this policy exists to prevent is a human or agent landing unreviewed
code. Two mitigations are available: a second approving reviewer, or independent
mechanical verification. This repository has the second and not the first.

## Decision

Configure a ruleset on `main` that requires:

| Rule                                   | Value                             | Reason                                               |
| -------------------------------------- | --------------------------------- | ---------------------------------------------------- |
| Require a pull request                 | enabled                           | No direct push                                       |
| Required status checks                 | the 14 checks in `CI_GATES.md` §3 | Independent mechanical verification                  |
| Require conversation resolution        | enabled                           | No unresolved review threads                         |
| Dismiss stale approvals on new commits | enabled                           | Applies once a second reviewer exists                |
| Require linear history                 | enabled                           | Readable, revertible history                         |
| Block force-push                       | enabled                           | No rewriting of shared history                       |
| Block branch deletion                  | enabled                           |                                                      |
| **Required approving reviews**         | **0**                             | A single operator cannot satisfy its own requirement |

Required review count is **0 deliberately**, and this ADR is the record of that
deliberate choice. It is not an oversight and it must not be "fixed" by lowering or
removing a gate; the compensating control is the required status check set.

## Consequences

**Positive**

- `main` cannot receive a commit that has not passed fourteen independent gates on a
  clean checkout.
- Direct pushes, force-pushes, and branch deletion are impossible on `main`.
- The policy is honest about the single-operator reality instead of encoding a rule
  that could never be satisfied.

**Negative**

- There is no human second pair of eyes. Review quality rests on the gates plus the
  agent's own verification evidence, which the gates cannot fully replace: a reviewer
  is still needed to judge whether the change is _right_, not merely _valid_.
- When a second operator joins, this ADR must be superseded to set a review count
  greater than zero, and the repository must define who holds provider access
  (`DEPLOYMENT_MAP.md` §8 already anticipates that change).

## Re-evaluation trigger

- A second trusted operator is added, or
- the repository owner grants review rights to another account.

Until then the correct reading of "reviewed" in this repository is
"mechanically verified by the required gates and accompanied by cited evidence in the
pull request".

## References

`GOVERNANCE.md` §2, `CI_GATES.md` area 12 and §3, `DEPLOYMENT_MAP.md` §8.
