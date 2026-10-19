import {
  ArticleListQuerySchema,
  FaqListQuerySchema,
  PaginatedResponseSchema,
  PublicArticleSchema,
  PublicArticleSummarySchema,
  PublicFaqSchema,
  type ArticleListQuery,
  type FaqListQuery,
  type PublicArticle,
  type PaginatedResponse,
  type PublicArticleSummary,
  type PublicFaq,
} from '@me-palnadu/contracts';

/**
 * Read-only API client for the public site.
 *
 * Every response is parsed with the contract schema: an API that drifts from the
 * published contract fails here rather than rendering `undefined` in a page. Reads
 * are cached and tagged so the API's revalidation call can purge exactly what
 * changed (ADR-0010 §5).
 */
const API_URL =
  process.env['API_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

const CACHE_SECONDS = 300;

interface ReadOptions {
  tags: string[];
}

const read = async <Value>(
  path: string,
  schema: {safeParse: (value: unknown) => {success: true; data: Value} | {success: false}},
  options: ReadOptions,
): Promise<Value> => {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: {accept: 'application/json'},
      next: {revalidate: CACHE_SECONDS, tags: options.tags},
    });
  } catch {
    throw new Error('The API is unreachable.');
  }
  if (!response.ok) {
    throw new Error(`The API responded with status ${response.status}.`);
  }
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error('The API response did not match the published contract.');
  }
  return parsed.data;
};

export const listPublishedArticles = async (
  query: Partial<ArticleListQuery> = {},
): Promise<PaginatedResponse<PublicArticleSummary>> => {
  const parsed = ArticleListQuerySchema.parse(query);
  const search = new URLSearchParams({page: String(parsed.page), limit: String(parsed.limit)});
  if (parsed.kind !== undefined) search.set('kind', parsed.kind);
  if (parsed.tag !== undefined) search.set('tag', parsed.tag);
  if (parsed.q !== undefined) search.set('q', parsed.q);
  return read(
    `/api/knowledge?${search.toString()}`,
    PaginatedResponseSchema(PublicArticleSummarySchema),
    {tags: ['articles']},
  );
};

/** `null` means the article is missing, a draft, or archived: all three are a 404. */
export const findPublishedArticle = async (slug: string): Promise<PublicArticle | null> => {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/knowledge/${encodeURIComponent(slug)}`, {
      headers: {accept: 'application/json'},
      next: {revalidate: CACHE_SECONDS, tags: ['articles']},
    });
  } catch {
    throw new Error('The API is unreachable.');
  }
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`The API responded with status ${response.status}.`);
  const parsed = PublicArticleSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error('The API response did not match the published contract.');
  return parsed.data;
};

/**
 * The FAQ page shows every published entry. The API caps a page at 50, so this
 * follows `hasMore` rather than silently truncating; the bound prevents a runaway
 * loop if the API ever returns inconsistent pagination.
 */
export const listAllPublishedFaqs = async (
  query: Partial<FaqListQuery> = {},
): Promise<PublicFaq[]> => {
  const parsed = FaqListQuerySchema.parse(query);
  const items: PublicFaq[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const search = new URLSearchParams({page: String(page), limit: '50'});
    if (parsed.category !== undefined) search.set('category', parsed.category);
    if (parsed.q !== undefined) search.set('q', parsed.q);
    const response = await read(
      `/api/faq?${search.toString()}`,
      PaginatedResponseSchema(PublicFaqSchema),
      {tags: ['faq']},
    );
    items.push(...response.items);
    if (!response.hasMore) break;
  }
  return items;
};
