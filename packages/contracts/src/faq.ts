import {z} from 'zod';
import {ContentStatusSchema, FaqCategorySchema} from './enums.js';
import {
  IdSchema,
  IsoDateTimeSchema,
  NonEmptyTextSchema,
  PaginationQuerySchema,
  toPatchShape,
} from './common.js';

/**
 * FAQ entry.
 *
 * `answer` is Markdown, rendered through the same restricted renderer as an
 * article body (ADR-0010). It is stored as source so a rendering change does not
 * require a data rewrite.
 */
const FaqShape = {
  question: NonEmptyTextSchema.max(300),
  answer: z.string().min(1).max(10_000),
  category: FaqCategorySchema.default('general'),
  sortIndex: z.number().int().min(0).max(9999).default(0),
  status: ContentStatusSchema.default('draft'),
  publishedAt: IsoDateTimeSchema.optional(),
};

export const FaqBaseSchema = z.object(FaqShape);

export const FaqCreateSchema = FaqBaseSchema;
export type FaqCreateInput = z.infer<typeof FaqCreateSchema>;

export const FaqPatchShape = toPatchShape(FaqBaseSchema.shape);
export const FaqUpdateSchema = z.object(FaqPatchShape);
export type FaqUpdateInput = z.infer<typeof FaqUpdateSchema>;

export const FaqSchema = FaqBaseSchema.extend({
  id: IdSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Faq = z.infer<typeof FaqSchema>;

/** What an unauthenticated caller may receive. `status` is absent by design. */
export const PublicFaqSchema = z.object({
  id: IdSchema,
  question: NonEmptyTextSchema.max(300),
  answer: z.string().min(1).max(10_000),
  category: FaqCategorySchema,
  sortIndex: z.number().int().min(0).max(9999),
  publishedAt: IsoDateTimeSchema,
});
export type PublicFaq = z.infer<typeof PublicFaqSchema>;

export const FaqListQuerySchema = PaginationQuerySchema.extend({
  category: FaqCategorySchema.optional(),
  status: ContentStatusSchema.optional(),
  q: z.string().trim().max(100).optional(),
});
export type FaqListQuery = z.infer<typeof FaqListQuerySchema>;
