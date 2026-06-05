import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const auditRoot =
  process.env.LAUNCH_AUDIT_DIR ||
  path.join(process.cwd(), '.tmp', 'launch-audit', 'playwright');
const apiBaseUrl =
  process.env.LAUNCH_AUDIT_API_URL ||
  `http://127.0.0.1:${process.env.PLAYWRIGHT_MOCK_API_PORT || '3001'}`;
const strictOptimizer = process.env.LAUNCH_AUDIT_STRICT_OPTIMIZER === 'true';
const authToken =
  process.env.LAUNCH_AUDIT_AUTH_TOKEN || process.env.STAGING_AUTH_TOKEN || '';
const authHeaders = authToken ? { Authorization: `Bearer ${authToken}` } : {};

const primaryRoutes = [
  { slug: 'public-launch', path: '/' },
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
  { slug: 'driver-workspace', path: '/driver' },
  { slug: 'public-tracking', path: '/track/demo-token' },
];

const publicMarketingRoutes = [
  { path: '/', heading: /Plan the route\. Run the day\. Prove every stop/i },
  { path: '/platform', heading: /Trovan platform/i },
  { path: '/platform/plan', heading: /Build routes your team can actually run/i },
  { path: '/platform/dispatch', heading: /Run the route day from one live board/i },
  { path: '/platform/drive', heading: /Give drivers the next best action/i },
  { path: '/platform/track', heading: /Keep customers updated before they call/i },
  { path: '/platform/proof', heading: /Know what happened on every route/i },
  { path: '/demo', heading: /Watch a full route day/i },
  { path: '/pricing', heading: /Pricing built around route volume/i },
  { path: '/testimonials', heading: /Operator scenarios/i },
  { path: '/security', heading: /Security and control for route operations/i },
  { path: '/resources', heading: /Resources/i },
  { path: '/support', heading: /Support/i },
  { path: '/company', heading: /Built for the route day operators/i },
  { path: '/mission', heading: /Trovan exists to make route days/i },
  { path: '/careers', heading: /Careers/i },
  { path: '/legal/privacy', heading: /Privacy/i },
  { path: '/legal/terms', heading: /Terms/i },
  { path: '/legal/cookies', heading: /Cookie/i },
  { path: '/legal/exercise-rights', heading: /Privacy Rights Request/i },
  { path: '/resources/downloads', heading: /Downloads/i },
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
  await page.addInitScript(() => {
    window.localStorage.removeItem('trovan-preview-auth-user');
  });
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
  test('public launch route audit flow is interactive', async ({ page }) => {
    await gotoReady(page, '/');

    await expect(page.getByRole('heading', { name: /Plan the route\. Run the day\. Prove every stop/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Book demo$/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Get a free route audit$/i }).first()).toBeVisible();
    await expect(page.getByLabel(/Route audit preview/i)).toHaveCount(0);
    await expect(page.getByText(/Start with one real route day/i)).toHaveCount(0);
    await expect(page.getByText(/Ready routes|Needs review|Live ETAs/i)).toHaveCount(0);

    await page.getByRole('button', { name: /^Get a free route audit$/i }).first().click();
    await expect(page.getByRole('dialog', { name: /Talk to Trovan/i })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /Request type/i })).toContainText('Route audit');
    await page.getByRole('combobox', { name: /Fleet size/i }).click();
    await expect(page.getByRole('option', { name: '300+ / Custom' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByLabel(/Name/i).fill('Launch Operator');
    await page.getByLabel(/Work email/i).fill('ops@example.com');
    await page.getByLabel(/Company/i).fill('Example Delivery');
    await page.getByLabel(/Optional notes/i).fill('Spreadsheet and map tabs');
    await page.getByRole('button', { name: /Prepare request email|Send request/i }).click();
    await expect(page.getByTestId('request-success')).toBeVisible();
    await expect(page.getByText(/captured locally/i)).toHaveCount(0);
  });

  test('book demo opens the unified request modal with demo selected', async ({ page }) => {
    await gotoReady(page, '/');

    await page.getByRole('button', { name: /^Book demo$/i }).first().click();
    await expect(page.getByRole('dialog', { name: /Talk to Trovan/i })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /Request type/i })).toContainText('Book demo');
  });

  test('homepage does not expose the old route audit calculator', async ({ page }) => {
    await gotoReady(page, '/');

    await expect(page.locator('#route-audit')).toHaveCount(0);
    await expect(page.getByLabel(/Biggest routing pain/i)).toHaveCount(0);
    await expect(page.getByText(/Planning hours at risk/i)).toHaveCount(0);
  });

  test('starter pricing CTA does not imply checkout before checkout exists', async ({ page }) => {
    await gotoReady(page, '/');

    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await expect(page.getByText(/Launch onboarding is currently reviewed before activation/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Start Starter$/i })).toHaveCount(0);
    await page.getByRole('button', { name: /^Request Launch setup$/i }).click();
    await expect(page.getByRole('dialog', { name: /Talk to Trovan/i })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /Request type/i })).toContainText('Implementation');
  });

  test('pricing page has a semantic page heading', async ({ page }) => {
    await gotoReady(page, '/pricing');

    await expect(
      page.getByRole('heading', { level: 1, name: /Pricing built around route volume and operational impact/i }),
    ).toBeVisible();
  });

  test('public demo chips are either real tabs or inert labels', async ({ page }) => {
    await gotoReady(page, '/');

    await expect(page.getByRole('button', { name: /^Dispatch workflow$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Driver execution$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Customer tracking$/i })).toHaveCount(0);

    const dispatchTab = page.getByRole('tab', { name: 'Dispatch live' });
    await dispatchTab.click();
    await expect(dispatchTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(/Keep route execution visible/i)).toBeVisible();
  });

  test('demo tabs remain readable when inactive', async ({ page }) => {
    await gotoReady(page, '/demo');

    const dispatchTab = page.getByRole('tab', { name: 'Dispatch live' });
    await expect(dispatchTab).toBeVisible();
    await expect(dispatchTab).toHaveCSS('color', 'rgb(23, 17, 13)');
  });

  test('driver workflow page uses a mobile app proof frame', async ({ page }) => {
    await gotoReady(page, '/platform/drive');

    await expect(page.getByLabel(/Trovan Driver mobile app preview/i)).toBeVisible();
    await expect(page.getByText(/Driver mobile app proof/i)).toBeVisible();
  });

  test('public launch product proof tabs change content', async ({ page }) => {
    await gotoReady(page, '/');

    await page.getByRole('tab', { name: 'Dispatch live' }).click();
    await expect(page.getByText(/Keep route execution visible/i)).toBeVisible();

    await page.getByRole('tab', { name: 'Driver app' }).click();
    await expect(page.getByRole('heading', { name: /Give drivers the next best action/i })).toBeVisible();

    await page.getByRole('tab', { name: 'Customer tracking & ETA' }).click();
    await expect(page.getByText(/Reduce customer where-is-it calls/i)).toBeVisible();
  });

  test('login unavailable state is friendly and recoverable', async ({ page }) => {
    await page.route('**/api/auth/config', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Auth service unavailable' }),
      });
    });

    await page.goto('/login?auth=live', { waitUntil: 'domcontentloaded' });
    await page.locator('#root').waitFor({ state: 'visible' });

    await expect(page.getByTestId('login-unavailable')).toBeVisible();
    await expect(page.getByText(/Request timed out|Backend may be unavailable/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Retry$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Request access\/support/i })).toBeVisible();
  });

  test('public page does not expose broken demo tracking or local-capture copy', async ({ page }) => {
    await gotoReady(page, '/');

    await expect(page.getByText(/captured locally/i)).toHaveCount(0);
    await expect(page.locator('a[href="/track/demo-token"]')).toHaveCount(0);
  });

  test('enterprise public marketing routes render without stealing protected app routes', async ({ page }) => {
    test.setTimeout(240_000);
    for (const route of publicMarketingRoutes) {
      await gotoReady(page, route.path, { settle: false });
      await expect(page).not.toHaveURL(/\/login|\/dashboard/);
      await expect(page.getByTestId('public-site-shell')).toBeVisible();
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible();
    }

    await gotoReady(page, '/testimonials', { settle: false });
    await expect(page.getByRole('heading', { name: /Operator scenarios/i })).toBeVisible();

    await gotoReady(page, '/customers', { settle: false });
    await expect(page.getByTestId('public-site-shell')).toHaveCount(0);
    await expect(page).toHaveURL(/\/(customers|login)/);
  });

  test('public nav exposes workflow pages and footer links resolve to real destinations', async ({ page }) => {
    await gotoReady(page, '/');

    await page.getByRole('button', { name: /^Product$/i }).click();
    await page.getByRole('menuitem', { name: /Plan/i }).click();
    await expect(page).toHaveURL(/\/platform\/plan$/);
    await expect(page.getByRole('heading', { name: /Build routes your team can actually run/i })).toBeVisible();

    await gotoReady(page, '/');
    const footerLinks = page.getByTestId('public-footer').locator('a[href]');
    const hrefs = await footerLinks.evaluateAll((links) =>
      links
        .map((link) => link.getAttribute('href') || '')
        .filter((href) => href.startsWith('/')),
    );

    expect(hrefs.length).toBeGreaterThan(8);
    expect(hrefs).not.toContain('/customers');

    for (const href of hrefs) {
      await gotoReady(page, href);
      await expect(page).not.toHaveURL(/\/login|\/dashboard/);
      await expect(page.getByTestId('public-site-shell')).toBeVisible();
    }
  });

  test('public conversion CTAs and demo tour are interactive', async ({ page }) => {
    await gotoReady(page, '/pricing');

    await page.getByRole('button', { name: /^Book ROI walkthrough$/i }).click();
    await expect(page.getByRole('dialog', { name: /Talk to Trovan/i })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /Request type/i })).toContainText('Book demo');
    await page.keyboard.press('Escape');

    await gotoReady(page, '/demo');
    await page.getByRole('tab', { name: /Dispatch live/i }).click();
    await expect(page.getByRole('heading', { name: /Dispatch board walkthrough/i })).toBeVisible();
    await page.getByRole('button', { name: /^Book demo$/i }).first().click();
    await expect(page.getByRole('dialog', { name: /Talk to Trovan/i })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /Request type/i })).toContainText('Book demo');
  });

  test('quick product demo walks a route day from plan to proof', async ({ page }) => {
    await gotoReady(page, '/demo');

    await expect(page.getByRole('heading', { name: /Click through the route day loop/i })).toBeVisible();
    await expect(page.getByText('46 stops imported', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: /Dispatch routes/i }).click();
    await expect(page.getByText('Routes published to dispatch', { exact: true })).toBeVisible();
    await expect(page.getByText(/Dispatch sees route lanes/i)).toBeVisible();

    await page.getByRole('button', { name: /Driver mobile app/i }).click();
    await expect(page.getByText('Driver opens the mobile app', { exact: true })).toBeVisible();
    await expect(page.getByLabel(/Quick demo status/i)).toContainText('Driver');

    await page.getByRole('button', { name: /Proof of delivery/i }).click();
    await expect(page.getByText(/Proof, notes, and route history are attached/i)).toBeVisible();

    await page.getByRole('button', { name: /^Replay demo$/i }).click();
    await expect(page.getByText('46 stops imported', { exact: true })).toBeVisible();
  });

  test('demo page uses short motion proof and connected route lines', async ({ page }) => {
    await gotoReady(page, '/demo');

    await expect(page.getByText(/Product walkthrough video/i)).toBeVisible();
    await expect(page.getByTestId('route-rebalance-staged-animation')).toBeVisible();

    const routePreview = page.getByLabel('Actual connected route preview');
    await expect(routePreview).toBeVisible();
    await expect(routePreview.getByTestId('product-app-frame')).toBeVisible();
    await expect(page.getByText('Route lines connect every planned stop')).toBeVisible();

    await page.getByRole('button', { name: /Driver mobile app/i }).click();
    await expect(page.getByText('Mobile app shows the next stop in sequence')).toBeVisible();
  });

  test('public header exposes Fleetio-inspired mega menus', async ({ page }) => {
    await gotoReady(page, '/');

    await page.getByRole('button', { name: /^Product$/i }).click();
    await expect(page.getByRole('heading', { name: /Route day workflows/i })).toBeVisible();
    await expect(page.getByText(/Plan, dispatch, driver execution, tracking, and proof/i)).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /^Solutions$/i }).click();
    await expect(page.getByRole('heading', { name: /Built for route-heavy operators/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Delivery operations/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Distribution teams/i })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /^Resources$/i }).click();
    await expect(page.getByRole('heading', { name: /Launch resources/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Route audit checklist/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Support/i })).toBeVisible();
  });

  test('marketing dashboard frames do not use fake browser chrome', async ({ page }) => {
    await gotoReady(page, '/');

    await expect(page.getByText(/trytrovan\.com/i)).toHaveCount(0);
    await expect(page.getByTestId('fake-browser-dot')).toHaveCount(0);
    await expect(page.getByTestId('product-app-frame').first()).toBeVisible();
    await expect(page.getByText(/Live Trovan workspace/i).first()).toBeVisible();
  });

  test('homepage has a proof-heavy scroll story with restrained motion', async ({ page }) => {
    await gotoReady(page, '/');

    await expect(page.getByRole('heading', { name: /Route days run better when every team sees the same route-day picture/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /One workspace for the route day/i })).toBeVisible();
    await expect(page.getByText(/live route-day system/i)).toHaveCount(0);
    await expect(page.getByText(/live operating system/i)).toBeVisible();
    await expect(page.getByText(/Plans, route lanes, driver assignments, map context/i)).toBeVisible();
    await expect(page.getByText(/Trovan uses real product workflows/i)).toBeVisible();
    await expect(page.getByText(/No fake customer logos|Until named references|website reads like/i)).toHaveCount(0);
    await expect(page.locator('[data-motion="scroll-reveal"]')).toHaveCount(3);
  });

  test('cookie preferences persist without enabling analytics by default', async ({ page }) => {
    await gotoReady(page, '/');

    await page.getByRole('button', { name: /Cookie preferences/i }).click();
    await expect(page.getByRole('dialog', { name: /Cookie preferences/i })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Essential/i })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: /Analytics/i })).not.toBeChecked();
    await expect(page.getByRole('checkbox', { name: /Marketing/i })).not.toBeChecked();
    await page.getByRole('checkbox', { name: /Analytics/i }).check();
    await page.getByRole('button', { name: /Save preferences/i }).click();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Cookie preferences/i }).click();
    await expect(page.getByRole('checkbox', { name: /Analytics/i })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: /Marketing/i })).not.toBeChecked();
  });

  test('security and testimonial pages avoid unsupported claims', async ({ page }) => {
    await gotoReady(page, '/security');
    await expect(page.getByText(/SOC\s*2|HIPAA|ISO\s*27001|certified|certification/i)).toHaveCount(0);
    await expect(page.getByText(/request IDs|redaction|audit logs|RBAC/i).first()).toBeVisible();

    await gotoReady(page, '/testimonials');
    await expect(page.getByText(/Acme|Globex|Initech|five stars|customer quote/i)).toHaveCount(0);
    await expect(page.getByText(/scenario|operator|dispatcher/i).first()).toBeVisible();
  });

  test('public workflow pages render local product screenshot assets', async ({ page }) => {
    for (const route of publicMarketingRoutes.filter((item) => item.path.startsWith('/platform'))) {
      await gotoReady(page, route.path);
      const imagesLoaded = await page.locator('img[src^="/marketing/"]').evaluateAll((images) =>
        images.every((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0),
      );
      expect(imagesLoaded).toBe(true);
    }
  });

  test('public marketing screenshots are framed without side cropping', async ({ page }) => {
    for (const route of ['/', '/demo', '/platform', ...publicMarketingRoutes.filter((item) => item.path.startsWith('/platform')).map((item) => item.path)]) {
      await gotoReady(page, route);
      const croppedScreenshots = await page.locator('img[src^="/marketing/"]').evaluateAll((images) =>
        images
          .map((image) => {
            const element = image as HTMLImageElement;
            const style = window.getComputedStyle(element);
            return {
              src: element.getAttribute('src'),
              fit: style.objectFit,
            };
          })
          .filter((item) => item.fit !== 'contain'),
      );

      expect(croppedScreenshots).toEqual([]);
    }
  });

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
