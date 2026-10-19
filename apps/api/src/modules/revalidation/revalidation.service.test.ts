import {afterEach, describe, expect, it, vi} from 'vitest';
import {CACHE_TAGS, REVALIDATE_SECRET_HEADER} from '@me-palnadu/contracts';
import {RevalidationService} from './revalidation.service.js';
import type {Env} from '../../config/env.js';

/**
 * Cache revalidation is best-effort by design: the write has already committed, so
 * an unreachable web deployment must not turn a successful save into an error.
 * These tests pin that contract.
 */

const configured = (): Env =>
  ({
    NODE_ENV: 'test',
    WEB_REVALIDATE_URL: 'http://localhost:3001/api/revalidate',
    REVALIDATE_SECRET: 'revalidation-secret-value',
  }) as Env;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RevalidationService', () => {
  it('posts the tags and paths with the secret header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', {status: 200}));
    vi.stubGlobal('fetch', fetchMock);

    await new RevalidationService(configured()).revalidate({
      tags: [CACHE_TAGS.articles],
      paths: ['/knowledge-hub'],
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3001/api/revalidate');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)[REVALIDATE_SECRET_HEADER]).toBe(
      'revalidation-secret-value',
    );
    expect(JSON.parse(String(init.body))).toEqual({
      tags: [CACHE_TAGS.articles],
      paths: ['/knowledge-hub'],
    });
  });

  it('does not throw when the web app refuses or is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', {status: 500})));
    await expect(
      new RevalidationService(configured()).revalidate({tags: [CACHE_TAGS.articles], paths: []}),
    ).resolves.toBeUndefined();

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    await expect(
      new RevalidationService(configured()).revalidate({tags: [CACHE_TAGS.articles], paths: []}),
    ).resolves.toBeUndefined();
  });

  it('is a no-op when the deployment has no web app configured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await new RevalidationService({NODE_ENV: 'test'} as Env).revalidate({
      tags: [CACHE_TAGS.articles],
      paths: [],
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
