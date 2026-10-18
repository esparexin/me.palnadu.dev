# Exception registry

Exceptions to the rules in `AGENTS.md`, `ARCHITECTURE.md`, `SSOT_POLICY.md`,
`CODING_STANDARDS.md`, `UI_UX_STANDARDS.md`, and `CI_GATES.md` are recorded here
(`GOVERNANCE.md` §5). An exception that is not in this file does not exist.

**Current exceptions: none.**

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

_None yet._

## Entry template

```markdown
### EXC-0001 — <short title>

| Field | Value |
| --- | --- |
| Rule | `ARCHITECTURE.md` §3 (import matrix) |
| Scope | `apps/web/src/lib/api.ts` (named files only) |
| Requirement | <what made the rule unsatisfiable> |
| Justification | <why the exception is correct, not merely convenient> |
| Compensating control | <what limits the blast radius> |
| Owner | Repository owner |
| Created | YYYY-MM-DD |
| Review by | YYYY-MM-DD |
| Status | active / resolved |
```