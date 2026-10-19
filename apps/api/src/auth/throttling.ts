import {applyDecorators, Injectable} from '@nestjs/common';
import {SkipThrottle, ThrottlerGuard, Throttle, type ThrottlerOptions} from '@nestjs/throttler';
import type {RequestWithAdmin} from './admin-context.js';

/**
 * Rate limiting (SECURITY.md 5).
 *
 * Two named throttlers rather than one global limit, because the documented limits
 * differ by two and a half orders of magnitude and are identified by different things.
 *
 * - `public` bounds unauthenticated reads by client address: 120/min.
 * - `admin` bounds authenticated administrative writes by administrator: 300/min.
 *
 * Keying administrative writes on the administrator rather than on the address is the
 * point of the split: the quantity worth bounding is one account's activity, and that
 * account's requests arrive from a single address anyway, so an address-based key would
 * count them against whatever else shares the network path.
 *
 * `ADR-0007` records the dependency choice, the in-memory storage decision, and the
 * consequences of both.
 */

export const PUBLIC_THROTTLER = 'public';
export const ADMIN_THROTTLER = 'admin';

/**
 * A 60-second window in milliseconds, with the per-window limits beside it, so §5 and
 * the configuration can be compared rather than restated.
 *
 * `@nestjs/throttler` 6 takes `ttl` in milliseconds; §5 states a per-minute limit.
 */
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const PUBLIC_LIMIT_PER_WINDOW = 120;
export const ADMIN_LIMIT_PER_WINDOW = 300;

/**
 * Keys an administrative request on the administrator the guard resolved.
 *
 * `AdminSessionGuard` runs first, so `request.admin` is the database-resolved identity
 * rather than anything a token asserts - a caller cannot choose which budget it spends.
 */
const adminTracker = async (request: Record<string, unknown>): Promise<string> => {
  const admin = (request as RequestWithAdmin).admin;
  if (admin !== undefined) return `admin:${admin.id}`;
  // Reachable only if the throttler is ever ordered ahead of authorization. Counting by
  // address is better than throwing from inside the limiter.
  return `address:${String(request['ip'] ?? 'unknown')}`;
};

export const publicThrottlerOptions: ThrottlerOptions = {
  name: PUBLIC_THROTTLER,
  ttl: RATE_LIMIT_WINDOW_MS,
  limit: PUBLIC_LIMIT_PER_WINDOW,
};

export const adminThrottlerOptions: ThrottlerOptions = {
  name: ADMIN_THROTTLER,
  ttl: RATE_LIMIT_WINDOW_MS,
  limit: ADMIN_LIMIT_PER_WINDOW,
  getTracker: adminTracker,
};

/**
 * Applies the {@link PUBLIC_THROTTLER} limit to a route.
 *
 * Skips the administrative throttler explicitly. Every named throttler registered in
 * `forRoot` applies to every route unless it is overridden or skipped, so a public read
 * would otherwise also be charged to the administrative budget - keyed by address,
 * because no administrator has been resolved yet.
 */
export const PublicRateLimit = (): MethodDecorator & ClassDecorator =>
  applyDecorators(
    SkipThrottle({[ADMIN_THROTTLER]: true}),
    Throttle({[PUBLIC_THROTTLER]: {limit: PUBLIC_LIMIT_PER_WINDOW, ttl: RATE_LIMIT_WINDOW_MS}}),
  );

/**
 * Applies the {@link ADMIN_THROTTLER} limit to a route.
 *
 * An administrative route is not also charged to the `public` budget: a caller that
 * cannot authenticate is refused with 401 before it can spend an administrator's
 * allowance.
 */
export const AdminRateLimit = (): MethodDecorator & ClassDecorator =>
  applyDecorators(
    // Without this the public throttler also applies and administrative writes are cut
    // off at 120/min. That was the first behaviour observed: the 300-request test was
    // refused at request 121.
    SkipThrottle({[PUBLIC_THROTTLER]: true}),
    Throttle({[ADMIN_THROTTLER]: {limit: ADMIN_LIMIT_PER_WINDOW, ttl: RATE_LIMIT_WINDOW_MS}}),
  );

/**
 * The guard registered globally.
 *
 * Subclassed only to key on the resolved administrator. Counting, storage and header
 * emission remain the package's.
 */
@Injectable()
export class ApiThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(request: Record<string, unknown>): Promise<string> {
    return adminTracker(request);
  }
}
