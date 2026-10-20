import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  MediaAssetSchema,
  MediaListQuerySchema,
  MediaRegisterSchema,
  MediaSignRequestSchema,
  MediaSignResponseSchema,
  MediaStatusSchema,
  PaginatedResponseSchema,
  type MediaListQuery,
  type MediaRegisterInput,
  type MediaSignRequest,
} from '@me-palnadu/contracts';
import {MediaService} from './media.service.js';
import {ZodValidationPipe} from '../../common/zod-validation.pipe.js';
import {RequireRoles} from '../../auth/require-roles.decorator.js';
import type {RequestWithAdmin} from '../../auth/admin-context.js';
import {AdminRateLimit} from '../../auth/throttling.js';
import {auditOf} from '../../common/audit.js';

/**
 * Media library administration (ADR-0010 §4).
 *
 * All routes require a session: there is deliberately no public listing. Assets are
 * consumed by URL from published content, which the visitor's browser fetches from
 * the provider, not from this API.
 */
@Controller('api/admin/media')
export class MediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}

  /** Reports whether the deployment can accept uploads, without revealing the key. */
  @RequireRoles('owner', 'editor')
  @AdminRateLimit()
  @Get('status')
  status() {
    return MediaStatusSchema.parse(this.media.status());
  }

  @RequireRoles('owner', 'editor')
  @AdminRateLimit()
  @Post('sign')
  @HttpCode(HttpStatus.OK)
  sign(@Body(new ZodValidationPipe(MediaSignRequestSchema)) body: MediaSignRequest) {
    return MediaSignResponseSchema.parse(this.media.sign(body));
  }

  @RequireRoles('owner', 'editor')
  @AdminRateLimit()
  @Get()
  async list(@Query(new ZodValidationPipe(MediaListQuerySchema)) query: MediaListQuery) {
    const page = await this.media.list(query);
    return PaginatedResponseSchema(MediaAssetSchema).parse(page);
  }

  @RequireRoles('owner', 'editor')
  @AdminRateLimit()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(new ZodValidationPipe(MediaRegisterSchema)) body: MediaRegisterInput,
    @Req() request: RequestWithAdmin,
  ) {
    const asset = await this.media.register(
      body,
      auditOf(request, 'media_register', 'media', 'pending'),
    );
    return MediaAssetSchema.parse(asset);
  }

  @RequireRoles('owner')
  @AdminRateLimit()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @Req() request: RequestWithAdmin) {
    await this.media.delete(id, auditOf(request, 'media_delete', 'media', id));
  }
}
