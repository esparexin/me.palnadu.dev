import {Test, type TestingModule} from '@nestjs/testing';
import type {INestApplication} from '@nestjs/common';
import {AppModule} from '../../src/app.module.js';
import {ENV} from '../../src/common/tokens.js';
import {configureHttp} from '../../src/common/http-hardening.js';
import {ApiExceptionFilter} from '../../src/common/api-exception.filter.js';
import {parseEnv, type Env} from '../../src/config/env.js';

/**
 * Builds an application configured exactly as the server is.
 *
 * `configureHttp` is the same function `main.ts` calls, so a test cannot accidentally
 * assert against a differently-configured application. The earlier arrangement, where
 * CORS lived in `bootstrap()` and the suite built its own app, meant every test ran
 * with no CORS at all.
 */
export const TEST_AUTH_SECRET = 'test-secret-value-that-is-long-enough-32';
export const TEST_ISSUER = 'me-palnadu-admin';
export const TEST_AUDIENCE = 'me-palnadu-api';

export const testEnv = (overrides: Partial<NodeJS.ProcessEnv> = {}): Env =>
  parseEnv({
    NODE_ENV: 'test',
    DATABASE_URL: process.env['DATABASE_URL'],
    AUTH_SECRET: TEST_AUTH_SECRET,
    AUTH_ISSUER: TEST_ISSUER,
    AUTH_AUDIENCE: TEST_AUDIENCE,
    ALLOWED_ORIGINS: 'http://localhost:3000,http://localhost:3001',
    ...overrides,
  });

export const createTestApp = async (env: Env = testEnv()): Promise<INestApplication> => {
  const moduleRef: TestingModule = await Test.createTestingModule({imports: [AppModule]})
    .overrideProvider(ENV)
    .useValue(env)
    .compile();

  const app = moduleRef.createNestApplication();
  configureHttp(app, env);
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.init();
  return app;
};
