import type {Prisma} from '@prisma/client';
import {
  ArticleKindSchema,
  ContentStatusSchema,
  DifficultySchema,
  type Article,
  type ArticleListQuery,
  type ArticleSummary,
  type ArticleUpdateInput,
  type ContentStatus,
  type PublicArticle,
  type PublicArticleSummary,
} from '@me-palnadu/contracts';

export interface ArticleRow {
  id: string;
  slug: string;
  kind: string;
  title: string;
  excerpt: string;
  body: string;
  tags: string[];
  difficulty: string | null;
  status: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Builds Prisma where clause for public article list queries. */
export const buildPublishedWhere = (query: ArticleListQuery): Prisma.ArticleWhereInput => {
  const where: Prisma.ArticleWhereInput = {status: 'published', publishedAt: {not: null}};
  if (query.kind !== undefined) where.kind = query.kind;
  if (query.tag !== undefined) where.tags = {has: query.tag};
  if (query.q !== undefined) {
    where.OR = [
      {title: {contains: query.q}},
      {excerpt: {contains: query.q}},
      {tags: {has: query.q}},
    ];
  }
  return where;
};

/** Builds Prisma where clause for authenticated admin article queries. */
export const buildAdminWhere = (query: ArticleListQuery): Prisma.ArticleWhereInput => {
  const where: Prisma.ArticleWhereInput = {};
  if (query.kind !== undefined) where.kind = query.kind;
  if (query.status !== undefined) where.status = query.status;
  if (query.q !== undefined) {
    where.OR = [
      {title: {contains: query.q}},
      {excerpt: {contains: query.q}},
      {tags: {has: query.q}},
    ];
  }
  return where;
};

/**
 * Builds a Prisma update payload that touches only supplied fields.
 *
 * Status changes stamp or clear `publishedAt` in the same write. A status change
 * that left a stale publication instant behind would make an unpublished article
 * look live to a date-based query.
 */
export const buildUpdate = (
  changes: ArticleUpdateInput,
  existing: ArticleRow,
): Record<string, unknown> => {
  const data: Record<string, unknown> = {};

  if (changes.slug !== undefined) data['slug'] = changes.slug;
  if (changes.kind !== undefined) data['kind'] = changes.kind;
  if (changes.title !== undefined) data['title'] = changes.title;
  if (changes.excerpt !== undefined) data['excerpt'] = changes.excerpt;
  if (changes.body !== undefined) data['body'] = changes.body;
  if (changes.tags !== undefined) data['tags'] = changes.tags;
  if (changes.difficulty !== undefined) data['difficulty'] = changes.difficulty;

  if (changes.status !== undefined && changes.status !== existing.status) {
    data['status'] = changes.status;
    data['publishedAt'] = changes.status === 'published' ? new Date() : null;
  }

  return data;
};

export const statusOf = (row: ArticleRow): ContentStatus => ContentStatusSchema.parse(row.status);

export const difficultyOf = (row: ArticleRow) =>
  row.difficulty === null ? {} : {difficulty: DifficultySchema.parse(row.difficulty)};

/** Database row to contract type. The only place Prisma shapes become contracts. */
export const toContract = (row: ArticleRow): Article => ({
  id: row.id,
  slug: row.slug,
  kind: ArticleKindSchema.parse(row.kind),
  title: row.title,
  excerpt: row.excerpt,
  body: row.body,
  tags: row.tags,
  ...difficultyOf(row),
  status: statusOf(row),
  ...(row.publishedAt === null ? {} : {publishedAt: row.publishedAt.toISOString()}),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const toSummary = (row: ArticleRow): ArticleSummary => ({
  id: row.id,
  slug: row.slug,
  kind: ArticleKindSchema.parse(row.kind),
  title: row.title,
  excerpt: row.excerpt,
  tags: row.tags,
  ...difficultyOf(row),
  status: statusOf(row),
  ...(row.publishedAt === null ? {} : {publishedAt: row.publishedAt.toISOString()}),
  updatedAt: row.updatedAt.toISOString(),
});

export const toPublicSummary = (row: ArticleRow): PublicArticleSummary => {
  if (row.publishedAt === null) {
    throw new Error('a published article must have a publication instant');
  }
  return {
    id: row.id,
    slug: row.slug,
    kind: ArticleKindSchema.parse(row.kind),
    title: row.title,
    excerpt: row.excerpt,
    tags: row.tags,
    ...difficultyOf(row),
    publishedAt: row.publishedAt.toISOString(),
  };
};

export const toPublicArticle = (row: ArticleRow): PublicArticle => ({
  ...toPublicSummary(row),
  body: row.body,
  updatedAt: row.updatedAt.toISOString(),
});

export const __testing = {buildUpdate, toContract, toSummary, toPublicArticle};
