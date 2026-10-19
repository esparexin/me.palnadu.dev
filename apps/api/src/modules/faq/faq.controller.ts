import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  FaqCreateSchema,
  FaqListQuerySchema,
  FaqSchema,
  FaqUpdateSchema,
  PaginatedResponseSchema,
  PublicFaqSchema,
  type FaqCreateInput,
  type FaqListQuery,
  type FaqUpdateInput,
} from '@me-palnadu/contracts';
import {FaqService} from './faq.service.js';
import {ZodValidationPipe} from '../../common/zod-validation.pipe.js';
import {Public} from '../../auth/public.decorator.js';
import {RequireRoles} from '../../auth/require-roles.decorator.js';
import type {RequestWithAdmin} from '../../auth/admin-context.js';
import {AdminRateLimit, PublicRateLimit} from '../../auth/throttling.js';
import {auditOf} from '../../common/audit.js';

/** Public FAQ reads. Drafts are absent, not forbidden (SECURITY.md §3). */
@Controller('api/faq')
export class FaqPublicController {
  constructor(@Inject(FaqService) private readonly faq: FaqService) {}

  @Public()
  @PublicRateLimit()
  @Get()
  async list(@Query(new ZodValidationPipe(FaqListQuerySchema)) query: FaqListQuery) {
    const page = await this.faq.listPublished(query);
    return PaginatedResponseSchema(PublicFaqSchema).parse(page);
  }
}

/** Authenticated FAQ authoring. */
@Controller('api/admin/faq')
export class FaqAdminController {
  constructor(@Inject(FaqService) private readonly faq: FaqService) {}

  @RequireRoles('owner', 'editor')
  @AdminRateLimit()
  @Get()
  async list(@Query(new ZodValidationPipe(FaqListQuerySchema)) query: FaqListQuery) {
    const page = await this.faq.listAll(query);
    return PaginatedResponseSchema(FaqSchema).parse(page);
  }

  @RequireRoles('owner', 'editor')
  @AdminRateLimit()
  @Get(':id')
  async read(@Param('id') id: string) {
    return FaqSchema.parse(await this.faq.findById(id));
  }

  @RequireRoles('owner', 'editor')
  @AdminRateLimit()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodValidationPipe(FaqCreateSchema)) body: FaqCreateInput,
    @Req() request: RequestWithAdmin,
  ) {
    const created = await this.faq.create(body, auditOf(request, 'faq_create', 'faq', 'pending'));
    return FaqSchema.parse(created);
  }

  @RequireRoles('owner', 'editor')
  @AdminRateLimit()
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(FaqUpdateSchema)) body: FaqUpdateInput,
    @Req() request: RequestWithAdmin,
  ) {
    const updated = await this.faq.update(
      id,
      body,
      auditOf(request, 'faq_update', 'faq', id, {fields: Object.keys(body)}),
    );
    return FaqSchema.parse(updated);
  }

  @RequireRoles('owner', 'editor')
  @AdminRateLimit()
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  async publish(@Param('id') id: string, @Req() request: RequestWithAdmin) {
    return FaqSchema.parse(
      await this.faq.setStatus(id, 'published', auditOf(request, 'faq_publish', 'faq', id)),
    );
  }

  @RequireRoles('owner', 'editor')
  @AdminRateLimit()
  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  async unpublish(@Param('id') id: string, @Req() request: RequestWithAdmin) {
    return FaqSchema.parse(
      await this.faq.setStatus(id, 'draft', auditOf(request, 'faq_unpublish', 'faq', id)),
    );
  }

  @RequireRoles('owner', 'editor')
  @AdminRateLimit()
  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  async archive(@Param('id') id: string, @Req() request: RequestWithAdmin) {
    return FaqSchema.parse(
      await this.faq.setStatus(id, 'archived', auditOf(request, 'faq_archive', 'faq', id)),
    );
  }

  @RequireRoles('owner')
  @AdminRateLimit()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @Req() request: RequestWithAdmin) {
    await this.faq.delete(id, auditOf(request, 'faq_delete', 'faq', id));
  }
}
