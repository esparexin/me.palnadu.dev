import {Inject, Injectable} from '@nestjs/common';
import type {Prisma} from '@prisma/client';
import {
  ArticleKindSchema,
  ContentStatusSchema,
  DifficultySchema,
  type Article,
  type ArticleCreateInput,
  type ArticleListQuery,
  type ArticleSummary,
  type ArticleUpdateInput,
  type ContentStatus,
  type PaginatedResponse,
  type PublicArticle,
  type PublicArticleSummary,
} from '@me-palnadu/contracts';
import {PrismaService} from '../../prisma/prisma.service.js';
import {AdminService, type AuditEntry} from '../auth/admin.service.js';
import {ApiError} from '../../common/api-error.js';
import {mapPersistenceError} from '../../common/persistence-error.js';
import {RevalidationService} from '../revalidation/revalidation.service.js';

/**
 * Persistence for the Knowledge Hub (ADR-0010).
 *
 * Two rules govern this class:
 *   1. Validation happens in @me-palnadu/contracts at the boundary; this layer
 *      accepts already-validated input and does not re-derive the rules.
 *   2. Prisma rows never leave the API untyped. The mapper below converts a row
 *      into the contract type, so schema drift surfaces here rather than in a
 *      client (SSOT_POLICY §7).
 *   3. A write and its audit entry commit in one transaction. Cache revalidation
 *      happens after the commit and never fails the write: the database is the
 *      source of truth and a stale page is recoverable, a lost write is not.
 */

interface ArticleRow {
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

@Injectable()
export class KnowledgeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AdminService) private readonly admin: AdminService,
    @Inject(RevalidationService) private readonly revalidation: RevalidationService,
  ) {}

  private async audited<T>(
    audit: AuditEntry,
    write: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const result = await write(tx);
      await this.admin.writeAudit(tx, audit);
      return result;
    });
  }

  /** Public list. The published filter lives in the query, never in the client. */
  async listPublished(query: ArticleListQuery): Promise<PaginatedResponse<PublicArticleSummary>> {
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

    try {
      const [rows, total] = await Promise.all([
        this.prisma.article.findMany({
          where,
          orderBy: [{publishedAt: 'desc'}, {id: 'asc'}],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        this.prisma.article.count({where}),
      ]);
      return {
        items: rows.map((row) => toPublicSummary(row as ArticleRow)),
        page: query.page,
        limit: query.limit,
        total,
        hasMore: query.page * query.limit < total,
      };
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  /** A draft or archived article is indistinguishable from a missing one to a visitor. */
  async findPublished(slug: string): Promise<PublicArticle | null> {
    try {
      const row = await this.prisma.article.findUnique({where: {slug}});
      if (row === null || row.status !== 'published' || row.publishedAt === null) return null;
      return toPublicArticle(row as ArticleRow);
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  /** Authenticated list: every status, with the body omitted. */
  async listAll(query: ArticleListQuery): Promise<PaginatedResponse<ArticleSummary>> {
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

    try {
      const [rows, total] = await Promise.all([
        this.prisma.article.findMany({
          where,
          orderBy: [{updatedAt: 'desc'}, {id: 'asc'}],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        this.prisma.article.count({where}),
      ]);
      return {
        items: rows.map((row) => toSummary(row as ArticleRow)),
        page: query.page,
        limit: query.limit,
        total,
        hasMore: query.page * query.limit < total,
      };
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  async findById(id: string): Promise<Article> {
    try {
      const row = await this.prisma.article.findUnique({where: {id}});
      if (row === null) throw ApiError.notFound('No article with that identifier exists.');
      return toContract(row as ArticleRow);
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  async create(input: ArticleCreateInput, audit: AuditEntry): Promise<Article> {
    const status = input.status;
    try {
      // The audit entry names the row that was created, so it is written after the
      // insert but inside the same transaction: an unaudited create cannot commit.
      const created = await this.prisma.$transaction(async (tx) => {
        const row = await tx.article.create({
          data: {
            slug: input.slug,
            kind: input.kind,
            title: input.title,
            excerpt: input.excerpt,
            body: input.body,
            tags: input.tags,
            difficulty: input.difficulty ?? null,
            status,
            publishedAt: status === 'published' ? new Date() : null,
          },
        });
        await this.admin.writeAudit(tx, {...audit, entityId: row.id});
        return row;
      });
      if (status === 'published') await this.revalidateArticle(input.slug);
      return toContract(created as ArticleRow);
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  async update(id: string, changes: ArticleUpdateInput, audit: AuditEntry): Promise<Article> {
    try {
      const {updated, wasPublished, isPublished} = await this.audited(
        {...audit, entityId: id},
        async (tx) => {
          const existing = await tx.article.findUnique({where: {id}});
          if (existing === null) throw ApiError.notFound('No article with that identifier exists.');

          const row = await tx.article.update({
            where: {id},
            data: buildUpdate(changes, existing as ArticleRow),
          });
          return {
            updated: row,
            wasPublished: existing.status === 'published',
            isPublished: row.status === 'published',
          };
        },
      );

      if (wasPublished || isPublished) await this.revalidateArticle(updated.slug);
      return toContract(updated as ArticleRow);
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  /**
   * Publication transitions are explicit operations, not a generic status write,
   * so the audit trail names what happened and `publishedAt` cannot drift.
   */
  async setStatus(id: string, status: ContentStatus, audit: AuditEntry): Promise<Article> {
    try {
      const updated = await this.audited({...audit, entityId: id}, async (tx) => {
        const existing = await tx.article.findUnique({where: {id}});
        if (existing === null) throw ApiError.notFound('No article with that identifier exists.');
        if (existing.status === status) return existing;

        return tx.article.update({
          where: {id},
          data: {
            status,
            publishedAt: status === 'published' ? new Date() : null,
          },
        });
      });
      await this.revalidateArticle(updated.slug);
      return toContract(updated as ArticleRow);
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  async delete(id: string, audit: AuditEntry): Promise<void> {
    try {
      const removed = await this.audited({...audit, entityId: id}, async (tx) => {
        const existing = await tx.article.findUnique({where: {id}});
        if (existing === null) throw ApiError.notFound('No article with that identifier exists.');
        await tx.article.delete({where: {id}});
        return existing;
      });
      if (removed.status === 'published') await this.revalidateArticle(removed.slug);
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  private async revalidateArticle(slug: string): Promise<void> {
    await this.revalidation.revalidate({
      tags: ['articles', 'sitemap'],
      paths: ['/knowledge-hub', `/knowledge-hub/${slug}`],
    });
  }
}

/**
 * Builds a Prisma update payload that touches only supplied fields.
 *
 * Status changes stamp or clear `publishedAt` in the same write. A status change
 * that left a stale publication instant behind would make an unpublished article
 * look live to a date-based query.
 */
const buildUpdate = (
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

const statusOf = (row: ArticleRow): ContentStatus => ContentStatusSchema.parse(row.status);

const difficultyOf = (row: ArticleRow) =>
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
