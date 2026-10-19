import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type {Prisma} from '@prisma/client';
import {
  ExperienceCreateSchema,
  ExperienceSchema,
  ExperienceUpdateSchema,
  PublicExperienceSchema,
  type ExperienceCreateInput,
  type ExperienceUpdateInput,
} from '@me-palnadu/contracts';
import {ExperienceService} from './experience.service.js';
import {ApiError} from '../../common/api-error.js';
import {ZodValidationPipe} from '../../common/zod-validation.pipe.js';
import {Public} from '../../auth/public.decorator.js';
import {RequireRoles} from '../../auth/require-roles.decorator.js';
import type {RequestWithAdmin} from '../../auth/admin-context.js';

/**
 * The Experience resource over HTTP.
 *
 * Reads are public and return published records only. Every write requires an
 * administrator session, and the guard fails closed: a route without `@Public()` is
 * protected, so forgetting the annotation yields a 401 rather than an open endpoint.
 *
 * Responses are validated against the contracts on the way out, so drift between
 * persistence and the published contract fails here instead of in a browser.
 *
 * There is deliberately no `archive` route. Archiving was previously implemented as
 * `published = false`, which is byte-for-byte what `unpublish` already does: two names
 * for one behaviour, where an operator would reasonably assume they differ. Real
 * archiving needs an archived state in the contract and the database, which is a
 * domain decision rather than a routing detail. See the open question in the PR.
 */
@Controller('api/experience')
export class ExperienceController {
  constructor(@Inject(ExperienceService) private readonly experience: ExperienceService) {}

  @Public()
  @Get()
  async listPublished() {
    const records = await this.experience.listPublished();
    return records.map((record) => PublicExperienceSchema.parse(record));
  }

  @Public()
  @Get(':slug')
  async readPublished(@Param('slug') slug: string) {
    const record = await this.experience.findBySlug(slug);
    // A draft is indistinguishable from a missing record for an unauthenticated
    // caller: returning 403 would confirm that it exists.
    if (record === null || !record.published) {
      throw ApiError.notFound('No published experience entry has that identifier.');
    }
    return PublicExperienceSchema.parse(record);
  }

  @RequireRoles('owner', 'editor')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodValidationPipe(ExperienceCreateSchema)) body: ExperienceCreateInput,
    @Req() request: RequestWithAdmin,
  ) {
    const created = await this.experience.create(
      body,
      auditOf(request, 'experience.create', body.slug),
    );
    return ExperienceSchema.parse(created);
  }

  @RequireRoles('owner', 'editor')
  @Patch(':slug')
  async update(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(ExperienceUpdateSchema)) body: ExperienceUpdateInput,
    @Req() request: RequestWithAdmin,
  ) {
    const updated = await this.experience.update(
      slug,
      body,
      auditOf(request, 'experience.update', slug, {fields: Object.keys(body)}),
    );
    return ExperienceSchema.parse(updated);
  }

  @RequireRoles('owner', 'editor')
  @Post(':slug/publish')
  @HttpCode(HttpStatus.OK)
  async publish(@Param('slug') slug: string, @Req() request: RequestWithAdmin) {
    return ExperienceSchema.parse(
      await this.experience.setPublished(slug, true, auditOf(request, 'experience.publish', slug)),
    );
  }

  @RequireRoles('owner', 'editor')
  @Post(':slug/unpublish')
  @HttpCode(HttpStatus.OK)
  async unpublish(@Param('slug') slug: string, @Req() request: RequestWithAdmin) {
    return ExperienceSchema.parse(
      await this.experience.setPublished(
        slug,
        false,
        auditOf(request, 'experience.unpublish', slug),
      ),
    );
  }
}

/**
 * Builds the audit entry for an administrative write.
 *
 * The actor is read from the request only after `AdminSessionGuard` has resolved it
 * against the database, so a forged claim cannot name an author. Its absence here is a
 * wiring fault rather than a client error, and fails closed.
 */
const auditOf = (
  request: RequestWithAdmin,
  action: string,
  entityId: string,
  detail?: Prisma.InputJsonObject,
) => {
  if (request.admin === undefined) {
    throw new ApiError('UNAUTHENTICATED', 'The session token is not valid.');
  }
  return {
    actorId: request.admin.id,
    action,
    entityType: 'experience',
    entityId,
    // Conditional spread, not `detail: detail ?? undefined`: under
    // `exactOptionalPropertyTypes` a key present with an undefined value is a type
    // error, and omitting it keeps the optional genuinely optional.
    ...(detail === undefined ? {} : {detail}),
  };
};
