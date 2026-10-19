import {Inject, Injectable} from '@nestjs/common';
import type {Prisma} from '@prisma/client';
import {
  ContentStatusSchema,
  FaqCategorySchema,
  type ContentStatus,
  type Faq,
  type FaqCreateInput,
  type FaqListQuery,
  type FaqUpdateInput,
  type PaginatedResponse,
  type PublicFaq,
} from '@me-palnadu/contracts';
import {PrismaService} from '../../prisma/prisma.service.js';
import {AdminService, type AuditEntry} from '../auth/admin.service.js';
import {ApiError} from '../../common/api-error.js';
import {mapPersistenceError} from '../../common/persistence-error.js';
import {RevalidationService} from '../revalidation/revalidation.service.js';

/**
 * FAQ persistence (ADR-0010).
 *
 * The same rules as the Knowledge Hub apply: validated input at the boundary,
 * rows mapped to contract types here, and an audit entry committed with the write.
 * There is no slug because a FAQ has no public detail route; `sortIndex` plus the
 * question text is enough to identify it on the FAQ page.
 */

interface FaqRow {
  id: string;
  question: string;
  answer: string;
  category: string;
  sortIndex: number;
  status: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class FaqService {
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

  async listPublished(query: FaqListQuery): Promise<PaginatedResponse<PublicFaq>> {
    const where: Prisma.FaqWhereInput = {status: 'published', publishedAt: {not: null}};
    if (query.category !== undefined) where.category = query.category;
    if (query.q !== undefined) {
      where.OR = [{question: {contains: query.q}}, {answer: {contains: query.q}}];
    }

    try {
      const [rows, total] = await Promise.all([
        this.prisma.faq.findMany({
          where,
          orderBy: [{sortIndex: 'asc'}, {updatedAt: 'desc'}, {id: 'asc'}],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        this.prisma.faq.count({where}),
      ]);
      return {
        items: rows.map((row) => toPublicFaq(row as FaqRow)),
        page: query.page,
        limit: query.limit,
        total,
        hasMore: query.page * query.limit < total,
      };
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  async listAll(query: FaqListQuery): Promise<PaginatedResponse<Faq>> {
    const where: Prisma.FaqWhereInput = {};
    if (query.category !== undefined) where.category = query.category;
    if (query.status !== undefined) where.status = query.status;
    if (query.q !== undefined) {
      where.OR = [{question: {contains: query.q}}, {answer: {contains: query.q}}];
    }

    try {
      const [rows, total] = await Promise.all([
        this.prisma.faq.findMany({
          where,
          orderBy: [{sortIndex: 'asc'}, {updatedAt: 'desc'}, {id: 'asc'}],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        this.prisma.faq.count({where}),
      ]);
      return {
        items: rows.map((row) => toContract(row as FaqRow)),
        page: query.page,
        limit: query.limit,
        total,
        hasMore: query.page * query.limit < total,
      };
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  async findById(id: string): Promise<Faq> {
    try {
      const row = await this.prisma.faq.findUnique({where: {id}});
      if (row === null) throw ApiError.notFound('No FAQ entry with that identifier exists.');
      return toContract(row as FaqRow);
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  async create(input: FaqCreateInput, audit: AuditEntry): Promise<Faq> {
    try {
      // The audit entry names the row that was created, so it is written after the
      // insert but inside the same transaction: an unaudited create cannot commit.
      const created = await this.prisma.$transaction(async (tx) => {
        const row = await tx.faq.create({
          data: {
            question: input.question,
            answer: input.answer,
            category: input.category,
            sortIndex: input.sortIndex,
            status: input.status,
            publishedAt: input.status === 'published' ? new Date() : null,
          },
        });
        await this.admin.writeAudit(tx, {...audit, entityId: row.id});
        return row;
      });
      if (created.status === 'published') await this.revalidateFaq();
      return toContract(created as FaqRow);
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  async update(id: string, changes: FaqUpdateInput, audit: AuditEntry): Promise<Faq> {
    try {
      const {updated, wasPublished, isPublished} = await this.audited(audit, async (tx) => {
        const existing = await tx.faq.findUnique({where: {id}});
        if (existing === null) throw ApiError.notFound('No FAQ entry with that identifier exists.');

        const row = await tx.faq.update({
          where: {id},
          data: buildUpdate(changes, existing as FaqRow),
        });
        return {
          updated: row,
          wasPublished: existing.status === 'published',
          isPublished: row.status === 'published',
        };
      });
      if (wasPublished || isPublished) await this.revalidateFaq();
      return toContract(updated as FaqRow);
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  async setStatus(id: string, status: ContentStatus, audit: AuditEntry): Promise<Faq> {
    try {
      const updated = await this.audited(audit, async (tx) => {
        const existing = await tx.faq.findUnique({where: {id}});
        if (existing === null) throw ApiError.notFound('No FAQ entry with that identifier exists.');
        if (existing.status === status) return existing;
        return tx.faq.update({
          where: {id},
          data: {status, publishedAt: status === 'published' ? new Date() : null},
        });
      });
      await this.revalidateFaq();
      return toContract(updated as FaqRow);
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  async delete(id: string, audit: AuditEntry): Promise<void> {
    try {
      const removed = await this.audited(audit, async (tx) => {
        const existing = await tx.faq.findUnique({where: {id}});
        if (existing === null) throw ApiError.notFound('No FAQ entry with that identifier exists.');
        await tx.faq.delete({where: {id}});
        return existing;
      });
      if (removed.status === 'published') await this.revalidateFaq();
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  private async revalidateFaq(): Promise<void> {
    await this.revalidation.revalidate({tags: ['faq', 'sitemap'], paths: ['/faq']});
  }
}

const buildUpdate = (changes: FaqUpdateInput, existing: FaqRow): Record<string, unknown> => {
  const data: Record<string, unknown> = {};
  if (changes.question !== undefined) data['question'] = changes.question;
  if (changes.answer !== undefined) data['answer'] = changes.answer;
  if (changes.category !== undefined) data['category'] = changes.category;
  if (changes.sortIndex !== undefined) data['sortIndex'] = changes.sortIndex;

  if (changes.status !== undefined && changes.status !== existing.status) {
    data['status'] = changes.status;
    data['publishedAt'] = changes.status === 'published' ? new Date() : null;
  }
  return data;
};

const toContract = (row: FaqRow): Faq => ({
  id: row.id,
  question: row.question,
  answer: row.answer,
  category: FaqCategorySchema.parse(row.category),
  sortIndex: row.sortIndex,
  status: ContentStatusSchema.parse(row.status),
  ...(row.publishedAt === null ? {} : {publishedAt: row.publishedAt.toISOString()}),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const toPublicFaq = (row: FaqRow): PublicFaq => {
  if (row.publishedAt === null) {
    throw new Error('a published FAQ entry must have a publication instant');
  }
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    category: FaqCategorySchema.parse(row.category),
    sortIndex: row.sortIndex,
    publishedAt: row.publishedAt.toISOString(),
  };
};

export const __testing = {buildUpdate, toContract, toPublicFaq};
