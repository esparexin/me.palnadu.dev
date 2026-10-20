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
  /** API-only signing key; the admin application never verifies tokens (SECURITY.md 4.4). */
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_ISSUER: z.string().min(1).default('me-palnadu-admin'),
  AUTH_AUDIENCE: z.string().min(1).default('me-palnadu-api'),
  /** Exact origins only. A wildcard is a defect and is rejected here. */
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  /**
   * Public URL of the web app's `POST /api/revalidate` route. Absent means cache
   * invalidation is skipped and the write still succeeds (ADR-0010 5).
   */
  WEB_REVALIDATE_URL: z.url().optional(),
  /** Shared secret presented to the web revalidation route. Never logged. */
  REVALIDATE_SECRET: z.string().min(16).optional(),
  /** Media library provider (ADR-0010 4). All three are required for uploads. */
  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),
  CLOUDINARY_UPLOAD_FOLDER: z.string().min(1).default('me-palnadu/media'),
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
  const cloudinary = [
    parsed.data.CLOUDINARY_CLOUD_NAME,
    parsed.data.CLOUDINARY_API_KEY,
    parsed.data.CLOUDINARY_API_SECRET,
  ];
  const configuredCloudinary = cloudinary.filter((value) => value !== undefined).length;
  if (configuredCloudinary !== 0 && configuredCloudinary !== cloudinary.length) {
    // A half-configured media library reports `configured: false` while an operator
    // believes it is on. Refuse the boot rather than serve a misleading status.
    throw new Error(
      'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must be set together',
    );
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
