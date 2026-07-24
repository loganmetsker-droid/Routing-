import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

function readLocalEnv() {
  const envPath = path.join(process.cwd(), 'backend', '.env.local');
  if (!existsSync(envPath)) return {};
  return Object.fromEntries(
    readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const [key, ...rest] = line.split('=');
        return [key, rest.join('=').replace(/^['"]|['"]$/g, '')];
      }),
  ) as Record<string, string>;
}

async function useAuthenticatedSession(page: Page, baseURL?: string) {
  const env = readLocalEnv();
  const email = process.env.PLAYWRIGHT_AUTH_EMAIL || env.AUTH_ADMIN_EMAIL;
  const password = process.env.PLAYWRIGHT_AUTH_PASSWORD || env.AUTH_ADMIN_PASSWORD;

  if (baseURL && email && password) {
    const response = await page.request.post(new URL('/api/auth/login', baseURL).toString(), {
      data: { email, password },
    }).catch(() => null);
    if (response?.ok()) {
      const payload = await response.json();
      const token =
        payload?.data?.accessToken ||
        payload?.accessToken ||
        payload?.token;
      if (token) {
        await page.addInitScript((authToken) => {
          window.localStorage.setItem('authToken', authToken);
        }, token);
        return;
      }
    }
  }

  await page.addInitScript(() => {
    window.localStorage.setItem('authToken', 'preview-auth-bypass');
    window.localStorage.setItem('trovan-preview-auth-user', JSON.stringify({
      id: 'step3-ui-controls-user',
      email: 'dispatcher@trovan.local',
      role: 'dispatcher',
      roles: ['DISPATCHER'],
      organizationId: 'step3-ui-controls-org',
      sessionId: 'step3-ui-controls-session',
    }));
  });
}

async function gotoProtected(page: Page, targetPath: string, baseURL?: string) {
  await useAuthenticatedSession(page, baseURL);
  await page.goto(targetPath, { waitUntil: 'domcontentloaded' });
  await page.locator('#root').waitFor({ state: 'visible' });
  await expect(page.getByText(/Workspace Failed To Render/i)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /^Welcome back$/ })).toHaveCount(0);
}

test.describe('Step 3 migrated UI controls', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('tracking exposes map style and route scope controls', async ({ page }, testInfo) => {
    await gotoProtected(page, '/tracking', testInfo.project.use.baseURL);

    await expect(page.getByRole('button', { name: /^Satellite$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Streets$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^All Routes$/ })).toBeVisible();
  });

  test('POD, exceptions, reports, and vehicles expose expected utility controls', async ({ page }, testInfo) => {
    await gotoProtected(page, '/pod', testInfo.project.use.baseURL);
    await expect(page.getByRole('button', { name: /^Filters$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Export$/ })).toBeVisible();

    await gotoProtected(page, '/exceptions', testInfo.project.use.baseURL);
    await expect(page.getByRole('button', { name: /^New exception$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^All \d+$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Open \d+$/ })).toBeVisible();

    await gotoProtected(page, '/analytics', testInfo.project.use.baseURL);
    await expect(page.getByRole('button', { name: /^View$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Export$/ })).toBeVisible();

    await gotoProtected(page, '/vehicles', testInfo.project.use.baseURL);
    await expect(page.getByRole('button', { name: /^Filters$/ })).toBeVisible();
  });

  test('routing map modes expose an observable selected state', async ({ page }, testInfo) => {
    await gotoProtected(page, '/routing?scenario=dense-route-day', testInfo.project.use.baseURL);
    await expect(page.getByTestId('routing-workspace-page')).toBeVisible({ timeout: 20_000 });

    const expectedLabels = ['Selected route', 'All routes', 'Route density', 'Exceptions only'];
    for (const label of expectedLabels) {
      await page.getByRole('button', { name: label }).click();
      await expect(page.getByTestId('routing-map-mode-state')).toHaveText(`Map view: ${label}`);
    }
  });
});
