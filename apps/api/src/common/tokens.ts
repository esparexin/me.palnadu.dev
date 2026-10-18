/**
 * Injection tokens. Declared as symbols so a missing provider fails loudly at
 * bootstrap instead of silently injecting undefined (SECURITY.md 3, assumption 6).
 */
export const ENV = Symbol('ENV');
export type EnvToken = typeof ENV;