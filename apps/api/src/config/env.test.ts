import {describe, expect, it} from 'vitest';
import {allowedOrigins, parseEnv} from './env.js';

const base = {
  NODE_ENV: 'test',
  PORT: '4000',
  AUTH_ISSUER: 'me-palnadu-admin',
  AUTH_AUDIENCE: 'me-palnadu-api',
  LOG_LEVEL: 'info',
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
});
