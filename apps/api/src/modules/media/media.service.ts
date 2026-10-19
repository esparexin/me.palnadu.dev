import {Inject, Injectable, Logger} from '@nestjs/common';
import {createHash} from 'node:crypto';
import type {Prisma} from '@prisma/client';
import {
  MEDIA_ALLOWED_FORMATS,
  MEDIA_MAX_BYTES,
  MediaFormatSchema,
  MediaResourceTypeSchema,
  type MediaAsset,
  type MediaFormat,
  type MediaListQuery,
  type MediaRegisterInput,
  type MediaResourceType,
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
 * 3. Deleting commits the metadata removal first and then asks the provider to
 *    destroy the file. A provider failure leaves an orphaned file, which is
 *    recoverable from the provider console; the reverse order leaves published
 *    content pointing at a file that no longer exists.
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

interface DeploymentAsset {
  cloudName: string;
  folder: string;
  publicId: string;
  secureUrl: string;
  format: MediaFormat;
  resourceType: MediaResourceType;
}

/**
 * Proves that a registration names an asset this deployment could have uploaded.
 *
 * The URL is not merely checked for the Cloudinary hostname: its path must resolve
 * to the submitted public id, format, resource type and cloud. Otherwise a caller
 * could register an unrelated (or altered) URL under a trusted-looking public id,
 * and a later delete would destroy the named asset while the page rendered another.
 */
export const isDeploymentAsset = ({
  cloudName,
  folder,
  publicId,
  secureUrl,
  format,
  resourceType,
}: DeploymentAsset): boolean => {
  if (!publicId.startsWith(`${folder}/`)) return false;
  const segments = publicId.split('/');
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    return false;
  }

  let url: URL;
  try {
    url = new URL(secureUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return false;
  if (url.port !== '' || url.username !== '' || url.password !== '') return false;
  if (url.search !== '' || url.hash !== '') return false;

  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return false;
  }

  const prefix = `/${cloudName}/${resourceType}/upload/`;
  if (!pathname.startsWith(prefix)) return false;
  const expected = `${publicId}.${format}`;
  const remainder = pathname.slice(prefix.length);
  if (remainder === expected) return true;

  const versioned = /^v\d+\/(.+)$/u.exec(remainder);
  return versioned?.[1] === expected;
};

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

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
    if (
      !isDeploymentAsset({
        cloudName,
        folder,
        publicId: input.publicId,
        secureUrl: input.secureUrl,
        format: input.format,
        resourceType: input.resourceType,
      })
    ) {
      throw ApiError.validationFailed('The asset does not belong to this media library.', [
        {path: 'secureUrl', message: 'must resolve to the submitted public id in this cloud'},
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
    let existing: {publicId: string; resourceType: string} | null;
    try {
      existing = await this.prisma.mediaAsset.findUnique({where: {id}});
    } catch (error) {
      throw mapPersistenceError(error).error;
    }
    if (existing === null) throw ApiError.notFound('No media asset with that identifier exists.');

    // Commit the authoritative removal before touching the provider. If the
    // provider call then fails, the only residue is an orphaned file, which an
    // operator can remove; the library never references a destroyed file.
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.mediaAsset.delete({where: {id}});
        await this.admin.writeAudit(tx, {...audit, entityId: id});
      });
    } catch (error) {
      throw mapPersistenceError(error).error;
    }

    try {
      await this.destroyAtProvider(existing.publicId, existing.resourceType);
    } catch (error) {
      this.logger.warn(
        `media ${id} was removed from the library but provider cleanup failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
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
