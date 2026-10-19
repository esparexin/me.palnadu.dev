import {describe, expect, it} from 'vitest';
import {
  API_ROUTES,
  CACHE_TAGS,
  ContactMessageCreateSchema,
  MessageStatusSchema,
  PaginationQuerySchema,
  RevalidateRequestSchema,
  SkillCategorySchema,
  WEB_ROUTES,
} from './index.js';

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
  });

  it('keeps message status and skill category single-sourced', () => {
    expect(MessageStatusSchema.parse('replied')).toBe('replied');
    expect(SkillCategorySchema.safeParse('mdm').success).toBe(true);
    expect(SkillCategorySchema.safeParse('wizardry').success).toBe(false);
  });
});
