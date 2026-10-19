import {Module} from '@nestjs/common';
import {APP_GUARD} from '@nestjs/core';
import {HealthModule} from './modules/health/health.module.js';
import {ExperienceModule} from './modules/experience/experience.module.js';
import {AdminAuthModule} from './modules/auth/admin.module.js';
import {PrismaModule} from './prisma/prisma.module.js';
import {AdminSessionGuard} from './auth/admin-session.guard.js';
import {RequireRolesGuard} from './auth/require-roles.guard.js';
import {ConfigModule} from './config/config.module.js';

/**
 * The root module.
 *
 * Configuration is parsed when this module is constructed, so an invalid
 * environment aborts the boot instead of yielding a half-started process that
 * answers requests with undefined configuration (DEPLOYMENT_MAP.md section 6).
 *
 * PrismaModule is imported here so the client connects once per process and its
 * lifecycle is tied to the application rather than to a lazily loaded feature.
 */
/**
 * Guards are registered globally so that protection is the default.
 *
 * `AdminSessionGuard` skips routes that carry `@Public()`; anything else requires a
 * valid session. `RequireRolesGuard` only acts on routes that declare roles. A route
 * that forgets `@Public()` therefore returns 401 instead of becoming an open endpoint,
 * which is the failure mode that matters (SECURITY.md section 2).
 */
@Module({
  imports: [ConfigModule, PrismaModule, AdminAuthModule, HealthModule, ExperienceModule],
  providers: [
    {provide: APP_GUARD, useClass: AdminSessionGuard},
    {provide: APP_GUARD, useClass: RequireRolesGuard},
  ],
})
export class AppModule {}
