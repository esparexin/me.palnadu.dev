import {describe, expect, it} from 'vitest';
import {allowedOrigins, parseEnv} from './env.js';

const base = {
  NODE_ENV: 'test',
  PORT: '4000',
  AUTH_ISSUER: 'me-palnadu-admin',
  AUTH_AUDIENCE: 'me-palnadu-api',
  LOG_LEVEL: 'info',
} as NodeJS.ProcessEnv;

const production = {
  NODE_ENV: 'production',
  DATABASE_URL: 'mongodb://127.0.0.1:27017/me_palnadu',
  AUTH_SECRET: 'a'.repeat(32),
  ALLOWED_ORIGINS: 'https://me.palnadu.dev,https://admin.me.palnadu.dev',
} as NodeJS.ProcessEnv;

describe('env validation', () => {
  it('applies documented defaults', () => {
    const env = parseEnv(base);
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('test');
    expect(env.DATABASE_URL).toBeUndefined();
  });

  it('coerces a numeric port', () => {
    expect(parseEnv({...base, PORT: '8080'}).PORT).toBe(8080);
  });

  it('rejects an out-of-range port rather than silently defaulting', () => {
    expect(() => parseEnv({...base, PORT: '70000'})).toThrow(/invalid environment/);
  });

  it('refuses to boot with a short AUTH_SECRET', () => {
    expect(() => parseEnv({...base, AUTH_SECRET: 'too-short'})).toThrow(/invalid environment/);
  });

  it('rejects a wildcard CORS allowlist', () => {
    expect(() => parseEnv({...base, ALLOWED_ORIGINS: '*'})).toThrow(/wildcard is forbidden/);
  });

  it('splits and trims the origin allowlist', () => {
    const env = parseEnv({
      ...base,
      ALLOWED_ORIGINS: 'https://me.palnadu.dev, https://admin.me.palnadu.dev',
    });
    expect(allowedOrigins(env)).toEqual(['https://me.palnadu.dev', 'https://admin.me.palnadu.dev']);
  });

  it('tolerates a missing DATABASE_URL outside production', () => {
    // Development may boot without a database; readiness reports the truth instead.
    expect(parseEnv(base).DATABASE_URL).toBeUndefined();
  });
});

describe('production configuration is fail-fast (Phase 6A)', () => {
  it('accepts a complete production configuration', () => {
    const env = parseEnv(production);
    expect(env.NODE_ENV).toBe('production');
    expect(env.DATABASE_URL).toBe(production.DATABASE_URL);
  });

  it('refuses to start in production without DATABASE_URL', () => {
    const withoutDatabase: NodeJS.ProcessEnv = {...production};
    delete withoutDatabase.DATABASE_URL;
    expect(() => parseEnv(withoutDatabase)).toThrow(/missing required variables: DATABASE_URL/);
  });

  it('refuses to start in production without AUTH_SECRET', () => {
    const withoutSecret: NodeJS.ProcessEnv = {...production};
    delete withoutSecret.AUTH_SECRET;
    expect(() => parseEnv(withoutSecret)).toThrow(/missing required variables: AUTH_SECRET/);
  });

  it('names every missing variable at once rather than one per restart', () => {
    expect(() => parseEnv({NODE_ENV: 'production'})).toThrow(
      /missing required variables: DATABASE_URL, AUTH_SECRET/,
    );
  });

  it('refuses non-https origins in production', () => {
    expect(() =>
      parseEnv({...production, ALLOWED_ORIGINS: 'http://me.palnadu.dev'} as NodeJS.ProcessEnv),
    ).toThrow(/must use https origins/);
  });

  it('never includes the value of a missing secret in the error', () => {
    const withoutSecret: NodeJS.ProcessEnv = {...production};
    delete withoutSecret.AUTH_SECRET;
    try {
      parseEnv(withoutSecret);
      expect.unreachable('parseEnv should have thrown');
    } catch (error) {
      expect(error instanceof Error ? error.message : '').not.toContain('mongodb://');
    }
  });
});
