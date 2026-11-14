import {randomBytes, scrypt as scryptCallback, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';

/**
 * Password hashing (ADR-0009).
 *
 * scrypt from `node:crypto`, not Argon2id. Argon2id is preferable in principle, but
 * `crypto.argon2` does not exist on the Node version this repository pins (it was
 * added in 24.7.0; `.nvmrc` pins 22), and a library would mean a native dependency and
 * a compile step. Using `crypto.argon2` would pass locally on Node 26 and fail in CI
 * on Node 22, which is the worst possible failure shape.
 *
 * scrypt is memory-hard and is listed by OWASP as an acceptable password hashing
 * function. These parameters are the OWASP baseline for scrypt: N=2^16, r=8, p=1,
 * which is roughly 64 MiB per hash.
 */

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: {N: number; r: number; p: number; maxmem: number},
) => Promise<Buffer>;

const COST = 2 ** 16;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 32;
/** scrypt needs roughly 128 * N * r bytes; anything below this fails to allocate. */
const MAX_MEMORY = 256 * COST * BLOCK_SIZE;

/**
 * The stored format. Self-describing so parameters can be raised later and existing
 * hashes keep verifying:
 *
 *   `scrypt$N$r$p$saltBase64$keyBase64`
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELISM,
    maxmem: MAX_MEMORY,
  });
  return [
    'scrypt',
    String(COST),
    String(BLOCK_SIZE),
    String(PARALLELISM),
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
};

/**
 * Verifies a candidate against a stored hash.
 *
 * Returns false for a malformed hash rather than throwing, so a corrupted row denies
 * access instead of crashing the login endpoint.
 *
 * The comparison is constant-time. Note that a hash which does not parse returns
 * earlier than one that does; that timing difference is inherent to the format and
 * reveals only that the stored value is malformed, which the caller already knows.
 */
export const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const cost = Number(parts[1]);
  const blockSize = Number(parts[2]);
  const parallelism = Number(parts[3]);
  if (!Number.isInteger(cost) || !Number.isInteger(blockSize) || !Number.isInteger(parallelism)) {
    return false;
  }
  // Refuse absurd parameters from a tampered row rather than allocating on its word.
  if (cost < 2 ** 12 || cost > 2 ** 20 || blockSize < 1 || blockSize > 32) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4] ?? '', 'base64');
    expected = Buffer.from(parts[5] ?? '', 'base64');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  let derived: Buffer;
  try {
    derived = await scrypt(password.normalize('NFKC'), salt, expected.length, {
      N: cost,
      r: blockSize,
      p: parallelism,
      maxmem: 256 * cost * blockSize,
    });
  } catch {
    return false;
  }

  return derived.length === expected.length && timingSafeEqual(derived, expected);
};

/**
 * A hash of a random value, used to spend roughly the same time when no account
 * matches.
 *
 * Without this, "no such account" returns faster than "wrong password", which is an
 * enumeration oracle by timing even when the response body is identical.
 */
const decoyHash = 'scrypt$65536$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + 'A'.repeat(86);

export const verifyAgainstDecoy = async (password: string): Promise<void> => {
  await verifyPassword(password, decoyHash);
};
