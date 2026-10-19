import {z} from 'zod';
import {AuditActionSchema, AuditEntityTypeSchema} from './enums.js';
import {IdSchema, IsoDateTimeSchema, PaginationQuerySchema} from './common.js';

/**
 * The administrative audit trail.
 *
 * Read-only over HTTP: the API exposes list and detail, never update or delete
 * (SECURITY.md §3, "Audit trail tampering"). Entries are written inside the same
 * transaction as the change they describe.
 */
export const AuditEntrySchema = z.object({
  id: IdSchema,
  actorId: IdSchema,
  action: AuditActionSchema,
  entityType: AuditEntityTypeSchema,
  entityId: z.string().min(1).max(300),
  detail: z.record(z.string(), z.unknown()).optional(),
  createdAt: IsoDateTimeSchema,
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

export const AuditListQuerySchema = PaginationQuerySchema.extend({
  action: AuditActionSchema.optional(),
  entityType: AuditEntityTypeSchema.optional(),
  entityId: z.string().min(1).max(300).optional(),
  actorId: IdSchema.optional(),
});
export type AuditListQuery = z.infer<typeof AuditListQuerySchema>;

/**
 * Overview counters for the dashboard.
 *
 * Counts are computed by the API from the database on each request. They are not
 * stored: a stored count is a second source of truth that drifts (SSOT_POLICY §5).
 */
export const DashboardOverviewSchema = z.object({
  articles: z.object({
    draft: z.number().int().min(0),
    published: z.number().int().min(0),
    archived: z.number().int().min(0),
  }),
  faq: z.object({
    draft: z.number().int().min(0),
    published: z.number().int().min(0),
    archived: z.number().int().min(0),
  }),
  media: z.object({
    assets: z.number().int().min(0),
    totalBytes: z.number().int().min(0),
  }),
  recentActivity: z.array(AuditEntrySchema).max(10),
});
export type DashboardOverview = z.infer<typeof DashboardOverviewSchema>;

/** One administrator session, as shown on the security screen. */
export const AdminSessionSummarySchema = z.object({
  id: IdSchema,
  sessionId: z.string().min(1),
  createdAt: IsoDateTimeSchema,
  lastSeenAt: IsoDateTimeSchema,
  expiresAt: IsoDateTimeSchema,
  revokedAt: IsoDateTimeSchema.optional(),
  current: z.boolean(),
  ip: z.string().max(64).optional(),
  userAgent: z.string().max(400).optional(),
});
export type AdminSessionSummary = z.infer<typeof AdminSessionSummarySchema>;

export const AdminSessionListSchema = z.object({
  sessions: z.array(AdminSessionSummarySchema),
});
export type AdminSessionList = z.infer<typeof AdminSessionListSchema>;

export const RevokeSessionSchema = z.object({
  sessionId: z.string().min(1).max(128),
});
export type RevokeSession = z.infer<typeof RevokeSessionSchema>;
