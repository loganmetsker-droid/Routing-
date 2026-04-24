import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5185';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  outputDir: '.artifacts/playwright/test-results',
  use: {
    baseURL,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: {
    command:
      'env VITE_AUTH_BYPASS=true VITE_MOCK_PREVIEW=true /Users/logan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ../node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5185',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    cwd: './frontend',
  },
});
