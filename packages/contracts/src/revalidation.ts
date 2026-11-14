import {z} from 'zod';

/**
 * Cache revalidation contract (ADR-0010 §5).
 *
 * Tags are defined here so the API that invalidates and the web app that consumes
 * them cannot drift. A tag is a string the framework treats as opaque; the names
 * are the contract.
 */
export const CACHE_TAGS = {
  articles: 'articles',
  sitemap: 'sitemap',
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

export const CACHE_TAG_VALUES = Object.values(CACHE_TAGS) as readonly CacheTag[];

/**
 * A revalidation request.
 *
 * Bounded deliberately: an unbounded list lets a caller invalidate every route
 * repeatedly, turning a cache into a denial-of-service amplifier. Twelve entries
 * is more than any single content change needs.
 */
export const RevalidateRequestSchema = z
  .object({
    tags: z
      .array(z.enum([CACHE_TAGS.articles, CACHE_TAGS.sitemap]))
      .max(12)
      .default([]),
    paths: z
      .array(
        z
          .string()
          .min(1)
          .max(200)
          .regex(/^\/(?!\/)/, 'must be an absolute path on this site'),
      )
      .max(12)
      .default([]),
  })
  .refine((value) => value.tags.length > 0 || value.paths.length > 0, {
    message: 'at least one tag or path is required',
  });
export type RevalidateRequest = z.infer<typeof RevalidateRequestSchema>;

export const RevalidateResponseSchema = z.object({
  revalidated: z.boolean(),
  tags: z.array(z.string()),
  paths: z.array(z.string()),
});
export type RevalidateResponse = z.infer<typeof RevalidateResponseSchema>;

/** The header the API uses to authenticate a revalidation call. */
export const REVALIDATE_SECRET_HEADER = 'x-revalidate-secret';
