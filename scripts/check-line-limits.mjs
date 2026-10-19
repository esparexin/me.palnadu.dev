#!/usr/bin/env node
/**
 * Gate: source file line limit compliance (CI_GATES.md area 1 / area 5).
 *
 * Enforces a strict 250-line limit across TypeScript, JavaScript, and MJS files
 * in apps, packages, scripts, and tests.
 *
 * Ratchet mechanism:
 * - Files exceeding 250 lines must be documented in scripts/line-limit-allowlist.json
 *   with an explicit rationale, review date, and ratcheted maxLines cap.
 * - An allowlisted file that grows past its cap fails immediately.
 * - Any new file exceeding 250 lines fails immediately.
 * - Passing --strict audits every file against the 250-line limit ignoring allowlists.
 */
import {readdir, readFile} from 'node:fs/promises';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MAX_LINES = 250;
const ALLOWLIST_FILE = 'scripts/line-limit-allowlist.json';

const SCAN_ROOTS = ['apps', 'packages', 'scripts', 'tests'];
const SKIP_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  '.next',
  '.turbo',
  'coverage',
  '.git',
  '.me-palnadu-test-replica',
  'test-results',
  'playwright-report',
  'blob-report',
  '.lighthouseci',
]);

const SOURCE_FILE_PATTERN = /\.(ts|tsx|mjs|js)$/;
const EXCLUDE_FILE_PATTERN = /\.d\.ts$/;

const isStrict = process.argv.includes('--strict');

async function findSourceFiles(relativeDir) {
  const results = [];
  const absoluteDir = path.join(ROOT, relativeDir);

  if (!existsSync(absoluteDir)) return results;

  async function walk(currentAbs, currentRel) {
    const entries = await readdir(currentAbs, {withFileTypes: true});
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.github') continue;
      if (SKIP_DIRECTORIES.has(entry.name)) continue;

      const entryAbs = path.join(currentAbs, entry.name);
      const entryRel = path.join(currentRel, entry.name);

      if (entry.isDirectory()) {
        await walk(entryAbs, entryRel);
      } else if (SOURCE_FILE_PATTERN.test(entry.name) && !EXCLUDE_FILE_PATTERN.test(entry.name)) {
        results.push(entryRel);
      }
    }
  }

  await walk(absoluteDir, relativeDir);
  return results;
}

async function main() {
  const allowlistPath = path.join(ROOT, ALLOWLIST_FILE);
  let allowlist = [];
  if (existsSync(allowlistPath)) {
    try {
      allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));
    } catch (err) {
      console.error(`check-line-limits: failed to parse ${ALLOWLIST_FILE}: ${err.message}`);
      process.exit(1);
    }
  }

  const allowlistMap = new Map(allowlist.map((entry) => [entry.file, entry]));
  const failures = [];
  const notes = [];
  const today = new Date().toISOString().slice(0, 10);

  let totalFilesScanned = 0;
  const violatingFiles = [];

  for (const root of SCAN_ROOTS) {
    const files = await findSourceFiles(root);
    for (const relPath of files) {
      totalFilesScanned++;
      const absPath = path.join(ROOT, relPath);
      const content = await readFile(absPath, 'utf8');
      const lineCount = content.split('\n').length;

      if (lineCount > MAX_LINES) {
        violatingFiles.push({file: relPath, lines: lineCount, excess: lineCount - MAX_LINES});

        if (isStrict) {
          failures.push(
            `${relPath}: ${lineCount} lines exceeds ${MAX_LINES} (+${lineCount - MAX_LINES})`,
          );
          continue;
        }

        const allowEntry = allowlistMap.get(relPath);
        if (!allowEntry) {
          failures.push(
            `${relPath}: ${lineCount} lines exceeds ${MAX_LINES}-line limit (+${lineCount - MAX_LINES}) without an exception in ${ALLOWLIST_FILE}`,
          );
        } else {
          // Verify ratchet cap
          if (lineCount > allowEntry.maxLines) {
            failures.push(
              `${relPath}: ${lineCount} lines exceeds allowlisted ratchet ceiling of ${allowEntry.maxLines} (+${lineCount - allowEntry.maxLines})`,
            );
          } else if (allowEntry.reviewBy && allowEntry.reviewBy < today) {
            failures.push(
              `${relPath}: exception expired on ${allowEntry.reviewBy}. Refactor or re-approve via ADR/review.`,
            );
          } else {
            notes.push(
              `${relPath}: ${lineCount} lines (allowed up to ${allowEntry.maxLines}; ${allowEntry.category}): ${allowEntry.reason}`,
            );
          }
        }
      } else {
        // File is within limits; verify it is not redundantly allowlisted
        const allowEntry = allowlistMap.get(relPath);
        if (allowEntry && !isStrict) {
          notes.push(
            `${relPath}: now compliant (${lineCount} lines <= ${MAX_LINES}). Ready to remove from ${ALLOWLIST_FILE}.`,
          );
        }
      }
    }
  }

  // Also check root configuration files (e.g. eslint.config.mjs)
  const rootFiles = ['eslint.config.mjs'];
  for (const file of rootFiles) {
    if (existsSync(path.join(ROOT, file))) {
      totalFilesScanned++;
      const content = await readFile(path.join(ROOT, file), 'utf8');
      const lineCount = content.split('\n').length;
      if (lineCount > MAX_LINES) {
        violatingFiles.push({file, lines: lineCount, excess: lineCount - MAX_LINES});
        if (isStrict || !allowlistMap.has(file)) {
          failures.push(`${file}: ${lineCount} lines exceeds ${MAX_LINES}-line limit`);
        }
      }
    }
  }

  for (const message of notes) {
    console.log(`  ok   ${message}`);
  }

  for (const message of failures) {
    console.error(`  FAIL ${message}`);
  }

  console.log(
    `\ncheck-line-limits: ${totalFilesScanned} files scanned, ${violatingFiles.length} exceeding ${MAX_LINES} lines, ${failures.length} violation(s)`,
  );

  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`check-line-limits: fatal error: ${err.stack || err.message}`);
  process.exit(1);
});
