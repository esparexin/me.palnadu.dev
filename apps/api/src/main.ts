import 'reflect-metadata';
import {Logger, ValidationPipe} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module.js';
import {allowedOrigins, parseEnv} from './config/env.js';

/**
 * Bootstrap.
 *
 * CORS is an exact-origin allowlist and credentials stay off: the API does not
 * authenticate by cookie (SECURITY.md 4.4), so an ambient browser credential must
 * never be accepted here.
 */
async function bootstrap(): Promise<void> {
  const env = parseEnv(process.env);
  const app = await NestFactory.create(AppModule, {bufferLogs: false});

  app.enableCors({
    origin: allowedOrigins(env),
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 600,
  });

  app.useGlobalPipes(
    // Defence in depth: strip unknown keys and reject unknown ones outright, so a
    // client can never smuggle a field into a persisted document (SECURITY.md 3).
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableShutdownHooks();

  const logger = new Logger('Bootstrap');
  await app.listen(env.PORT, '0.0.0.0');
  logger.log(`api listening on port ${env.PORT} (${env.NODE_ENV})`);
}

await bootstrap();
