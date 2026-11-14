import {Inject, Injectable} from '@nestjs/common';
import type {Prisma} from '@prisma/client';
import type {
  Article,
  ArticleCreateInput,
  ArticleListQuery,
  ArticleSummary,
  ArticleUpdateInput,
  ContentStatus,
  PaginatedResponse,
  PublicArticle,
  PublicArticleSummary,
} from '@me-palnadu/contracts';
import {PrismaService} from '../../prisma/prisma.service.js';
import {AdminService, type AuditEntry} from '../auth/admin.service.js';
import {ApiError} from '../../common/api-error.js';
import {mapPersistenceError} from '../../common/persistence-error.js';
import {RevalidationService} from '../revalidation/revalidation.service.js';
import {
  buildAdminWhere,
  buildPublishedWhere,
  buildUpdate,
  toContract,
  toPublicArticle,
  toPublicSummary,
  toSummary,
  type ArticleRow,
  __testing,
} from './knowledge.mapper.js';

export {toContract, toSummary, toPublicSummary, toPublicArticle, __testing};

/**
 * Persistence for the Knowledge Hub (ADR-0010).
 *
 * Rules:
 *   1. Boundary validation in @me-palnadu/contracts.
 *   2. Prisma rows mapped to contract types via knowledge.mapper.ts.
 *   3. Writes and audits commit atomically; revalidation is non-blocking.
 */
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
    const where = buildPublishedWhere(query);
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
    const where = buildAdminWhere(query);
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

  /** Explicit publication status transition. */
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
