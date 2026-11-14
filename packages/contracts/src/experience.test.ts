import {describe, expect, it} from 'vitest';
import {ExperienceCreateSchema, ExperienceUpdateSchema} from './index.js';

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
