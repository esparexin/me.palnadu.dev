import {Injectable} from '@nestjs/common';
import type {Experience} from '@me-palnadu/contracts';
import {type PrismaService} from '../../prisma/prisma.service.js';
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
 *
 * Write operations are service methods without HTTP routes in this phase.
 * Authentication lands in Phase 6C, and exposing a write route before the session
 * guard exists would create an unauthenticated write path (SECURITY.md section 2).
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
  constructor(private readonly prisma: PrismaService) {}

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
  async create(input: CreateExperienceRecord): Promise<Experience> {
    try {
      const row = await this.prisma.experience.create({
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
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  /** Partial update. Only the provided fields change; absent fields are untouched. */
  async update(slug: string, changes: UpdateExperienceRecord): Promise<Experience> {
    try {
      const existing = await this.prisma.experience.findUnique({where: {slug}});
      if (existing === null) throw ApiError.notFound('No experience entry with that slug exists.');

      const row = await this.prisma.experience.update({
        where: {slug},
        data: buildUpdate(changes, existing as ExperienceRow),
      });
      return toContract(row as ExperienceRow);
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

export interface CreateExperienceRecord {
  slug: string;
  org: string;
  title: string;
  location?: string | undefined;
  startDate: string;
  endDate?: string | undefined;
  current: boolean;
  kind: string;
  summary: string;
  highlights: string[];
  tech: string[];
  sortIndex: number;
  published: boolean;
}

export interface UpdateExperienceRecord extends Partial<Omit<CreateExperienceRecord, 'slug'>> {
  slug?: string;
}

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
  kind: row.kind as Experience['kind'],
  summary: row.summary,
  highlights: row.highlights,
  tech: row.tech,
  sortIndex: row.sortIndex,
  published: row.published,
});

export const __testing = {toContract, buildUpdate};
