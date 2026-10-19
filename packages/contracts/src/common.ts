import {z} from 'zod';

/** Lowercase kebab slug. The public URL identity of projects and articles. */
export const SlugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be lowercase kebab-case');

/** ISO calendar month, `YYYY-MM`. Precision finer than a month is a career claim we cannot verify. */
export const MonthSchema = z.string().regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/, 'must be YYYY-MM');

export const IsoDateSchema = z.iso.date();

/**
 * Full ISO datetime. Article publication is an instant, not a calendar day: two
 * articles published on the same date still have a defined order, and a cache tag
 * can be invalidated at the moment the status changed.
 */
export const IsoDateTimeSchema = z.iso.datetime({offset: true});

export const NonEmptyTextSchema = z.string().trim().min(1);

export const TechTagSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z0-9][A-Za-z0-9 .+#/-]*$/, 'must start alphanumeric');

/**
 * Derive a patch shape from a create shape without restating a single field.
 *
 * `z.object(base.shape).partial()` is not equivalent: a field declared with a
 * default keeps that default through `.optional()`, so a partial update would
 * silently overwrite stored values the caller never mentioned. Verified in Zod
 * 4.6: `z.object({ a: z.boolean().default(false).optional() }).parse({})` yields
 * `{ a: false }`, while unwrapping the default first yields `{}`.
 *
 * Unwrapping is what removes the default from the patch path, and keeping the
 * derivation mechanical is what honours the single definition of the field list
 * (SSOT_POLICY 3.3).
 */
type UnwrapDefault<Type> = Type extends z.ZodDefault<infer Inner> ? Inner : Type;

/** `unwrap()` is declared on the wrapper types, not on the base type. */
interface DefaultWrapper {
  unwrap: () => z.ZodType;
}

const isDefaultWrapper = (value: z.ZodType): value is z.ZodType & DefaultWrapper =>
  typeof (value as unknown as Partial<DefaultWrapper>).unwrap === 'function';

export const toPatchShape = <Shape extends z.ZodRawShape>(
  shape: Shape,
): {[Key in keyof Shape]: z.ZodOptional<UnwrapDefault<Shape[Key]>>} =>
  Object.fromEntries(
    Object.entries(shape).map(([key, value]) => {
      const field = value as z.ZodType;
      const stripped = isDefaultWrapper(field) ? field.unwrap() : field;
      return [key, stripped.optional()];
    }),
  ) as unknown as {[Key in keyof Shape]: z.ZodOptional<UnwrapDefault<Shape[Key]>>};

/** RFC 2606 reserved domain, so fixtures and examples can never be real addresses. */
export const EmailAddressSchema = z.email().max(254);

export const UrlSchema = z.url().max(2048);

export const IdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/);

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/** Generic envelope so every list endpoint returns one shape. */
export const PaginatedResponseSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    total: z.number().int().min(0),
    hasMore: z.boolean(),
  });

/**
 * The response schema for a 204. Named so a client can parse "no content" without
 * importing Zod itself or casting the result.
 */
export const NoContentSchema = z.void();

/** The inferred envelope, so a service returns a typed list without re-declaring it. */
export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export const ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'SETUP_REQUIRED',
  'DEPENDENCY_UNAVAILABLE',
] as const;
export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

/** The only error shape the API ever returns (SECURITY.md 5). */
export const ApiErrorEnvelopeSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    requestId: z.string(),
    details: z.array(z.object({path: z.string(), message: z.string()})).optional(),
  }),
});
export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelopeSchema>;

/** Route constants so the client and the controller cannot drift apart. */
export const API_ROUTES = {
  health: {
    live: '/health/live',
    ready: '/health/ready',
  },
  auth: {
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    changePassword: '/api/auth/change-password',
    session: '/api/auth/session',
    sessions: '/api/auth/sessions',
    sessionsRevoke: '/api/auth/sessions/revoke',
  },
  experience: '/api/experience',
  projects: '/api/projects',
  skills: '/api/skills',
  resume: '/api/resume',
  knowledge: '/api/knowledge',
  knowledgeAdmin: '/api/admin/knowledge',
  media: '/api/admin/media',
  audit: '/api/admin/audit',
  overview: '/api/admin/overview',
  messages: '/api/messages',
} as const;

/** Public web routes. Canonical names live here so links and sitemap agree. */
export const WEB_ROUTES = {
  home: '/',
  experience: '/experience',
  projects: '/projects',
  knowledgeHub: '/knowledge-hub',
  resume: '/resume',
  contact: '/contact',
  revalidate: '/api/revalidate',
  rss: '/knowledge-hub/rss.xml',
} as const;
