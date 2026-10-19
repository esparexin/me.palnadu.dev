import {Global, Module} from '@nestjs/common';
import {ENV} from '../common/tokens.js';
import {parseEnv, type Env} from './env.js';

/**
 * Provides the validated environment to the whole application.
 *
 * Global on purpose. `AppModule` providing `ENV` does not make it visible to the
 * modules it imports, so `PrismaService` could not resolve the token - a failure the
 * Phase 6B integration test surfaced immediately. A global configuration module is
 * the idiomatic fix and removes a scoping trap rather than working around it.
 *
 * Parsing happens once, at module construction, so an invalid environment aborts the
 * boot rather than producing a half-started process (DEPLOYMENT_MAP.md section 6).
 */
@Global()
@Module({
  providers: [{provide: ENV, useFactory: (): Env => parseEnv(process.env)}],
  exports: [ENV],
})
export class ConfigModule {}
