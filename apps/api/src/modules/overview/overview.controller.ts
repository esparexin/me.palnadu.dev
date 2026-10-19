import {Controller, Get, Inject, Injectable} from '@nestjs/common';
import {DashboardOverviewSchema, type DashboardOverview} from '@me-palnadu/contracts';
import {PrismaService} from '../../prisma/prisma.service.js';
import {mapPersistenceError} from '../../common/persistence-error.js';
import {RequireRoles} from '../../auth/require-roles.decorator.js';
import {AdminRateLimit} from '../../auth/throttling.js';
import {toAuditEntry, type AuditRow} from '../audit/audit.mapper.js';

/**
 * Dashboard counters (ADR-0010 §6).
 *
 * Every number is computed from the database on request. Nothing is cached and
 * nothing is stored: a counter is derived data, and stored derived data drifts from
 * the rows it claims to summarise (SSOT_POLICY §5).
 */
@Injectable()
export class OverviewService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async load(): Promise<DashboardOverview> {
    try {
      const [articleCounts, faqCounts, media, recent] = await Promise.all([
        this.prisma.article.groupBy({by: ['status'], _count: {_all: true}}),
        this.prisma.faq.groupBy({by: ['status'], _count: {_all: true}}),
        this.prisma.mediaAsset.aggregate({_count: {_all: true}, _sum: {bytes: true}}),
        this.prisma.auditLog.findMany({
          orderBy: [{createdAt: 'desc'}, {id: 'asc'}],
          take: 10,
        }),
      ]);

      return {
        articles: countsByStatus(articleCounts),
        faq: countsByStatus(faqCounts),
        media: {
          assets: media._count._all,
          totalBytes: media._sum.bytes ?? 0,
        },
        recentActivity: recent.map((row) => toAuditEntry(row as AuditRow)),
      };
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }
}

const countsByStatus = (
  groups: {status: string; _count: {_all: number}}[],
): {draft: number; published: number; archived: number} => {
  const counts = {draft: 0, published: 0, archived: 0};
  for (const group of groups) {
    if (group.status in counts) {
      counts[group.status as keyof typeof counts] = group._count._all;
    }
  }
  return counts;
};

@Controller('api/admin/overview')
export class OverviewController {
  constructor(@Inject(OverviewService) private readonly overview: OverviewService) {}

  @RequireRoles('owner', 'editor')
  @AdminRateLimit()
  @Get()
  async read() {
    return DashboardOverviewSchema.parse(await this.overview.load());
  }
}

export const __testing = {countsByStatus};
