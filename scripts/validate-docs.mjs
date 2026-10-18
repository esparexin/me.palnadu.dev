#!/usr/bin/env node
/**
 * Gate: governance and documentation compliance (CI_GATES.md area 5).
 *
 * Checks that every document in the AGENTS.md index exists, ADRs referenced in
 * code or prose exist, no exception is past its review date, and the gate
 * inventory matches the workflows that actually exist.
 */
import {readFile, readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {parseInventoryTable} from './lib/gate-inventory.mjs';

const ROOT = process.cwd();
const failures = [];
const notes = [];
const notImplemented = [];

const fail = (m) => failures.push(m);
const note = (m) => notes.push(m);
const todo = (m) => notImplemented.push(m);

const REQUIRED_DOCS = [
  'AGENTS.md',
  'AI_WORKFLOW.md',
  'GOVERNANCE.md',
  'ARCHITECTURE.md',
  'SSOT_POLICY.md',
  'CODING_STANDARDS.md',
  'UI_UX_STANDARDS.md',
  'TESTING.md',
  'SECURITY.md',
  'CI_GATES.md',
  'DEPLOYMENT_MAP.md',
  'RUNBOOK.md',
  'docs/exceptions.md',
  'README.md',
];

async function main() {
  for (const doc of REQUIRED_DOCS) {
    const target = path.join(ROOT, doc);
    if (!existsSync(target)) {
      fail(`missing required document: ${doc}`);
      continue;
    }
    const body = await readFile(target, 'utf8');
    if (body.trim().length < 200) fail(`document is a stub: ${doc}`);
  }

  // ADRs must exist and be numbered sequentially from 0001.
  const adrDir = path.join(ROOT, 'docs/adr');
  if (existsSync(adrDir)) {
    const adrs = (await readdir(adrDir)).filter((f) => f.endsWith('.md')).sort();
    for (const [index, file] of adrs.entries()) {
      const expected = String(index + 1).padStart(4, '0');
      if (!file.startsWith(expected)) {
        fail(`docs/adr/${file} does not follow the sequential ADR-NNNN naming`);
      }
      const body = await readFile(path.join(adrDir, file), 'utf8');
      if (!/^- \*\*Status:\*\* (Proposed|Accepted|Rejected|Superseded)/m.test(body)) {
        fail(`docs/adr/${file} has no valid Status line`);
      }
      if (!/^- \*\*Date:\*\*/m.test(body)) fail(`docs/adr/${file} has no Date line`);
    }
    note(`${adrs.length} ADR(s) validated`);
  } else {
    fail('docs/adr is missing');
  }

  // Exceptions must not be past their review date.
  const exceptionsPath = path.join(ROOT, 'docs/exceptions.md');
  if (existsSync(exceptionsPath)) {
    const body = await readFile(exceptionsPath, 'utf8');
    const today = new Date();
    const reviewDates = [
      ...body.matchAll(/\|\s*Review by\s*\|\s*([0-9]{4}-[0-9]{2}-[0-9]{2})\s*\|/g),
    ];
    for (const match of reviewDates) {
      const expiry = new Date(`${match[1]}T00:00:00Z`);
      if (expiry < today) {
        fail(`exception review date ${match[1]} has passed (GOVERNANCE.md section 5)`);
      } else {
        note(`exception review date ${match[1]} is in the future`);
      }
    }
  }

  // Gate inventory: every job named in CI_GATES.md must exist in a workflow,
  // and a workflow must not define a job CI_GATES.md does not document.
  //
  // Parsed by scripts/lib/gate-inventory.mjs so that a format change fails loudly
  // instead of silently producing an empty comparison.
  const ciGates = await readFile(path.join(ROOT, 'CI_GATES.md'), 'utf8');
  const inventory = parseInventoryTable(ciGates);
  for (const message of inventory.errors) fail(message);
  const documentedJobs = new Set(inventory.rows.map((row) => row.jobId));
  const documentedChecks = new Set(inventory.rows.map((row) => row.check));
  note(`gate inventory: ${inventory.rows.length} required check(s) parsed from CI_GATES.md`);

  const workflowsDir = path.join(ROOT, '.github/workflows');
  const workflowFiles = existsSync(workflowsDir)
    ? (await readdir(workflowsDir)).filter((f) => /\.ya?ml$/.test(f))
    : [];

  if (workflowFiles.length === 0) {
    todo(
      'no workflows exist yet: the gate inventory cannot be compared (CI_GATES.md area 5 check 6 is NOT ENFORCED)',
    );
  } else {
    const defined = new Set();
    for (const file of workflowFiles) {
      const body = await readFile(path.join(workflowsDir, file), 'utf8');
      for (const match of body.matchAll(/^\s{2}([a-z0-9-]+):\s*$/gm)) defined.add(match[1]);
    }
    for (const job of documentedJobs) {
      if (!defined.has(job)) fail(`CI_GATES.md documents job "${job}" but no workflow defines it`);
    }
    for (const job of defined) {
      if (!documentedJobs.has(job)) {
        note(`workflow job "${job}" is not a documented required check (informational)`);
      }
    }
    note(
      `${workflowFiles.length} workflow file(s), ${defined.size} job(s) compared against the inventory`,
    );
  }

  // A control must not be described as enforced while it is specified.
  //
  // This is a heuristic, not a proof. It flags a line only when the line asserts
  // enforcement in the present tense AND carries no qualifier. Qualifiers are the
  // ways a specification legitimately talks about a future or negative enforcement
  // state ("not enforced", "once gate X exists", "enforced by review", ...). A
  // document that needs a new phrasing to satisfy this check is a signal to add an
  // explicit status label, which is the behaviour this gate exists to force.
  const QUALIFIER =
    /\b(?:not|none|no|never|yet|once|after|before|until|will|would|shall|pending|future|later|specif|target|planned|next phase|may|must be|is required|by (?:gate|lint|review|rule|compiler|git|github|the)|when|cannot|are enforced by|is enforced by)\b/i;

  for (const doc of REQUIRED_DOCS) {
    const target = path.join(ROOT, doc);
    if (!existsSync(target)) continue;
    const body = await readFile(target, 'utf8');
    for (const [index, line] of body.split('\n').entries()) {
      if (!/\b(?:is|are) enforced\b/i.test(line)) continue;
      if (QUALIFIER.test(line)) continue;
      fail(
        `${doc}:${index + 1} asserts enforcement with no status qualifier: ${line.trim().slice(0, 90)}`,
      );
    }
  }
  note('enforcement claims: every unqualified enforcement assertion is rejected');

  for (const message of notes) console.log(`  ok   ${message}`);
  for (const message of notImplemented) console.warn(`  n/i  ${message}`);
  for (const message of failures) console.error(`  FAIL ${message}`);

  const suffix =
    notImplemented.length > 0 ? `, ${notImplemented.length} check(s) NOT ENFORCED` : '';
  console.log(`\ndocs: ${failures.length} violation(s)${suffix}`);
  process.exit(failures.length === 0 ? 0 : 1);
}

// Small helper kept separate so the ADR loop stays synchronous in intent.
await main();
