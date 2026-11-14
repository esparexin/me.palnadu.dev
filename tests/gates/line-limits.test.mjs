import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';

const ROOT = new URL('../..', import.meta.url).pathname;
const ALLOWLIST_FILE = join(ROOT, 'scripts/line-limit-allowlist.json');

describe('line-limit allowlist integrity (CI_GATES.md area 1 / area 5)', () => {
  it('allowlist file exists and parses as valid JSON', () => {
    expect(existsSync(ALLOWLIST_FILE)).toBe(true);
    const content = readFileSync(ALLOWLIST_FILE, 'utf8');
    const allowlist = JSON.parse(content);
    expect(Array.isArray(allowlist)).toBe(true);
    expect(allowlist.length).toBeGreaterThan(0);
  });

  it('every allowlist entry contains required fields and valid constraints', () => {
    const allowlist = JSON.parse(readFileSync(ALLOWLIST_FILE, 'utf8'));
    const today = new Date().toISOString().slice(0, 10);

    for (const entry of allowlist) {
      expect(typeof entry.file).toBe('string');
      expect(typeof entry.maxLines).toBe('number');
      expect(entry.maxLines).toBeGreaterThan(250);
      expect(typeof entry.reason).toBe('string');
      expect(entry.reason.trim().length).toBeGreaterThan(10);
      expect(typeof entry.allowedBy).toBe('string');
      expect(typeof entry.category).toBe('string');
      expect(typeof entry.reviewBy).toBe('string');
      expect(entry.reviewBy >= today).toBe(true);

      const targetPath = join(ROOT, entry.file);
      expect(existsSync(targetPath), `Target file ${entry.file} must exist`).toBe(true);

      const content = readFileSync(targetPath, 'utf8');
      const lines = content.split('\n').length;
      expect(
        lines,
        `File ${entry.file} line count (${lines}) must not exceed ratcheted maxLines (${entry.maxLines})`,
      ).toBeLessThanOrEqual(entry.maxLines);
    }
  });
});
