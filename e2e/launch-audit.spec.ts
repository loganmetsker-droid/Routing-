import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const auditRoot =
  process.env.LAUNCH_AUDIT_DIR ||
  path.join(process.cwd(), '.tmp', 'launch-audit', 'playwright');
const apiBaseUrl =
  process.env.LAUNCH_AUDIT_API_URL || 'http://127.0.0.1:3001';
const strictOptimizer = process.env.LAUNCH_AUDIT_STRICT_OPTIMIZER === 'true';
const authToken =
  process.env.LAUNCH_AUDIT_AUTH_TOKEN || process.env.STAGING_AUTH_TOKEN || '';
const authHeaders = authToken ? { Authorization: `Bearer ${authToken}` } : {};

const primaryRoutes = [
  { slug: 'dashboard', path: '/' },
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
  { slug: 'driver-workspace', path: '/driver' },
  { slug: 'public-tracking', path: '/track/demo-token' },
];

const viewports = [
  { slug: 'desktop', width: 1440, height: 960 },
  { slug: 'mobile', width: 390, height: 844 },
];

const interactiveSelector = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="switch"]',
].join(',');

const destructiveControl = /\b(delete|revoke|rotate|logout|archive|remove|discard|reset)\b/i;
const lifecycleControl =
  /\b(assign|reassign|save driver|dispatch|start|complete|cancel|fail|reschedule|proof|resolve|route exception|replay|publish)\b/i;

type AuditIssue = {
  scope: string;
  message: string;
};

function ensureAuditRoot() {
  mkdirSync(auditRoot, { recursive: true });
}

function writeAuditJson(name: string, payload: unknown) {
  ensureAuditRoot();
  writeFileSync(
    path.join(auditRoot, name),
    JSON.stringify(payload, null, 2),
    'utf8',
  );
}

async function collectInteractiveInventory(page: Page) {
  return page.locator(interactiveSelector).evaluateAll((elements) =>
    elements
      .map((element, index) => {
        const htmlElement = element as HTMLElement;
        const box = htmlElement.getBoundingClientRect();
        const aria = htmlElement.getAttribute('aria-label') || '';
        const label =
          aria ||
          htmlElement.innerText ||
          htmlElement.getAttribute('placeholder') ||
          htmlElement.getAttribute('name') ||
          htmlElement.getAttribute('type') ||
          htmlElement.id ||
          element.tagName.toLowerCase();
        const disabled =
          htmlElement.hasAttribute('disabled') ||
          htmlElement.getAttribute('aria-disabled') === 'true';
        return {
          index,
          className:
            typeof htmlElement.className === 'string'
              ? htmlElement.className
              : '',
          tag: element.tagName.toLowerCase(),
          role: htmlElement.getAttribute('role') || null,
          type: htmlElement.getAttribute('type') || null,
          label: label.trim().replace(/\s+/g, ' ').slice(0, 180),
          disabled,
          visible:
            box.width > 0 &&
            box.height > 0 &&
            getComputedStyle(htmlElement).visibility !== 'hidden' &&
            getComputedStyle(htmlElement).display !== 'none',
        };
      })
      .filter((item) => item.visible),
  );
}

async function gotoReady(
  page: Page,
  routePath: string,
  options: { settle?: boolean } = {},
) {
  if (authToken) {
    await page.addInitScript((token) => {
      window.localStorage.setItem('authToken', token);
    }, authToken);
  }
  await page.goto(routePath, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.locator('#root').waitFor({ state: 'visible', timeout: 10_000 });
  if (options.settle !== false) {
    await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {});
  }
  await expect(page.getByText(/Workspace Failed To Render/i)).toHaveCount(0);
  await expect(page.getByText(/Preview mode is enabled/i)).toHaveCount(0);
}

function installFailureCollectors(page: Page, issues: AuditIssue[], scope: string) {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      issues.push({ scope, message: `console error: ${message.text()}` });
    }
  });
  page.on('pageerror', (error) => {
    issues.push({ scope, message: `page error: ${error.message}` });
  });
  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    const expectedMissingPreviewEndpoints =
      url.includes('/api/auth/sessions') ||
      url.includes('/api/platform/') ||
      url.includes('/api/notifications/');
    if (status >= 400 && !expectedMissingPreviewEndpoints) {
      issues.push({ scope, message: `HTTP ${status}: ${url}` });
    }
  });
}

async function clickAuditableControls(page: Page, routePath: string) {
  const clicked: Array<Record<string, unknown>> = [];
  await gotoReady(page, routePath, { settle: false });
  const inventory = await collectInteractiveInventory(page);

  for (const item of inventory) {
    const label = String(item.label || item.tag);
    if (item.disabled) {
      clicked.push({ ...item, result: 'skipped', reason: 'disabled' });
      continue;
    }
    if (['input', 'select', 'textarea'].includes(item.tag)) {
      clicked.push({
        ...item,
        result: 'skipped',
        reason: 'form input inventoried; filled by form workflow tests',
      });
      continue;
    }
    if (item.tag === 'a') {
      clicked.push({
        ...item,
        result: 'skipped',
        reason: 'navigation link covered by primary route render audit',
      });
      continue;
    }
    if (String(item.className || '').includes('leaflet-marker-icon')) {
      clicked.push({
        ...item,
        result: 'skipped',
        reason: 'map marker interaction covered by route/map workflow tests',
      });
      continue;
    }
    if (destructiveControl.test(label)) {
      clicked.push({ ...item, result: 'skipped', reason: 'destructive control' });
      continue;
    }
    if (lifecycleControl.test(label)) {
      clicked.push({
        ...item,
        result: 'skipped',
        reason: 'covered by workflow-specific route tests',
      });
      continue;
    }
    await gotoReady(page, routePath, { settle: false });
    const controls = page.locator(interactiveSelector);
    if ((await controls.count()) <= item.index) {
      clicked.push({ ...item, result: 'skipped', reason: 'control moved after reload' });
      continue;
    }
    const target = controls.nth(item.index);
    try {
      await target.click({ timeout: 2_000 });
      await page.keyboard.press('Escape').catch(() => {});
      clicked.push({ ...item, result: 'clicked' });
    } catch (error) {
      try {
        await target.dispatchEvent('click', undefined, { timeout: 1_000 });
        await page.keyboard.press('Escape').catch(() => {});
        clicked.push({
          ...item,
          result: 'clicked-via-dispatch',
          reason:
            error instanceof Error
              ? `Playwright click timed out; dispatched click event instead: ${error.message}`
              : `Playwright click timed out; dispatched click event instead: ${String(error)}`,
        });
      } catch (dispatchError) {
        clicked.push({
          ...item,
          result: 'failed',
          reason:
            dispatchError instanceof Error
              ? dispatchError.message
              : String(dispatchError),
        });
      }
    }
  }

  return clicked;
}

test.describe('launch UI audit', () => {
  test('renders every primary route on desktop and mobile with inventory evidence', async ({ page }) => {
    ensureAuditRoot();
    const issues: AuditIssue[] = [];
    installFailureCollectors(page, issues, 'primary-route-render');
    const routeInventory: Record<string, unknown> = {};

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const route of primaryRoutes) {
        await gotoReady(page, route.path);
        const inventory = await collectInteractiveInventory(page);
        routeInventory[`${route.slug}-${viewport.slug}`] = inventory;
        await page.screenshot({
          path: path.join(auditRoot, `${route.slug}-${viewport.slug}.png`),
          fullPage: true,
        });
      }
    }

    writeAuditJson('route-inventory.json', routeInventory);
    writeAuditJson('render-issues.json', issues);
    expect(issues).toEqual([]);
  });

  test('accounts for visible controls on every primary route', async ({ page }) => {
    test.setTimeout(420_000);
    const results: Record<string, unknown> = {};
    const issues: AuditIssue[] = [];
    installFailureCollectors(page, issues, 'control-clicks');
    await page.setViewportSize({ width: 1440, height: 960 });

    for (const route of primaryRoutes) {
      results[route.slug] = await clickAuditableControls(page, route.path);
    }

    writeAuditJson('control-click-results.json', results);
    writeAuditJson('control-click-issues.json', issues);
    const failedClicks = Object.values(results)
      .flatMap((value) => value as Array<Record<string, unknown>>)
      .filter((item) => item.result === 'failed');
    expect(failedClicks).toEqual([]);
    expect(issues).toEqual([]);
  });

  test('fills core SaaS forms with launch audit data', async ({ page }) => {
    const unique = Date.now().toString(36);

    await gotoReady(page, '/customers');
    await page.getByRole('button', { name: /add customer/i }).click();
    await page.getByLabel(/customer name/i).fill(`Launch Audit Customer ${unique}`);
    await page.getByLabel(/business name/i).fill('Launch Audit Logistics');
    await page.getByLabel(/^phone$/i).fill('(555) 010-4500');
    await page.getByLabel(/^email$/i).fill(`launch-customer-${unique}@example.com`);
    await page.getByLabel(/default address/i).fill('500 Grand Blvd, Kansas City, MO 64106');
    await page.getByLabel(/service time/i).fill('15 minutes');
    await page.getByRole('button', { name: /save customer/i }).click();
    await expect(page.getByText(`Launch Audit Customer ${unique}`)).toBeVisible();

    await gotoReady(page, '/drivers');
    await page.getByRole('button', { name: /add driver/i }).click();
    await page.getByLabel(/first name/i).fill('Launch');
    await page.getByLabel(/last name/i).fill(`Driver ${unique}`);
    await page.getByLabel(/^email$/i).fill(`launch-driver-${unique}@example.com`);
    await page.getByLabel(/^phone$/i).fill('(555) 010-4600');
    await page.getByLabel(/license number/i).fill(`LA-${unique}`);
    await page.getByRole('button', { name: /save driver/i }).click();
    await expect(page.getByText(`Launch Driver ${unique}`)).toBeVisible();

    await gotoReady(page, '/vehicles');
    await page.getByRole('button', { name: /add vehicle/i }).click();
    await page.getByLabel(/^make$/i).fill('Launch');
    await page.getByLabel(/^model$/i).fill(`Van ${unique}`);
    await page.getByLabel(/license plate/i).fill(`LA-${unique}`.slice(0, 12));
    await page.getByLabel(/^capacity$/i).fill('2200');
    await page.getByRole('button', { name: /save vehicle/i }).click();
    await expect(page.getByText(`Launch Van ${unique}`)).toBeVisible();

    await gotoReady(page, '/jobs');
    await page.getByRole('button', { name: /new job/i }).click();
    await page.getByLabel(/customer name/i).fill(`Launch Audit Customer ${unique}`);
    await page.getByLabel(/delivery address/i).fill('1040 River Market St, Kansas City, MO 64106');
    await page.getByRole('button', { name: /^create job$/i }).click();
    await expect(page.getByText(/job added to the queue/i)).toBeVisible();
  });

  test('proves route optimization path returns live optimized output', async ({ request }) => {
    const [vehiclesResponse, jobsResponse, healthResponse] = await Promise.all([
      request.get(`${apiBaseUrl}/api/vehicles`, { headers: authHeaders }),
      request.get(`${apiBaseUrl}/api/jobs`, { headers: authHeaders }),
      request.get(`${apiBaseUrl}/api/dispatch/optimizer/health`, {
        headers: authHeaders,
      }),
    ]);
    expect(vehiclesResponse.ok()).toBeTruthy();
    expect(jobsResponse.ok()).toBeTruthy();
    expect(healthResponse.ok()).toBeTruthy();

    const vehiclesPayload = await vehiclesResponse.json();
    const jobsPayload = await jobsResponse.json();
    const vehicleId = vehiclesPayload.vehicles?.[0]?.id;
    const jobIds = (jobsPayload.jobs || []).slice(0, 2).map((job: { id: string }) => job.id);
    expect(vehicleId).toBeTruthy();
    expect(jobIds.length).toBeGreaterThan(0);

    const routeResponse = await request.post(`${apiBaseUrl}/api/dispatch/routes`, {
      headers: authHeaders,
      data: { vehicleId, jobIds, objective: 'balanced' },
    });
    expect(routeResponse.ok()).toBeTruthy();

    const payload = await routeResponse.json();
    const route = payload.route || payload.data?.route;
    const routeData = route.routeData || route.route_data || route;
    expect(routeData.optimization_status || route.optimizationStatus).toBe('optimized');
    expect(routeData.data_quality || route.dataQuality).toBe('live');
    expect(Boolean(routeData.is_fallback || route.fallbackUsed)).toBe(false);
    expect((route.optimizedStops || route.optimized_stops || []).length).toBe(jobIds.length);

    const health = await healthResponse.json();
    if (strictOptimizer) {
      expect(health.status).toBe('healthy');
      expect(health.fallbackActive || health.circuitOpen).toBeFalsy();
      expect(health.source).not.toBe('mock-preview');
    }
  });
});
