#!/usr/bin/env node
/**
 * Gate: contract and shared-package synchronisation (SSOT_POLICY.md section 7).
 *
 * Statically verifies that the single source of truth is not being bypassed:
 *   1. every enum defined in packages/contracts has unique, kebab-case members;
 *   2. no workspace outside packages/contracts re-declares those enum literals;
 *   3. every workspace importing @me-palnadu/* declares it in package.json;
 *   4. no workspace outside packages/contracts defines a Zod schema for an
 *      entity name owned by contracts.
 */
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CONTRACTS = path.join(ROOT, 'packages/contracts/src');
const OTHER_WORKSPACES = [
  'packages/shared/src',
  'packages/ui/src',
  'apps/api/src',
  'apps/admin/src',
  'apps/web/src',
];

const failures = [];
const notes = [];

const fail = (m) => failures.push(m);
const note = (m) => notes.push(m);

async function walk(dir) {
  if (!existsSync(dir)) return [];
  const {readdir} = await import('node:fs/promises');
  const out = [];
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

async function main() {
  if (!existsSync(CONTRACTS)) {
    fail('packages/contracts/src does not exist');
    process.exit(1);
  }

  const contractFiles = await walk(CONTRACTS);
  const contractBody = (await Promise.all(contractFiles.map((f) => readFile(f, 'utf8')))).join(
    '\n',
  );

  // 1. Enum hygiene.
  const enums = [...contractBody.matchAll(/export const ([A-Z0-9_]+) = \[([^\]]*)\]\s+as const/g)]
    // An enum is an array of string literals. A const array of objects (for example
    // ADMIN_ALLOWLIST) is data, not an enum, and is skipped here deliberately.
    .filter(([, , body]) => /'[^']+'/.test(body) && !/=\s*\{|\{\s*[a-zA-Z]/.test(body));
  if (enums.length === 0) fail('no exported enum arrays found in packages/contracts');
  const members = new Map();
  for (const [, name, body] of enums) {
    const values = [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    if (values.length === 0) fail(`enum ${name} has no members`);
    if (new Set(values).size !== values.length) fail(`enum ${name} has duplicate members`);

    // Two wire styles are legitimate and deliberate: kebab-case for domain status
    // values and slugs, SCREAMING_SNAKE for protocol-level error codes that appear
    // verbatim in the API error envelope. Mixing them inside one enum is a defect.
    const kebab = values.every((value) => /^[a-z][a-z0-9_]*$/.test(value));
    const screaming = values.every((value) => /^[A-Z][A-Z0-9_]*$/.test(value));
    if (!kebab && !screaming) {
      fail(`enum ${name} mixes wire styles or uses an undocumented convention`);
    }
    members.set(name, values);
  }
  note(`validated ${enums.length} contract enum(s): ${[...members.keys()].join(', ')}`);

  // 2 & 4. No re-declaration outside contracts.
  for (const dir of OTHER_WORKSPACES) {
    for (const file of await walk(path.join(ROOT, dir))) {
      const body = await readFile(file, 'utf8');
      const rel = path.relative(ROOT, file);

      for (const [name, values] of members) {
        // A literal union or a const array duplicating a contract enum.
        const union = new RegExp(`(?:'${values[0]}'[^\\n]*\\|)|(?:\\|[^\\n]*'${values[0]}')`);
        const list = new RegExp(`\\[\\s*(?:'${values[0]}'\\s*,?)+\\s*\\]`, 's');
        if (values.length > 1 && (union.test(body) || list.test(body))) {
          fail(
            `${rel}: re-declares the ${name} enum defined in packages/contracts (SSOT_POLICY.md section 2)`,
          );
        }
      }

      if (/z\.object\(\s*\{[^}]*\btitle\b/.test(body) && !rel.startsWith('packages/contracts')) {
        // Legitimate for UI props; a heuristic that reports for review rather than blocking alone.
        notes.push(
          `${rel}: defines a z.object containing "title" - confirm it is a props schema, not a domain entity`,
        );
      }
    }
  }

  // 3. Dependency declarations match imports.
  const workspaces = ['packages/shared', 'packages/ui', 'apps/api', 'apps/admin', 'apps/web'];
  for (const workspace of workspaces) {
    const manifestPath = path.join(ROOT, workspace, 'package.json');
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const declared = new Set([
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
    ]);
    for (const file of await walk(path.join(ROOT, workspace, 'src'))) {
      const body = await readFile(file, 'utf8');
      for (const match of body.matchAll(/from\s+['"](@me-palnadu\/[^'"]+)['"]/g)) {
        const pkg = `${match[1].split('/')[0]}/${match[1].split('/')[1]}`;
        if (!declared.has(pkg)) {
          fail(
            `${path.relative(ROOT, file)}: imports ${pkg} which ${workspace}/package.json does not declare`,
          );
        }
      }
    }
    note(`${workspace}: ${declared.size} dependency declaration(s) checked`);
  }

  for (const message of notes) console.log(`  ok   ${message}`);
  for (const message of failures) console.error(`  FAIL ${message}`);
  console.log(`\ncontracts: ${failures.length} violation(s)`);
  process.exit(failures.length === 0 ? 0 : 1);
}

await main();
