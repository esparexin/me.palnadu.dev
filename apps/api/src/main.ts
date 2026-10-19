import 'reflect-metadata';
import {Logger} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module.js';
import {ApiExceptionFilter} from './common/api-exception.filter.js';
import {configureHttp} from './common/http-hardening.js';
import {parseEnv} from './config/env.js';

async function bootstrap(): Promise<void> {
  const env = parseEnv(process.env);
  const app = await NestFactory.create(AppModule, {bufferLogs: false});

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
