#!/usr/bin/env node
/**
 * Runs integration tests against an ephemeral single-node MongoDB replica set.
 *
 * Behaviour that matters, and why:
 *   - The database is started before the tests and torn down afterwards, even if
 *     the tests fail or the process is interrupted.
 *   - If MongoDB cannot start, the run FAILS. It never falls back to a standalone
 *     server, never skips the database tests, and never reports success without
 *     having exercised them (B3).
 *   - The harness works from a clean checkout: it uses `turbo build` so the
 *     workspace packages are compiled, rather than relying on a warm dist/.
 */

import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {down, up} from './replica-set.mjs';
import {parseSchema} from '../lib/schema-diff.mjs';

const ROOT = process.cwd();
const SCHEMA_PATH = path.join(ROOT, 'apps/api/prisma/schema.prisma');

const run = (command, args, env) =>
  spawnSync(command, args, {
    stdio: 'inherit',
    env: {...process.env, ...env},
    shell: process.platform === 'win32',
  });

let replica;

try {
  replica = await up({quiet: true});
  console.log(`integration: replica set ready on ${replica.host}:${replica.port}`);

  // Build the dependency graph first: a clean checkout has no compiled workspace
  // packages, and an earlier failure of exactly this kind is why this step exists.
  const build = run('pnpm', ['build'], {});
  if (build.status !== 0) {
    console.error('integration: build failed; not running database tests');
    process.exit(1);
  }

  // Apply the schema to the disposable database before testing.
  //
  // This is not optional: without it the unique index on `slug` does not exist in
  // the database, and the duplicate-slug test passes for the wrong reason - it
  // would be asserting behaviour of a schema that was never applied. Running
  // `db push` here also exercises the schema-management process against disposable
  // data before it is ever pointed at a non-disposable environment (B2 item 3).
  const push = run(
    'pnpm',
    ['--filter', '@me-palnadu/api', 'exec', 'prisma', 'db', 'push', '--skip-generate'],
    {DATABASE_URL: replica.uri},
  );
  if (push.status !== 0) {
    console.error('integration: prisma db push failed; not running database tests');
    process.exit(1);
  }

  // Verify that the indexes the schema declares actually exist in the database.
  //
  // `prisma db pull` re-introspection is not supported for the MongoDB provider
  // without `--force`, and Prisma documents that forcing it loses relations,
  // comments, and mapped fields. Rather than depend on a lossy introspection, this
  // reads the real index list from the disposable database and compares it with the
  // declared schema: the declared indexes exist, with the declared uniqueness.
  //
  // This is a guardrail. It does not prove data preservation, application
  // compatibility, or rollback safety.
  const {MongoClient} = await import('mongodb');
  const client = new MongoClient(replica.uri, {directConnection: true});
  try {
    await client.connect();
    const declared = parseSchema(readFileSync(SCHEMA_PATH, 'utf8'));
    if (declared.errors.length > 0) {
      for (const error of declared.errors) console.error(`integration: ${error}`);
      process.exit(1);
    }

    const existing = new Set(
      (await client.db(replica.database).listCollections().toArray()).map(
        (collection) => collection.name,
      ),
    );

    const missingCollections = Object.keys(declared.models).filter((model) => !existing.has(model));
    if (missingCollections.length > 0) {
      console.error(
        `integration: collections declared in the schema do not exist: ${missingCollections.join(', ')}`,
      );
      process.exit(1);
    }

    const mismatches = [];
    for (const [model, spec] of Object.entries(declared.models)) {
      const actual = await client.db(replica.database).collection(model).indexes();
      const uniqueKeys = new Set(
        actual
          .filter((index) => index.unique === true)
          .map((index) => Object.keys(index.key ?? {}).join(',')),
      );
      const indexedKeys = new Set(actual.map((index) => Object.keys(index.key ?? {}).join(',')));

      for (const index of spec.indexes) {
        const key = index.fields.join(',');
        if (index.unique ? !uniqueKeys.has(key) : !indexedKeys.has(key)) {
          mismatches.push(
            `${model}: declared @@${index.unique ? 'unique' : 'index'}(${key}) is absent`,
          );
        }
      }
      for (const field of Object.values(spec.fields)) {
        if (field.unique && !uniqueKeys.has(field.name)) {
          mismatches.push(`${model}: declared unique field ${field.name} has no unique index`);
        }
      }
    }

    if (mismatches.length > 0) {
      for (const mismatch of mismatches) console.error(`integration: ${mismatch}`);
      process.exit(1);
    }
    console.log('integration: declared collections and indexes exist in the database');
  } finally {
    await client.close().catch(() => undefined);
  }

  const test = run('pnpm', ['--filter', '@me-palnadu/api', 'run', 'test:integration'], {
    DATABASE_URL: replica.uri,
    NODE_ENV: 'test',
  });

  if (test.status !== 0) process.exitCode = test.status ?? 1;
} catch (error) {
  console.error(`integration: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  try {
    down();
  } catch {
    // Teardown must never mask the original failure.
  }
}
