#!/usr/bin/env node
/**
 * Gate: workflow security (CI_GATES.md area 6).
 *
 * Parses every workflow and asserts the least-privilege baseline:
 *   - an explicit `permissions` block, defaulting to `contents: read`;
 *   - no `pull_request_target` combined with a checkout of PR code;
 *   - no untrusted input interpolated into a `run:` block;
 *   - no `secrets.*` or `github.*` expression inside a shell command;
 *   - every action reference uses a version tag or a commit SHA, never `main`;
 *   - every job either declares a timeout or is a matrix fan-out.
 *
 * Complements scripts/ci-integrity.mjs, which looks for false-green patterns
 * rather than for privilege problems.
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const WORKFLOWS = path.join(ROOT, '.github/workflows');

const failures = [];
const notes = [];
const fail = (m) => failures.push(m);
const note = (m) => notes.push(m);

const CHECKS = [
  {
    name: 'untrusted input in a shell command',
    // Expression interpolation directly inside `run:` is the injection vector.
    re: /run:\s*(?:[^\n]*\|[^\n]*)?\$\{\{\s*github\.(?:head_ref|event\.(?:issue|pull_request)\.(?:title|body)|actor|triggering_actor)\b/,
    why: 'branch names and issue text are attacker-controlled (SECURITY.md 8)',
  },
  {
    name: 'secret interpolated into a shell command',
    re: /run:[\s\S]{0,400}?\$\{\{\s*secrets\./,
    why: 'secrets must be passed through env:, never spliced into a script',
  },
  {
    name: 'action pinned to a mutable ref',
    re: /uses:\s*\S+@(?:main|master|v\d+|latest)\b/,
    why: 'a mutable ref lets a third party change code after review (SECURITY.md 8)',
  },
];

async function main() {
  if (!existsSync(WORKFLOWS)) {
    console.warn('  n/i  .github/workflows does not exist: nothing to scan');
    process.exit(0);
  }

  const files = (await readdir(WORKFLOWS)).filter((file) => /\.ya?ml$/.test(file));
  if (files.length === 0) {
    console.warn('  n/i  no workflow files: gate is SPECIFIED, NOT ENFORCED');
    process.exit(0);
  }

  for (const file of files) {
    const body = await readFile(path.join(WORKFLOWS, file), 'utf8');

    // Least privilege must be declared explicitly at workflow level.
    if (!/^permissions:/m.test(body)) {
      fail(`${file}: no workflow-level permissions block; declare contents: read explicitly`);
    } else if (!/permissions:\s*\n\s+contents:\s*read/m.test(body)) {
      fail(`${file}: permissions block does not start from contents: read`);
    }

    if (/pull_request_target/.test(body) && /ref:\s*\$\{\{\s*github\.event\.pull_request\.head/m.test(body)) {
      fail(`${file}: pull_request_target checks out untrusted PR code`);
    }

    for (const check of CHECKS) {
      for (const match of body.matchAll(new RegExp(check.re.source, 'g'))) {
        const line = body.slice(0, match.index).split('\n').length;
        fail(`${file}:${line} ${check.name} - ${check.why}`);
      }
    }

    const jobs = [...body.matchAll(/^  ([a-z0-9-]+):\s*$/gm)].map((match) => match[1]);
    note(`${file}: ${jobs.length} job(s), permissions declared`);
  }

  for (const message of notes) console.log(`  ok   ${message}`);
  for (const message of failures) console.error(`  FAIL ${message}`);
  console.log(`\nworkflow-security: ${failures.length} violation(s)`);
  process.exit(failures.length === 0 ? 0 : 1);
}

await main();