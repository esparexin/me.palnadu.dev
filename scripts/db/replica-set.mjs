#!/usr/bin/env node
/**
 * Ephemeral single-node MongoDB replica set for integration tests (B3).
 *
 * Why this exists: Prisma's MongoDB connector uses transactions internally, and
 * MongoDB only permits transactions on a replica set. A standalone `mongod` fails
 * with "Transactions are not supported by this deployment". This harness starts a
 * single-node replica set so integration tests exercise the real code path rather
 * than a configuration flag.
 *
 * Design constraints, all deliberate:
 *   - a dedicated data directory under the OS temp dir, removed on exit;
 *   - a dedicated port, never the default 27017, so a developer's own MongoDB is
 *     never started, stopped, or contacted by a test run;
 *   - loopback binding only, so nothing is reachable off the machine;
 *   - a test-only database name;
 *   - readiness means "is writable primary", not merely "process started";
 *   - transactions are proven by executing one, not asserted from configuration;
 *   - deterministic teardown on success, failure, and SIGINT/SIGTERM.
 *
 * mongod is started with --fork and a pidfile rather than being spawned as a child,
 * so the harness never has to manage a long-lived child process or leave a zombie.
 *
 * Usage:
 *   node scripts/db/replica-set.mjs up      # start, initialise, verify, print the URI
 *   node scripts/db/replica-set.mjs down    # stop and clean up
 *   node scripts/db/replica-set.mjs status  # report without starting
 */

import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import path from 'node:path';

/**
 * State lives in a directory created with owner-only permissions.
 *
 * The OS temp directory is world-writable, so anything created inside it with the
 * default mode can be read or pre-created by another local user. CodeQL flagged
 * exactly this (`js/insecure-temporary-file`), and it is a real weakness: a
 * predictable path in a shared directory allows a local attacker to substitute a
 * pid file or a log. The directory is therefore created with mode 0700 and every
 * file inside it inherits that owner-only access.
 */
const STATE_DIR_MODE = 0o700;
const STATE_DIR = path.join(tmpdir(), 'me-palnadu-test-replica');
const STATE_FILE = path.join(STATE_DIR, 'state.json');
const DATA_DIR = path.join(STATE_DIR, 'data');
const LOG_FILE = path.join(STATE_DIR, 'mongod.log');
const PID_FILE = path.join(STATE_DIR, 'mongod.pid');
const REPLICA_SET_NAME = 'rs0';
const HOST = '127.0.0.1';
const DEFAULT_PORT = 27118;
export const TEST_DATABASE = 'me_palnadu_integration_test';
const READY_TIMEOUT_MS = 60_000;
const SHUTDOWN_TIMEOUT_MS = 15_000;

export const fail = (message) => {
  console.error(`replica-set: ${message}`);
  process.exit(1);
};

const readState = () =>
  existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : null;

const writeState = (state) =>
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), {mode: STATE_DIR_MODE, flag: 'w'});

const readPid = () =>
  existsSync(PID_FILE) ? Number.parseInt(readFileSync(PID_FILE, 'utf8').trim(), 10) : null;

const pidAlive = (pid) => {
  if (!Number.isInteger(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const mongodBinary = () => {
  for (const candidate of [
    '/opt/homebrew/bin/mongod',
    '/usr/local/bin/mongod',
    '/usr/bin/mongod',
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  const result = spawnSync('which', ['mongod'], {encoding: 'utf8'});
  const found = result.stdout.trim();
  if (result.status !== 0 || found.length === 0) {
    fail(
      'mongod was not found on PATH. Integration tests require a local MongoDB server; install MongoDB 7.x (for example `brew install mongodb-community`) and re-run. Tests fail rather than silently skipping.',
    );
  }
  return found;
};

const isPortFree = (port) =>
  new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, HOST);
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Readiness is "isWritablePrimary", because MongoDB reports a started replica set
 * as ok before an election has completed, and Prisma's nested writes fail until then.
 */
const waitForWritablePrimary = async (uri, timeoutMs) => {
  const {MongoClient} = await import('mongodb');
  const deadline = Date.now() + timeoutMs;
  let lastError = 'no attempt made';

  while (Date.now() < deadline) {
    const client = new MongoClient(uri, {directConnection: true, serverSelectionTimeoutMS: 2_000});
    try {
      await client.connect();
      const hello = await client.db('admin').command({hello: 1});
      await client.close();
      if (hello.ok === 1 && hello.isWritablePrimary === true) {
        return {ok: true, setName: hello.setName ?? null, isWritablePrimary: true};
      }
      lastError = `hello.ok=${hello.ok} isWritablePrimary=${hello.isWritablePrimary}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await client.close().catch(() => undefined);
    }
    await sleep(500);
  }
  throw new Error(
    `replica set did not reach a writable primary within ${timeoutMs}ms: ${lastError}`,
  );
};

/** Proves a transaction actually executes, which is what Prisma requires. */
const verifyTransactions = async (uri) => {
  const {MongoClient} = await import('mongodb');
  const client = new MongoClient(uri, {directConnection: true});
  try {
    await client.connect();
    const probe = client.db(TEST_DATABASE).collection('__transaction_probe__');
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        await probe.insertOne({ok: true}, {session});
      });
    } finally {
      await session.endSession();
    }
    const {deletedCount} = await probe.deleteMany({});
    if (deletedCount !== 1)
      throw new Error('transaction probe did not commit exactly one document');
    return true;
  } catch (error) {
    throw new Error(
      `transactions are unavailable on this deployment, and Prisma requires them: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } finally {
    await client.close().catch(() => undefined);
  }
};

export const down = () => {
  const pid = readPid() ?? readState()?.pid ?? null;
  if (pidAlive(pid)) {
    const result = spawnSync(mongodBinary(), ['--dbpath', DATA_DIR, '--shutdown'], {
      encoding: 'utf8',
    });
    if (result.status !== 0 && pidAlive(pid)) {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        // Already gone.
      }
    }
  }
  rmSync(STATE_DIR, {recursive: true, force: true});
  return pid !== null;
};

export const up = async ({port = DEFAULT_PORT, quiet = false} = {}) => {
  const existing = readState();
  if (existing && pidAlive(existing.pid)) {
    if (!quiet)
      console.log(`replica-set: already running (pid ${existing.pid}, port ${existing.port})`);
    return existing;
  }

  rmSync(STATE_DIR, {recursive: true, force: true});
  // Owner-only: the data directory holds a live database for the duration of a run.
  mkdirSync(STATE_DIR, {recursive: true, mode: STATE_DIR_MODE});
  mkdirSync(DATA_DIR, {recursive: true, mode: STATE_DIR_MODE});

  // A previous run may still be releasing the port for a moment after its teardown.
  // Wait briefly for it to free rather than failing a clean run on that race. The
  // wait is bounded: if something else genuinely owns the port, we still fail and
  // we never touch a process we did not start.
  const portDeadline = Date.now() + 10_000;
  while (Date.now() < portDeadline && !(await isPortFree(port))) {
    await sleep(250);
  }
  if (!(await isPortFree(port))) {
    fail(
      `port ${port} is already in use. Pass --port to choose another. Never reuse 27017: it may be a developer's own MongoDB, which this harness must never touch.`,
    );
  }

  const binary = mongodBinary();
  const start = spawnSync(
    binary,
    [
      '--dbpath',
      DATA_DIR,
      '--port',
      String(port),
      '--bind_ip',
      HOST,
      '--replSet',
      REPLICA_SET_NAME,
      '--pidfilepath',
      PID_FILE,
      '--logpath',
      LOG_FILE,
      '--logappend',
      '--fork',
    ],
    {encoding: 'utf8'},
  );
  if (start.status !== 0) {
    const detail = (start.stderr || start.stdout || '').trim().split('\n').slice(-3).join(' | ');
    rmSync(STATE_DIR, {recursive: true, force: true});
    fail(`mongod failed to start: ${detail || 'no output'}`);
  }

  const pid = readPid();
  if (!pidAlive(pid)) {
    rmSync(STATE_DIR, {recursive: true, force: true});
    fail(`mongod reported success but no live pid was written to ${PID_FILE}`);
  }

  const directUri = `mongodb://${HOST}:${port}/?directConnection=true`;
  const uri = `mongodb://${HOST}:${port}/${TEST_DATABASE}?replicaSet=${REPLICA_SET_NAME}`;

  const initiateDeadline = Date.now() + READY_TIMEOUT_MS;
  let initiated = false;
  let lastError = 'no attempt made';
  while (Date.now() < initiateDeadline && !initiated) {
    const {MongoClient} = await import('mongodb');
    const client = new MongoClient(directUri, {
      directConnection: true,
      serverSelectionTimeoutMS: 2_000,
    });
    try {
      await client.connect();
      await client.db('admin').command({
        replSetInitiate: {_id: REPLICA_SET_NAME, members: [{_id: 0, host: `${HOST}:${port}`}]},
      });
      initiated = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastError = message;
      if (/already initialized/i.test(message)) initiated = true;
    } finally {
      await client.close().catch(() => undefined);
    }
    if (!initiated) await sleep(400);
  }
  if (!initiated) {
    down();
    fail(`could not initialise the replica set within ${READY_TIMEOUT_MS}ms: ${lastError}`);
  }

  try {
    await waitForWritablePrimary(uri, READY_TIMEOUT_MS);
    await verifyTransactions(uri);
  } catch (error) {
    down();
    throw error;
  }

  const state = {pid, port, uri, host: HOST, database: TEST_DATABASE, dataDir: DATA_DIR};
  writeState(state);
  if (!quiet) {
    console.log(`replica-set: ready on ${HOST}:${port} (pid ${pid}), transactions verified`);
    console.log(`replica-set: DATABASE_URL=${uri}`);
  }
  return state;
};

export const status = () => {
  const state = readState();
  const pid = readPid() ?? state?.pid ?? null;
  return state && pidAlive(pid) ? {...state, running: true} : null;
};

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === `file://${path.resolve(process.argv[1])}`;

if (invokedDirectly) {
  const command = process.argv[2] ?? 'status';
  const portArgument = process.argv.indexOf('--port');
  const port =
    portArgument > -1 ? Number.parseInt(process.argv[portArgument + 1] ?? '', 10) : DEFAULT_PORT;

  const shutdown = () => {
    try {
      down();
    } catch {
      // Teardown on signal must not mask the original failure.
    }
  };
  process.on('SIGINT', () => {
    shutdown();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    shutdown();
    process.exit(143);
  });

  try {
    if (command === 'up') {
      await up({port});
    } else if (command === 'down') {
      console.log(`replica-set: cleaned up (${down() ? 'was running' : 'nothing running'})`);
    } else if (command === 'status') {
      const state = status();
      if (state) {
        console.log(`running pid=${state.pid} port=${state.port}`);
      } else {
        console.log('not running');
        process.exitCode = 1;
      }
    } else {
      fail(`unknown command "${command}" (expected up, down, or status)`);
    }
  } catch (error) {
    shutdown();
    fail(error instanceof Error ? error.message : String(error));
  }
}
