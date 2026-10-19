import {describe, expect, it} from 'vitest';
import {
  ARTICLE_KINDS,
  AUDIT_ACTIONS,
  CONTENT_STATUSES,
  ERROR_CODES,
  EXPERIENCE_KINDS,
  ROLES,
} from './index.js';

describe('enum hygiene (SSOT_POLICY 3.4)', () => {
  const enums = {
    EXPERIENCE_KINDS,
    ARTICLE_KINDS,
    CONTENT_STATUSES,
    AUDIT_ACTIONS,
    ROLES,
    ERROR_CODES,
  };

  for (const [name, members] of Object.entries(enums)) {
    it(`${name} has unique, non-empty members in one consistent wire style`, () => {
      expect(members.length).toBeGreaterThan(0);
      expect(new Set(members).size).toBe(members.length);
      // Domain values are kebab-case; protocol-level error codes are
      // SCREAMING_SNAKE because they appear verbatim in the error envelope.
      // Mixing the two inside one enum would be a defect.
      const kebab = members.every((m) => /^[a-z][a-z0-9_]*$/.test(m));
      const screaming = members.every((m) => /^[A-Z][A-Z0-9_]*$/.test(m));
      expect(kebab || screaming).toBe(true);
    });
  }

  it('keeps the published status inside CONTENT_STATUSES', () => {
    expect(CONTENT_STATUSES).toContain('published');
    expect(CONTENT_STATUSES).toContain('draft');
    expect(CONTENT_STATUSES).toContain('archived');
  });
});
