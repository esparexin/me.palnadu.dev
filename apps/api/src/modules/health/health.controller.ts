import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import { API_ROUTES } from '@me-palnadu/contracts';
import { ENV } from '../../common/tokens.js';
import type { Env } from '../../config/env.js';

/**
 * The minimum surface this controller needs from the response object.
 *
 * Declared structurally so the health module does not take a dependency on the
 * underlying HTTP framework's types: a health probe is infrastructure, and
 * coupling it to express types would make the module harder to move.
 */
interface StatusSetter {
  status: (code: number) => unknown;
}

/**
 * Health endpoints (DEPLOYMENT_MAP.md section 6).
 *
 * Liveness answers "is this process running" and touches nothing else, so a slow
 * database cannot cause the platform to kill a healthy process. Readiness answers
 * "should traffic be routed here" and fails closed: with no database configured it
 * returns 503 rather than claiming a readiness it cannot prove.
 */
@Controller()
export class HealthController {
  constructor(@Inject(ENV) private readonly env: Env) {}

  @Get(API_ROUTES.health.live)
  live() {
    return { status: 'ok' as const, uptimeSeconds: Math.round(process.uptime()) };
  }

  @Get(API_ROUTES.health.ready)
  ready(@Res({ passthrough: true }) response: StatusSetter) {
    const databaseConfigured = this.env.DATABASE_URL !== undefined;
    if (!databaseConfigured) {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return {
      status: databaseConfigured ? ('ready' as const) : ('degraded' as const),
      database: databaseConfigured ? 'configured' : 'not-configured',
    };
  }
}