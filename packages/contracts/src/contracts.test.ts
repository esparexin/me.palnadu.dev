import {describe, expect, it} from 'vitest';
import {
  API_ROUTES,
  ARTICLE_KINDS,
  ArticleCreateSchema,
  ArticleUpdateSchema,
  AUDIT_ACTIONS,
  CACHE_TAGS,
  CONTENT_STATUSES,
  ContactMessageCreateSchema,
  ERROR_CODES,
  ExperienceCreateSchema,
  ExperienceUpdateSchema,
  EXPERIENCE_KINDS,
  FaqCreateSchema,
  FAQ_CATEGORIES,
  MediaRegisterSchema,
  MediaSignResponseSchema,
  MessageStatusSchema,
  PaginationQuerySchema,
  ProjectCreateSchema,
  RevalidateRequestSchema,
  ROLES,
  SessionClaimsSchema,
  SkillCategorySchema,
  AdminEmailSchema,
  PasswordSchema,
  passwordProblems,
  LoginRequestSchema,
  ChangePasswordRequestSchema,
  OWNER_EMAIL,
  SESSION_COOKIE_NAME,
  WEB_ROUTES,
} from './index.js';

/** Factories consume the schemas, so a schema change breaks fixtures loudly. */
const validExperience = () => ({
  slug: 'example-organisation-endpoint-engineer',
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
    FAQ_CATEGORIES,
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

  it('requires a unique public identity in kebab-case', () => {
    expect(ExperienceCreateSchema.safeParse({...validExperience(), slug: undefined}).success).toBe(
      false,
    );
    expect(
      ExperienceCreateSchema.safeParse({...validExperience(), slug: 'Not A Slug'}).success,
    ).toBe(false);
    expect(ExperienceCreateSchema.safeParse(validExperience()).success).toBe(true);
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

describe('administrator credentials (ADR-0009)', () => {
  it('normalizes email addresses and rejects invalid ones', () => {
    expect(AdminEmailSchema.parse('  Owner@Me.Palnadu.Dev  ')).toBe('owner@me.palnadu.dev');
    expect(AdminEmailSchema.safeParse('not-an-email').success).toBe(false);
    expect(AdminEmailSchema.safeParse('@missing-local.com').success).toBe(false);
    expect(AdminEmailSchema.safeParse('owner@').success).toBe(false);
  });

  it('enforces password policy rules', () => {
    expect(PasswordSchema.safeParse('Short1!').success).toBe(false);
    expect(PasswordSchema.safeParse('alllowercaseletters123').success).toBe(false);
    expect(PasswordSchema.safeParse('ALLUPPERCASELETTERS123').success).toBe(false);
    expect(PasswordSchema.safeParse('LettersWithoutDigits').success).toBe(false);
    expect(PasswordSchema.safeParse('password1234').success).toBe(false);

    const email = 'owner@me.palnadu.dev';
    const problemsWithEmail = passwordProblems('StrongOwnerPassword123!', email);
    expect(
      problemsWithEmail.some((problem) => problem.includes('must not contain the email address')),
    ).toBe(true);

    expect(PasswordSchema.safeParse('CorrectHorseBattery2026!').success).toBe(true);
  });

  it('accepts valid login and password change requests', () => {
    const login = LoginRequestSchema.parse({
      email: '  OWNER@me.palnadu.dev  ',
      password: 'any-password-string',
    });
    expect(login.email).toBe('owner@me.palnadu.dev');
    expect(login.password).toBe('any-password-string');

    const change = ChangePasswordRequestSchema.safeParse({
      currentPassword: 'old-password',
      newPassword: 'CorrectHorseBattery2026!',
    });
    expect(change.success).toBe(true);
  });

  it('exposes valid owner email and cookie name constants', () => {
    expect(AdminEmailSchema.safeParse(OWNER_EMAIL).success).toBe(true);
    expect(SESSION_COOKIE_NAME).toMatch(/^__Secure-/);
  });
});

describe('session claims (ADR-0009)', () => {
  const claims = {
    sub: 'admin_1',
    email: 'owner@me.palnadu.dev',
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

  it('requires a valid email address claim', () => {
    expect(SessionClaimsSchema.safeParse({...claims, email: 'invalid-email'}).success).toBe(false);
  });

  it('rejects an unknown role', () => {
    expect(SessionClaimsSchema.safeParse({...claims, role: 'superuser'}).success).toBe(false);
  });
});

describe('Knowledge Hub article contract', () => {
  const validArticle = () => ({
    slug: 'jamf-pro-enrollment-guide',
    kind: 'tutorial' as const,
    title: 'Jamf Pro enrolment guide',
    excerpt: 'A placeholder excerpt used only in tests.',
    body: '## Heading\n\nPlaceholder body used only in tests.',
    tags: ['Jamf Pro'],
  });

  it('accepts a minimal article and applies its defaults', () => {
    const parsed = ArticleCreateSchema.parse(validArticle());
    expect(parsed.status).toBe('draft');
    expect(parsed.tags).toEqual(['Jamf Pro']);
  });

  it('requires a difficulty for interview preparation', () => {
    expect(ArticleCreateSchema.safeParse({...validArticle(), kind: 'interview'}).success).toBe(
      false,
    );
    expect(
      ArticleCreateSchema.safeParse({
        ...validArticle(),
        kind: 'interview',
        difficulty: 'advanced',
      }).success,
    ).toBe(true);
  });

  it('does not require the client to choose a publication instant', () => {
    // The API stamps publishedAt; a browser must not decide when a post went live.
    expect(ArticleCreateSchema.safeParse({...validArticle(), status: 'published'}).success).toBe(
      true,
    );
  });

  it('keeps a patch partial and free of create-time defaults', () => {
    const parsed = ArticleUpdateSchema.parse({title: 'Revised title'});
    expect(Object.keys(parsed)).toEqual(['title']);
  });

  it('rejects a non-kebab slug', () => {
    expect(ArticleCreateSchema.safeParse({...validArticle(), slug: 'Not A Slug'}).success).toBe(
      false,
    );
  });
});

describe('FAQ contract', () => {
  it('applies category and sort defaults', () => {
    const parsed = FaqCreateSchema.parse({
      question: 'What is endpoint management?',
      answer: 'A placeholder answer used only in tests.',
    });
    expect(parsed.category).toBe('general');
    expect(parsed.sortIndex).toBe(0);
    expect(parsed.status).toBe('draft');
  });

  it('rejects an empty answer', () => {
    expect(FaqCreateSchema.safeParse({question: 'Q?', answer: ''}).success).toBe(false);
  });
});

describe('media contract', () => {
  const asset = {
    publicId: 'me-palnadu/knowledge/example',
    secureUrl: 'https://res.cloudinary.com/example/image/upload/example.webp',
    format: 'webp',
    resourceType: 'image',
    bytes: 123_456,
    width: 1200,
    height: 800,
    originalFilename: 'example.webp',
  };

  it('accepts a registered image asset', () => {
    expect(MediaRegisterSchema.safeParse(asset).success).toBe(true);
  });

  it('rejects a format outside the accepted list', () => {
    expect(MediaRegisterSchema.safeParse({...asset, format: 'svg'}).success).toBe(false);
  });

  it('rejects an asset above the size ceiling', () => {
    expect(MediaRegisterSchema.safeParse({...asset, bytes: 20 * 1024 * 1024}).success).toBe(false);
  });

  it('requires every field a signature response needs', () => {
    expect(
      MediaSignResponseSchema.safeParse({
        signature: 'abc',
        timestamp: 1,
        apiKey: 'key',
        cloudName: 'cloud',
        folder: 'me-palnadu',
        uploadUrl: 'https://api.cloudinary.com/v1_1/cloud/image/upload',
        allowedFormats: ['jpg'],
      }).success,
    ).toBe(true);
  });
});

describe('revalidation contract', () => {
  it('accepts tags only and paths only', () => {
    expect(RevalidateRequestSchema.safeParse({tags: [CACHE_TAGS.articles]}).success).toBe(true);
    expect(RevalidateRequestSchema.safeParse({paths: ['/knowledge-hub']}).success).toBe(true);
  });

  it('rejects an empty request', () => {
    expect(RevalidateRequestSchema.safeParse({}).success).toBe(false);
  });

  it('rejects a protocol-relative path', () => {
    expect(RevalidateRequestSchema.safeParse({paths: ['//evil.test']}).success).toBe(false);
  });

  it('rejects an unbounded tag list', () => {
    const tags = Array.from({length: 13}, () => CACHE_TAGS.articles);
    expect(RevalidateRequestSchema.safeParse({tags}).success).toBe(false);
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
    expect(API_ROUTES.knowledgeAdmin).toBe('/api/admin/knowledge');
    expect(WEB_ROUTES.knowledgeHub).toBe('/knowledge-hub');
    expect(WEB_ROUTES.faq).toBe('/faq');
  });

  it('keeps message status and skill category single-sourced', () => {
    expect(MessageStatusSchema.parse('replied')).toBe('replied');
    expect(SkillCategorySchema.safeParse('mdm').success).toBe(true);
    expect(SkillCategorySchema.safeParse('wizardry').success).toBe(false);
  });
});
