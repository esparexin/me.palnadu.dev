import {describe, expect, it} from 'vitest';
import {ProjectCreateSchema} from './index.js';

const validProject = () => ({
  slug: 'placeholder-project',
  title: 'Placeholder Project',
  summary: 'Placeholder summary used only in tests.',
  status: 'published' as const,
  publishedAt: '2026-01-15',
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
