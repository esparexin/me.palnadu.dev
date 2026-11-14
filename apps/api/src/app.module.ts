import {Module} from '@nestjs/common';
import {APP_GUARD} from '@nestjs/core';
import {ThrottlerModule} from '@nestjs/throttler';
import {HealthModule} from './modules/health/health.module.js';
import {ExperienceModule} from './modules/experience/experience.module.js';
import {AdminAuthModule} from './modules/auth/admin.module.js';
import {KnowledgeModule} from './modules/knowledge/knowledge.module.js';
import {MediaModule} from './modules/media/media.module.js';
import {AuditModule} from './modules/audit/audit.module.js';
import {OverviewModule} from './modules/overview/overview.module.js';
import {PrismaModule} from './prisma/prisma.module.js';
import {AdminSessionGuard} from './auth/admin-session.guard.js';
import {RequireRolesGuard} from './auth/require-roles.guard.js';
import {ConfigModule} from './config/config.module.js';
import {
  ApiThrottlerGuard,
  adminThrottlerOptions,
  loginThrottlerOptions,
  publicThrottlerOptions,
} from './auth/throttling.js';

/**
 * The root module.
 *
 * Configuration is parsed when this module is constructed, so an invalid environment
 * aborts the boot instead of yielding a half-started process that answers requests with
 * undefined configuration (DEPLOYMENT_MAP.md section 6). PrismaModule is imported here
 * so the client connects once per process and its lifecycle is tied to the application.
 *
 * Guards are registered globally so that protection is the default.
 *
 * `AdminSessionGuard` skips routes that carry `@Public()`; anything else requires a
 * valid session. `RequireRolesGuard` only acts on routes that declare roles. A route
 * that forgets `@Public()` therefore returns 401 instead of becoming an open endpoint,
 * which is the failure mode that matters (SECURITY.md section 2).
 *
 * `ThrottlerGuard` runs after both, so the administrative throttler can key on the
 * administrator the guard resolved rather than on an address several requests may
 * share.
 */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AdminAuthModule,
    HealthModule,
    ExperienceModule,
    KnowledgeModule,
    MediaModule,
    AuditModule,
    OverviewModule,
    ThrottlerModule.forRoot([publicThrottlerOptions, adminThrottlerOptions, loginThrottlerOptions]),
  ],
  providers: [
    {provide: APP_GUARD, useClass: AdminSessionGuard},
    {provide: APP_GUARD, useClass: RequireRolesGuard},
    {provide: APP_GUARD, useClass: ApiThrottlerGuard},
  ],
})
export class AppModule {}
