/**
 * @me-palnadu/contracts
 *
 * The single source of truth for domain types, enums, validation schemas, error
 * codes, and API contracts (SSOT_POLICY.md). Everything else in the monorepo
 * consumes this package; nothing redefines what it defines.
 *
 * This package must stay framework-free: no React, no Next, no Nest, no Prisma,
 * no database client, and no Node-only APIs beyond what Zod itself needs.
 */
export * from './enums.js';
export * from './common.js';
export * from './experience.js';
export * from './project.js';
export * from './knowledge.js';
export * from './auth.js';