import {z} from 'zod';
import {ContentStatusSchema, type ContentStatus} from './enums.js';
import {
  IdSchema,
  IsoDateSchema,
  NonEmptyTextSchema,
  SlugSchema,
  TechTagSchema,
  toPatchShape,
  UrlSchema,
} from './common.js';

const ProjectShape = {
  slug: SlugSchema,
  title: NonEmptyTextSchema.max(140),
  summary: NonEmptyTextSchema.max(400),
  description: z.string().max(20_000).default(''),
  role: NonEmptyTextSchema.max(140).optional(),
  tech: z.array(TechTagSchema).max(24).default([]),
  links: z
    .object({
      repository: UrlSchema.optional(),
      live: UrlSchema.optional(),
      caseStudy: UrlSchema.optional(),
    })
    .default({}),
  coverImageUrl: UrlSchema.optional(),
  featured: z.boolean().default(false),
  status: ContentStatusSchema.default('draft'),
  publishedAt: IsoDateSchema.optional(),
};

/** Create: a published record must carry its publication date. */
const projectCreateRules = (
  value: {status: ContentStatus; publishedAt?: string | undefined},
  ctx: z.RefinementCtx,
) => {
  if (value.status === 'published' && value.publishedAt === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['publishedAt'],
      message: 'publishedAt is required when status is published',
    });
  }
};

/** Patch: only refuse a contradiction that the patch itself introduces. */
const projectUpdateRules = (
  value: {status?: ContentStatus | undefined; publishedAt?: string | undefined},
  ctx: z.RefinementCtx,
) => {
  if (value.status === 'published' && value.publishedAt === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['publishedAt'],
      message: 'publishedAt is required when status is set to published',
    });
  }
};

export const ProjectBaseSchema = z.object(ProjectShape);

export const ProjectCreateSchema = ProjectBaseSchema.superRefine(projectCreateRules);
export type ProjectCreateInput = z.infer<typeof ProjectCreateSchema>;

export const ProjectPatchShape = toPatchShape(ProjectBaseSchema.shape);
export const ProjectUpdateSchema = z.object(ProjectPatchShape).superRefine(projectUpdateRules);
export type ProjectUpdateInput = z.infer<typeof ProjectUpdateSchema>;

export const ProjectSchema = ProjectBaseSchema.extend({id: IdSchema});
export type Project = z.infer<typeof ProjectSchema>;
