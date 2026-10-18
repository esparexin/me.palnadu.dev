import {Module} from '@nestjs/common';
import {HealthModule} from './modules/health/health.module.js';
import {ExperienceModule} from './modules/experience/experience.module.js';
import {PrismaModule} from './prisma/prisma.module.js';
import {ENV} from './common/tokens.js';
import {parseEnv} from './config/env.js';

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
@Module({
  imports: [PrismaModule, HealthModule, ExperienceModule],
  providers: [{provide: ENV, useValue: parseEnv(process.env)}],
})
export class AppModule {}
