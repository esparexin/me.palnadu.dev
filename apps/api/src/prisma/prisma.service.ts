import {Inject, Injectable, type OnModuleDestroy, type OnModuleInit} from '@nestjs/common';
import {PrismaClient} from '@prisma/client';
import {ENV} from '../common/tokens.js';
import type {Env} from '../config/env.js';

/**
 * The only Prisma client in the repository (ARCHITECTURE.md section 5).
 *
 * Prisma is imported here and nowhere else outside this module, and the database
 * credential never leaves apps/api (ARCHITECTURE.md section 3).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(ENV) private readonly env: Env) {
    const url = env.DATABASE_URL;
    // Fail fast and without echoing the value: a client that cannot reach a
    // database must not start and pretend to be healthy (DEPLOYMENT_MAP section 6).
    if (url === undefined) {
      throw new Error(
        'DATABASE_URL is required to construct PrismaService. Set it before starting the API.',
      );
    }
    super({
      datasources: {db: {url}},
      log: env.LOG_LEVEL === 'debug' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Readiness detail, never the connection string.
   *
   * Uses $runCommandRaw because Prisma's MongoDB connector does not expose
   * $queryRaw; verified against Prisma 6.19.3 rather than assumed.
   */
  async isReachable(): Promise<boolean> {
    try {
      await this.$runCommandRaw({hello: 1});
      return true;
    } catch {
      return false;
    }
  }
}
