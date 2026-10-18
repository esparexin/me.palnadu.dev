#!/usr/bin/env node
/**
 * Gate: dependency boundaries and circular dependencies (CI_GATES.md area 10).
 *
 * Implements the allowed-import matrix in ARCHITECTURE.md section 3 against the
 * real source tree, plus the banned patterns from section 3 and 10.
 */
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCOPE = '@me-palnadu/';

/** Which internal packages each workspace may import. ARCHITECTURE.md section 3. */
const ALLOWED = {
  contracts: [],
  'design-tokens': [],
  shared: ['contracts'],
  ui: ['contracts', 'design-tokens', 'shared'],
  api: ['contracts', 'shared'],
  admin: ['contracts', 'design-tokens', 'shared', 'ui'],
  web: ['contracts', 'design-tokens', 'shared', 'ui'],
};

const WORKSPACES = {
  'packages/contracts': 'contracts',
  'packages/design-tokens': 'design-tokens',
  'packages/shared': 'shared',
  'packages/ui': 'ui',
  'apps/api': 'api',
  'apps/admin': 'admin',
  'apps/web': 'web',
};

const IMPORT_PATTERNS = [
  /\bfrom\s+['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

async function* walk(dir) {
  if (!existsSync(dir)) return;
  const {readdir} = await import('node:fs/promises');
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    if (['node_modules', '.next', 'dist', '.turbo', 'coverage'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) yield full;
  }
}

const failures = [];
const edges = new Map(); // workspace -> Set<workspace>
const notes = [];

function fail(message) {
  failures.push(message);
}

async function main() {
  for (const [workspaceDir, name] of Object.entries(WORKSPACES)) {
    const src = path.join(ROOT, workspaceDir, 'src');
    const targets = edges.get(name) ?? new Set();
    edges.set(name, targets);
    const allowed = new Set(ALLOWED[name]);

    for await (const file of walk(src)) {
      const body = await readFile(file, 'utf8');
      const rel = path.relative(ROOT, file);

      for (const pattern of IMPORT_PATTERNS) {
        for (const match of body.matchAll(pattern)) {
          const specifier = match[1];

          // Cross-workspace via package name.
          if (specifier.startsWith(SCOPE)) {
            const dep = specifier.slice(SCOPE.length).split('/')[0];
            if (!ALLOWED[name].includes(dep) && !allowed.has(dep)) {
              fail(`${rel}: ${name} may not import @me-palnadu/${dep} (ARCHITECTURE.md section 3)`);
            }
            targets.add(dep);
            continue;
          }

          // Relative escape out of the workspace.
          if (specifier.startsWith('.')) {
            const resolved = path.resolve(path.dirname(file), specifier);
            if (!resolved.startsWith(src)) {
              fail(
                `${rel}: relative import "${specifier}" escapes ${workspaceDir} (ARCHITECTURE.md section 3)`,
              );
            }
            continue;
          }

          // App-to-app source imports must never appear.
          if (/^@?\/?(apps\/)?(web|admin|api)\//.test(specifier)) {
            fail(
              `${rel}: cross-application import "${specifier}" is forbidden (ARCHITECTURE.md section 3)`,
            );
          }

          // Persistence is confined to apps/api.
          if (
            /(^|\/)(@prisma\/client|prisma|@nestjs\/mongoose|mongodb)(\/|$)/.test(specifier) &&
            name !== 'api'
          ) {
            fail(
              `${rel}: persistence import "${specifier}" is only allowed in apps/api (ARCHITECTURE.md section 5)`,
            );
          }
        }
      }

      // NEXT_PUBLIC_ names that look like secrets.
      for (const match of body.matchAll(/NEXT_PUBLIC_[A-Z0-9_]*/g)) {
        if (/(SECRET|TOKEN|PASSWORD|PRIVATE_KEY|CREDENTIAL|DSN)/.test(match[0])) {
          fail(`${rel}: ${match[0]} would expose a secret (SECURITY.md section 3)`);
        }
      }
    }
  }

  // Cycle detection over the workspace graph.
  const visiting = new Set();
  const done = new Set();
  const stack = [];

  function dfs(node) {
    if (visiting.has(node)) {
      const cycle = [...stack.slice(stack.indexOf(node)), node].join(' -> ');
      fail(`import cycle: ${cycle} (ARCHITECTURE.md section 3)`);
      return;
    }
    if (done.has(node)) return;
    visiting.add(node);
    stack.push(node);
    for (const next of edges.get(node) ?? []) dfs(next);
    stack.pop();
    visiting.delete(node);
    done.add(node);
  }

  for (const node of edges.keys()) dfs(node);

  notes.push(`${edges.size} workspace(s) scanned`);
  notes.push(
    `edges: ${[...edges].map(([k, v]) => `${k}->{${[...v].join(',') || '-'}}`).join(' ')}`,
  );

  for (const message of notes) console.log(`  ok   ${message}`);
  for (const message of failures) console.error(`  FAIL ${message}`);
  console.log(`\nboundaries: ${failures.length} violation(s)`);
  process.exit(failures.length === 0 ? 0 : 1);
}

await main();
