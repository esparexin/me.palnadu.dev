import {Module} from '@nestjs/common';
import {HealthModule} from './modules/health/health.module.js';
import {ENV} from './common/tokens.js';
import {parseEnv} from './config/env.js';

/**
 * The root module.
 *
 * Configuration is parsed when this module is constructed, so an invalid
 * environment aborts the boot instead of yielding a half-started process that
 * answers requests with undefined configuration (DEPLOYMENT_MAP.md section 6).
 */
@Module({
  imports: [HealthModule],
  providers: [{provide: ENV, useValue: parseEnv(process.env)}],
})
export class AppModule {}
