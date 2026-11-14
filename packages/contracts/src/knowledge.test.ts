import {describe, expect, it} from 'vitest';
import {ArticleCreateSchema, ArticleUpdateSchema} from './index.js';

const validArticle = () => ({
  slug: 'jamf-pro-enrollment-guide',
  kind: 'tutorial' as const,
  title: 'Jamf Pro enrolment guide',
  excerpt: 'A placeholder excerpt used only in tests.',
  body: '## Heading\n\nPlaceholder body used only in tests.',
  tags: ['Jamf Pro'],
});

describe('Knowledge Hub article contract', () => {
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
