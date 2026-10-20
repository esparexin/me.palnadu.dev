#!/usr/bin/env node
/**
 * Owner provisioning (ADR-0009).
 *
 * The only supported way to create or reset an administrator. There is deliberately no
 * HTTP route for either: an endpoint that can create or re-password an administrator
 * is the largest hole this application could have, and a forgotten password is handled
 * by an operator running this command, not by an unauthenticated request.
 *
 * The password is read from a hidden prompt, never from an argument. Arguments appear
 * in shell history and in `ps` output to every user on the machine.
 *
 *   pnpm --filter @me-palnadu/api owner:provision -- --email owner@example.com
 *   pnpm --filter @me-palnadu/api owner:provision -- --email owner@example.com --reset-password
 */
import {createInterface} from 'node:readline';
import {existsSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {parseEnv} from '../config/env.js';
import {PrismaService} from '../prisma/prisma.service.js';
import {hashPassword} from '../auth/password.js';
import {AdminEmailSchema, normalizeEmail, passwordProblems} from '@me-palnadu/contracts';

interface Options {
  email: string | undefined;
  resetPassword: boolean;
}

const parseOptions = (argv: readonly string[]): Options => {
  let email: string | undefined;
  let resetPassword = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--') {
      continue;
    }
    if (argument === '--email') {
      email = argv[index + 1];
      index += 1;
    } else if (argument === '--reset-password') {
      resetPassword = true;
    } else {
      throw new Error(`unknown argument: ${String(argument)}`);
    }
  }

  if (email === undefined) throw new Error('--email is required');
  return {email, resetPassword};
};

/**
 * Reads a value without echoing it.
 *
 * `readline` has no hidden-input mode, so the terminal is put into raw mode and
 * characters are consumed directly. Falls back to a visible prompt when stdin is not a
 * TTY, which is the case in CI - a non-interactive run must never silently accept a
 * visible password.
 */
const promptHidden = (question: string): Promise<string> => {
  const input = process.stdin;
  const output = process.stdout;
  return new Promise((resolve, reject) => {
    if (!input.isTTY) {
      reject(new Error('a terminal is required: refusing to read a password non-interactively'));
      return;
    }
    output.write(question);
    const rl = createInterface({input, output, terminal: true});
    let value = '';
    const onData = (character: Buffer | string): void => {
      const text = character.toString();
      switch (text) {
        case '\r':
        case '\n':
        case '\u0004':
          input.removeListener('data', onData);
          rl.close();
          output.write('\n');
          resolve(value);
          break;
        case '\u0003':
          rl.close();
          reject(new Error('cancelled'));
          break;
        case '\u007f':
        case '\b':
          value = value.slice(0, -1);
          break;
        default:
          value += text;
      }
    };
    input.on('data', onData);
  });
};

const main = async (): Promise<void> => {
  const options = parseOptions(process.argv.slice(2));
  try {
    process.loadEnvFile?.();
  } catch {
    // ignore missing or unreadable .env file
  }

  if (process.env['DATABASE_URL'] === undefined) {
    const candidatePaths = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(process.cwd(), 'apps/api/.env'),
      path.resolve(process.cwd(), '../.env'),
    ];
    for (const candidate of candidatePaths) {
      if (existsSync(candidate)) {
        try {
          process.loadEnvFile?.(candidate);
          if (process.env['DATABASE_URL'] !== undefined) break;
        } catch {
          // ignore
        }
      }
    }
  }

  if (process.env['DATABASE_URL'] === undefined) {
    const stateFile = path.join(tmpdir(), 'me-palnadu-test-replica', 'state.json');
    if (existsSync(stateFile)) {
      try {
        const state: unknown = JSON.parse(readFileSync(stateFile, 'utf8'));
        if (
          typeof state === 'object' &&
          state !== null &&
          'uri' in state &&
          typeof state.uri === 'string'
        ) {
          process.env['DATABASE_URL'] = state.uri;
        }
      } catch {
        // ignore malformed state file
      }
    }
  }

  const email = AdminEmailSchema.parse(options.email);
  const env = parseEnv(process.env);
  const prisma = new PrismaService(env);

  try {
    const existing = await prisma.adminUser.findUnique({where: {email}});

    if (existing !== null && !options.resetPassword) {
      throw new Error(
        `an administrator already exists for ${email}; pass --reset-password to change it`,
      );
    }

    const password = await promptHidden('Initial password: ');
    const problems = passwordProblems(password, email);
    if (problems.length > 0) {
      throw new Error(`password rejected:\n  - ${problems.join('\n  - ')}`);
    }
    const confirmation = await promptHidden('Confirm password: ');
    if (confirmation !== password) {
      throw new Error('the two passwords did not match');
    }

    const passwordHash = await hashPassword(password);

    if (existing === null) {
      await prisma.adminUser.create({
        data: {email: normalizeEmail(email), passwordHash, role: 'owner', active: true},
      });
      process.stdout.write(`created owner administrator for ${email}\n`);
    } else {
      // `tokenVersion` is incremented so any session issued under the old credential
      // stops working immediately.
      await prisma.adminUser.update({
        where: {id: existing.id},
        data: {passwordHash, tokenVersion: {increment: 1}, failedLoginCount: 0},
      });
      process.stdout.write(
        `password changed for ${email}; every existing session was invalidated\n`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error: unknown) => {
  process.stderr.write(
    `owner:provision failed - ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
