import {z} from 'zod';

/**
 * Every domain enum in the system. Defined exactly once (SSOT_POLICY.md 2).
 * A workspace that needs one of these imports it from here; it never re-declares
 * the literals. `scripts/validate-contracts.mjs` fails the build if one does.
 */

export const EXPERIENCE_KINDS = [
  'full_time',
  'contract',
  'internship',
  'freelance',
  'volunteer',
] as const;
export const ExperienceKindSchema = z.enum(EXPERIENCE_KINDS);
export type ExperienceKind = z.infer<typeof ExperienceKindSchema>;

export const ARTICLE_KINDS = ['tutorial', 'kt_guide', 'troubleshooting', 'interview'] as const;
export const ArticleKindSchema = z.enum(ARTICLE_KINDS);
export type ArticleKind = z.infer<typeof ArticleKindSchema>;

export const CONTENT_STATUSES = ['draft', 'published', 'archived'] as const;
export const ContentStatusSchema = z.enum(CONTENT_STATUSES);
export type ContentStatus = z.infer<typeof ContentStatusSchema>;

export const RESUME_SECTION_KINDS = [
  'summary',
  'experience',
  'education',
  'certifications',
  'skills',
  'projects',
] as const;
export const ResumeSectionKindSchema = z.enum(RESUME_SECTION_KINDS);
export type ResumeSectionKind = z.infer<typeof ResumeSectionKindSchema>;

export const SKILL_CATEGORIES = [
  'endpoint_management',
  'mdm',
  'identity',
  'security',
  'cloud',
  'networking',
  'automation',
  'other',
] as const;
export const SkillCategorySchema = z.enum(SKILL_CATEGORIES);
export type SkillCategory = z.infer<typeof SkillCategorySchema>;

export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
export const DifficultySchema = z.enum(DIFFICULTIES);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const MESSAGE_STATUSES = ['new', 'read', 'replied', 'archived'] as const;
export const MessageStatusSchema = z.enum(MESSAGE_STATUSES);
export type MessageStatus = z.infer<typeof MessageStatusSchema>;

/** FAQ grouping. One list, defined once, consumed by the API, admin, and web. */
export const FAQ_CATEGORIES = [
  'general',
  'endpoint_management',
  'mdm',
  'identity',
  'security',
  'career',
] as const;
export const FaqCategorySchema = z.enum(FAQ_CATEGORIES);
export type FaqCategory = z.infer<typeof FaqCategorySchema>;

/** Cloudinary resource kinds the media library accepts. */
export const MEDIA_RESOURCE_TYPES = ['image', 'raw'] as const;
export const MediaResourceTypeSchema = z.enum(MEDIA_RESOURCE_TYPES);
export type MediaResourceType = z.infer<typeof MediaResourceTypeSchema>;

/** Accepted upload formats, deliberately narrower than what Cloudinary accepts. */
export const MEDIA_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'pdf'] as const;
export const MediaFormatSchema = z.enum(MEDIA_FORMATS);
export type MediaFormat = z.infer<typeof MediaFormatSchema>;

/** Actions that appear in the administrative audit trail. */
export const AUDIT_ACTIONS = [
  'article_create',
  'article_update',
  'article_publish',
  'article_unpublish',
  'article_archive',
  'article_delete',
  'faq_create',
  'faq_update',
  'faq_publish',
  'faq_unpublish',
  'faq_archive',
  'faq_delete',
  'experience_create',
  'experience_update',
  'experience_publish',
  'experience_unpublish',
  'experience_delete',
  'media_register',
  'media_delete',
  'content_import',
  'auth_login',
  'auth_logout',
  'auth_password_change',
  'auth_session_revoke',
] as const;
export const AuditActionSchema = z.enum(AUDIT_ACTIONS);
export type AuditAction = z.infer<typeof AuditActionSchema>;

/** Entity types an audit entry may reference. */
export const AUDIT_ENTITY_TYPES = [
  'article',
  'faq',
  'media',
  'admin',
  'experience',
  'content',
] as const;
export const AuditEntityTypeSchema = z.enum(AUDIT_ENTITY_TYPES);
export type AuditEntityType = z.infer<typeof AuditEntityTypeSchema>;

/** Administrator roles. Roles are advisory in a token; the database is authority. */
export const ROLES = ['owner', 'editor'] as const;
export const RoleSchema = z.enum(ROLES);
export type Role = z.infer<typeof RoleSchema>;

export const ARTICLE_KIND_LABELS: Record<ArticleKind, string> = {
  tutorial: 'Tutorial',
  kt_guide: 'KT Guide',
  troubleshooting: 'Troubleshooting',
  interview: 'Interview Preparation',
};
