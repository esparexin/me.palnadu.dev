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
  ArticleCreateSchema,
  ArticleListQuerySchema,
  ArticleSchema,
  ArticleSummarySchema,
  ArticleUpdateSchema,
  PaginatedResponseSchema,
  PublicArticleSchema,
  PublicArticleSummarySchema,
  type ArticleCreateInput,
  type ArticleListQuery,
  type ArticleUpdateInput,
  type PaginatedResponse,
} from '@me-palnadu/contracts';
import {KnowledgeService} from './knowledge.service.js';
import {ApiError} from '../../common/api-error.js';
import {ZodValidationPipe} from '../../common/zod-validation.pipe.js';
import {Public} from '../../auth/public.decorator.js';
import {RequireRoles} from '../../auth/require-roles.decorator.js';
import type {RequestWithAdmin} from '../../auth/admin-context.js';
import {AdminRateLimit, PublicRateLimit} from '../../auth/throttling.js';
import {auditOf} from '../../common/audit.js';

/**
 * Public Knowledge Hub reads.
 *
 * Drafts are filtered in the query, not in the client. A draft is indistinguishable
 * from a missing record: returning 403 would confirm it exists (SECURITY.md §3).
 */
@Controller('api/knowledge')
export class KnowledgePublicController {
  constructor(@Inject(KnowledgeService) private readonly knowledge: KnowledgeService) {}

  @Public()
  @PublicRateLimit()
  @Get()
  async list(@Query(new ZodValidationPipe(ArticleListQuerySchema)) query: ArticleListQuery) {
    const page = await this.knowledge.listPublished(query);
    return PaginatedResponseSchema(PublicArticleSummarySchema).parse(page);
  }

  @Public()
  @PublicRateLimit()
  @Get(':slug')
  async read(@Param('slug') slug: string) {
    const article = await this.knowledge.findPublished(slug);
    if (article === null) {
      throw ApiError.notFound('No published article has that identifier.');
    }
    return PublicArticleSchema.parse(article);
  }
}

/**
 * Authenticated Knowledge Hub authoring.
 *
 * Every write is audited, and every response is validated against the contract on
 * the way out so persistence drift fails here rather than in the admin UI.
 */
@Controller('api/admin/knowledge')
export class KnowledgeAdminController {
  constructor(@Inject(KnowledgeService) private readonly knowledge: KnowledgeService) {}

  @RequireRoles('owner', 'editor')
  @AdminRateLimit()
  @Get()
  async list(@Query(new ZodValidationPipe(ArticleListQuerySchema)) query: ArticleListQuery) {
    const page = await this.knowledge.listAll(query);
    return PaginatedResponseSchema(ArticleSummarySchema).parse(page);
  }

  @RequireRoles('owner', 'editor')
  @AdminRateLimit()
  @Get(':id')
  async read(@Param('id') id: string) {
    return ArticleSchema.parse(await this.knowledge.findById(id));
  }

  @RequireRoles('owner', 'editor')
  @AdminRateLimit()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodValidationPipe(ArticleCreateSchema)) body: ArticleCreateInput,
    @Req() request: RequestWithAdmin,
  ) {
    const created = await this.knowledge.create(
      body,
      auditOf(request, 'article_create', 'article', body.slug),
    );
    return ArticleSchema.parse(created);
  }

  @RequireRoles('owner', 'editor')
  @AdminRateLimit()
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ArticleUpdateSchema)) body: ArticleUpdateInput,
    @Req() request: RequestWithAdmin,
  ) {
    const updated = await this.knowledge.update(
      id,
      body,
      auditOf(request, 'article_update', 'article', id, {fields: Object.keys(body)}),
    );
    return ArticleSchema.parse(updated);
  }

  @RequireRoles('owner', 'editor')
  @AdminRateLimit()
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  async publish(@Param('id') id: string, @Req() request: RequestWithAdmin) {
    return ArticleSchema.parse(
      await this.knowledge.setStatus(
        id,
        'published',
        auditOf(request, 'article_publish', 'article', id),
      ),
    );
  }

  @RequireRoles('owner', 'editor')
  @AdminRateLimit()
  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  async unpublish(@Param('id') id: string, @Req() request: RequestWithAdmin) {
    return ArticleSchema.parse(
      await this.knowledge.setStatus(
        id,
        'draft',
        auditOf(request, 'article_unpublish', 'article', id),
      ),
    );
  }

  @RequireRoles('owner', 'editor')
  @AdminRateLimit()
  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  async archive(@Param('id') id: string, @Req() request: RequestWithAdmin) {
    return ArticleSchema.parse(
      await this.knowledge.setStatus(
        id,
        'archived',
        auditOf(request, 'article_archive', 'article', id),
      ),
    );
  }

  @RequireRoles('owner')
  @AdminRateLimit()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @Req() request: RequestWithAdmin) {
    await this.knowledge.delete(id, auditOf(request, 'article_delete', 'article', id));
  }
}

export type {PaginatedResponse};
