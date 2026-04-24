import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { test } from '@playwright/test';

const screenshotRoot = path.join(process.cwd(), '.artifacts', 'ui-audit', 'playwright');

const routes = [
  { slug: 'dashboard', path: '/dashboard' },
  { slug: 'jobs', path: '/jobs' },
  { slug: 'routing', path: '/routing' },
  { slug: 'dispatch', path: '/dispatch' },
  { slug: 'exceptions', path: '/exceptions' },
  { slug: 'tracking', path: '/tracking' },
  { slug: 'drivers', path: '/drivers' },
  { slug: 'vehicles', path: '/vehicles' },
  { slug: 'customers', path: '/customers' },
  { slug: 'analytics', path: '/analytics' },
  { slug: 'settings', path: '/settings' },
  { slug: 'driver', path: '/driver' },
  { slug: 'public-tracking', path: '/track/demo-token' },
];

const viewports = [
  { slug: 'laptop', width: 1440, height: 960 },
  { slug: 'widescreen', width: 1728, height: 1117 },
];

test('captures UI audit screenshots for all primary routes', async ({ page }) => {
  mkdirSync(screenshotRoot, { recursive: true });

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (const route of routes) {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await page.locator('#root').waitFor({ state: 'visible' });
      await page.waitForTimeout(1200);
      await page.screenshot({
        path: path.join(screenshotRoot, `${route.slug}-${viewport.slug}.png`),
        fullPage: false,
      });
    }
  }
});
