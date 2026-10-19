import {z} from 'zod';

/**
 * Runtime configuration schema.
 *
 * This is application-local configuration, not a shared contract, so it lives
 * here rather than in packages/contracts (SSOT_POLICY 1: precedence by concern).
 * It is validated at startup and a failure aborts the boot rather than letting the
 * process run with an undefined secret (SECURITY.md 3, assumption 6).
 */
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  /** Absent until the Atlas cluster is provisioned; readiness reports it honestly. */
  DATABASE_URL: z.string().min(1).optional(),
  /** Must be byte-identical to the admin application's AUTH_SECRET (SECURITY.md 4.4). */
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_ISSUER: z.string().min(1).default('me-palnadu-admin'),
  AUTH_AUDIENCE: z.string().min(1).default('me-palnadu-api'),
  /** Exact origins only. A wildcard is a defect and is rejected here. */
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Settings that must be present and valid in production.
 *
 * The Phase 3 behaviour was to tolerate a missing DATABASE_URL so a developer
 * could boot without a database. That is correct for development and wrong for
 * production: a production process that starts without a database serves 503s
 * while appearing healthy, and the failure surfaces to visitors rather than to
 * the deploy. The rule is therefore environment-dependent and fails fast.
 */
const PRODUCTION_REQUIRED = ['DATABASE_URL', 'AUTH_SECRET'] as const;

export const parseEnv = (source: NodeJS.ProcessEnv): Env => {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`invalid environment configuration - ${detail}`);
  }
  if (parsed.data.ALLOWED_ORIGINS.includes('*')) {
    throw new Error('ALLOWED_ORIGINS must list exact origins; a wildcard is forbidden');
  }
  if (parsed.data.NODE_ENV === 'production') {
    const missing = PRODUCTION_REQUIRED.filter((key) => parsed.data[key] === undefined);
    if (missing.length > 0) {
      // Names only: a value must never reach a log line.
      throw new Error(
        `production configuration is incomplete - missing required variables: ${missing.join(', ')}`,
      );
    }
    if (!parsed.data.ALLOWED_ORIGINS.includes('https://')) {
      throw new Error('production ALLOWED_ORIGINS must use https origins');
    }
  }
  return parsed.data;
};

export const allowedOrigins = (env: Env): string[] =>
  env.ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
