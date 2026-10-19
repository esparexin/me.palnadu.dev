import {defineConfig} from 'vitest/config';

/**
 * The default run is unit tests only.
 *
 * Integration tests live in test/integration and are excluded here on purpose: they
 * require a MongoDB replica set, and a unit run that quietly skipped or failed them
 * would report a misleading result (B3: never silently skip database tests).
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['test/integration/**', 'dist/**', 'node_modules/**'],
  },
});
