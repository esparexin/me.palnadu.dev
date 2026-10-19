import {defineConfig} from 'vitest/config';

/**
 * Database integration tests. Run only through `pnpm test:integration`, which
 * starts the ephemeral replica set first (scripts/db/run-integration.mjs).
 *
 * No skip-if-unavailable behaviour: if DATABASE_URL is absent the suite throws,
 * because a database test that did not run must never look like one that passed.
 */
export default defineConfig({
  test: {
    include: ['test/integration/**/*.int-spec.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
