import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { expect, test, type Page, type Response } from '@playwright/test';

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
  { path: '/accessibility', heading: /Accessibility Statement/i },
  { path: '/resources', heading: /Resources/i },
  { path: '/support', heading: /Support/i },
  { path: '/company', heading: /Built for the route day operators/i },
  { path: '/mission', heading: /Trovan exists to make route days/i },
  { path: '/careers', heading: /Careers/i },
  { path: '/legal/privacy', heading: /Privacy/i },
  { path: '/legal/terms', heading: /Terms/i },
  { path: '/legal/cookies', heading: /Cookie/i },
  { path: '/legal/exercise-rights', heading: /Privacy Rights Request/i },
  {
    path: '/resources/downloads',
    heading: /Everything a customer needs to implement Trovan/i,
  },
];

const primaryRoutes = [
  { slug: 'public-launch', path: '/' },
  { slug: 'public-platform', path: '/platform' },
  { slug: 'public-plan', path: '/platform/plan' },
  { slug: 'public-dispatch', path: '/platform/dispatch' },
  { slug: 'public-drive', path: '/platform/drive' },
  { slug: 'public-track', path: '/platform/track' },
  { slug: 'public-proof', path: '/platform/proof' },
  { slug: 'public-demo', path: '/demo' },
  { slug: 'public-pricing', path: '/pricing' },
  { slug: 'public-testimonials', path: '/testimonials' },
  { slug: 'public-security', path: '/security' },
  { slug: 'public-accessibility', path: '/accessibility' },
  { slug: 'public-resources', path: '/resources' },
  { slug: 'public-support', path: '/support' },
  { slug: 'public-company', path: '/company' },
  { slug: 'public-mission', path: '/mission' },
  { slug: 'public-careers', path: '/careers' },
  { slug: 'public-privacy', path: '/legal/privacy' },
  { slug: 'public-terms', path: '/legal/terms' },
  { slug: 'public-cookies', path: '/legal/cookies' },
  { slug: 'public-rights', path: '/legal/exercise-rights' },
  { slug: 'public-downloads', path: '/resources/downloads' },
  { slug: 'login', path: '/login' },
  { slug: 'dashboard', path: '/dashboard' },
  { slug: 'jobs', path: '/jobs' },
  { slug: 'routing', path: '/routing' },
  { slug: 'dispatch', path: '/dispatch' },
  { slug: 'route-run-detail', path: '/route-runs/route-alpha-001' },
  { slug: 'exceptions', path: '/exceptions' },
  { slug: 'tracking', path: '/tracking' },
  { slug: 'drivers', path: '/drivers' },
  { slug: 'vehicles', path: '/vehicles' },
  { slug: 'customers', path: '/customers' },
  { slug: 'proof-of-delivery', path: '/pod' },
  { slug: 'analytics', path: '/analytics' },
  { slug: 'settings', path: '/settings' },
  { slug: 'academy', path: '/academy' },
  { slug: 'academy-start-here', path: '/academy/start-here' },
  { slug: 'driver-workspace', path: '/driver' },
  { slug: 'driver-help', path: '/driver/help' },
  { slug: 'driver-route-run', path: '/driver/route-runs/route-alpha-001' },
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

const destructiveControl = /\b(delete|revoke|rotate|logout|archive|remove|discard)\b/i;
const lifecycleControl =
  /\b(assign|reassign|save driver|dispatch|start|complete|cancel|fail|reschedule|proof|resolve|route exception|replay|publish|location)\b/i;

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

function controlAuditSummary(
  results: Record<string, Array<Record<string, unknown>>>,
  issues: AuditIssue[],
) {
  const controls = Object.values(results).flat();
  const failedClicks = controls.filter((item) => item.result === 'failed');
  const buttonControls = controls.filter((item) =>
    item.tag === 'button' || ['button', 'tab'].includes(String(item.role || '')),
  );
  const directlyProvenButtons = buttonControls.filter(
    (item) => item.result === 'clicked-and-proven',
  );
  const workflowProvenButtons = buttonControls.filter((item) =>
    ['covered by workflow-specific route tests', 'covered by dedicated map interaction proof'].includes(
      String(item.reason || ''),
    ),
  );
  const disabledButtons = buttonControls.filter((item) => item.disabled === true);
  const unaccountedEnabledButtons = buttonControls.filter(
    (item) =>
      item.disabled !== true &&
      item.result !== 'clicked-and-proven' &&
      !['covered by workflow-specific route tests', 'covered by dedicated map interaction proof'].includes(
        String(item.reason || ''),
      ),
  );
  const resultCounts = controls.reduce<Record<string, number>>((counts, item) => {
    const result = String(item.result || 'unknown');
    counts[result] = (counts[result] || 0) + 1;
    return counts;
  }, {});
  const skipReasons = controls
    .filter((item) => item.result === 'skipped')
    .reduce<Record<string, number>>((counts, item) => {
      const reason = String(item.reason || 'unspecified');
      counts[reason] = (counts[reason] || 0) + 1;
      return counts;
    }, {});

  return {
    failedClicks,
    unaccountedEnabledButtons,
    proof: {
      generatedAt: new Date().toISOString(),
      status:
        failedClicks.length || issues.length || unaccountedEnabledButtons.length
          ? 'failed'
          : 'passed',
      routes: Object.keys(results).length,
      controls: controls.length,
      buttons: {
        total: buttonControls.length,
        directlyProven: directlyProvenButtons.length,
        workflowProven: workflowProvenButtons.length,
        disabledAtInitialState: disabledButtons.length,
        unaccountedEnabled: unaccountedEnabledButtons.length,
      },
      resultCounts,
      skipReasons,
      workflowEvidence: [
        'e2e/launch-audit.spec.ts: primary navigation, forms, route rendering, optimization',
        'e2e/product-ui.spec.ts: lifecycle, dispatch, exception, and route-state actions',
        'e2e/launch-audit.spec.ts: every visible Leaflet zoom control and interactive marker',
        'e2e/live-persistence.spec.ts: account sign-out/sign-in and durable customer mutation',
      ],
    },
  };
}

async function collectInteractiveInventory(page: Page) {
  return page.locator(interactiveSelector).evaluateAll((elements) =>
    elements
      .map((element, index) => {
        const htmlElement = element as HTMLElement;
        const box = htmlElement.getBoundingClientRect();
        const className =
          typeof htmlElement.className === 'string' ? htmlElement.className : '';
        const mapContainer = className.includes('leaflet-marker-icon')
          ? htmlElement.closest('.leaflet-container')
          : null;
        const mapBox = mapContainer?.getBoundingClientRect();
        const withinMapViewport =
          !mapBox ||
          (box.right > mapBox.left &&
            box.left < mapBox.right &&
            box.bottom > mapBox.top &&
            box.top < mapBox.bottom);
        const aria = htmlElement.getAttribute('aria-label') || '';
        const label =
          aria ||
          htmlElement.innerText ||
          htmlElement.getAttribute('title') ||
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
          className,
          testId: htmlElement.getAttribute('data-testid') || null,
          id: htmlElement.id || null,
          name: htmlElement.getAttribute('name') || null,
          ariaControls: htmlElement.getAttribute('aria-controls') || null,
          tag: element.tagName.toLowerCase(),
          role: htmlElement.getAttribute('role') || null,
          href: htmlElement.getAttribute('href') || null,
          type: htmlElement.getAttribute('type') || null,
          label: label.trim().replace(/\s+/g, ' ').slice(0, 180),
          disabled,
          selected:
            htmlElement.getAttribute('aria-pressed') === 'true' ||
            htmlElement.getAttribute('aria-selected') === 'true' ||
            htmlElement.getAttribute('aria-checked') === 'true' ||
            htmlElement.classList.contains('Mui-selected'),
          visible:
            box.width > 0 &&
            box.height > 0 &&
            withinMapViewport &&
            getComputedStyle(htmlElement).visibility !== 'hidden' &&
            getComputedStyle(htmlElement).display !== 'none',
        };
      })
      .filter((item) => item.visible),
  );
}

async function collectStableInteractiveInventory(page: Page) {
  let previousSignature = '';
  let inventory = await collectInteractiveInventory(page);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const signature = JSON.stringify(
      inventory.map((item) => [
        item.tag,
        item.role,
        item.href,
        item.type,
        item.testId,
        item.id,
        item.name,
        item.ariaControls,
        item.label,
        item.disabled,
        item.selected,
      ]),
    );
    if (signature === previousSignature) return inventory;
    previousSignature = signature;
    await page.waitForTimeout(120);
    inventory = await collectInteractiveInventory(page);
  }

  return inventory;
}

async function installStorageBaseline(page: Page) {
  const baseline = await page.evaluate(() => ({
    local: Object.fromEntries(
      Array.from({ length: window.localStorage.length }, (_, index) => {
        const key = window.localStorage.key(index) || '';
        return [key, window.localStorage.getItem(key) || ''];
      }),
    ),
    session: Object.fromEntries(
      Array.from({ length: window.sessionStorage.length }, (_, index) => {
        const key = window.sessionStorage.key(index) || '';
        return [key, window.sessionStorage.getItem(key) || ''];
      }),
    ),
  }));

  await page.addInitScript((storage) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    for (const [key, value] of Object.entries(storage.local)) {
      window.localStorage.setItem(key, value);
    }
    for (const [key, value] of Object.entries(storage.session)) {
      window.sessionStorage.setItem(key, value);
    }
  }, baseline);
}

async function collectOutcomeSignals(page: Page) {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      const htmlElement = element as HTMLElement;
      const box = htmlElement.getBoundingClientRect();
      const style = getComputedStyle(htmlElement);
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const compactText = (element: Element) =>
      ((element as HTMLElement).innerText || element.textContent || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 240);
    const text = (document.querySelector('#root') as HTMLElement | null)?.innerText || '';
    let textHash = 0;
    for (let index = 0; index < text.length; index += 1) {
      textHash = (textHash * 31 + text.charCodeAt(index)) >>> 0;
    }
    const selected = Array.from(
      document.querySelectorAll('[aria-pressed="true"], [aria-selected="true"], [aria-checked="true"]'),
    )
      .filter(visible)
      .map(compactText)
      .slice(0, 30);
    const expanded = Array.from(document.querySelectorAll('[aria-expanded="true"]'))
      .filter(visible)
      .map(compactText)
      .slice(0, 30);
    const overlays = Array.from(
      document.querySelectorAll('[role="dialog"], [role="menu"], [role="alert"], [role="status"], .MuiPopover-root, .MuiSnackbar-root, .leaflet-popup'),
    )
      .filter(visible)
      .map(compactText)
      .slice(0, 30);
    const values = Array.from(document.querySelectorAll('input, select, textarea'))
      .filter(visible)
      .map((element) => {
        const input = element as HTMLInputElement;
        return `${input.getAttribute('aria-label') || input.getAttribute('name') || input.id}:${input.value}:${input.checked}`;
      })
      .slice(0, 40);
    const mapState = Array.from(document.querySelectorAll('.leaflet-map-pane, .leaflet-zoom-animated'))
      .map((element) => `${element.getAttribute('class')}:${element.getAttribute('style') || ''}`)
      .slice(0, 20);
    const storage = Object.keys(window.localStorage)
      .filter((key) => key.startsWith('trovan.'))
      .sort()
      .map((key) => `${key}:${window.localStorage.getItem(key)}`)
      .slice(0, 20);

    return {
      url: window.location.href,
      theme: document.documentElement.dataset.theme || '',
      textLength: text.length,
      textHash,
      selected,
      expanded,
      overlays,
      values,
      mapState,
      storage,
    };
  });
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
  if (routePath !== '/login') {
    await expect(page.getByText(/Preview mode is enabled/i)).toHaveCount(0);
  }
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
  const inventory = await collectStableInteractiveInventory(page);
  await installStorageBaseline(page);

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
    if (item.tag === 'a' && item.role !== 'button') {
      clicked.push({
        ...item,
        result: 'skipped',
        reason: 'navigation link covered by primary route render audit',
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
    if (String(item.className || '').includes('leaflet-')) {
      clicked.push({
        ...item,
        result: 'skipped',
        reason: 'covered by dedicated map interaction proof',
      });
      continue;
    }
    const isLeafletControl = String(item.className || '').includes('leaflet-');
    const isLeafletMarker = String(item.className || '').includes('leaflet-marker-icon');
    await gotoReady(page, routePath, { settle: false });
    if (isLeafletControl) {
      await page.waitForTimeout(1_200);
    }
    const refreshedInventory = await collectStableInteractiveInventory(page);
    const sameControl = (candidate: (typeof refreshedInventory)[number]) =>
      candidate.tag === item.tag &&
      candidate.role === item.role &&
      candidate.type === item.type &&
      candidate.href === item.href &&
      candidate.testId === item.testId &&
      candidate.id === item.id &&
      candidate.name === item.name &&
      candidate.ariaControls === item.ariaControls &&
      candidate.label === item.label;
    const originalOccurrence = inventory
      .slice(0, inventory.indexOf(item))
      .filter(sameControl).length;
    let refreshedItem = refreshedInventory
      .filter(sameControl)
      .at(originalOccurrence);
    let matchedBy = 'exact-control-identity';
    if (!refreshedItem && !item.testId && !item.id) {
      const sameControlKind = (candidate: (typeof refreshedInventory)[number]) =>
        candidate.tag === item.tag &&
        candidate.role === item.role &&
        candidate.type === item.type &&
        candidate.href === item.href &&
        candidate.name === item.name &&
        candidate.ariaControls === item.ariaControls &&
        candidate.className === item.className;
      const kindOccurrence = inventory
        .slice(0, inventory.indexOf(item))
        .filter(sameControlKind).length;
      const equivalentControls = refreshedInventory.filter(sameControlKind);
      refreshedItem = equivalentControls.at(
        Math.min(kindOccurrence, Math.max(equivalentControls.length - 1, 0)),
      );
      matchedBy = 'equivalent-dynamic-control';
    }
    const controls = page.locator(interactiveSelector);
    if (!refreshedItem || (await controls.count()) <= refreshedItem.index) {
      clicked.push({
        ...item,
        result: 'failed',
        reason: 'control was not present after deterministic route reload',
      });
      continue;
    }
    const target = controls.nth(refreshedItem.index);
    const apiResponses: Array<{ status: number; url: string }> = [];
    const responseListener = (response: Response) => {
      if (response.url().includes('/api/')) {
        apiResponses.push({ status: response.status(), url: response.url() });
      }
    };
    try {
      const before = await collectOutcomeSignals(page);
      page.on('response', responseListener);
      let downloadProof: { suggestedFilename: string } | null = null;
      let interaction = 'pointer-click';
      if (/^Export$/i.test(label)) {
        const [download] = await Promise.all([
          page.waitForEvent('download'),
          target.click({ timeout: 5_000, noWaitAfter: true }),
        ]);
        downloadProof = { suggestedFilename: download.suggestedFilename() };
      } else {
        if (isLeafletControl) {
          await target.click({ timeout: 5_000, force: isLeafletMarker, noWaitAfter: true });
          interaction = isLeafletMarker
            ? 'forced-pointer-click-for-animated-map-marker'
            : 'pointer-click-for-map-control';
        } else {
          await target.click({ timeout: 5_000, noWaitAfter: true });
        }
      }
      await page.waitForTimeout(isLeafletControl ? 1_000 : 180);
      page.off('response', responseListener);
      const after = await collectOutcomeSignals(page);
      await page.keyboard.press('Escape').catch(() => {});
      const changed = JSON.stringify(before) !== JSON.stringify(after);
      const successfulApiResponse = apiResponses.some((response) => response.status >= 200 && response.status < 400);
      clicked.push({
        ...item,
        matchedBy,
        result: changed || successfulApiResponse || item.selected || downloadProof ? 'clicked-and-proven' : 'failed',
        reason:
          changed || successfulApiResponse || downloadProof
            ? 'observable UI, navigation, storage, map, or API outcome'
            : item.selected
              ? 'selected control remained selected after an idempotent click'
              : 'click produced no observable UI, navigation, storage, map, or API outcome',
        before,
        after,
        apiResponses,
        downloadProof,
        interaction,
      });
    } catch (error) {
      page.off('response', responseListener);
      clicked.push({
        ...item,
        result: 'failed',
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return clicked;
}

test.describe('launch UI audit', () => {
  // The all-controls audit below deliberately visits every primary route and
  // exercises hundreds of controls. It completes in about six minutes on a
  // local workstation but can exceed fifteen minutes on a throttled hosted
  // runner, so keep a bounded 30-minute ceiling without weakening coverage.
  test.describe.configure({ timeout: 1_800_000 });
  test('public launch route audit flow is interactive', async ({ page }) => {
    await gotoReady(page, '/');

    await expect(page.getByRole('heading', { name: /Plan the route\. Run the day\. Prove every stop/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Book demo$/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /^Watch a Demo$/i }).first()).toBeVisible();
    await expect(page.getByLabel(/Route audit preview/i)).toHaveCount(0);
    await expect(page.getByText(/Start with one real route day/i)).toHaveCount(0);
    await expect(page.getByText(/Ready routes|Needs review|Live ETAs/i)).toHaveCount(0);

    await page.getByRole('button', { name: /^Book demo$/i }).first().click();
    await expect(page.getByRole('dialog', { name: /Talk to Trovan/i })).toBeVisible();
    const requestType = page.getByRole('combobox', { name: /Request type/i });
    await expect(requestType).toContainText('Book demo');
    await requestType.click();
    await page.getByRole('option', { name: 'Route audit' }).click();
    await expect(requestType).toContainText('Route audit');
    await page.getByRole('combobox', { name: /Fleet size/i }).click();
    await expect(page.getByRole('option', { name: '300+ / Custom' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByLabel(/Name/i).fill('Launch Operator');
    await page.getByLabel(/Work email/i).fill('ops@example.com');
    await page.getByLabel(/Company/i).fill('Example Delivery');
    await page.getByLabel(/Optional notes/i).fill('Spreadsheet and map tabs');
    await page.getByRole('button', { name: /^Send request$/i }).click();
    await expect(page.getByTestId('request-success')).toBeVisible();
    await expect(page.getByText(/captured locally/i)).toHaveCount(0);
  });

  test('book demo opens the unified request modal with demo selected', async ({ page }) => {
    await gotoReady(page, '/');

    await page.getByRole('button', { name: /^Book demo$/i }).first().click();
    await expect(page.getByRole('dialog', { name: /Talk to Trovan/i })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /Request type/i })).toContainText('Book demo');
  });

  test('lead intake failure preserves the request and offers an explicit email fallback', async ({ page }) => {
    await page.route('**/api/marketing-leads', (route) => route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Lead intake temporarily unavailable' }),
    }));
    await gotoReady(page, '/pricing');

    await page.getByRole('button', { name: /^Book ROI walkthrough$/i }).click();
    await page.getByLabel(/Name/i).fill('Fallback Operator');
    await page.getByLabel(/Work email/i).fill('fallback@example.com');
    await page.getByLabel(/Company/i).fill('Fallback Logistics');
    await page.getByRole('button', { name: /^Send request$/i }).click();

    await expect(page.getByRole('alert').filter({ hasText: /could not send the request automatically/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Email instead/i })).toHaveAttribute(
      'href',
      /^mailto:sales@trytrovan\.com/,
    );
    await expect(page.getByLabel(/Work email/i)).toHaveValue('fallback@example.com');
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
    await expect(page.getByText(/For local delivery teams proving route discipline/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Request Launch setup$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Start Starter$/i })).toHaveCount(0);
    await page.getByRole('button', { name: /^Request Launch setup$/i }).click();
    await expect(page.getByRole('dialog', { name: /Talk to Trovan/i })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /Request type/i })).toContainText(
      'Implementation planning',
    );
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

  test('demo page uses the current product recording and connected route lines', async ({ page }) => {
    await gotoReady(page, '/demo');

    await expect(page.getByText(/Product walkthrough video/i)).toBeVisible();
    const productTour = page.getByLabel(/Trovan full route day product walkthrough video/i);
    await expect(productTour).toBeVisible();
    await expect(productTour.locator('source')).toHaveAttribute('src', '/marketing/trovan-product-tour.mp4');
    await expect(productTour).toHaveAttribute('poster', '/marketing/trovan-product-tour-poster.webp');
    await expect(productTour.locator('track[kind="captions"]')).toHaveAttribute(
      'src',
      '/marketing/trovan-product-tour.vtt',
    );

    await productTour.evaluate(async (video) => {
      const media = video as HTMLVideoElement;
      if (media.readyState < HTMLMediaElement.HAVE_METADATA) {
        await new Promise<void>((resolve, reject) => {
          media.addEventListener('loadedmetadata', () => resolve(), { once: true });
          media.addEventListener('error', () => reject(media.error), { once: true });
          media.load();
        });
      }
    });
    const mediaProof = await productTour.evaluate((video) => {
      const media = video as HTMLVideoElement;
      return {
        duration: media.duration,
        width: media.videoWidth,
        height: media.videoHeight,
      };
    });
    expect(mediaProof.duration).toBeGreaterThan(30);
    expect(mediaProof.duration).toBeLessThan(60);
    expect(mediaProof.width).toBe(1280);
    expect(mediaProof.height).toBe(800);

    const routePreview = page.getByLabel('Actual connected route preview');
    await expect(routePreview).toBeVisible();
    await expect(routePreview.getByTestId('product-app-frame')).toBeVisible();
    await expect(page.getByText('Route lines connect every planned stop')).toBeVisible();

    await page.getByRole('button', { name: /Driver mobile app/i }).click();
    await expect(page.getByText('Mobile app shows the next stop in sequence')).toBeVisible();
  });

  test('public header exposes Fleetio-inspired mega menus', async ({ page }) => {
    await gotoReady(page, '/');

    const headerLogo = page
      .getByRole('banner')
      .getByRole('link', { name: 'Trovan home' })
      .locator('img');
    await expect(headerLogo).toHaveAttribute(
      'src',
      '/brand/assets/trovan-primary-lockup-crop.png',
    );
    await expect(page.getByTestId('public-footer').locator('img').first()).toHaveAttribute(
      'src',
      '/brand/assets/trovan-primary-lockup-crop.png',
    );
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
      'href',
      '/brand/assets/trovan-standalone-icon-crop.png',
    );

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
    await expect(page.getByText(/Trovan sells one operating promise/i)).toBeVisible();
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

  test('homepage uses distinct current product captures instead of legacy mockups', async ({ page }) => {
    await gotoReady(page, '/');

    const productImages = page.locator('img[src^="/marketing/product-"]');
    const sources = await productImages.evaluateAll((images) =>
      images.map((image) => image.getAttribute('src')).filter((source): source is string => Boolean(source)),
    );
    expect(new Set(sources).size).toBeGreaterThanOrEqual(4);
    expect(sources).toContain('/marketing/product-routing.png');
    expect(sources).toContain('/marketing/product-dashboard.png');
    expect(sources.some((source) => /hero-route|routing-workspace|dispatch-board/.test(source))).toBe(false);

    for (let index = 0; index < await productImages.count(); index += 1) {
      await productImages.nth(index).scrollIntoViewIfNeeded();
    }
    await expect.poll(() =>
      productImages.evaluateAll((images) =>
        images.every((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0),
      ),
    ).toBe(true);

    await expect.poll(() =>
      productImages.first().evaluate((image) => (image as HTMLImageElement).currentSrc),
    ).toMatch(/\/marketing\/product-routing-(640|768)\.webp$/);
  });

  test('public metadata, crawler controls, and social preview are launch-ready', async ({ page }) => {
    await gotoReady(page, '/demo');

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://trytrovan.com/demo');
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /TryTrovan Demo/i);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      'https://trytrovan.com/marketing/product-routing.webp',
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');

    const robots = await page.request.get('/robots.txt');
    expect(robots.ok()).toBe(true);
    expect(await robots.text()).toContain('Sitemap: https://trytrovan.com/sitemap.xml');

    const sitemap = await page.request.get('/sitemap.xml');
    expect(sitemap.ok()).toBe(true);
    const sitemapBody = await sitemap.text();
    expect(sitemapBody).toContain('<loc>https://trytrovan.com/</loc>');
    expect(sitemapBody).toContain('<loc>https://trytrovan.com/demo</loc>');
    expect(sitemapBody).toContain('<loc>https://trytrovan.com/accessibility</loc>');
    expect(sitemapBody).not.toContain('/dashboard');

    const securityPolicy = await page.request.get('/.well-known/security.txt');
    expect(securityPolicy.ok()).toBe(true);
    expect(securityPolicy.headers()['content-type']).toContain('text/plain');
    expect(await securityPolicy.text()).toContain(
      'Canonical: https://trytrovan.com/.well-known/security.txt',
    );
  });

  test('homepage defers the full product-tour download until the recording approaches the viewport', async ({ page }) => {
    const productTourRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().endsWith('/marketing/trovan-product-tour.mp4')) {
        productTourRequests.push(request.url());
      }
    });

    await gotoReady(page, '/', { settle: false });
    await page.waitForTimeout(700);
    expect(productTourRequests).toHaveLength(0);

    const recording = page.getByLabel(/Trovan product tour recording from dashboard through customer tracking/i);
    await recording.scrollIntoViewIfNeeded();
    await expect.poll(() => productTourRequests.length).toBeGreaterThan(0);
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

  test('activates every visible map control and marker with observable outcomes', async ({ page }) => {
    test.setTimeout(420_000);
    const mapRoutes = primaryRoutes.filter((route) =>
      ['dashboard', 'routing', 'dispatch', 'exceptions', 'tracking', 'customers', 'proof-of-delivery'].includes(route.slug),
    );
    const checks: Array<Record<string, unknown>> = [];

    for (const route of mapRoutes) {
      await gotoReady(page, route.path, { settle: false });
      await page.waitForTimeout(1_200);
      const targets = await page
        .locator('.leaflet-control-zoom-in, .leaflet-control-zoom-out, .leaflet-marker-icon[role="button"]')
        .evaluateAll((elements) =>
          elements
            .filter((element) => {
              const className = element.getAttribute('class') || '';
              if (!className.includes('leaflet-marker-icon')) return true;
              const box = element.getBoundingClientRect();
              const mapBox = element.closest('.leaflet-container')?.getBoundingClientRect();
              return Boolean(
                mapBox &&
                  box.right > mapBox.left &&
                  box.left < mapBox.right &&
                  box.bottom > mapBox.top &&
                  box.top < mapBox.bottom,
              );
            })
            .map((element) => ({
              title: element.getAttribute('title') || element.getAttribute('aria-label') || element.textContent?.trim() || '',
              className: element.getAttribute('class') || '',
              html: element.outerHTML,
            })),
        );

      for (const mapTarget of targets) {
        expect(
          mapTarget.title,
          `${route.slug}: every interactive map target must have an accessible name: ${mapTarget.html}`,
        ).not.toBe('');
        const target = page.getByTitle(mapTarget.title, { exact: true }).first();
        await expect(target).toBeVisible();
        const before = await collectOutcomeSignals(page);
        const marker = mapTarget.className.includes('leaflet-marker-icon');
        if (marker) {
          await target.press('Enter');
        } else {
          await target.click();
        }
        await page.waitForTimeout(marker ? 400 : 650);
        const after = await collectOutcomeSignals(page);
        expect(JSON.stringify(after), `${route.slug}: ${mapTarget.title}`).not.toBe(JSON.stringify(before));
        checks.push({
          route: route.slug,
          control: mapTarget.title,
          kind: marker ? 'marker' : 'zoom',
          interaction: marker ? 'keyboard-activation-for-map-marker' : 'pointer-click',
          status: 'passed',
        });
      }
    }

    const proofRoot = path.join(process.cwd(), '.codex', 'launch-audit');
    mkdirSync(proofRoot, { recursive: true });
    writeFileSync(
      path.join(proofRoot, 'map-control-proof.json'),
      `${JSON.stringify({ generatedAt: new Date().toISOString(), status: 'passed', checks }, null, 2)}\n`,
      'utf8',
    );
  });

  test.describe('visible control coverage by route', () => {
    for (const [routeIndex, route] of primaryRoutes.entries()) {
      test(`accounts for visible controls on ${route.slug}`, async ({ page }) => {
        test.setTimeout(300_000);
        const routeEvidenceRoot = path.join(auditRoot, 'control-routes');
        if (routeIndex === 0) {
          rmSync(routeEvidenceRoot, { recursive: true, force: true });
        }
        mkdirSync(routeEvidenceRoot, { recursive: true });

        const issues: AuditIssue[] = [];
        installFailureCollectors(page, issues, `control-clicks:${route.slug}`);
        await page.setViewportSize({ width: 1440, height: 960 });
        const controls = await clickAuditableControls(page, route.path);
        writeFileSync(
          path.join(routeEvidenceRoot, `${route.slug}.json`),
          `${JSON.stringify({ route, controls, issues }, null, 2)}\n`,
          'utf8',
        );

        const aggregateResults: Record<string, Array<Record<string, unknown>>> = {};
        const aggregateIssues: AuditIssue[] = [];
        for (const evidenceFile of readdirSync(routeEvidenceRoot).sort()) {
          const evidence = JSON.parse(
            readFileSync(path.join(routeEvidenceRoot, evidenceFile), 'utf8'),
          ) as {
            route: { slug: string };
            controls: Array<Record<string, unknown>>;
            issues: AuditIssue[];
          };
          aggregateResults[evidence.route.slug] = evidence.controls;
          aggregateIssues.push(...evidence.issues);
        }

        writeAuditJson('control-click-results.json', aggregateResults);
        writeAuditJson('control-click-issues.json', aggregateIssues);
        const aggregate = controlAuditSummary(aggregateResults, aggregateIssues);
        const proofRoot = path.join(process.cwd(), '.codex', 'launch-audit');
        mkdirSync(proofRoot, { recursive: true });
        writeFileSync(
          path.join(proofRoot, 'control-proof.json'),
          `${JSON.stringify(aggregate.proof, null, 2)}\n`,
          'utf8',
        );

        const routeSummary = controlAuditSummary({ [route.slug]: controls }, issues);
        expect(routeSummary.failedClicks).toEqual([]);
        expect(routeSummary.unaccountedEnabledButtons).toEqual([]);
        expect(issues).toEqual([]);
      });
    }
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
    await expect(page.locator('tbody').getByText(`Launch Driver ${unique}`)).toBeVisible();

    await gotoReady(page, '/vehicles');
    await page.getByRole('button', { name: /add vehicle/i }).click();
    await page.getByLabel(/^make$/i).fill('Launch');
    await page.getByLabel(/^model$/i).fill(`Van ${unique}`);
    await page.getByLabel(/license plate/i).fill(`LA-${unique}`.slice(0, 12));
    await page.getByLabel(/payload capacity \(lb\)/i).fill('2200');
    await page.getByLabel(/volume capacity \(cu ft\)/i).fill('180');
    await page.getByRole('button', { name: /save vehicle/i }).click();
    await expect(page.getByText(`Launch Van ${unique}`)).toBeVisible();

    await gotoReady(page, '/jobs');
    await page.getByRole('button', { name: /new job/i }).click();
    await page.getByLabel(/customer name/i).fill(`Launch Audit Customer ${unique}`);
    await page.getByLabel(/delivery address/i).fill('1040 River Market St, Kansas City, MO 64106');
    await page.getByRole('button', { name: /^create job$/i }).click();
    await expect(page.getByRole('alert')).toContainText(/Job added with routing constraints and readiness context/i);
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
