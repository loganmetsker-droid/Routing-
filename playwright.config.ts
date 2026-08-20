import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5185';
const nodeCommand =
  process.env.PLAYWRIGHT_NODE ||
  '/Users/logan/Desktop/Local LLM/.local/node-v24.15.0-darwin-arm64/bin/node';
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === 'true';
const browserChannel = process.env.PLAYWRIGHT_CHANNEL?.trim();

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  outputDir:
    process.env.PLAYWRIGHT_OUTPUT_DIR || '.tmp/playwright/test-results',
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
        ...(browserChannel ? { channel: browserChannel } : {}),
      },
    },
  ],
  webServer: skipWebServer
    ? undefined
    : {
        command: `"${nodeCommand}" scripts/playwright-preview-server.mjs`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
