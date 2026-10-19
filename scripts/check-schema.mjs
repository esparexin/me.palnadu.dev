#!/usr/bin/env node
/**
 * Gate: destructive Prisma schema changes (CI_GATES.md area 5).
 *
 * Why this exists: Prisma's MongoDB connector has no migration history and no
 * `prisma migrate`, so no tool tells a reviewer that a schema edit deletes data.
 * This gate compares the committed baseline with the intended schema and blocks on
 * destructive changes unless an explicit, reviewed exception records a recovery
 * plan for that exact target.
 *
 * What it detects:
 *   - removed model, removed field, changed field type
 *   - newly required field with no default, field made required
 *   - unique constraint or unique index added or removed
 *   - removed query index (reported as risky, not blocking)
 *
 * What it cannot detect, stated plainly:
 *   - data semantics: renaming intent, value formats, or cardinality changes that
 *     keep the same Prisma type
 *   - application compatibility: a field can be type-compatible and still break
 *     the code that reads it
 *   - data loss caused by the data itself rather than by the schema
 *   - anything outside the models parsed from schema.prisma
 *   It is a guardrail for review, not a guarantee of preservation or rollback.
 */

import {readFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {diffSchemas, evaluateExceptions, parseSchema} from './lib/schema-diff.mjs';

const ROOT = process.cwd();
const SCHEMA = path.join(ROOT, 'apps/api/prisma/schema.prisma');
const BASELINE = path.join(ROOT, 'apps/api/prisma/baseline.prisma');
const EXCEPTIONS = path.join(ROOT, 'apps/api/prisma/schema-exceptions.json');

const failures = [];
const notes = [];

const readOrFail = (file, label) => {
  if (!existsSync(file)) {
    failures.push(
      `${label} is missing (${path.relative(ROOT, file)}); refusing to report "no changes"`,
    );
    return null;
  }
  const content = readFileSync(file, 'utf8');
  if (content.trim().length === 0) {
    failures.push(`${label} is empty (${path.relative(ROOT, file)})`);
    return null;
  }
  return content;
};

const intendedSource = readOrFail(SCHEMA, 'prisma schema');
const baselineSource = readOrFail(BASELINE, 'prisma baseline');

if (intendedSource !== null && baselineSource !== null) {
  const intended = parseSchema(intendedSource);
  const baseline = parseSchema(baselineSource);
  const diff = diffSchemas(baseline, intended);

  for (const error of [...baseline.errors, ...intended.errors]) failures.push(error);

  const exceptions = existsSync(EXCEPTIONS) ? JSON.parse(readFileSync(EXCEPTIONS, 'utf8')) : [];
  const blocking = evaluateExceptions(
    diff.changes.filter((change) => change.classification === 'destructive'),
    exceptions,
  );

  for (const change of diff.changes) {
    const marker =
      change.classification === 'destructive'
        ? 'DESTRUCTIVE'
        : change.classification === 'risky'
          ? 'RISKY'
          : 'ok';
    notes.push(`  ${marker.padEnd(11)} ${change.kind.padEnd(24)} ${change.target}`);
  }

  for (const change of blocking) {
    failures.push(
      `${change.classification} schema change: ${change.kind} on ${change.target} - ${change.detail}`,
    );
  }

  if (diff.changes.length === 0) {
    notes.push('  schema matches the committed baseline; no changes detected');
  }
}

for (const message of notes) console.log(message);
for (const message of failures) console.error(`  FAIL ${message}`);

console.log(
  `\nschema: ${failures.length} blocking issue(s), ${notes.length} change(s) reported` +
    (failures.length === 0 && notes.length > 0 ? ' (advisory changes are not blocking)' : ''),
);
process.exit(failures.length === 0 ? 0 : 1);
