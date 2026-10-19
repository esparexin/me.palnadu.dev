import {Inject, Injectable} from '@nestjs/common';
import {createHash} from 'node:crypto';
import type {Prisma} from '@prisma/client';
import {
  MEDIA_ALLOWED_FORMATS,
  MEDIA_MAX_BYTES,
  MediaFormatSchema,
  MediaResourceTypeSchema,
  type MediaAsset,
  type MediaListQuery,
  type MediaRegisterInput,
  type MediaSignRequest,
  type MediaSignResponse,
  type MediaStatus,
  type PaginatedResponse,
} from '@me-palnadu/contracts';
import {ENV} from '../../common/tokens.js';
import type {Env} from '../../config/env.js';
import {PrismaService} from '../../prisma/prisma.service.js';
import {AdminService, type AuditEntry} from '../auth/admin.service.js';
import {ApiError} from '../../common/api-error.js';
import {mapPersistenceError} from '../../common/persistence-error.js';

/**
 * Media library (ADR-0010 §4).
 *
 * The browser uploads bytes straight to Cloudinary; this service only signs the
 * upload and records metadata. Three consequences are deliberate:
 *
 * 1. `CLOUDINARY_API_SECRET` is used to compute an HMAC-style SHA-1 signature and
 *    is never returned. The signature authorises one upload inside a narrow window;
 *    the browser receives an api key, which is not a secret.
 * 2. A registration is accepted only if the URL points at this deployment's cloud
 *    and the public id sits under this deployment's folder. Without that check, an
 *    admin session could register any URL as a site asset (SSRF-adjacent misuse and
 *    a broken image crop in one).
 * 3. Deleting a row first destroys the provider asset. If the provider refuses, the
 *    row survives: a dangling database row is recoverable, a deleted file behind a
 *    live page is not.
 */

interface MediaRow {
  id: string;
  publicId: string;
  secureUrl: string;
  format: string;
  resourceType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  originalFilename: string;
  alt: string;
  createdAt: Date;
}

const DEFAULT_FOLDER = 'me-palnadu/media';

@Injectable()
export class MediaService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AdminService) private readonly admin: AdminService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  status(): MediaStatus {
    const cloudName = this.env.CLOUDINARY_CLOUD_NAME;
    const configured =
      cloudName !== undefined &&
      this.env.CLOUDINARY_API_KEY !== undefined &&
      this.env.CLOUDINARY_API_SECRET !== undefined;

    return {
      configured,
      ...(configured ? {cloudName} : {}),
      allowedFormats: [...MEDIA_ALLOWED_FORMATS],
      maxBytes: MEDIA_MAX_BYTES,
    };
  }

  /**
   * Returns the parameters Cloudinary requires for a direct upload.
   *
   * `folder` and `allowed_formats` are part of the signature, not just the request,
   * so the browser cannot widen them without invalidating it.
   */
  sign(request: MediaSignRequest): MediaSignResponse {
    const cloudName = this.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = this.env.CLOUDINARY_API_KEY;
    const apiSecret = this.env.CLOUDINARY_API_SECRET;
    if (cloudName === undefined || apiKey === undefined || apiSecret === undefined) {
      throw ApiError.setupRequired(
        'The media library is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.',
      );
    }

    const folder = this.env.CLOUDINARY_UPLOAD_FOLDER ?? DEFAULT_FOLDER;
    const allowedFormats = [...MEDIA_ALLOWED_FORMATS];
    const timestamp = Math.floor(Date.now() / 1000);

    const signature = signParams(
      {
        allowed_formats: allowedFormats.join(','),
        folder,
        timestamp: String(timestamp),
      },
      apiSecret,
    );

    return {
      signature,
      timestamp,
      apiKey,
      cloudName,
      folder,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${request.resourceType}/upload`,
      allowedFormats,
    };
  }

  async register(input: MediaRegisterInput, audit: AuditEntry): Promise<MediaAsset> {
    const cloudName = this.env.CLOUDINARY_CLOUD_NAME;
    if (cloudName === undefined) {
      throw ApiError.setupRequired('The media library is not configured.');
    }

    const folder = this.env.CLOUDINARY_UPLOAD_FOLDER ?? DEFAULT_FOLDER;
    if (!this.isThisDeployment(cloudName, folder, input)) {
      throw ApiError.validationFailed('The asset does not belong to this media library.', [
        {path: 'secureUrl', message: 'must point at this Cloudinary cloud and folder'},
      ]);
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const row = await tx.mediaAsset.create({
          data: {
            publicId: input.publicId,
            secureUrl: input.secureUrl,
            format: input.format,
            resourceType: input.resourceType,
            bytes: input.bytes,
            width: input.width ?? null,
            height: input.height ?? null,
            originalFilename: input.originalFilename,
            alt: input.alt,
          },
        });
        await this.admin.writeAudit(tx, {...audit, entityId: row.id});
        return row;
      });
      return toContract(created as MediaRow);
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  async list(query: MediaListQuery): Promise<PaginatedResponse<MediaAsset>> {
    const where: Prisma.MediaAssetWhereInput = {};
    if (query.format !== undefined) where.format = query.format;
    if (query.q !== undefined) {
      where.OR = [
        {originalFilename: {contains: query.q}},
        {alt: {contains: query.q}},
        {publicId: {contains: query.q}},
      ];
    }

    try {
      const [rows, total] = await Promise.all([
        this.prisma.mediaAsset.findMany({
          where,
          orderBy: [{createdAt: 'desc'}, {id: 'asc'}],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        this.prisma.mediaAsset.count({where}),
      ]);
      return {
        items: rows.map((row) => toContract(row as MediaRow)),
        page: query.page,
        limit: query.limit,
        total,
        hasMore: query.page * query.limit < total,
      };
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  async delete(id: string, audit: AuditEntry): Promise<void> {
    try {
      const existing = await this.prisma.mediaAsset.findUnique({where: {id}});
      if (existing === null) throw ApiError.notFound('No media asset with that identifier exists.');

      // Destroy first. A failed provider call leaves the row in place, so the
      // library still lists an asset that exists rather than hiding one that does.
      await this.destroyAtProvider(existing.publicId, existing.resourceType);

      await this.prisma.$transaction(async (tx) => {
        await tx.mediaAsset.delete({where: {id}});
        await this.admin.writeAudit(tx, {...audit, entityId: id});
      });
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
  }

  /**
   * Best-effort provider deletion.
   *
   * A 404 is success: the asset is already gone, and refusing to remove the row
   * would strand the library on an id that can never be deleted.
   */
  private async destroyAtProvider(publicId: string, resourceType: string): Promise<void> {
    const cloudName = this.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = this.env.CLOUDINARY_API_KEY;
    const apiSecret = this.env.CLOUDINARY_API_SECRET;
    if (cloudName === undefined || apiKey === undefined || apiSecret === undefined) {
      throw ApiError.setupRequired(
        'Cannot delete a media asset while the media library is not configured.',
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signParams({public_id: publicId, timestamp: String(timestamp)}, apiSecret);
    const body = new URLSearchParams({
      public_id: publicId,
      timestamp: String(timestamp),
      api_key: apiKey,
      signature,
    });

    let response: Response;
    try {
      response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/x-www-form-urlencoded'},
          body,
          cache: 'no-store',
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch {
      throw ApiError.dependencyUnavailable(
        'The media provider could not be reached; the asset was not deleted.',
      );
    }

    if (response.status === 404) return;
    if (!response.ok) {
      throw ApiError.dependencyUnavailable(
        'The media provider refused the deletion; the asset was not deleted.',
      );
    }
  }

  private isThisDeployment(cloudName: string, folder: string, input: MediaRegisterInput): boolean {
    let url: URL;
    try {
      url = new URL(input.secureUrl);
    } catch {
      return false;
    }
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return false;
    if (!url.pathname.startsWith(`/${cloudName}/`)) return false;
    if (!input.publicId.startsWith(`${folder}/`)) return false;
    return (MEDIA_ALLOWED_FORMATS as readonly string[]).includes(input.format);
  }
}

/**
 * Cloudinary's documented signing recipe: SHA-1 over the alphabetically sorted
 * `key=value` pairs joined with `&`, followed by the API secret. The secret is the
 * tail, not a prefix, and is never part of the request.
 */
export const signParams = (params: Record<string, string>, apiSecret: string): string => {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
};

const toContract = (row: MediaRow): MediaAsset => ({
  id: row.id,
  publicId: row.publicId,
  secureUrl: row.secureUrl,
  format: MediaFormatSchema.parse(row.format),
  resourceType: MediaResourceTypeSchema.parse(row.resourceType),
  bytes: row.bytes,
  ...(row.width === null ? {} : {width: row.width}),
  ...(row.height === null ? {} : {height: row.height}),
  originalFilename: row.originalFilename,
  alt: row.alt,
  createdAt: row.createdAt.toISOString(),
});

export const __testing = {signParams, toContract};
