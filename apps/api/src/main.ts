import 'reflect-metadata';
import {Logger} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import type {NestExpressApplication} from '@nestjs/platform-express';
import {AppModule} from './app.module.js';
import {existsSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {ApiExceptionFilter} from './common/api-exception.filter.js';
import {configureHttp} from './common/http-hardening.js';
import {parseEnv} from './config/env.js';

async function bootstrap(): Promise<void> {
  try {
    process.loadEnvFile?.();
  } catch {
    // ignore missing .env file
  }

  if (process.env['DATABASE_URL'] === undefined && process.env['NODE_ENV'] !== 'production') {
    const stateFile = path.join(tmpdir(), 'me-palnadu-test-replica', 'state.json');
    if (existsSync(stateFile)) {
      try {
        const state: unknown = JSON.parse(readFileSync(stateFile, 'utf8'));
        if (
          typeof state === 'object' &&
          state !== null &&
          'uri' in state &&
          typeof state.uri === 'string'
        ) {
          process.env['DATABASE_URL'] = state.uri;
        }
      } catch {
        // ignore malformed state file
      }
    }
  }

  const env = parseEnv(process.env);
  // NestExpressApplication, not INestApplication: `useBodyParser` is declared on the
  // concrete Express application and is how the body limit is set explicitly rather
  // than inheriting Express's 100KB default (SECURITY.md 5).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {bufferLogs: false});

  // Cross-origin policy and security headers come from the shared configuration so
  // the tests exercise exactly what is deployed (SECURITY.md 5).
  configureHttp(app, env);

  // One error envelope for every failure, including persistence failures, so a
  // client never has to parse two shapes (CODING_STANDARDS.md section 4).
  app.useGlobalFilters(new ApiExceptionFilter());

  app.enableShutdownHooks();

  const logger = new Logger('Bootstrap');
  await app.listen(env.PORT, '0.0.0.0');
  logger.log(`api listening on port ${env.PORT} (${env.NODE_ENV})`);
}

await bootstrap();
