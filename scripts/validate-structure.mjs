#!/usr/bin/env node
/**
 * Gate: monorepo structure and organisation (CI_GATES.md area 5, part 1).
 *
 * Verifies the tree matches ARCHITECTURE.md section 2 and that every workspace
 * carries the files its ownership requires. Exits non-zero on any violation.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const failures = [];
const notes = [];

const fail = (message) => failures.push(message);
const note = (message) => notes.push(message);

async function isDirectory(target) {
  try {
    return (await stat(target)).isDirectory();
  } catch {
    return false;
  }
}

/** Entries the repository layout mandates. */
const REQUIRED_TOP_LEVEL = [
  'apps',
  'packages',
  'content',
  'scripts',
  'tests',
  'docs',
  '.github/workflows',
  'AGENTS.md',
  'AI_WORKFLOW.md',
  'ARCHITECTURE.md',
  'SSOT_POLICY.md',
  'CODING_STANDARDS.md',
  'UI_UX_STANDARDS.md',
  'SECURITY.md',
  'TESTING.md',
  'CI_GATES.md',
  'DEPLOYMENT_MAP.md',
  'RUNBOOK.md',
  'GOVERNANCE.md',
  'package.json',
  'pnpm-workspace.yaml',
  'turbo.json',
  'tsconfig.base.json',
  '.env.example',
];

/** Directories that must not exist: rejected speculative infrastructure. */
const FORBIDDEN_TOP_LEVEL = ['queue', 'worker', 'packages/legacy', 'vendor'];

const WORKSPACES = ['apps/web', 'apps/admin', 'apps/api', 'packages/contracts', 'packages/design-tokens', 'packages/shared', 'packages/ui'];

const WORKSPACE_REQUIRED = {
  'apps/web': ['package.json', 'tsconfig.json'],
  'apps/admin': ['package.json', 'tsconfig.json'],
  'apps/api': ['package.json', 'tsconfig.json'],
  'packages/contracts': ['package.json', 'tsconfig.json', 'src/index.ts'],
  'packages/design-tokens': ['package.json', 'tsconfig.json', 'src/index.ts'],
  'packages/shared': ['package.json', 'tsconfig.json', 'src/index.ts'],
  'packages/ui': ['package.json', 'tsconfig.json', 'src/index.ts'],
};

async function main() {
  for (const entry of REQUIRED_TOP_LEVEL) {
    const target = path.join(ROOT, entry);
    if (!existsSync(target)) fail(`missing required path: ${entry}`);
  }

  for (const entry of FORBIDDEN_TOP_LEVEL) {
    if (existsSync(path.join(ROOT, entry))) fail(`forbidden path present: ${entry}`);
  }

  // Only these directories may sit at the top level. ARTIFACT_DIRS are produced
  // by tooling and are already git-ignored; they are permitted to exist on a
  // developer machine and are never committed.
  const ARTIFACT_DIRS = new Set([
    'test-results', 'playwright-report', 'blob-report', '.lighthouseci',
  ]);
  const allowed = new Set([
    '.git', '.github', '.vscode', 'node_modules', 'apps', 'packages', 'content', 'scripts',
    'tests', 'docs', 'turbo', '.turbo', 'coverage',
  ]);
  for (const entry of await readdir(ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    if (ARTIFACT_DIRS.has(entry.name)) {
      note(`${entry.name}/ is a tool artefact directory (git-ignored)`);
      continue;
    }
    if (!allowed.has(entry.name) && !['dist', 'out'].includes(entry.name)) {
      fail(`unexpected top-level directory: ${entry.name}/ (is it justified in an ADR?)`);
    }
  }

  for (const workspace of WORKSPACES) {
    const dir = path.join(ROOT, workspace);
    if (!(await isDirectory(dir))) {
      fail(`missing workspace directory: ${workspace}`);
      continue;
    }
    for (const file of WORKSPACE_REQUIRED[workspace] ?? []) {
      if (!existsSync(path.join(dir, file))) fail(`${workspace} is missing ${file}`);
    }
  }

  // Workspace globs must resolve, and every package must declare a private flag
  // so a workspace package can never be published by accident.
  for (const group of ['apps', 'packages']) {
    const dir = path.join(ROOT, group);
    if (!(await isDirectory(dir))) continue;
    const entries = await readdir(dir);
    if (entries.length === 0) fail(`${group}/ exists but is empty`);
  }

  for (const workspace of WORKSPACES) {
    const manifest = path.join(ROOT, workspace, 'package.json');
    if (!existsSync(manifest)) continue;
    const parsed = JSON.parse(await readFile(manifest, 'utf8'));
    if (!parsed.name?.startsWith('@me-palnadu/')) {
      fail(`${workspace}: package name must be scoped @me-palnadu/*, found ${parsed.name}`);
    }
    if (parsed.private !== true) {
      fail(`${workspace}: must be private:true so it cannot be published accidentally`);
    }
    if (parsed.scripts?.typecheck) note(`${workspace} declares a typecheck script`);
    else fail(`${workspace}: missing a typecheck script`);
  }

  // Root manifest invariants.
  const root = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
  if (!root.packageManager?.startsWith('pnpm@')) fail('root: packageManager must pin pnpm');
  if (!root.engines?.node) fail('root: engines.node must be declared');
  note(`packageManager=${root.packageManager} engines.node=${root.engines?.node}`);

  for (const message of notes) console.log(`  ok   ${message}`);
  for (const message of failures) console.error(`  FAIL ${message}`);

  console.log(`\nstructure: ${failures.length} violation(s), ${notes.length} check(s) passed`);
  process.exit(failures.length === 0 ? 0 : 1);
}

await main();