import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end and accessibility gates (CI_GATES.md area 4).
 *
 * These run against a production build served by `next start`, never against the
 * dev server: a dev build tolerates things a production build rejects, so testing
 * the dev server would let a broken production bundle pass.
 */
const PORT = Number.parseInt(process.env['E2E_PORT'] ?? '3100', 10);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  forbidOnly: true, // CI_GATES.md area 11: a stray .only must fail, not skip
  retries: 0, // TESTING.md section 3: a flaky test is a defect, not a retry problem
  workers: 2,
  reporter: process.env['CI'] === 'true' ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    // Pixel rather than iPhone: the iPhone descriptor selects WebKit, which would
    // add a second browser download to CI for no extra coverage. The mobile
    // viewport and touch behaviour under test are the same.
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `pnpm --filter @me-palnadu/web build && pnpm --filter @me-palnadu/web exec next start --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_SITE_URL: BASE_URL,
      NEXT_PUBLIC_API_URL: 'http://127.0.0.1:4000',
    },
  },
});