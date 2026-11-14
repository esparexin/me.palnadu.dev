import {Inject, Injectable, Logger} from '@nestjs/common';
import {
  CACHE_TAGS,
  REVALIDATE_SECRET_HEADER,
  type CacheTag,
  type RevalidateRequest,
} from '@me-palnadu/contracts';
import {ENV} from '../../common/tokens.js';
import type {Env} from '../../config/env.js';

/**
 * Cache revalidation (ADR-0010 §5).
 *
 * The write is the source of truth; the cache is derived. A failed revalidation
 * is logged and swallowed rather than failing the write, because losing a content
 * change to an unreachable web deployment is strictly worse than serving a stale
 * page until the next successful call or TTL expiry.
 *
 * When `WEB_REVALIDATE_URL` or `REVALIDATE_SECRET` is absent, this is a no-op that
 * logs once per process: a local API with no web app running should not spam a
 * warning on every save.
 */
@Injectable()
export class RevalidationService {
  private readonly logger = new Logger(RevalidationService.name);
  private warned = false;

  constructor(@Inject(ENV) private readonly env: Env) {}

  async revalidate(request: RevalidateRequest): Promise<void> {
    const url = this.env.WEB_REVALIDATE_URL;
    const secret = this.env.REVALIDATE_SECRET;
    if (url === undefined || secret === undefined) {
      if (!this.warned) {
        this.logger.warn(
          'cache revalidation is not configured (WEB_REVALIDATE_URL/REVALIDATE_SECRET absent); content changes will appear on the next cache expiry',
        );
        this.warned = true;
      }
      return;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [REVALIDATE_SECRET_HEADER]: secret,
        },
        body: JSON.stringify(request),
        cache: 'no-store',
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) {
        this.logger.warn(`cache revalidation rejected with status ${response.status}`);
      }
    } catch (error) {
      this.logger.warn(
        `cache revalidation request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Tags a content change always invalidates. Named here so callers do not guess. */
  static readonly contentTags: readonly CacheTag[] = [CACHE_TAGS.articles, CACHE_TAGS.sitemap];
}
