import {z} from 'zod';
import {MediaFormatSchema, MediaResourceTypeSchema} from './enums.js';
import {IdSchema, IsoDateTimeSchema, NonEmptyTextSchema, PaginationQuerySchema} from './common.js';

/**
 * Media library (ADR-0010).
 *
 * Files are uploaded directly from the browser to Cloudinary with a short-lived
 * signature. The API stores metadata only, so an upload never streams bytes
 * through the API process and a large file cannot exhaust its memory.
 *
 * The client never names the folder, the timestamp, or the constraints: it asks
 * for a signature and receives what the server decided. That keeps a compromised
 * admin page from choosing where an upload lands.
 */

export const MEDIA_MAX_BYTES = 10 * 1024 * 1024;

export const MEDIA_ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'pdf'] as const;

const MediaAssetShape = {
  publicId: NonEmptyTextSchema.max(300),
  secureUrl: z.url().max(2048),
  format: MediaFormatSchema,
  resourceType: MediaResourceTypeSchema,
  bytes: z.number().int().positive().max(MEDIA_MAX_BYTES),
  width: z.number().int().positive().max(20_000).optional(),
  height: z.number().int().positive().max(20_000).optional(),
  originalFilename: NonEmptyTextSchema.max(255),
  alt: z.string().trim().max(300).default(''),
};

export const MediaRegisterSchema = z.object(MediaAssetShape);
export type MediaRegisterInput = z.infer<typeof MediaRegisterSchema>;

export const MediaAssetSchema = MediaRegisterSchema.extend({
  id: IdSchema,
  createdAt: IsoDateTimeSchema,
});
export type MediaAsset = z.infer<typeof MediaAssetSchema>;

export const MediaListQuerySchema = PaginationQuerySchema.extend({
  format: MediaFormatSchema.optional(),
  q: z.string().trim().max(100).optional(),
});
export type MediaListQuery = z.infer<typeof MediaListQuerySchema>;

export const MediaSignRequestSchema = z.object({
  resourceType: MediaResourceTypeSchema.default('image'),
});
export type MediaSignRequest = z.infer<typeof MediaSignRequestSchema>;

export const MediaSignResponseSchema = z.object({
  signature: z.string().min(1),
  timestamp: z.number().int().positive(),
  apiKey: z.string().min(1),
  cloudName: z.string().min(1),
  folder: z.string().min(1),
  uploadUrl: z.url(),
  allowedFormats: z.array(MediaFormatSchema).min(1),
});
export type MediaSignResponse = z.infer<typeof MediaSignResponseSchema>;

/**
 * Availability of the media pipeline.
 *
 * When the Cloudinary keys are absent the API reports `configured: false` rather
 * than failing with an opaque 500. The admin UI renders a setup-required state,
 * which is the honest description of a deployment without a media provider.
 */
export const MediaStatusSchema = z.object({
  configured: z.boolean(),
  cloudName: z.string().min(1).optional(),
  allowedFormats: z.array(MediaFormatSchema),
  maxBytes: z.number().int().positive(),
});
export type MediaStatus = z.infer<typeof MediaStatusSchema>;
