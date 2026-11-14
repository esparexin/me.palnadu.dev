# RUNBOOK.md

Operational procedures for releasing, verifying, rolling back, and recovering
`me.palnadu.dev`. Pair with `DEPLOYMENT_MAP.md` and `SECURITY.md`.

**Status: `SPECIFIED`.** No procedure here has been executed. Every checklist item must
be performed and its evidence recorded before a runbook entry may be described as
tested.

## 1. Release: merge to production

| #   | Step                                                                                            | Verification                                                    |
| --- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1   | Merge to `main` is accepted by the ruleset                                                      | All required checks green on the head commit; approval recorded |
| 2   | Release workflow builds once and publishes an immutable artefact tagged with the commit SHA     | Artefact digest in the run log; no rebuild afterwards           |
| 3   | Deploy the same artefact to `staging`; run readiness and smoke checks                           | Staging smoke report                                            |
| 4   | Verify staging manually: home, experience timeline, one knowledge article, admin login redirect | Notes in the pull request or the release issue                  |
| 5   | Approve the `production` GitHub environment                                                     | Approval recorded with the approver's identity                  |
| 6   | Promote the artefact to production: `apps/api`, then `apps/admin`, then `apps/web`              | Deployment URLs per component                                   |
| 7   | Apply the schema with `prisma db push` after staging and a verified snapshot                    | `db push` output; `GET /health/ready` returns 200               |
| 8   | Run the post-deployment verification in §2                                                      | Full report                                                     |
| 9   | Record the deployment in the release log: SHA, previous good SHA, duration, operator, outcome   | Release log entry                                               |

Ordering rationale: the API first so the frontends never point at a missing API; the
admin second so content management is ready; the public site last so visitors are never
served a page that fails.

## 2. Post-deployment verification

Run against the production URLs, not against a build. Any failure triggers §3.

**API**

- [ ] `GET /health/live` returns 200.
- [ ] `GET /health/ready` returns 200 and reports the database as reachable.
- [ ] An unauthenticated write to a protected route returns `401` with the contract
      error envelope — proving the guard is mounted.
- [ ] A public list endpoint returns published content and no draft.

**Public site (`me.palnadu.dev`)**

- [ ] Home renders the **View Resume** and **Explore Experience** CTAs.
- [ ] `/experience` renders the timeline in newest-first order.
- [ ] `/knowledge-hub` lists published articles and one article renders with code and lists intact; `/knowledge` redirects there.
- [ ] `/projects` and one project detail render.
- [ ] `/contact` rejects invalid input with a visible, accessible error.
- [ ] `/knowledge-hub/rss.xml` responds 200 with well-formed XML and absolute article links.
- [ ] No console errors, no hydration warnings, no 404s for local assets.

**Admin**

- [ ] Unauthenticated access to a dashboard route redirects to `/login`.
- [ ] Wrong credentials are refused with the generic message, and the attempt is in the audit log.
- [ ] The provisioned owner reaches the dashboard and can read content.

**Cross-cutting**

- [ ] Security headers present: CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`,
      `Permissions-Policy`.
- [ ] A draft article is not reachable from the public site, including by direct slug.
- [ ] Lighthouse budgets hold on the home page (`TESTING.md` §9).
- [ ] Axe reports zero serious or critical violations on `/` and `/experience`.

## 3. Rollback

Decision: roll back if any verification in §2 fails, if the API error rate rises, or if
content is wrong or unpublished. Rolling back is the default; debugging in production
is not.

| Component    | Mechanism                                             | Time   | Data implication                                                                                  |
| ------------ | ----------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| `apps/web`   | Redeploy the previous known-good Vercel deployment    | ~1 min | None                                                                                              |
| `apps/admin` | Redeploy the previous known-good Vercel deployment    | ~1 min | None                                                                                              |
| `apps/api`   | Roll back the Render deploy to the previous image tag | ~3 min | Requires the previous code to tolerate the current schema                                         |
| Database     | No rollback of any kind                               | Manual | There is no migration history. Recovery is forward repair or a point-in-time restore (`ADR-0006`) |

Procedure:

1. Announce in the incident channel with the reason and the target SHA.
2. Redeploy the previous known-good artefact for each affected component, web last.
3. Re-run §2 in full.
4. If the API must be rolled back but a newer schema change is incompatible with the
   rolled-back code, restore from the Atlas point-in-time snapshot and verify content
   integrity before reopening. Prefer a forward-compatible schema change over this
   path: it is slower and loses writes made since the snapshot.
5. Record what rolled back, why, and the follow-up task. A rollback is not a resolution.

## 4. Gate failure triage

| Symptom                                        | First action                                                  | Then                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Required gate fails on your branch             | Read the log; fix the cause                                   | Never re-run to obtain a different result without a change                         |
| `boundaries` fails                             | Find the violating import from the rule name                  | Move the code, or record an exception in `docs/exceptions.md`                      |
| `e2e` fails only in CI                         | Compare environment differences (database seed, port, timing) | Fix the test's determinism (`TESTING.md` §3); do not add a retry to hide flakiness |
| `a11y` fails                                   | Treat as a product defect, not a gate problem                 | Fix the component                                                                  |
| `secrets` fails                                | Assume the secret is compromised                              | Rotate first (`SECURITY.md` §7), then remove                                       |
| `ci-integrity` fails on your own workflow edit | Re-read `CI_GATES.md` area 11                                 | An edit that neutralises a gate is rejected at review                              |
| `governance` fails                             | Check the index in `AGENTS.md` and `docs/exceptions.md`       | Add the document or correct the stale claim                                        |

## 4a. CodeQL review threads before merge

`main` requires all review threads to be resolved. CodeQL opens a thread on every
pull request, so **a CodeQL summary thread is expected on every PR** and will block the
merge until it is handled.

Procedure:

1. Read the thread. It names the rule, the path, and the line.
2. Check for open code-scanning alerts:
   `gh api repos/esparexin/me.palnadu.dev/code-scanning/alerts --jq '.[] | {rule: .rule.id, path: .most_recent_instance.location.path}'`
3. **If an alert is open, fix the code and push.** Do not resolve the thread first.
4. Only when there are no open alerts for the thread's finding may the thread be
   resolved, and the resolution is recorded in the pull request with the evidence.

Resolving a thread removes the blocker, not the defect. The two threads raised on the
Phase 6A pull request were a real insecure-temporary-file finding and a real unused
variable, both fixed before resolution.

## 5. Security incident

1. **Contain.** Revoke first: rotate `AUTH_SECRET` (logs out every administrator),
   set `active: false` or increment `tokenVersion` on `AdminUser` to invalidate all active JWTs,
   rotate `DATABASE_URL` credentials, and revoke any suspected provider tokens.
2. **Preserve.** Export logs and the Atlas audit trail before rotating anything else.
3. **Assess.** Determine which asset in `SECURITY.md` §1 was touched: sessions, content,
   personal data, or credentials.
4. **Remediate.** Remove the access path, not just the symptom. Close the finding with a
   test that would have caught it.
5. **Record.** What happened, what was exposed, what was done, and which control
   changed as a result. Update `SECURITY.md` if a control was missing.
6. If personal data was involved, follow the applicable breach-notification process.

## 6. Administrator session and credential operations

| Task                          | Procedure                                                                                                          | Verification                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Provision owner credential    | Run `pnpm --filter @me-palnadu/api owner:provision -- --email <email>` and enter the password at the hidden prompt | Creates `AdminUser` record with scrypt hash; login succeeds   |
| Break-glass password recovery | Re-run `owner:provision` with new password; updates `passwordHash` and increments `tv`                             | All existing sessions invalidated; new password authenticates |
| Change password (online)      | Authenticated `POST /api/auth/change-password` with current and new password                                       | Increments `tokenVersion`; requires immediate re-login        |
| Revoke one session            | Set `revokedAt` on the `AdminSession` record                                                                       | The next API request from that session returns `401`          |
| Revoke all sessions           | Increment `AdminUser.tokenVersion`                                                                                 | All existing tokens fail the `tv` comparison                  |
| Emergency global logout       | Rotate `AUTH_SECRET` in the API environment and redeploy the API                                                   | Every JWT fails verification immediately                      |
| Deactivate administrator      | Set `active: false` on the `AdminUser` record                                                                      | Sign-in refused; existing sessions rejected with `403`        |
| Audit a session               | Query `AuditLog` by `sid`                                                                                          | Every write for that session is attributable                  |

## 7. Content operations

**Publishing a draft** (the only supported path; direct production data edits outside
this flow require the owner-approved procedure in `GOVERNANCE.md` §2):

1. Sign in to `apps/admin` as the provisioned owner.
2. Create or edit the record; save as `draft`. Verify it is **not** visible on the public
   site.
3. Proofread. Career claims must match the verified record — no invented dates,
   employers, or metrics (`AGENTS.md` §4).
4. Publish. Confirm the change is live on the public site and in the RSS feed.
5. Confirm the corresponding `AuditLog` entries exist.

**Applying seed content** from `content/`: no importer exists. `content/` is approved
reference material, never a second live content store; until an importer ships with its
own ADR and tests, seed material is entered through the admin UI and audited like any
other write (`AGENTS.md` §4).

**Quarterly restore drill:** restore the production cluster to a scratch cluster, verify
the content inventory and one published article, then delete the scratch cluster. Record
the date and outcome here.

| Date | Operator | Outcome           |
| ---- | -------- | ----------------- |
| —    | —        | Not yet performed |

## 8. Scheduled maintenance

| Cadence         | Task                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------- |
| Weekly          | Review CodeQL alerts; triage new advisories                                                         |
| Monthly         | Review dependency updates; confirm lockfile diff is intentional                                     |
| Monthly         | Review `docs/exceptions.md` for entries approaching review                                          |
| Quarterly       | Atlas restore drill (§7); provider access review; verify the ruleset still matches `CI_GATES.md` §3 |
| On any rotation | Update `DEPLOYMENT_MAP.md` §3 if a key changed                                                      |

## 9. Escalation

Stop and report rather than guessing when a procedure cannot be completed, a rollback
would destroy data, a secret is suspected exposed, or the verification evidence for a
completed step is unavailable. Escalate to the repository owner with: the evidence, the
blocker, the recommendation, and the risk of waiting.
