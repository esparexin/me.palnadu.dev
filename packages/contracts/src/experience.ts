import { z } from 'zod';
import {
  ExperienceKindSchema,
  type ExperienceKind,
} from './enums.js';
import {
  IdSchema,
  MonthSchema,
  NonEmptyTextSchema,
  TechTagSchema,
  toPatchShape,
} from './common.js';

/**
 * Career timeline entry. Employment dates are professional claims (AGENTS.md 4),
 * so the schema refuses a combination that would state an unverifiable range
 * rather than trusting the client to get it right.
 */
const ExperienceShape = {
  org: NonEmptyTextSchema.max(120),
  title: NonEmptyTextSchema.max(120),
  location: NonEmptyTextSchema.max(120).optional(),
  startDate: MonthSchema,
  endDate: MonthSchema.optional(),
  current: z.boolean().default(false),
  kind: ExperienceKindSchema,
  summary: NonEmptyTextSchema.max(1200),
  highlights: z.array(NonEmptyTextSchema.max(240)).max(12).default([]),
  tech: z.array(TechTagSchema).max(24).default([]),
  sortIndex: z.number().int().min(0).max(9999).default(0),
  published: z.boolean().default(false),
};

/**
 * Create semantics: a complete entry must be internally consistent. Employment
 * dates are professional claims (AGENTS.md 4), so an unverifiable combination is
 * refused rather than trusted.
 */
/**
 * The unrefined object shape. Read and projection schemas derive from this, not
 * from the refined create schema: Zod forbids `.pick()` on a schema carrying a
 * refinement, and a stored record legitimately needs no create-time completeness
 * rule (a current role has no end date).
 */
export const ExperienceBaseSchema = z.object(ExperienceShape);

const experienceCreateRules = (
  value: { startDate: string; endDate?: string | undefined; current: boolean },
  ctx: z.RefinementCtx,
) => {
  if (value.current && value.endDate !== undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'endDate must be absent when current is true',
    });
  }
  if (!value.current && value.endDate === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'endDate is required when current is false',
    });
  }
  if (value.endDate !== undefined && value.endDate < value.startDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'endDate must not precede startDate',
    });
  }
};

/**
 * Patch semantics: only contradictions *present in the patch* are refused.
 * A patch that does not mention `current` cannot be judged incomplete, so the
 * completeness rule from create is deliberately not applied here.
 */
const experienceUpdateRules = (
  value: { startDate?: string | undefined; endDate?: string | undefined; current?: boolean | undefined },
  ctx: z.RefinementCtx,
) => {
  if (value.current === true && value.endDate !== undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'endDate must be absent when current is true',
    });
  }
  if (
    value.startDate !== undefined &&
    value.endDate !== undefined &&
    value.endDate < value.startDate
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'endDate must not precede startDate',
    });
  }
};

export const ExperienceCreateSchema = ExperienceBaseSchema.superRefine(experienceCreateRules);
export type ExperienceCreateInput = z.infer<typeof ExperienceCreateSchema>;

/** Patch semantics: reuse the base shape rather than restating it. */
export const ExperiencePatchShape = toPatchShape(ExperienceBaseSchema.shape);
export const ExperienceUpdateSchema = z
  .object(ExperiencePatchShape)
  .superRefine(experienceUpdateRules);
export type ExperienceUpdateInput = z.infer<typeof ExperienceUpdateSchema>;

export const ExperienceSchema = ExperienceBaseSchema.extend({ id: IdSchema });
export type Experience = z.infer<typeof ExperienceSchema>;

/** Shape a repository returns to the public site: published entries only. */
export const PublicExperienceSchema = ExperienceSchema.pick({
  id: true,
  org: true,
  title: true,
  location: true,
  startDate: true,
  endDate: true,
  current: true,
  kind: true,
  summary: true,
  highlights: true,
  tech: true,
});
export type PublicExperience = z.infer<typeof PublicExperienceSchema>;

export type { ExperienceKind };