import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseUrl = (
  process.env.PRODUCT_UI_BASE_URL ||
  process.env.AUDIT_BASE_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  'http://127.0.0.1:5194'
).replace(/\/+$/, '');
const outDir = path.join(process.cwd(), 'audit');
const rawPath = path.join(outDir, 'product-ui-audit.json');
const mdPath = path.join(outDir, 'product-ui-audit.md');

const routes = [
  ['Dashboard', '/dashboard'],
  ['Dispatch', '/dispatch'],
  ['Routing', '/routing'],
  ['Jobs', '/jobs'],
  ['Customers', '/customers'],
  ['Drivers', '/drivers'],
  ['Vehicles', '/vehicles'],
  ['Tracking', '/tracking'],
  ['Proof of Delivery', '/pod'],
  ['Exceptions', '/exceptions'],
  ['Reports', '/analytics'],
  ['Settings', '/settings'],
  ['Driver Workspace', '/driver'],
  ['Public Tracking', '/track/demo-token'],
];

const unsafeButton = /\b(delete|remove|logout|archive|cancel jobs|dispatch all|dispatch route|start|complete|publish|accept risk|send|save changes|update assignment|revoke|rotate|retry|replay)\b/i;
const expectedTextByPath = {
  '/dashboard': [/Operations Dashboard/i, /Live Operations Map/i],
  '/dispatch': [/Dispatch Board/i, /Unassigned Jobs/i, /Active Routes/i],
  '/routing': [/Route Planning & Optimization/i, /Unassigned Jobs/i, /Route Summaries/i],
  '/jobs': [/Jobs/i, /New Job/i],
  '/customers': [/Customers/i],
  '/drivers': [/Drivers/i],
  '/vehicles': [/Vehicles/i],
  '/tracking': [/Live Tracking|Tracking/i],
  '/pod': [/Proof of Delivery/i],
  '/exceptions': [/Exceptions/i],
  '/analytics': [/Reports|Analytics/i],
  '/settings': [/Settings/i],
  '/driver': [/Driver|Route/i],
  '/track/demo-token': [/Tracking|Route/i],
};

function expectedTextFor(routePath, viewportName) {
  if (routePath === '/routing' && viewportName === 'mobile') {
    return [/Route Planning & Optimization/i];
  }
  return expectedTextByPath[routePath] || [];
}

const previewUser = {
  id: 'audit-preview-dispatcher',
  email: 'audit-dispatcher@trovan.local',
  role: 'dispatcher',
  roles: ['DISPATCHER', 'ADMIN'],
  authProvider: 'local-config',
  organizationId: 'preview-org',
  sessionId: 'preview-session',
};

function viewportOverflow() {
  const doc = document.documentElement;
  return {
    scrollWidth: doc.scrollWidth,
    clientWidth: doc.clientWidth,
    scrollHeight: doc.scrollHeight,
    clientHeight: doc.clientHeight,
    horizontalOverflow: doc.scrollWidth > doc.clientWidth + 2,
  };
}

async function setupPage(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const badResponses = [];
  const apiResponses = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', async (response) => {
    const url = response.url();
    const status = response.status();
    if (url.includes('/api/') || url.includes('/health')) {
      apiResponses.push({ status, url: url.replace(baseUrl, '') });
    }
    if (status >= 400 && !url.includes('/api/auth/sessions')) {
      badResponses.push({ status, url: url.replace(baseUrl, '') });
    }
  });
  await page.addInitScript((user) => {
    window.localStorage.setItem('authToken', 'preview-auth-bypass');
    window.localStorage.setItem('trovan-preview-auth-user', JSON.stringify(user));
  }, previewUser);
  return { context, page, consoleErrors, pageErrors, badResponses, apiResponses };
}

async function visibleButtons(page) {
  return page.locator('button, [role="button"]').evaluateAll((nodes) =>
    nodes
      .map((node, index) => {
        const el = node;
        const rect = el.getBoundingClientRect();
        const label =
          el.getAttribute('aria-label') ||
          el.innerText ||
          el.textContent ||
          el.getAttribute('title') ||
          '';
        return {
          index,
          label: label.trim().replace(/\s+/g, ' ').slice(0, 120),
          disabled:
            el.hasAttribute('disabled') ||
            el.getAttribute('aria-disabled') === 'true',
          visible:
            rect.width > 0 &&
            rect.height > 0 &&
            getComputedStyle(el).display !== 'none' &&
            getComputedStyle(el).visibility !== 'hidden',
        };
      })
      .filter((item) => item.visible),
  );
}

async function safeClickProbe(browser, routePath) {
  const setup = await setupPage(browser, { width: 1159, height: 863 });
  await setup.page.goto(`${baseUrl}${routePath}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await setup.page.locator('#root').waitFor({ timeout: 10000 });
  await setup.page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
  const buttons = await visibleButtons(setup.page);
  await setup.context.close();
  const results = [];
  for (const button of buttons.slice(0, 28)) {
    if (!button.label || button.disabled || unsafeButton.test(button.label) || /^\d+$/.test(button.label)) {
      results.push({
        label: button.label || '(icon/no label)',
        result: button.disabled ? 'disabled' : 'skipped',
        reason: button.disabled ? 'disabled' : 'unsafe, mutating, or map marker control',
      });
      continue;
    }
    const { context, page } = await setupPage(browser, { width: 1159, height: 863 });
    try {
      await page.goto(`${baseUrl}${routePath}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.locator('#root').waitFor({ timeout: 10000 });
      await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
      const beforeUrl = page.url();
      await page.locator('button, [role="button"]').nth(button.index).click({ timeout: 2500 });
      await page.keyboard.press('Escape').catch(() => {});
      results.push({
        label: button.label,
        result: 'clicked',
        navigated: page.url() !== beforeUrl,
      });
    } catch (error) {
      results.push({
        label: button.label,
        result: 'failed',
        reason: error instanceof Error ? error.message.split('\n')[0] : String(error),
      });
    } finally {
      await context.close();
    }
  }
  return results;
}

async function run() {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    routes: [],
    buttonProbes: {},
    api: {},
  };

  for (const [name, routePath] of routes) {
    for (const viewport of [
      { name: 'desktop', width: 1159, height: 863 },
      { name: 'mobile', width: 390, height: 844 },
    ]) {
      const { context, page, consoleErrors, pageErrors, badResponses, apiResponses } =
        await setupPage(browser, { width: viewport.width, height: viewport.height });
      const routeResult = {
        name,
        path: routePath,
        viewport: viewport.name,
        loaded: false,
        titleText: '',
        expectedTextMissing: [],
        leafletMaps: 0,
        imageMaps: 0,
        overflow: null,
        consoleErrors,
        pageErrors,
        badResponses,
        apiResponses,
        staleCopyHits: [],
        buttonCount: 0,
      };
      try {
        await page.goto(`${baseUrl}${routePath}`, {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        });
        await page.locator('#root').waitFor({ timeout: 10000 });
        await page.waitForLoadState('networkidle', { timeout: 7000 }).catch(() => {});
        const bodyText = await page.locator('body').innerText({ timeout: 5000 });
        routeResult.loaded = true;
        routeResult.titleText = bodyText.split('\n').slice(0, 6).join(' / ');
        routeResult.expectedTextMissing = expectedTextFor(routePath, viewport.name)
          .filter((regex) => !regex.test(bodyText))
          .map((regex) => regex.toString());
        routeResult.leafletMaps = await page.locator('.leaflet-container').count();
        routeResult.imageMaps = await page
          .locator('img[src*="map"], img[alt*="map" i]')
          .count();
        routeResult.overflow = await page.evaluate(viewportOverflow);
        routeResult.staleCopyHits = Array.from(
          new Set(
            bodyText.match(
              /\b(seed\/API|mock|fake|lorem|placeholder|TODO|not implemented|simulated|simulation mode)\b/gi,
            ) || [],
          ),
        );
        routeResult.buttonCount = (await visibleButtons(page)).length;
      } catch (error) {
        routeResult.error = error instanceof Error ? error.message : String(error);
      }
      results.routes.push(routeResult);
      await context.close();
    }
  }

  for (const routePath of ['/dashboard', '/dispatch', '/routing', '/jobs', '/settings']) {
    results.buttonProbes[routePath] = await safeClickProbe(browser, routePath);
  }

  const apiChecks = [
    '/api/auth/config',
    '/api/jobs',
    '/api/customers',
    '/api/drivers',
    '/api/vehicles',
    '/api/route-runs',
    '/api/tracking/readiness',
  ];
  for (const apiPath of apiChecks) {
    const response = await fetch(`${baseUrl}${apiPath}`, {
      headers: { Authorization: 'Bearer preview-auth-bypass' },
    }).catch((error) => ({ error }));
    if ('error' in response) {
      results.api[apiPath] = { error: String(response.error) };
    } else {
      const text = await response.text();
      results.api[apiPath] = {
        status: response.status,
        ok: response.ok,
        bodySample: text.slice(0, 300),
      };
    }
  }

  await browser.close();
  writeFileSync(rawPath, JSON.stringify(results, null, 2));
  const failedRoutes = results.routes.filter(
    (route) =>
      !route.loaded ||
      route.expectedTextMissing.length ||
      route.consoleErrors.length ||
      route.pageErrors.length ||
      route.badResponses.length ||
      route.overflow?.horizontalOverflow,
  );
  const failedClicks = Object.entries(results.buttonProbes).flatMap(([routePath, probes]) =>
    probes
      .filter((probe) => probe.result === 'failed')
      .map((probe) => ({ routePath, label: probe.label, reason: probe.reason })),
  );
  const markdown = [
    '# Product UI Audit',
    '',
    `Base URL: ${baseUrl}`,
    `Generated: ${results.generatedAt}`,
    '',
    `Route checks: ${results.routes.length}`,
    `Routes needing attention: ${failedRoutes.length}`,
    `Safe button probe failures: ${failedClicks.length}`,
    '',
    '## Routes Needing Attention',
    '',
    failedRoutes.length
      ? failedRoutes
          .map(
            (route) =>
              `- ${route.name} ${route.path} (${route.viewport}): ` +
              [
                route.loaded ? null : 'did not load',
                route.expectedTextMissing.length ? `missing ${route.expectedTextMissing.join(', ')}` : null,
                route.consoleErrors.length ? `${route.consoleErrors.length} console errors` : null,
                route.pageErrors.length ? `${route.pageErrors.length} page errors` : null,
                route.badResponses.length ? `${route.badResponses.length} bad responses` : null,
                route.overflow?.horizontalOverflow ? 'horizontal overflow' : null,
              ]
                .filter(Boolean)
                .join('; '),
          )
          .join('\n')
      : '- None',
    '',
    '## Safe Button Probe Failures',
    '',
    failedClicks.length
      ? failedClicks.map((probe) => `- ${probe.routePath}: ${probe.label} - ${probe.reason}`).join('\n')
      : '- None',
    '',
    `Raw JSON: ${rawPath}`,
    '',
  ].join('\n');
  writeFileSync(mdPath, markdown);
  console.log(JSON.stringify({
    rawPath,
    mdPath,
    routeChecks: results.routes.length,
    buttonProbeRoutes: Object.keys(results.buttonProbes).length,
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
