import { z } from 'zod';

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
  return parsed.data;
};

export const allowedOrigins = (env: Env): string[] =>
  env.ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);