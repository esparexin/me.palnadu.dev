import {describe, expect, it} from 'vitest';
import {
  clampPage,
  compareExperience,
  comparePublishedDesc,
  computeReadingTime,
  computeTenure,
  formatDateRange,
  formatMonth,
  formatTenure,
  slugify,
  parseMarkdown,
  extractHeadings,
  markdownToPlainText,
  escapeXml,
  isAbsoluteHttpUrl,
} from './index.js';

describe('slugify', () => {
  it('produces a slug matching the contract pattern', () => {
    expect(slugify('Jamf Pro 10.15 Migration')).toBe('jamf-pro-10-15-migration');
  });

  it('strips accents and collapses separators', () => {
    expect(slugify('  Café   Résumé -- Guide  ')).toBe('cafe-resume-guide');
  });

  it('never emits leading or trailing separators', () => {
    expect(slugify('--Edge--')).toBe('edge');
  });

  it('returns an empty string for input with no usable characters', () => {
    expect(slugify('***')).toBe('');
  });
});

describe('computeTenure', () => {
  it('counts whole years and remaining months', () => {
    expect(computeTenure('2023-04', '2026-01')).toEqual({years: 2, months: 9});
  });

  it('counts a partial year as months', () => {
    expect(computeTenure('2025-01', '2025-08')).toEqual({years: 0, months: 7});
  });

  it('treats an identical range as zero', () => {
    expect(computeTenure('2025-01', '2025-01')).toEqual({years: 0, months: 0});
  });

  it('returns zero rather than a negative tenure', () => {
    expect(computeTenure('2026-01', '2023-01')).toEqual({years: 0, months: 0});
  });

  it('refuses to guess at a malformed month', () => {
    expect(computeTenure('2023-13', '2024-01')).toEqual({years: 0, months: 0});
    expect(computeTenure('nonsense', '2024-01')).toEqual({years: 0, months: 0});
  });
});

describe('month formatting', () => {
  it('formats a valid month', () => {
    expect(formatMonth('2024-03')).toBe('Mar 2024');
    expect(formatMonth('2024-12')).toBe('Dec 2024');
  });

  it('passes a malformed value through unchanged instead of inventing one', () => {
    expect(formatMonth('March 2024')).toBe('March 2024');
  });

  it('renders an open range as Present', () => {
    expect(formatDateRange('2023-04', undefined, true)).toBe('Apr 2023 - Present');
    expect(formatDateRange('2023-04')).toBe('Apr 2023 - Present');
  });

  it('renders a closed range', () => {
    expect(formatDateRange('2023-04', '2026-01', false)).toBe('Apr 2023 - Jan 2026');
  });

  it('summarises tenure with correct singulars', () => {
    expect(formatTenure('2025-01', '2025-02')).toBe('1 mo');
    expect(formatTenure('2024-01', '2025-01')).toBe('1 yr');
    expect(formatTenure('2023-04', '2026-01')).toBe('2 yrs 9 mos');
    expect(formatTenure('2025-01', '2025-01')).toBe('0 mos');
  });
});

describe('computeReadingTime', () => {
  it('rounds up to whole minutes', () => {
    expect(computeReadingTime('word '.repeat(221))).toBe(2);
    expect(computeReadingTime('word '.repeat(220))).toBe(1);
  });

  it('never reports zero minutes for a non-empty article', () => {
    expect(computeReadingTime('short')).toBe(1);
  });
});

describe('compareExperience', () => {
  const base = {current: false, sortIndex: 0};

  it('orders newest first', () => {
    const older = {...base, id: 'a', startDate: '2020-01'};
    const newer = {...base, id: 'b', startDate: '2024-01'};
    expect([older, newer].sort(compareExperience)).toEqual([newer, older]);
  });

  it('puts a current role ahead of a past role with the same start month', () => {
    const past = {id: 'a', startDate: '2024-01', current: false, sortIndex: 0};
    const current = {id: 'b', startDate: '2024-01', current: true, sortIndex: 5};
    expect([past, current].sort(compareExperience)).toEqual([current, past]);
  });

  it('falls back to sortIndex, then id, for a total order', () => {
    const low = {id: 'z', startDate: '2024-01', current: false, sortIndex: 1};
    const high = {id: 'a', startDate: '2024-01', current: false, sortIndex: 2};
    expect([high, low].sort(compareExperience)).toEqual([low, high]);
    const a = {...low, id: 'a'};
    const b = {...low, id: 'b'};
    expect([b, a].sort(compareExperience)).toEqual([a, b]);
  });
});

describe('comparePublishedDesc', () => {
  it('prefers publishedAt over createdAt', () => {
    const older = {publishedAt: '2026-01-01', createdAt: '2020-01-01'};
    const newer = {publishedAt: '2026-02-01', createdAt: '2020-01-01'};
    expect([older, newer].sort(comparePublishedDesc)).toEqual([newer, older]);
  });

  it('falls back to createdAt for an unpublished record', () => {
    const a = {createdAt: '2026-01-01'};
    const b = {createdAt: '2026-03-01'};
    expect([a, b].sort(comparePublishedDesc)).toEqual([b, a]);
  });

  it('is stable for identical dates', () => {
    const a = {createdAt: '2026-01-01'};
    const b = {createdAt: '2026-01-01'};
    expect(comparePublishedDesc(a, b)).toBe(0);
  });
});

describe('clampPage', () => {
  it('keeps a page inside the result set', () => {
    expect(clampPage(1, 100, 20)).toBe(1);
    expect(clampPage(5, 100, 20)).toBe(5);
    expect(clampPage(9, 100, 20)).toBe(5);
    expect(clampPage(0, 100, 20)).toBe(1);
  });

  it('never returns page zero for an empty set', () => {
    expect(clampPage(1, 0, 20)).toBe(1);
  });

  it('guards against a non-positive limit', () => {
    expect(clampPage(3, 100, 0)).toBe(1);
  });
});

describe('markdown subset', () => {
  it('renders headings at h2 and below with stable ids', () => {
    const blocks = parseMarkdown('## Getting started\n\n### Install the profile');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({type: 'heading', depth: 2, id: 'getting-started'});
    expect(blocks[1]).toMatchObject({type: 'heading', depth: 3, id: 'install-the-profile'});
  });

  it('does not treat an h1 in the body as a page heading', () => {
    // The page title is the h1 (UI_UX_STANDARDS 7.4); a `#` line is paragraph text.
    const blocks = parseMarkdown('# Not a heading');
    expect(blocks[0]?.type).toBe('paragraph');
  });

  it('keeps fenced code verbatim and out of inline parsing', () => {
    const blocks = parseMarkdown('```bash\n**not bold**\n```');
    expect(blocks).toEqual([{type: 'code', language: 'bash', value: '**not bold**'}]);
  });

  it('parses lists, quotes, and rules', () => {
    const blocks = parseMarkdown('- one\n- two\n\n> quoted\n\n---');
    expect(blocks.map((block) => block.type)).toEqual(['list', 'quote', 'rule']);
  });

  it('refuses a javascript: link rather than rendering it', () => {
    const blocks = parseMarkdown('[click](javascript:alert(1))');
    const paragraph = blocks[0];
    expect(paragraph?.type).toBe('paragraph');
    if (paragraph?.type !== 'paragraph') return;
    const link = paragraph.children.find((node) => node.type === 'link');
    expect(link).toMatchObject({type: 'link', href: '#'});
  });

  it('extracts headings for a table of contents', () => {
    const headings = extractHeadings(parseMarkdown('## One\n\n## Two'));
    expect(headings.map((heading) => heading.text)).toEqual(['One', 'Two']);
  });

  it('produces plain text for reading time', () => {
    expect(markdownToPlainText('## Title\n\nSome **bold** text.')).toBe('Title\n\nSome bold text.');
  });
});

describe('xml escaping', () => {
  it('escapes every character that would break a feed', () => {
    expect(escapeXml('<a href="x">Tom & Jerry\'s</a>')).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;',
    );
  });

  it('recognises only absolute http(s) URLs', () => {
    expect(isAbsoluteHttpUrl('https://me.palnadu.dev/knowledge-hub')).toBe(true);
    expect(isAbsoluteHttpUrl('/knowledge-hub')).toBe(false);
    expect(isAbsoluteHttpUrl('javascript:alert(1)')).toBe(false);
  });
});
