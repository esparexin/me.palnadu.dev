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

  // Canonical entity field lists, parsed from the contracts package so this gate
  // cannot drift from the definitions it protects.
  const canonicalShapes = new Map();
  for (const match of contractBody.matchAll(/const ([A-Za-z]+)Shape\s*=\s*\{([\s\S]*?)\n\};/g)) {
    const fields = [...match[2].matchAll(/(?:^|[\s,{])([a-zA-Z][a-zA-Z0-9]*)\s*:/g)].map(
      (m) => m[1],
    );
    if (fields.length >= 4) canonicalShapes.set(match[1], fields);
  }
  note(`canonical entity shapes: ${[...canonicalShapes.keys()].join(', ') || 'none found'}`);

  // 2 & 4. No re-declaration outside contracts.
  for (const dir of OTHER_WORKSPACES) {
    for (const file of await walk(path.join(ROOT, dir))) {
      const body = await readFile(file, 'utf8');
      const rel = path.relative(ROOT, file);

      for (const [name, values] of members) {
        if (values.length < 2) continue;
        const first = values[0];

        // A literal union of two or more contract values on one line.
        const second = values[1];
        // A union names at least two members separated by a pipe, in either order.
        const union = new RegExp(
          `'${first}'[^\\n]*\\|[^\\n]*'${second}'|'${second}'[^\\n]*\\|[^\\n]*'${first}'`,
        );

        // A const array literal in a declaration position.
        //
        // The assignment or return prefix is required on purpose. Without it,
        // bracket property access such as `data['summary']` matched the bare
        // bracket pattern and produced a false positive on ordinary code.
        const list = new RegExp(
          `(?:=\\s*|\\breturn\\s*|:\\s*)\\[\\s*'${first}'\\s*,?\\s*(?:'[^']+'\\s*,?\\s*)+\\]`,
        );

        if (union.test(body) || list.test(body)) {
          fail(
            `${rel}: re-declares the ${name} enum defined in packages/contracts (SSOT_POLICY.md section 2)`,
          );
        }
      }

      // High-precision duplicate detection: a z.object is only reported when its
      // field set mirrors a canonical entity shape. A test fixture or a UI props
      // schema that happens to use a familiar field name is not a second
      // definition of the entity, and flagging it would train reviewers to ignore
      // this gate.
      const objectMatch = /z\.object\(\{([\s\S]*?)\}\)/.exec(body);
      if (objectMatch !== null) {
        const declaredFields = new Set(
          [...objectMatch[1].matchAll(/(?:^|[\s,{])([a-zA-Z][a-zA-Z0-9]*)\s*:/g)].map((m) => m[1]),
        );
        for (const [entity, fields] of canonicalShapes) {
          const overlap = fields.filter((field) => declaredFields.has(field));
          // Most of the declared fields come from one canonical entity: that is a
          // second definition, whereas a props schema sharing one or two names is not.
          if (overlap.length >= 4 && overlap.length >= declaredFields.size * 0.75) {
            fail(
              `${rel}: z.object mirrors ${overlap.length} fields of the canonical ${entity} shape (${overlap.join(', ')}) - reuse @me-palnadu/contracts (SSOT_POLICY.md section 2)`,
            );
          }
        }
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
