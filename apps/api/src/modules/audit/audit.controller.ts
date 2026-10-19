import {Controller, Get, Inject, Injectable, Param, Query} from '@nestjs/common';
import type {Prisma} from '@prisma/client';
import {
  AuditEntrySchema,
  AuditListQuerySchema,
  PaginatedResponseSchema,
  type AuditEntry,
  type AuditListQuery,
} from '@me-palnadu/contracts';
import {PrismaService} from '../../prisma/prisma.service.js';
import {ApiError} from '../../common/api-error.js';
import {mapPersistenceError} from '../../common/persistence-error.js';
import {ZodValidationPipe} from '../../common/zod-validation.pipe.js';
import {RequireRoles} from '../../auth/require-roles.decorator.js';
import {AdminRateLimit} from '../../auth/throttling.js';
import {toAuditEntry, type AuditRow} from './audit.mapper.js';

/**
 * Read-only audit trail (SECURITY.md §3, ADR-0010 §6).
 *
 * There is no create, update, or delete route. Entries are written only by the
 * service that performed the change, inside the same transaction. An audit trail an
 * administrator can edit is not an audit trail.
 *
 * Only the owner may read it: editors can see their own writes in the content they
 * edit, but the full trail includes authentication events.
 */
@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: AuditListQuery) {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.action !== undefined) where.action = query.action;
    if (query.entityType !== undefined) where.entityType = query.entityType;
    if (query.entityId !== undefined) where.entityId = query.entityId;
    if (query.actorId !== undefined) where.actorId = query.actorId;

    try {
      const [rows, total] = await Promise.all([
        this.prisma.auditLog.findMany({
          where,
          orderBy: [{createdAt: 'desc'}, {id: 'asc'}],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        this.prisma.auditLog.count({where}),
      ]);
      return {
        items: rows.map((row) => toAuditEntry(row as AuditRow)),
        page: query.page,
        limit: query.limit,
        total,
        hasMore: query.page * query.limit < total,
      };
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  async findById(id: string): Promise<AuditEntry> {
    try {
      const row = await this.prisma.auditLog.findUnique({where: {id}});
      if (row === null) throw ApiError.notFound('No audit entry with that identifier exists.');
      return toAuditEntry(row as AuditRow);
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }
}

@Controller('api/admin/audit')
export class AuditController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  @RequireRoles('owner')
  @AdminRateLimit()
  @Get()
  async list(@Query(new ZodValidationPipe(AuditListQuerySchema)) query: AuditListQuery) {
    const page = await this.audit.list(query);
    return PaginatedResponseSchema(AuditEntrySchema).parse(page);
  }

  @RequireRoles('owner')
  @AdminRateLimit()
  @Get(':id')
  async read(@Param('id') id: string) {
    return AuditEntrySchema.parse(await this.audit.findById(id));
  }
}

export const __testing = {AuditService};
