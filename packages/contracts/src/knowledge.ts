import {z} from 'zod';
import {
  ArticleKindSchema,
  ContentStatusSchema,
  DifficultySchema,
  MessageStatusSchema,
  ResumeSectionKindSchema,
  SkillCategorySchema,
  type ArticleKind,
  type Difficulty,
} from './enums.js';
import {
  IdSchema,
  IsoDateTimeSchema,
  NonEmptyTextSchema,
  PaginationQuerySchema,
  SlugSchema,
  TechTagSchema,
  toPatchShape,
} from './common.js';

/**
 * Knowledge Hub article.
 *
 * `publishedAt` is a full ISO datetime, not a calendar date: publication is an
 * instant, so two articles published the same day still have a defined order and
 * a cache tag is invalidated at the moment the status changed.
 */
const ArticleShape = {
  slug: SlugSchema,
  kind: ArticleKindSchema,
  title: NonEmptyTextSchema.max(160),
  excerpt: NonEmptyTextSchema.max(400),
  body: z.string().min(1).max(60_000),
  tags: z.array(TechTagSchema).max(12).default([]),
  difficulty: DifficultySchema.optional(),
  status: ContentStatusSchema.default('draft'),
  publishedAt: IsoDateTimeSchema.optional(),
};

/**
 * Cross-field rules that keep the Knowledge Hub internally consistent
 * (SSOT_POLICY.md 3.5). Keeping them here means the API, the admin form, and the
 * content importer all fail the same way.
 *
 * `publishedAt` is deliberately not required when `status` is `published`: the
 * API stamps the instant of publication. Requiring the client to supply it would
 * let a browser choose when a post went live, which is a server decision.
 */
const articleRules = (
  value: {kind?: ArticleKind | undefined; difficulty?: Difficulty | undefined},
  ctx: z.RefinementCtx,
) => {
  if (value.kind === 'interview' && value.difficulty === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['difficulty'],
      message: 'interview preparation must declare a difficulty',
    });
  }
};

export const ArticleBaseSchema = z.object(ArticleShape);

export const ArticleCreateSchema = ArticleBaseSchema.superRefine(articleRules);
export type ArticleCreateInput = z.infer<typeof ArticleCreateSchema>;

export const ArticlePatchShape = toPatchShape(ArticleBaseSchema.shape);
export const ArticleUpdateSchema = z.object(ArticlePatchShape).superRefine(articleRules);
export type ArticleUpdateInput = z.infer<typeof ArticleUpdateSchema>;

export const ArticleSchema = ArticleBaseSchema.extend({
  id: IdSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Article = z.infer<typeof ArticleSchema>;

/** List projection: no body, so an index never downloads every article. */
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
  updatedAt: true,
});
export type ArticleSummary = z.infer<typeof ArticleSummarySchema>;

/** What an unauthenticated caller may receive. `status` is absent by design. */
export const PublicArticleSummarySchema = z.object({
  id: IdSchema,
  slug: SlugSchema,
  kind: ArticleKindSchema,
  title: NonEmptyTextSchema.max(160),
  excerpt: NonEmptyTextSchema.max(400),
  tags: z.array(TechTagSchema).max(12),
  difficulty: DifficultySchema.optional(),
  publishedAt: IsoDateTimeSchema,
});
export type PublicArticleSummary = z.infer<typeof PublicArticleSummarySchema>;

export const PublicArticleSchema = PublicArticleSummarySchema.extend({
  body: z.string().min(1).max(60_000),
  updatedAt: IsoDateTimeSchema,
});
export type PublicArticle = z.infer<typeof PublicArticleSchema>;

/**
 * Filtering for both audiences.
 *
 * `status` is only honoured on the authenticated route; the public controller
 * ignores it and always filters to `published`, so a query string cannot widen
 * what a visitor sees.
 */
export const ArticleListQuerySchema = PaginationQuerySchema.extend({
  kind: ArticleKindSchema.optional(),
  status: ContentStatusSchema.optional(),
  tag: TechTagSchema.optional(),
  q: z.string().trim().max(100).optional(),
});
export type ArticleListQuery = z.infer<typeof ArticleListQuerySchema>;

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
