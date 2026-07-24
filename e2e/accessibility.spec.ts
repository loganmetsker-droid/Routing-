import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { preparePreviewSession, type PreviewSessionRole } from './helpers/preview-session';

type AccessibilityRoute = {
  name: string;
  path: string;
  role?: PreviewSessionRole;
};

const publicRoutes: AccessibilityRoute[] = [
  { name: 'home', path: '/' },
  { name: 'platform', path: '/platform' },
  { name: 'plan', path: '/platform/plan' },
  { name: 'dispatch marketing', path: '/platform/dispatch' },
  { name: 'drive', path: '/platform/drive' },
  { name: 'track marketing', path: '/platform/track' },
  { name: 'proof marketing', path: '/platform/proof' },
  { name: 'demo', path: '/demo' },
  { name: 'pricing', path: '/pricing' },
  { name: 'testimonials', path: '/testimonials' },
  { name: 'security', path: '/security' },
  { name: 'resources', path: '/resources' },
  { name: 'downloads', path: '/resources/downloads' },
  { name: 'support', path: '/support' },
  { name: 'company', path: '/company' },
  { name: 'mission', path: '/mission' },
  { name: 'careers', path: '/careers' },
  { name: 'privacy', path: '/legal/privacy' },
  { name: 'terms', path: '/legal/terms' },
  { name: 'cookies', path: '/legal/cookies' },
  { name: 'privacy rights', path: '/legal/exercise-rights' },
  { name: 'login', path: '/login' },
];

const productRoutes: AccessibilityRoute[] = [
  { name: 'dashboard', path: '/dashboard', role: 'dispatcher' },
  { name: 'dispatch', path: '/dispatch', role: 'dispatcher' },
  { name: 'messages alias', path: '/messages', role: 'dispatcher' },
  { name: 'routing', path: '/routing', role: 'dispatcher' },
  { name: 'routes alias', path: '/routes', role: 'dispatcher' },
  { name: 'planning alias', path: '/planning', role: 'dispatcher' },
  { name: 'jobs', path: '/jobs', role: 'dispatcher' },
  { name: 'loads alias', path: '/loads', role: 'dispatcher' },
  { name: 'customers', path: '/customers', role: 'dispatcher' },
  { name: 'drivers', path: '/drivers', role: 'dispatcher' },
  { name: 'vehicles', path: '/vehicles', role: 'dispatcher' },
  { name: 'assets alias', path: '/assets', role: 'dispatcher' },
  { name: 'tracking', path: '/tracking', role: 'dispatcher' },
  { name: 'depots alias', path: '/depots', role: 'dispatcher' },
  { name: 'proof of delivery', path: '/pod', role: 'dispatcher' },
  { name: 'exceptions', path: '/exceptions', role: 'dispatcher' },
  { name: 'analytics', path: '/analytics', role: 'dispatcher' },
  { name: 'settings', path: '/settings', role: 'dispatcher' },
  { name: 'billing alias', path: '/billing', role: 'dispatcher' },
  { name: 'integrations alias', path: '/integrations', role: 'dispatcher' },
  {
    name: 'route run detail',
    path: '/route-runs/route-alpha-001',
    role: 'dispatcher',
  },
  { name: 'driver workspace', path: '/driver', role: 'driver' },
  {
    name: 'driver route run',
    path: '/driver/route-runs/route-beta-002',
    role: 'driver',
  },
  { name: 'public tracking', path: '/track/demo-token' },
];

const mobileRoutePaths = new Set([
  '/',
  '/platform',
  '/demo',
  '/pricing',
  '/support',
  '/login',
  '/dashboard',
  '/dispatch',
  '/routing',
  '/jobs',
  '/customers',
  '/drivers',
  '/vehicles',
  '/tracking',
  '/pod',
  '/exceptions',
  '/analytics',
  '/settings',
  '/route-runs/route-alpha-001',
  '/driver',
  '/driver/route-runs/route-beta-002',
  '/track/demo-token',
]);

const viewports = [
  { name: 'desktop', width: 1440, height: 960 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

async function prepareRoute(page: Page, route: AccessibilityRoute) {
  if (route.role) {
    await preparePreviewSession(page, { role: route.role });
  } else {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  }

  await page.goto(route.path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#root')).toBeVisible();
  await page.waitForTimeout(500);
}

function formatViolations(
  route: AccessibilityRoute,
  viewport: (typeof viewports)[number],
  violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations'],
) {
  return violations.map((violation) => ({
    route: route.path,
    viewport: viewport.name,
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    helpUrl: violation.helpUrl,
    targets: violation.nodes.map((node) => node.target.join(' ')),
  }));
}

async function runAccessibilityCheck(
  page: Page,
  testInfo: TestInfo,
  route: AccessibilityRoute,
  viewport: (typeof viewports)[number],
) {
  await page.setViewportSize(viewport);
  await prepareRoute(page, route);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blockingViolations = results.violations.filter(
    (violation) =>
      violation.impact === 'critical' || violation.impact === 'serious',
  );
  const evidence = formatViolations(route, viewport, results.violations);

  await testInfo.attach('axe-results', {
    body: Buffer.from(JSON.stringify(evidence, null, 2)),
    contentType: 'application/json',
  });

  if (process.env.ACCESSIBILITY_REPORT_ONLY === 'true') {
    if (blockingViolations.length > 0) {
      console.log(JSON.stringify(formatViolations(route, viewport, blockingViolations)));
    }
    return;
  }

  expect(
    formatViolations(route, viewport, blockingViolations),
    `${route.path} has serious or critical WCAG A/AA violations at ${viewport.name}`,
  ).toEqual([]);
}

test.describe('WCAG A/AA accessibility gate', () => {
  test.describe.configure({ mode: 'parallel' });

  for (const route of [...publicRoutes, ...productRoutes]) {
    for (const viewport of viewports) {
      if (viewport.name === 'mobile' && !mobileRoutePaths.has(route.path)) {
        continue;
      }

      test(`${route.name} · ${viewport.name}`, async ({ page }, testInfo) => {
        await runAccessibilityCheck(page, testInfo, route, viewport);
      });
    }
  }
});
