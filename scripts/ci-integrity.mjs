#!/usr/bin/env node
/**
 * Gate: CI integrity / false-green prevention (CI_GATES.md area 11).
 *
 * Fails the pipeline when a workflow could report success without proving the
 * thing it claims to check. Every pattern here corresponds to a bullet in
 * CI_GATES.md area 11.
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const WORKFLOWS = path.join(ROOT, '.github/workflows');

const RULES = [
  {
    name: 'continue-on-error on a step',
    re: /continue-on-error\s*:\s*true/,
    why: 'a required gate that tolerates failure cannot gate anything (AI_WORKFLOW.md section 1)',
  },
  {
    name: 'swallowed exit status',
    re: /\|\|\s*true\b|\bexit\s+0\b|\bset\s+\+e\b/,
    why: 'a non-zero exit must fail the step (CI_GATES.md section 5)',
  },
  {
    name: 'always()/failure() used to mask an effect',
    re: /if:\s*(?:always\(\)|failure\(\))/,
    why: 'a later step may act on a state that hides an earlier failure',
  },
  {
    name: 'pull_request_target with a checkout of PR code',
    re: /pull_request_target/,
    why: 'grants write tokens and secrets to untrusted code',
  },
  {
    name: 'matrix failure hiding',
    re: /fail-fast:\s*false/,
    why: 'the remaining legs may fail without failing the job',
  },
  {
    name: 'workflow_run used to bridge untrusted input',
    re: /workflow_run\s*:/,
    why: 'the downstream workflow runs with the base repository privileges',
  },
];

/** Jobs that legitimately run on pull_request_target style triggers or masks. */
const REVIEWED_EXCEPTIONS = [];

async function main() {
  const failures = [];
  const notes = [];

  if (!existsSync(WORKFLOWS)) {
    console.warn('  n/i  .github/workflows does not exist: no workflow can be scanned');
    console.log('\nci-integrity: 0 workflow(s) scanned - gate is SPECIFIED, NOT ENFORCED');
    process.exit(0);
  }

  const files = (await readdir(WORKFLOWS)).filter((f) => /\.ya?ml$/.test(f));
  if (files.length === 0) {
    console.warn('  n/i  no workflow files: gate is SPECIFIED, NOT ENFORCED');
    console.log('\nci-integrity: 0 workflow(s) scanned - gate is SPECIFIED, NOT ENFORCED');
    process.exit(0);
  }

  for (const file of files) {
    const body = await readFile(path.join(WORKFLOWS, file), 'utf8');
    for (const rule of RULES) {
      for (const match of body.matchAll(new RegExp(rule.re.source, 'g'))) {
        const line = body.slice(0, match.index).split('\n').length;
        const entry = REVIEWED_EXCEPTIONS.find((e) => e.file === file && e.line === line);
        if (entry) {
          notes.push(`${file}:${line} allowed by reviewed exception: ${entry.reason}`);
          continue;
        }
        failures.push(`${file}:${line} ${rule.name} - ${rule.why}`);
      }
    }

    // Every job needs an explicit conclusion signal; a job whose steps are all
    // optional cannot fail.
    const jobs = [...body.matchAll(/^  ([a-z0-9-]+):\s*$/gm)].map((m) => m[1]);
    for (const job of jobs) {
      const block = body.split(new RegExp(`^  ${job}:\\s*$`, 'm'))[1] ?? '';
      if (/needs:|uses:/.test(block) === false && /if:/.test(block)) {
        notes.push(`${file}: job ${job} is conditional - confirm it is not required`);
      }
    }
    notes.push(`${file}: ${jobs.length} job(s)`);
  }

  for (const message of notes) console.log(`  ok   ${message}`);
  for (const message of failures) console.error(`  FAIL ${message}`);
  console.log(`\nci-integrity: ${failures.length} violation(s)`);
  process.exit(failures.length === 0 ? 0 : 1);
}

await main();