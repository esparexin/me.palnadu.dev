import {ExperienceKindSchema} from '@me-palnadu/contracts';
import type {Experience, ExperienceCreateInput, ExperienceUpdateInput} from '@me-palnadu/contracts';

export interface ExperienceRow {
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

export type CreateExperienceRecord = ExperienceCreateInput;
export type UpdateExperienceRecord = ExperienceUpdateInput;

/**
 * Builds a Prisma update payload that touches only the supplied fields.
 *
 * Explicit `undefined` handling matters here: with `exactOptionalPropertyTypes`,
 * a key present with an undefined value would otherwise clear a stored value.
 */
export const buildUpdate = (changes: UpdateExperienceRecord, existing: ExperienceRow) => {
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
export const toContract = (row: ExperienceRow): Experience => ({
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
