import {describe, expect, it} from 'vitest';
import {
  ADMIN_ALLOWLIST,
  API_ROUTES,
  ARTICLE_KINDS,
  CONTENT_STATUSES,
  ContactMessageCreateSchema,
  ERROR_CODES,
  ExperienceCreateSchema,
  ExperienceUpdateSchema,
  EXPERIENCE_KINDS,
  MessageStatusSchema,
  PaginationQuerySchema,
  ProjectCreateSchema,
  ROLES,
  SessionClaimsSchema,
  SkillCategorySchema,
  isAllowlistedGithubId,
} from './index.js';

/** Factories consume the schemas, so a schema change breaks fixtures loudly. */
const validExperience = () => ({
  org: 'Example Organisation',
  title: 'Endpoint Engineer',
  startDate: '2023-04',
  endDate: '2026-01',
  current: false,
  kind: 'full_time',
  summary: 'Placeholder summary used only in tests.',
  highlights: ['Placeholder highlight'],
  tech: ['Jamf Pro', 'Intune'],
  sortIndex: 0,
  published: false,
});

const validProject = () => ({
  slug: 'placeholder-project',
  title: 'Placeholder Project',
  summary: 'Placeholder summary used only in tests.',
  status: 'published' as const,
  publishedAt: '2026-01-15',
});

describe('enum hygiene (SSOT_POLICY 3.4)', () => {
  const enums = {
    EXPERIENCE_KINDS,
    ARTICLE_KINDS,
    CONTENT_STATUSES,
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

describe('ExperienceCreateSchema cross-field rules', () => {
  it('accepts a complete closed-ended entry', () => {
    expect(ExperienceCreateSchema.safeParse(validExperience()).success).toBe(true);
  });

  it('rejects an end date on a current role', () => {
    const result = ExperienceCreateSchema.safeParse({
      ...validExperience(),
      current: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing end date on a past role', () => {
    const result = ExperienceCreateSchema.safeParse({
      ...validExperience(),
      endDate: undefined,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an end date before the start date', () => {
    const result = ExperienceCreateSchema.safeParse({
      ...validExperience(),
      startDate: '2024-01',
      endDate: '2023-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown kind instead of coercing it', () => {
    expect(
      ExperienceCreateSchema.safeParse({...validExperience(), kind: 'consulting'}).success,
    ).toBe(false);
  });

  it('applies defaults for optional collections', () => {
    const parsed = ExperienceCreateSchema.parse({
      ...validExperience(),
      highlights: undefined,
      tech: undefined,
    });
    expect(parsed.highlights).toEqual([]);
    expect(parsed.tech).toEqual([]);
  });

  it('keeps a partial update partial and free of create-time defaults', () => {
    // A patch must never apply the create defaults: doing so would overwrite
    // stored values the caller never mentioned (toPatchShape in common.ts).
    const parsed = ExperienceUpdateSchema.parse({published: true});
    expect(Object.keys(parsed)).toEqual(['published']);
    expect(parsed).not.toHaveProperty('highlights');
    expect(parsed).not.toHaveProperty('tech');
    expect(parsed).not.toHaveProperty('sortIndex');
  });
});

describe('ProjectCreateSchema', () => {
  it('requires publishedAt for a published project', () => {
    const result = ProjectCreateSchema.safeParse({...validProject(), publishedAt: undefined});
    expect(result.success).toBe(false);
  });

  it('allows a draft without publishedAt', () => {
    expect(
      ProjectCreateSchema.safeParse({...validProject(), status: 'draft', publishedAt: undefined})
        .success,
    ).toBe(true);
  });

  it('rejects a non-kebab slug', () => {
    expect(ProjectCreateSchema.safeParse({...validProject(), slug: 'Not A Slug'}).success).toBe(
      false,
    );
  });
});

describe('ContactMessageCreateSchema', () => {
  const validMessage = {
    name: 'Placeholder Visitor',
    email: 'visitor@example.com',
    message: 'This is a placeholder message body for tests only.',
  };

  it('accepts a valid submission', () => {
    expect(ContactMessageCreateSchema.safeParse(validMessage).success).toBe(true);
  });

  it('rejects a filled honeypot', () => {
    expect(
      ContactMessageCreateSchema.safeParse({...validMessage, website: 'http://spam.test'}).success,
    ).toBe(false);
  });

  it('rejects unknown keys rather than storing them', () => {
    expect(ContactMessageCreateSchema.safeParse({...validMessage, isAdmin: true}).success).toBe(
      false,
    );
  });
});

describe('admin allowlist (SECURITY.md 4.1)', () => {
  it('keys administrators on an immutable numeric id', () => {
    expect(ADMIN_ALLOWLIST.length).toBeGreaterThan(0);
    for (const entry of ADMIN_ALLOWLIST) {
      expect(Number.isInteger(entry.githubId)).toBe(true);
      expect(entry.githubId).toBeGreaterThan(0);
    }
  });

  it('recognises a seeded id and refuses an unknown one', () => {
    expect(isAllowlistedGithubId(ADMIN_ALLOWLIST[0].githubId)).toBe(true);
    expect(isAllowlistedGithubId(1)).toBe(false);
  });

  it('never puts a secret in the allowlist shape', () => {
    expect(Object.keys(ADMIN_ALLOWLIST[0]).sort()).toEqual(['githubId', 'login', 'role']);
  });
});

describe('session claims', () => {
  const claims = {
    sub: 'admin_1',
    gh_id: 230946749,
    role: 'owner',
    sid: 'sess_1',
    tv: 0,
    iss: 'me-palnadu-admin',
    aud: 'me-palnadu-api',
    iat: 1_700_000_000,
    exp: 1_700_000_900,
  };

  it('accepts a well-formed claim set', () => {
    expect(SessionClaimsSchema.safeParse(claims).success).toBe(true);
  });

  it('requires a token version so revocation can be compared', () => {
    expect(SessionClaimsSchema.safeParse({...claims, tv: undefined}).success).toBe(false);
  });

  it('rejects an unknown role', () => {
    expect(SessionClaimsSchema.safeParse({...claims, role: 'superuser'}).success).toBe(false);
  });
});

describe('shared primitives', () => {
  it('coerces pagination and applies its defaults', () => {
    expect(PaginationQuerySchema.parse({})).toEqual({page: 1, limit: 20});
    expect(PaginationQuerySchema.parse({page: '3', limit: '50'})).toEqual({page: 3, limit: 50});
  });

  it('caps the page size', () => {
    expect(PaginationQuerySchema.safeParse({limit: 500}).success).toBe(false);
  });

  it('exposes every documented API route', () => {
    expect(API_ROUTES.health.live).toBe('/health/live');
    expect(API_ROUTES.knowledge).toBe('/api/knowledge');
  });

  it('keeps message status and skill category single-sourced', () => {
    expect(MessageStatusSchema.parse('replied')).toBe('replied');
    expect(SkillCategorySchema.safeParse('mdm').success).toBe(true);
    expect(SkillCategorySchema.safeParse('wizardry').success).toBe(false);
  });
});
