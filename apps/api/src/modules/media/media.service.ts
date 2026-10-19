import {Inject, Injectable, Logger} from '@nestjs/common';
import type {Prisma} from '@prisma/client';
import {
  MEDIA_ALLOWED_FORMATS,
  MEDIA_MAX_BYTES,
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
import {
  DEFAULT_FOLDER,
  destroyCloudinaryAsset,
  isDeploymentAsset,
  signParams,
  toContract,
  type MediaRow,
  __testing,
} from './media.mapper.js';

export {isDeploymentAsset, signParams, __testing};

/**
 * Media library (ADR-0010 §4).
 *
 * 1. Direct browser uploads to Cloudinary with server-signed tokens.
 * 2. Origin/deployment verification against tenant cloud and folder.
 * 3. Two-phase deletion: metadata first, provider destroy second.
 */
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

  /** Returns parameters Cloudinary requires for a direct upload. */
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

  private async destroyAtProvider(publicId: string, resourceType: string): Promise<void> {
    const cloudName = this.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = this.env.CLOUDINARY_API_KEY;
    const apiSecret = this.env.CLOUDINARY_API_SECRET;
    if (cloudName === undefined || apiKey === undefined || apiSecret === undefined) {
      throw ApiError.setupRequired(
        'Cannot delete a media asset while the media library is not configured.',
      );
    }

    await destroyCloudinaryAsset({cloudName, apiKey, apiSecret, publicId, resourceType});
  }
}
