import { z } from 'zod';
import {
  ArticleKindSchema,
  ContentStatusSchema,
  DifficultySchema,
  MessageStatusSchema,
  ResumeSectionKindSchema,
  SkillCategorySchema,
  type ArticleKind,
  type ContentStatus,
  type Difficulty,
} from './enums.js';
import {
  IdSchema,
  IsoDateSchema,
  NonEmptyTextSchema,
  SlugSchema,
  toPatchShape,
} from './common.js';

const ArticleShape = {
  slug: SlugSchema,
  kind: ArticleKindSchema,
  title: NonEmptyTextSchema.max(160),
  excerpt: NonEmptyTextSchema.max(400),
  body: z.string().min(1).max(60_000),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  difficulty: DifficultySchema.optional(),
  status: ContentStatusSchema.default('draft'),
  publishedAt: IsoDateSchema.optional(),
};

/**
 * Cross-field rules that keep the Knowledge Hub internally consistent
 * (SSOT_POLICY.md 3.5). Keeping them here means the API, the admin form, and the
 * content importer all fail the same way.
 */
const articleCreateRules = (
  value: {
    kind: ArticleKind;
    status: ContentStatus;
    publishedAt?: string | undefined;
    difficulty?: Difficulty | undefined;
  },
  ctx: z.RefinementCtx,
) => {
  if (value.status === 'published' && value.publishedAt === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['publishedAt'],
      message: 'publishedAt is required when status is published',
    });
  }
  if (value.kind === 'interview' && value.difficulty === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['difficulty'],
      message: 'interview preparation must declare a difficulty',
    });
  }
};

const articleUpdateRules = (
  value: {
    kind?: ArticleKind | undefined;
    status?: ContentStatus | undefined;
    publishedAt?: string | undefined;
    difficulty?: Difficulty | undefined;
  },
  ctx: z.RefinementCtx,
) => {
  if (value.status === 'published' && value.publishedAt === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['publishedAt'],
      message: 'publishedAt is required when status is set to published',
    });
  }
  if (value.kind === 'interview' && value.difficulty === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['difficulty'],
      message: 'interview preparation must declare a difficulty',
    });
  }
};

export const ArticleBaseSchema = z.object(ArticleShape);

export const ArticleCreateSchema = ArticleBaseSchema.superRefine(articleCreateRules);
export type ArticleCreateInput = z.infer<typeof ArticleCreateSchema>;

export const ArticlePatchShape = toPatchShape(ArticleBaseSchema.shape);
export const ArticleUpdateSchema = z.object(ArticlePatchShape).superRefine(articleUpdateRules);
export type ArticleUpdateInput = z.infer<typeof ArticleUpdateSchema>;

export const ArticleSchema = ArticleBaseSchema.extend({ id: IdSchema });
export type Article = z.infer<typeof ArticleSchema>;

export const ArticleSummarySchema = ArticleSchema.pick({
  id: true,
  slug: true,
  kind: true,
  title: true,
  excerpt: true,
  tags: true,
  difficulty: true,
  status: true,
  publishedAt: true,
});
export type ArticleSummary = z.infer<typeof ArticleSummarySchema>;

export const SkillSchema = z.object({
  id: IdSchema,
  name: NonEmptyTextSchema.max(80),
  category: SkillCategorySchema,
  proficiency: z.number().int().min(1).max(5).optional(),
  sortIndex: z.number().int().min(0).max(9999).default(0),
});
export type Skill = z.infer<typeof SkillSchema>;

export const ResumeSectionSchema = z.object({
  id: IdSchema,
  kind: ResumeSectionKindSchema,
  heading: NonEmptyTextSchema.max(140),
  body: z.string().min(1).max(30_000),
  sortIndex: z.number().int().min(0).max(9999).default(0),
});
export type ResumeSection = z.infer<typeof ResumeSectionSchema>;

export const ContactMessageCreateSchema = z
  .object({
    name: NonEmptyTextSchema.max(120),
    email: z.email().max(254),
    message: NonEmptyTextSchema.min(10).max(4000),
    /**
     * Honeypot. A real visitor never sees this field; a bot fills it. The schema
     * rejects a filled value rather than silently discarding it, so the API never
     * stores spam it believes to have filtered (SECURITY.md 5).
     */
    website: z.string().max(0).optional(),
  })
  .strict();
export type ContactMessageCreateInput = z.infer<typeof ContactMessageCreateSchema>;

export const MessageStatusUpdateSchema = z.object({
  status: MessageStatusSchema,
});
export type MessageStatusUpdateInput = z.infer<typeof MessageStatusUpdateSchema>;