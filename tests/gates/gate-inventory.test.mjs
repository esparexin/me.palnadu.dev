import {describe, expect, it} from 'vitest';
import {parseInventoryTable} from '../../scripts/lib/gate-inventory.mjs';

/**
 * Regression tests for the gate-inventory parser.
 *
 * Background: the parser was originally an inline regex in validate-docs.mjs.
 * When the CI_GATES.md table format changed, the regex matched nothing, the
 * documented set became empty, and the gate reported success while comparing
 * nothing - it accepted a fabricated job without complaint. These tests exist so
 * that a future format change fails loudly instead of silently.
 */

const header = [
  '## 3. Required status checks for the ruleset',
  '',
  '| Check name (what GitHub matches) | Job id | Area | Workflow |',
  '| -------------------------------- | ------ | ---- | -------- |',
  '| `Lint and formatting` | `lint` | 1 | ci.yml |',
  '| `Secret scanning` | `secrets` | 6 | ci.yml |',
  '',
  '## 4. Promotion rule for advisory checks',
].join('\n');

describe('parseInventoryTable', () => {
  it('extracts check name, job id, and area from every row', () => {
    const {rows, errors} = parseInventoryTable(header);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      {check: 'Lint and formatting', jobId: 'lint', area: '1'},
      {check: 'Secret scanning', jobId: 'secrets', area: '6'},
    ]);
  });

  it('tolerates the whitespace padding that a formatter introduces', () => {
    const padded = header.replace(
      '| `Lint and formatting` | `lint` | 1 | ci.yml |',
      '| `Lint and formatting`              | `lint`   | 1    | ci.yml  |',
    );
    expect(parseInventoryTable(padded).rows).toHaveLength(2);
  });

  it('refuses to report success when the table yields no rows', () => {
    // This is the exact failure mode that shipped: a parse producing an empty
    // inventory must be an error, not an empty comparison that passes.
    const {rows, errors} = parseInventoryTable(
      '## 3. Required status checks\n\nNo table here.\n\n## 4. Next',
    );
    expect(rows).toEqual([]);
    expect(errors.join(' ')).toMatch(/zero rows/i);
  });

  it('errors when the section is missing entirely', () => {
    const {errors} = parseInventoryTable('# Document\n\nNo section 3 at all.');
    expect(errors.join(' ')).toMatch(/no "## 3\./i);
  });

  it('errors on a row that lost columns', () => {
    const truncated = header.replace(
      '| `Secret scanning` | `secrets` | 6 | ci.yml |',
      '| `Secret scanning` | `secrets` |',
    );
    const {errors} = parseInventoryTable(truncated);
    expect(errors.join(' ')).toMatch(/missing columns|malformed/i);
  });

  it('errors when the area is not a number', () => {
    const badArea = header.replace('| `lint` | 1 |', '| `lint` | many |');
    expect(parseInventoryTable(badArea).errors.join(' ')).toMatch(/malformed/i);
  });

  it('still returns the valid rows alongside a malformed-row error', () => {
    const mixed = header.replace(
      '| `Secret scanning` | `secrets` | 6 | ci.yml |',
      '| broken row |',
    );
    const {rows, errors} = parseInventoryTable(mixed);
    expect(rows.map((row) => row.jobId)).toEqual(['lint']);
    expect(errors.length).toBeGreaterThan(0);
  });
});
