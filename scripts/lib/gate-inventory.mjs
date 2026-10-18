/**
 * Gate inventory parsing (CI_GATES.md area 5, check 6).
 *
 * Kept as a pure module so it can be tested directly. The reason it is a module
 * rather than an inline regex: an earlier version parsed the table with a regex
 * that silently stopped matching when the table format changed. The inventory then
 * became an empty set and the gate passed vacuously, which is exactly the false
 * green CI_GATES.md area 11 exists to prevent - caused by the very gate meant to
 * prevent it.
 *
 * Two properties follow from that and are enforced here:
 *   1. a parse that yields no rows is an error, never an empty comparison;
 *   2. every row must carry all four columns, so a partial table cannot be
 *      mistaken for a complete one.
 */

/**
 * Rows of the CI_GATES.md section 3 table, in order.
 * @returns {{rows: Array<{check: string, jobId: string, area: string}>, errors: string[]}}
 */
export function parseInventoryTable(markdown) {
  const errors = [];
  const rows = [];
  const section = markdown.split('## 3. Required status checks')[1]?.split('## 4.')[0];

  if (section === undefined) {
    return {rows, errors: ['CI_GATES.md has no "## 3. Required status checks" section']};
  }

  const tableLines = section
    .split('\n')
    .filter((line) => line.trim().startsWith('|') && !/^\s*\|[\s|:-]+\|\s*$/.test(line));

  let sawHeader = false;
  for (const line of tableLines) {
    const cells = line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());

    if (!sawHeader) {
      sawHeader = true;
      if (cells.length < 4) {
        errors.push(
          `CI_GATES.md section 3 table header must have 4 columns (check name, job id, area, workflow), found ${cells.length}`,
        );
      }
      continue;
    }

    if (cells.length < 4) {
      errors.push(`CI_GATES.md section 3 row is missing columns: ${line.trim()}`);
      continue;
    }

    const [checkCell, jobCell, areaCell] = cells;
    const check = checkCell.replace(/`/g, '').trim();
    const jobId = jobCell.replace(/`/g, '').trim();
    const area = areaCell.trim();

    if (check.length === 0 || jobId.length === 0 || !/^\d+$/.test(area)) {
      errors.push(`CI_GATES.md section 3 row is malformed: ${line.trim()}`);
      continue;
    }
    rows.push({check, jobId, area});
  }

  if (rows.length === 0) {
    errors.push(
      'CI_GATES.md section 3 table parsed to zero rows; refusing to compare an empty inventory against the workflows',
    );
  }

  return {rows, errors};
}
