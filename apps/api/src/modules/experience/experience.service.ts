import {Inject, Injectable} from '@nestjs/common';
import type {Prisma} from '@prisma/client';
import {AdminService, type AuditEntry} from '../auth/admin.service.js';
import {ExperienceKindSchema} from '@me-palnadu/contracts';
import type {Experience, ExperienceCreateInput, ExperienceUpdateInput} from '@me-palnadu/contracts';
import {PrismaService} from '../../prisma/prisma.service.js';
import {ApiError} from '../../common/api-error.js';
import {mapPersistenceError} from '../../common/persistence-error.js';

/**
 * Persistence for the Experience slice.
 *
 * Two rules govern this class:
 *   1. Validation happens in @me-palnadu/contracts at the boundary; this layer
 *      accepts already-validated input and does not re-derive the rules.
 *   2. Prisma rows never leave the API untyped. The mapper below converts a
 *      database row into the contract type, so a schema drift surfaces here
 *      rather than in a client (SSOT_POLICY section 7).
 *   3. A write and its audit entry commit in one transaction. An administrative
 *      change that leaves no trace of who made it is not an auditable change, so
 *      the two cannot be allowed to fail independently (SECURITY.md section 3).
 */

interface ExperienceRow {
  id: string;
  slug: string;
  org: string;
  title: string;
  location: string | null;
  startDate: string;
  endDate: string | null;
  current: boolean;
  kind: string;
  summary: string;
  highlights: string[];
  tech: string[];
  sortIndex: number;
  published: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ExperienceService {
  // Explicit injection: this application compiles to ESM, where TypeScript does not
  // emit `design:paramtypes`, so Nest cannot infer the type. Every constructor
  // dependency in this application is injected by token for that reason.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AdminService) private readonly admin: AdminService,
  ) {}

  /**
   * Runs a content write and its audit entry atomically.
   *
   * `MongoDB` transactions require a replica set, which the integration harness
   * already provides, so this is exercised by tests rather than assumed.
   */
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

  /**
   * Public reads return published entries only.
   *
   * The filter lives in the query, not in the controller and not in the client, so
   * a draft cannot leak by bypassing the UI (AGENTS.md section 4).
   */
  async listPublished(): Promise<Experience[]> {
    try {
      const rows = await this.prisma.experience.findMany({
        where: {published: true},
        // Mirrors compareExperience in @me-palnadu/shared: newest first, a current
        // role ahead of a finished one with the same start month, then sortIndex,
        // then id so the order is total. An integration test asserts this ordering
        // and the comparator cannot drift apart.
        orderBy: [{startDate: 'desc'}, {current: 'desc'}, {sortIndex: 'asc'}, {id: 'asc'}],
      });
      return rows.map((row) => toContract(row as ExperienceRow));
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  /** All entries, for an authenticated caller. Not routed over HTTP in this phase. */
  async listAll(): Promise<Experience[]> {
    try {
      const rows = await this.prisma.experience.findMany({
        orderBy: [{startDate: 'desc'}, {current: 'desc'}, {sortIndex: 'asc'}, {id: 'asc'}],
      });
      return rows.map((row) => toContract(row as ExperienceRow));
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  async findBySlug(slug: string): Promise<Experience | null> {
    try {
      const row = await this.prisma.experience.findUnique({where: {slug}});
      return row === null ? null : toContract(row as ExperienceRow);
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  /**
   * Creates an entry from already-validated contract input.
   *
   * The caller supplies a slug rather than deriving one here, because the rule for
   * what a slug should be belongs to the contracts package, not to persistence.
   */
  async create(input: CreateExperienceRecord, audit: AuditEntry): Promise<Experience> {
    try {
      return await this.audited({...audit, entityId: input.slug}, async (tx) => {
        const row = await tx.experience.create({
          data: {
            slug: input.slug,
            org: input.org,
            title: input.title,
            location: input.location ?? null,
            startDate: input.startDate,
            endDate: input.endDate ?? null,
            current: input.current,
            kind: input.kind,
            summary: input.summary,
            highlights: input.highlights,
            tech: input.tech,
            sortIndex: input.sortIndex,
            published: input.published,
            publishedAt: input.published ? new Date() : null,
          },
        });
        return toContract(row as ExperienceRow);
      });
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  /** Partial update. Only the provided fields change; absent fields are untouched. */
  async update(
    slug: string,
    changes: UpdateExperienceRecord,
    audit: AuditEntry,
  ): Promise<Experience> {
    try {
      return await this.audited({...audit, entityId: slug}, async (tx) => {
        const existing = await tx.experience.findUnique({where: {slug}});
        if (existing === null)
          throw ApiError.notFound('No experience entry with that slug exists.');

        const row = await tx.experience.update({
          where: {slug},
          data: buildUpdate(changes, existing as ExperienceRow),
        });
        return toContract(row as ExperienceRow);
      });
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  /**
   * Publishing and unpublishing are distinct operations rather than a generic flag
   * so the audit trail names what actually happened, and so the caller cannot publish
   * an entry without also stamping (or clearing) `publishedAt`.
   */
  async setPublished(slug: string, published: boolean, audit: AuditEntry): Promise<Experience> {
    try {
      return await this.audited({...audit, entityId: slug}, async (tx) => {
        const existing = await tx.experience.findUnique({where: {slug}});
        if (existing === null)
          throw ApiError.notFound('No experience entry with that slug exists.');
        if (existing.published === published) {
          // Idempotent by design: re-publishing a published entry is a no-op, not an
          // error and not a silent change of publishedAt. The audit entry is still
          // written, because the attempt is itself the thing worth recording.
          return toContract(existing as ExperienceRow);
        }
        const row = await tx.experience.update({
          where: {slug},
          data: {published, publishedAt: published ? new Date() : null},
        });
        return toContract(row as ExperienceRow);
      });
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  async delete(slug: string): Promise<void> {
    try {
      await this.prisma.experience.delete({where: {slug}});
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }
}

/**
 * Persistence input is the contract type, not a local copy of it.
 *
 * Phase 6A declared a hand-written `CreateExperienceRecord`; this removes the
 * duplication so a contract change cannot leave persistence accepting a shape the
 * contract no longer describes (SSOT_POLICY section 3).
 */
export type CreateExperienceRecord = ExperienceCreateInput;
export type UpdateExperienceRecord = ExperienceUpdateInput;

/**
 * Builds a Prisma update payload that touches only the supplied fields.
 *
 * Explicit `undefined` handling matters here: with `exactOptionalPropertyTypes`,
 * a key present with an undefined value would otherwise clear a stored value.
 */
const buildUpdate = (changes: UpdateExperienceRecord, existing: ExperienceRow) => {
  const data: Record<string, unknown> = {};

  if (changes.slug !== undefined) data['slug'] = changes.slug;
  if (changes.org !== undefined) data['org'] = changes.org;
  if (changes.title !== undefined) data['title'] = changes.title;
  if (changes.location !== undefined) data['location'] = changes.location;
  if (changes.startDate !== undefined) data['startDate'] = changes.startDate;
  if (changes.endDate !== undefined) data['endDate'] = changes.endDate;
  if (changes.current !== undefined) data['current'] = changes.current;
  if (changes.kind !== undefined) data['kind'] = changes.kind;
  if (changes.summary !== undefined) data['summary'] = changes.summary;
  if (changes.highlights !== undefined) data['highlights'] = changes.highlights;
  if (changes.tech !== undefined) data['tech'] = changes.tech;
  if (changes.sortIndex !== undefined) data['sortIndex'] = changes.sortIndex;

  if (changes.published !== undefined && changes.published !== existing.published) {
    data['published'] = changes.published;
    // Publishing stamps the date; unpublishing clears it, so a stale date can
    // never make an unpublished record look published to a date-based query.
    data['publishedAt'] = changes.published ? new Date() : null;
  }

  return data;
};

/** Database row to contract type. The only place Prisma shapes become contracts. */
const toContract = (row: ExperienceRow): Experience => ({
  id: row.id,
  slug: row.slug,
  org: row.org,
  title: row.title,
  ...(row.location === null ? {} : {location: row.location}),
  startDate: row.startDate,
  ...(row.endDate === null ? {} : {endDate: row.endDate}),
  current: row.current,
  kind: ExperienceKindSchema.parse(row.kind),
  summary: row.summary,
  highlights: row.highlights,
  tech: row.tech,
  sortIndex: row.sortIndex,
  published: row.published,
});

export const __testing = {toContract, buildUpdate};
