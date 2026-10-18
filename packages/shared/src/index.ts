/**
 * Framework-free utilities with one named purpose each (ARCHITECTURE.md 4).
 * No React, no Next, no Nest, no Prisma, no browser or Node globals: if a helper
 * needs a framework, it does not belong in this package.
 */

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** `2024-03` -> `Mar 2024`. Returns the input unchanged when it is malformed. */
export const formatMonth = (month: string): string => {
  const match = /^([0-9]{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) return month;
  const year = match[1] as string;
  const index = Number.parseInt(match[2] as string, 10) - 1;
  return `${MONTH_LABELS[index] as string} ${year}`;
};

/**
 * Inclusive tenure in whole years and months between two `YYYY-MM` months.
 * `computeTenure('2023-04', '2026-01')` -> `{ years: 2, months: 9 }`
 * (33 months elapsed). The function measures elapsed months; it does not count
 * the start and end month twice.
 *
 * Stored duplicates of this value are forbidden (SSOT_POLICY.md 5), so the
 * function is the only implementation in the repository.
 */
export const computeTenure = (
  startMonth: string,
  endMonth: string,
): {years: number; months: number} => {
  const parse = (value: string): [number, number] | null => {
    const match = /^([0-9]{4})-(0[1-9]|1[0-2])$/.exec(value);
    if (!match) return null;
    return [Number.parseInt(match[1] as string, 10), Number.parseInt(match[2] as string, 10)];
  };

  const start = parse(startMonth);
  const end = parse(endMonth);
  if (!start || !end) return {years: 0, months: 0};

  const months = (end[0] - start[0]) * 12 + (end[1] - start[1]);
  if (months < 0) return {years: 0, months: 0};

  return {years: Math.floor(months / 12), months: months % 12};
};

/** `Apr 2023 - Present`, `Jan 2024 - Mar 2025`, `Jan 2024` for an open range. */
export const formatDateRange = (startMonth: string, endMonth?: string, current = false): string => {
  const start = formatMonth(startMonth);
  if (current || endMonth === undefined) return `${start} - Present`;
  return `${start} - ${formatMonth(endMonth)}`;
};

/** Human tenure summary: `2 yrs 10 mos`, `7 mos`, `1 yr`. */
export const formatTenure = (startMonth: string, endMonth?: string): string => {
  const end = endMonth ?? startMonth;
  const {years, months} = computeTenure(startMonth, end);
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} yr${years === 1 ? '' : 's'}`);
  if (months > 0) parts.push(`${months} mo${months === 1 ? '' : 's'}`);
  return parts.length > 0 ? parts.join(' ') : '0 mos';
};

const WORDS_PER_MINUTE = 220;

/** Reading time rounded up to whole minutes, minimum 1, never derived twice. */
export const computeReadingTime = (markdown: string): number => {
  const words = markdown.trim().split(/\s+/u).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
};

/**
 * Timeline order for career entries: newest first, then explicit `sortIndex`,
 * then id so the order is total and stable (ARCHITECTURE.md 7).
 */
export interface OrderableExperience {
  id: string;
  startDate: string;
  current: boolean;
  sortIndex: number;
}

export const compareExperience = (a: OrderableExperience, b: OrderableExperience): number => {
  if (a.startDate !== b.startDate) return a.startDate < b.startDate ? 1 : -1;
  if (a.current !== b.current) return a.current ? -1 : 1;
  if (a.sortIndex !== b.sortIndex) return a.sortIndex - b.sortIndex;
  return a.id.localeCompare(b.id);
};

export interface DatedRecord {
  publishedAt?: string | undefined;
  createdAt: string;
}

export const comparePublishedDesc = (a: DatedRecord, b: DatedRecord): number => {
  const left = a.publishedAt ?? a.createdAt;
  const right = b.publishedAt ?? b.createdAt;
  if (left !== right) return left < right ? 1 : -1;
  return 0;
};

/** Lowercase kebab slug, matching the SlugSchema contract. */
export const slugify = (input: string): string =>
  input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/['’]/gu, '')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 120);

/** Clamp a requested page into the range a result set can actually satisfy. */
export const clampPage = (requested: number, totalItems: number, limit: number): number => {
  if (limit <= 0) return 1;
  const lastPage = Math.max(1, Math.ceil(totalItems / limit));
  return Math.min(Math.max(1, Math.trunc(requested)), lastPage);
};
