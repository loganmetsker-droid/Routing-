import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseUrl = (
  process.env.PRODUCT_UI_BASE_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  'http://127.0.0.1:5185'
).replace(/\/+$/, '');
const outputDir = path.join(process.cwd(), 'audit');
const jsonPath = path.join(outputDir, 'product-ui-audit.json');
const mdPath = path.join(outputDir, 'product-ui-audit.md');
const routePath = '/routing?scenario=dense-route-day&serviceDate=2026-06-03';
const dense300RoutePath = '/routing?scenario=dense-300-stop-day&serviceDate=2026-06-03';
const exceptionRoutePath = '/routing?scenario=exception-route-day&serviceDate=2026-06-03';

const findings = [];

const previewUser = {
  id: 'preview-admin',
  email: 'ops@trovan.local',
  role: 'admin',
  roles: ['OWNER', 'ADMIN', 'DISPATCHER'],
  authProvider: 'local-config',
  organizationId: 'preview-org',
  sessionId: 'preview-session',
};

function record(id, severity, message, evidence = {}) {
  findings.push({ id, severity, message, evidence });
}

async function visibleCount(locator) {
  const count = await locator.count();
  let visible = 0;
  for (let index = 0; index < count; index += 1) {
    if (await locator.nth(index).isVisible().catch(() => false)) {
      visible += 1;
    }
  }
  return visible;
}

async function elementArea(locator) {
  const box = await locator.boundingBox().catch(() => null);
  return box ? Math.round(box.width * box.height) : 0;
}

async function gotoProductRoute(page, pathName = routePath) {
  await page.addInitScript((user) => {
    const userJson = JSON.stringify(user);
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (
        key === 'trovan-preview-auth-user' &&
        typeof value === 'string' &&
        value.includes('"DRIVER"') &&
        !value.includes('"DISPATCHER"')
      ) {
        return originalSetItem.call(this, key, userJson);
      }
      return originalSetItem.call(this, key, value);
    };
    window.localStorage.setItem('authToken', 'preview-auth-bypass');
    window.localStorage.setItem('trovan-preview-auth-user', userJson);
  }, previewUser);
  await page.goto(`${baseUrl}${pathName}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.evaluate((user) => {
    window.localStorage.setItem('authToken', 'preview-auth-bypass');
    window.localStorage.setItem('trovan-preview-auth-user', JSON.stringify(user));
  }, previewUser);
  await page.goto(`${baseUrl}${pathName}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.locator('#root').waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByTestId('routing-workspace-page').waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {});
}

async function run() {
  mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });

  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await gotoProductRoute(page);

  const workspace = page.getByTestId('routing-workspace-page');
  if (!(await workspace.isVisible().catch(() => false))) {
    record('routing-workspace-not-visible', 'blocker', 'The actual routing workspace did not render.');
  }

  const summaryText = await page.getByTestId('routing-route-day-summary').innerText().catch(() => '');
  const normalizedSummaryText = summaryText.toLowerCase();
  for (const expected of ['132 total jobs', '120 routed', '12 unassigned', '8 routes', '3 open exceptions']) {
    if (!normalizedSummaryText.includes(expected)) {
      record('semantic-route-day-metrics-missing', 'blocker', `Route-day summary is missing "${expected}".`, {
        summaryText,
      });
    }
  }
  if (/draft ready/i.test(summaryText) && /12\s+unassigned|3\s+open exceptions/i.test(summaryText)) {
    record('draft-ready-with-blockers', 'blocker', 'Route-day summary shows Draft ready while unassigned jobs or blocking exceptions remain.', {
      summaryText,
    });
  }
  if (/\b\d+\s+jobs\b/i.test(summaryText) && !/total jobs/i.test(summaryText)) {
    record('job-metric-ambiguous', 'blocker', 'Route-day metrics use ambiguous jobs wording instead of total jobs/routed/unassigned semantics.', {
      summaryText,
    });
  }

  const tabs = {
    jobs: page.getByRole('button', { name: /^Jobs$/ }),
    routes: page.getByRole('button', { name: /^Routes$/ }),
    vehicles: page.getByRole('button', { name: /^Vehicles$/ }),
  };
  for (const [name, locator] of Object.entries(tabs)) {
    if (!(await locator.isVisible().catch(() => false))) {
      record('missing-left-panel-tab', 'blocker', `Missing ${name} tab in the routing workspace.`);
    }
  }

  await tabs.jobs.click();
  const jobsVisible = await page.getByText(/^Unassigned jobs$/).isVisible().catch(() => false);
  const routesVisibleWhileJobs = await page.getByRole('heading', { name: /^Routes$/ }).isVisible().catch(() => false);
  const vehiclesVisibleWhileJobs = await page.getByText(/^Vehicle list$/).isVisible().catch(() => false);
  if (!jobsVisible || routesVisibleWhileJobs || vehiclesVisibleWhileJobs) {
    record('left-panel-tabs-not-exclusive', 'blocker', 'Jobs, Routes, and Vehicles are not exclusive tab bodies.', {
      jobsVisible,
      routesVisibleWhileJobs,
      vehiclesVisibleWhileJobs,
    });
  }

  await tabs.routes.click();
  const routeFilterVisible = await page.getByTestId('routing-route-filter-panel').isVisible().catch(() => false);
  const jobFilterCountOnRoutes = await page.getByTestId('routing-job-filter-panel').count();
  const stopFilterCountOnRoutes = await page.getByLabel(/^Stop filters$/).count();
  const searchStopsOnRoutes = await page.getByLabel(/^Search stops$/).count();
  const routeFilterText = await page.getByTestId('routing-route-filter-panel').innerText().catch(() => '');
  const missingRouteFilters = ['Ready', 'Needs driver', 'Needs vehicle', 'Has exceptions', 'Has unassigned']
    .filter((label) => !routeFilterText.includes(label));
  if (!routeFilterVisible || jobFilterCountOnRoutes > 0 || stopFilterCountOnRoutes > 0 || searchStopsOnRoutes > 0 || missingRouteFilters.length) {
    record('job-filters-on-routes-tab', 'blocker', 'The Routes tab shows job-specific filters instead of route-specific filters.', {
      routeFilterVisible,
      jobFilterCountOnRoutes,
      stopFilterCountOnRoutes,
      searchStopsOnRoutes,
      routeFilterText,
      missingRouteFilters,
    });
  }

  const mapPanel = page.getByTestId('routing-map-panel');
  const leftPanel = page.getByTestId('routing-route-filter-panel');
  const inspector = page.getByTestId('routing-route-readiness-summary');
  const mapArea = await elementArea(mapPanel);
  const leftArea = await elementArea(leftPanel);
  const inspectorArea = await elementArea(inspector);
  if (mapArea <= Math.max(leftArea, inspectorArea)) {
    record('map-not-largest-work-area', 'blocker', 'The route map is not the largest visible work area.', {
      mapArea,
      leftArea,
      inspectorArea,
    });
  }

  const compactButton = page.getByRole('button', { name: /^Compact$/ });
  if (!(await compactButton.isVisible().catch(() => false))) {
    record('missing-compact-mode', 'blocker', 'Compact density toggle is missing.');
  } else {
    await compactButton.click();
    const compactRows = await visibleCount(page.getByTestId('routing-compact-stop-row'));
    if (compactRows < 100) {
      record('dense-compact-row-count-too-low', 'blocker', 'Dense route-day compact mode did not render the expected 120-stop stress data.', {
        compactRows,
      });
    }
    const cardsInCompact = await visibleCount(page.getByTestId('routing-stop-card'));
    if (cardsInCompact > 0) {
      record('compact-mode-still-renders-cards', 'blocker', 'Compact mode still renders full stop cards.', {
        cardsInCompact,
      });
    }
    const firstRowText = await page.getByTestId('routing-compact-stop-row').first().innerText().catch(() => '');
    if (!/Cold Chain|Medical Supply|Produce|Bakery|Pharmacy|Catering|Clinic|Market/i.test(firstRowText)) {
      record('compact-row-missing-stop-identity', 'blocker', 'Compact rows do not expose customer/stop identity.', {
        firstRowText,
      });
    }
  }

  const laneEditor = page.getByTestId('routing-lane-editor').first();
  if (!(await laneEditor.isVisible().catch(() => false))) {
    record('missing-lane-editor', 'blocker', 'Route lane editor is missing.');
  } else {
    await page.getByTestId('routing-lane-editor-collapse').first().click();
    const collapsedState = await laneEditor.getAttribute('data-lane-editor-state');
    const expandActionVisible = await page.getByTestId('routing-lane-editor-expand-from-collapsed').isVisible().catch(() => false);
    if (collapsedState !== 'collapsed' || !expandActionVisible) {
      record('lane-editor-not-collapsible', 'blocker', 'Route lane editor did not enter a clear collapsed state with one expand action.', {
        collapsedState,
        expandActionVisible,
      });
    }
    await page.getByTestId('routing-lane-editor-expand-from-collapsed').click();
  }

  if (!(await page.getByTestId('routing-map-mode-toggle').isVisible().catch(() => false))) {
    record('missing-map-display-modes', 'blocker', 'Map display mode toggle is missing.');
  }
  for (const mode of ['Selected route', 'All routes', 'Route density', 'Exceptions only']) {
    if (!(await page.getByRole('button', { name: new RegExp(`^${mode}$`) }).isVisible().catch(() => false))) {
      record('missing-map-display-mode-option', 'blocker', `Missing map display mode "${mode}".`);
    }
  }

  const routeLanes = page.locator('[data-testid^="routing-route-lane-"]');
  if ((await routeLanes.count()) > 1) {
    await routeLanes.nth(1).click();
    const selectedRouteId = await workspace.getAttribute('data-selected-route-id');
    const selectedLaneCount = await page.locator('[data-route-lane-focus="selected"]').count();
    const mutedLaneCount = await page.locator('[data-route-lane-focus="muted"]').count();
    const selectedMapRouteCount = await page.locator('path.trovan-route-line.is-selected').count();
    const simplifiedMapRouteCount = await page.locator('path.trovan-route-line.is-simplified').count();
    const dominantUnrelatedRouteCount = await page.locator('path.trovan-route-line:not(.is-selected):not(.is-simplified)').count();
    const renderLevel = await page.locator('[data-testid="routing-map-render-level"]').getAttribute('data-render-level').catch(() => null);
    const selectedStopMarkerCount = await page.locator('[data-testid="routing-stop-marker"][data-route-focus="selected"]').count();
    const mutedNormalStopMarkerCount = await page.locator('[data-testid="routing-stop-marker"][data-route-focus="muted"][data-stop-importance="normal"]').count();
    const totalStopMarkerCount = await page.locator('[data-testid="routing-stop-marker"]').count();
    const routeClusterMarkerCount = await page.locator('[data-testid="routing-route-cluster-marker"]').count();
    const exceptionMarkerCount = await page.locator('[data-testid="routing-exception-marker"]').count();
    const blurStyledDeclutterCount = await page.locator('[data-testid="routing-route-cluster-marker"][style*="blur"], [data-testid="routing-stop-marker"][style*="blur"], [data-testid="routing-route-cluster-marker"][style*="filter"], [data-testid="routing-stop-marker"][style*="filter"]').count();
    const selectedStroke = Number(
      await page.locator('path.trovan-route-line.is-selected').first().getAttribute('stroke-width'),
    );
    const simplifiedOpacity = Number(
      await page.locator('path.trovan-route-line.is-simplified').first().getAttribute('stroke-opacity'),
    );
    if (
      !selectedRouteId ||
      selectedLaneCount !== 1 ||
      mutedLaneCount === 0 ||
      selectedMapRouteCount !== 1 ||
      simplifiedMapRouteCount === 0 ||
      dominantUnrelatedRouteCount > 0 ||
      renderLevel !== 'overview' ||
      selectedStopMarkerCount < 10 ||
      mutedNormalStopMarkerCount > 0 ||
      totalStopMarkerCount > 40 ||
      routeClusterMarkerCount === 0 ||
      exceptionMarkerCount === 0 ||
      blurStyledDeclutterCount > 0 ||
      !Number.isFinite(selectedStroke) ||
      selectedStroke <= 3 ||
      !Number.isFinite(simplifiedOpacity) ||
      simplifiedOpacity >= 0.2
    ) {
      record('selected-route-focus-not-simplified', 'blocker', 'Selected-route map mode does not clearly simplify unrelated dense routes.', {
        selectedRouteId,
        selectedLaneCount,
        mutedLaneCount,
        selectedMapRouteCount,
        simplifiedMapRouteCount,
        dominantUnrelatedRouteCount,
        renderLevel,
        selectedStopMarkerCount,
        mutedNormalStopMarkerCount,
        totalStopMarkerCount,
        routeClusterMarkerCount,
        exceptionMarkerCount,
        blurStyledDeclutterCount,
        selectedStroke,
        simplifiedOpacity,
      });
    }
  } else {
    record('route-lanes-missing', 'blocker', 'Dense routing scenario did not render multiple route lanes.');
  }

  await page.getByRole('button', { name: /^All routes$/ }).click();
  const allRoutesStopMarkerCount = await page.locator('[data-testid="routing-stop-marker"]').count();
  const allRoutesClusterCount = await page.locator('[data-testid="routing-route-cluster-marker"]').count();
  if (allRoutesStopMarkerCount > 40 || allRoutesClusterCount === 0) {
    record('all-routes-low-zoom-not-clustered', 'blocker', 'Dense all-routes mode should cluster low-zoom route stops instead of rendering every stop marker.', {
      allRoutesStopMarkerCount,
      allRoutesClusterCount,
    });
  }

  await page.getByRole('button', { name: /^Route density$/ }).click();
  const densityNormalStopCount = await page.locator('[data-testid="routing-stop-marker"][data-stop-importance="normal"]').count();
  const densityClusterCount = await page.locator('[data-testid="routing-route-cluster-marker"]').count();
  const densityExceptionCount = await page.locator('[data-testid="routing-exception-marker"]').count();
  if (densityNormalStopCount > 0 || densityClusterCount === 0 || densityExceptionCount === 0) {
    record('route-density-mode-not-declustered', 'blocker', 'Route density mode should use route clusters/counts with exception markers on top, not normal individual stop markers.', {
      densityNormalStopCount,
      densityClusterCount,
      densityExceptionCount,
    });
  }

  await page.getByRole('button', { name: /^Exceptions only$/ }).click();
  const exceptionOnlyNormalStopCount = await page.locator('[data-testid="routing-stop-marker"][data-stop-importance="normal"]').count();
  const exceptionOnlyExceptionCount = await page.locator('[data-testid="routing-exception-marker"]').count();
  if (exceptionOnlyNormalStopCount > 0 || exceptionOnlyExceptionCount === 0) {
    record('exceptions-only-mode-hides-or-clutters-exceptions', 'blocker', 'Exceptions-only mode should hide normal markers while keeping exception and late-risk markers visible.', {
      exceptionOnlyNormalStopCount,
      exceptionOnlyExceptionCount,
    });
  }

  const overviewText = await page.locator('body').innerText();
  if (/draft ready/i.test(overviewText) && /Resolve unassigned|Review exceptions|12\s+unassigned|3\s+open exceptions/i.test(overviewText)) {
    record('draft-ready-visible-with-blockers', 'blocker', 'Draft ready appears in the dense Denver scenario while blockers remain.');
  }
  if (/Selected lanes stay highlighted|buyers should see|without blurring the map|feature explainer/i.test(overviewText)) {
    record(
      'marketing-copy-in-product-ui',
      'blocker',
      'The product route inspector still contains marketing or explainer copy.',
    );
  }
  for (const label of ['Status', 'Driver', 'Vehicle', 'Stops', 'Distance', 'Unassigned impact', 'Next action']) {
    if (!overviewText.includes(label)) {
      record('missing-route-readiness-data', 'high', `Route readiness is missing ${label}.`);
    }
  }
  const readinessLayout = await page.getByTestId('routing-route-readiness-summary').getAttribute('data-readiness-layout').catch(() => null);
  const readinessAlertCount = await page.getByTestId('routing-readiness-alert').count();
  if (readinessLayout !== 'summary' || readinessAlertCount === 0) {
    record('route-readiness-not-prioritized', 'blocker', 'Route readiness should use a clean summary plus issue alert cards.', {
      readinessLayout,
      readinessAlertCount,
    });
  }

  const rowCount = await page.getByTestId('routing-compact-stop-row').count();
  const lockTextCount = await page.getByText(/\bLock\b|\bLocked\b/i).count();
  if (rowCount > 20 && lockTextCount >= rowCount / 4) {
    record('repeated-lock-text', 'blocker', 'Lock-related text repeats across too many stop rows.', {
      rowCount,
      lockTextCount,
    });
  }

  const resolveButtons = await page.getByRole('button', { name: /^Resolve unassigned$/ }).count();
  const publishButtons = await page.getByRole('button', { name: /^Publish plan$/ }).count();
  const generateButtons = await page.getByRole('button', { name: /^Generate route draft$/ }).count();
  if (resolveButtons !== 1 || publishButtons !== 0 || generateButtons !== 0) {
    record('primary-action-blocker-logic-broken', 'blocker', 'Dense route day with unassigned jobs should show Resolve unassigned as the primary action, not Publish plan.', {
      resolveButtons,
      publishButtons,
      generateButtons,
    });
  }

  if (/\bkm\b/i.test(overviewText)) {
    record('denver-demo-uses-kilometers', 'blocker', 'Denver demo/local scenario still displays kilometers instead of miles.');
  }
  if (/2026-06-03|06\/03\/2026|6\/3\/2026/.test(overviewText)) {
    record('inconsistent-date-format', 'blocker', 'The routing screen mixes raw/numeric dates with readable dates.', {
      matches: overviewText.match(/2026-06-03|06\/03\/2026|6\/3\/2026/g),
    });
  }
  if (!overviewText.includes('Jun 3, 2026')) {
    record('missing-readable-date', 'blocker', 'The routing screen does not show the readable service date.');
  }

  await gotoProductRoute(page, dense300RoutePath);
  await page.getByRole('button', { name: /^Compact$/ }).click();
  const dense300SummaryText = await page.getByTestId('routing-route-day-summary').innerText().catch(() => '');
  const virtualizedLists = page.getByTestId('routing-virtualized-stop-list');
  const virtualizedListCount = await virtualizedLists.count();
  const virtualizedEnabledCount = await page.locator('[data-testid="routing-virtualized-stop-list"][data-virtualized="true"]').count();
  const dense300RenderedRows = await page.getByTestId('routing-compact-stop-row').count();
  const dense300TotalRows = await virtualizedLists.evaluateAll((elements) =>
    elements.reduce((total, element) => total + Number(element.getAttribute('data-total-stop-rows') || 0), 0),
  ).catch(() => 0);
  if (!dense300SummaryText.toLowerCase().includes('300 routed') || dense300TotalRows < 300) {
    record('dense-300-scenario-missing', 'blocker', 'Dense 300-stop product scenario did not load the expected routed-stop count.', {
      dense300SummaryText,
      dense300TotalRows,
    });
  }
  if (virtualizedListCount === 0 || virtualizedEnabledCount === 0) {
    record('dense-compact-virtualization-missing', 'blocker', 'Dense 300-stop compact lanes do not expose virtualized stop lists.', {
      virtualizedListCount,
      virtualizedEnabledCount,
    });
  }
  if (dense300RenderedRows >= 300 || dense300RenderedRows >= dense300TotalRows) {
    record('dense-compact-renders-all-rows', 'blocker', 'Dense compact mode renders every 300-stop row into the DOM instead of virtualizing.', {
      dense300RenderedRows,
      dense300TotalRows,
    });
  }

  await gotoProductRoute(page, '/routing?scenario=setup-route-day&serviceDate=2026-06-03');
  const setupGenerateButtons = await page.getByRole('button', { name: /^Generate route draft$/ }).count();
  const setupPublishButtons = await page.getByRole('button', { name: /^Publish plan$/ }).count();
  if (setupGenerateButtons !== 1 || setupPublishButtons !== 0) {
    record('generate-primary-missing-before-draft', 'blocker', 'Setup scenario should make Generate route draft the only primary action.', {
      setupGenerateButtons,
      setupPublishButtons,
    });
  }

  await gotoProductRoute(page, '/routing?scenario=clean-route-day&serviceDate=2026-06-03');
  const cleanText = await page.locator('body').innerText();
  const cleanPublishButtons = await page.getByRole('button', { name: /^Publish plan$/ }).count();
  if (cleanPublishButtons !== 1 || !/Ready to publish/i.test(cleanText)) {
    record('clean-draft-publish-state-broken', 'blocker', 'Clean Denver draft should be ready to publish with Publish plan as the primary action.', {
      cleanPublishButtons,
      hasReadyToPublish: /Ready to publish/i.test(cleanText),
    });
  }
  if (/\bkm\b/i.test(cleanText)) {
    record('clean-denver-demo-uses-kilometers', 'blocker', 'Clean Denver scenario still displays kilometers instead of miles.');
  }
  await page.getByRole('button', { name: /^Publish plan$/ }).click();
  const publishDialog = page.getByTestId('routing-publish-summary-dialog');
  const publishDialogVisible = await publishDialog.isVisible().catch(() => false);
  const publishDialogText = await publishDialog.innerText().catch(() => '');
  const missingPublishSummaryFields = [
    'Routes',
    'Routed stops',
    'Unassigned jobs',
    'Accepted exceptions',
    'Drivers assigned',
    'Vehicles assigned',
  ].filter((label) => !publishDialogText.includes(label));
  if (!publishDialogVisible || missingPublishSummaryFields.length) {
    record('publish-summary-missing', 'blocker', 'Publish plan should open a confirmation summary before dispatch handoff.', {
      publishDialogVisible,
      missingPublishSummaryFields,
      publishDialogText,
    });
  }
  if (/Unassigned jobs\s+[1-9]/i.test(publishDialogText)) {
    record('publish-summary-has-unassigned-blockers', 'blocker', 'Clean publish summary should not show unresolved unassigned blockers.', {
      publishDialogText,
    });
  }
  await publishDialog.getByRole('button', { name: /^Confirm publish$/ }).click();
  await page.getByTestId('routing-route-day-summary').waitFor({ state: 'visible', timeout: 5000 });
  const publishedText = await page.locator('body').innerText();
  const routeVersion = await page.getByTestId('routing-workspace-page').getAttribute('data-route-version').catch(() => null);
  const handoffVisible = await page.getByTestId('routing-dispatch-handoff').isVisible().catch(() => false);
  const laneReadOnly = await page.getByTestId('routing-lane-editor').getAttribute('data-read-only').catch(() => null);
  const unlockedHandleCount = await page
    .locator('[data-testid="routing-compact-stop-row"][data-stop-locked="false"] [data-testid="routing-stop-drag-handle"]')
    .count();
  const disabledUnlockedDragHandles = await page
    .locator('[data-testid="routing-compact-stop-row"][data-stop-locked="false"] [data-testid="routing-stop-drag-handle"][disabled]')
    .count();
  if (
    !/Published/i.test(publishedText) ||
    !routeVersion ||
    !handoffVisible ||
    laneReadOnly !== 'true' ||
    unlockedHandleCount === 0 ||
    disabledUnlockedDragHandles !== unlockedHandleCount
  ) {
    record('publish-handoff-incomplete', 'blocker', 'Publishing should record a route version, lock lanes, and show dispatch handoff.', {
      hasPublishedText: /Published/i.test(publishedText),
      routeVersion,
      handoffVisible,
      laneReadOnly,
      unlockedHandleCount,
      disabledUnlockedDragHandles,
    });
  }
  await page.getByRole('button', { name: /^Start revision$/ }).click();
  const laneReadOnlyAfterRevision = await page.getByTestId('routing-lane-editor').getAttribute('data-read-only').catch(() => null);
  const disabledUnlockedDragHandlesAfterRevision = await page
    .locator('[data-testid="routing-compact-stop-row"][data-stop-locked="false"] [data-testid="routing-stop-drag-handle"][disabled]')
    .count();
  if (laneReadOnlyAfterRevision !== 'false' || disabledUnlockedDragHandlesAfterRevision > 0) {
    record('published-lanes-cannot-revise', 'blocker', 'Published lane read-only state should clear after starting a revision.', {
      laneReadOnlyAfterRevision,
      disabledUnlockedDragHandlesAfterRevision,
    });
  }

  await gotoProductRoute(page, exceptionRoutePath);
  const reviewExceptionButtons = await page.getByRole('button', { name: /^Review exceptions$/ }).count();
  const publishBeforeExceptionResolution = await page.getByRole('button', { name: /^Publish plan$/ }).count();
  if (reviewExceptionButtons !== 1 || publishBeforeExceptionResolution !== 0) {
    record('exception-review-primary-action-missing', 'blocker', 'Exception route-day scenario should require Review exceptions before Publish plan is available.', {
      reviewExceptionButtons,
      publishBeforeExceptionResolution,
    });
  }
  await page.getByRole('button', { name: /^Review exceptions$/ }).click();
  const drawerVisible = await page.getByTestId('routing-exception-drawer').isVisible().catch(() => false);
  const severityGroups = await page.locator('[data-testid^="routing-exception-severity-"]').count();
  const routeGroups = await page.locator('[data-testid^="routing-exception-route-"]').count();
  const exceptionCards = await page.locator('[data-testid^="routing-exception-card-"]').count();
  const drawerText = await page.getByTestId('routing-exception-drawer').innerText().catch(() => '');
  const requiredExceptionFields = ['Type', 'Affected', 'Severity', 'Recommended action', 'Owner / status'];
  const missingExceptionFields = requiredExceptionFields.filter((label) => !drawerText.includes(label));
  if (!drawerVisible || severityGroups === 0 || routeGroups === 0 || exceptionCards < 4 || missingExceptionFields.length) {
    record('exception-drawer-incomplete', 'blocker', 'Exception drawer should group records by severity and route and show required exception fields.', {
      drawerVisible,
      severityGroups,
      routeGroups,
      exceptionCards,
      missingExceptionFields,
      drawerText: drawerText.slice(0, 800),
    });
  }
  await page.getByTestId('routing-exception-card-route-warning-exception-route-1-0').getByRole('button', { name: /^Resolve exception$/ }).click();
  await page
    .getByTestId('routing-exception-card-stop-exception-exception-stop-6')
    .getByLabel(/Risk acceptance reason/i)
    .fill('Audit accepted because the customer approved the delivery window.');
  await page
    .getByTestId('routing-exception-card-stop-exception-exception-stop-6')
    .getByRole('button', { name: /^Accept risk$/ })
    .click();
  await page.getByTestId('routing-exception-card-missing-driver-exception-route-3').getByRole('button', { name: /^Assign driver$/ }).click();
  await page.getByTestId('routing-exception-card-missing-vehicle-exception-route-4').getByRole('button', { name: /^Assign vehicle$/ }).click();
  await page.getByTestId('routing-exception-drawer').getByRole('button', { name: /^Close$/ }).click();
  const exceptionResolvedText = await page.locator('body').innerText();
  const publishAfterExceptionResolution = await page.getByRole('button', { name: /^Publish plan$/ }).count();
  if (publishAfterExceptionResolution !== 1 || !/0 open exceptions/i.test(exceptionResolvedText) || !/Ready to publish/i.test(exceptionResolvedText)) {
    record('exception-resolution-does-not-update-readiness', 'blocker', 'Resolving or accepting exception blockers should update route readiness and allow Publish plan.', {
      publishAfterExceptionResolution,
      hasZeroOpenExceptions: /0 open exceptions/i.test(exceptionResolvedText),
      hasReadyToPublish: /Ready to publish/i.test(exceptionResolvedText),
    });
  }

  if (consoleErrors.length) {
    record('console-errors', 'high', 'Console or page errors occurred while auditing product routing UI.', {
      consoleErrors: consoleErrors.slice(0, 8),
    });
  }

  const result = {
    baseUrl,
    route: routePath,
    generatedAt: new Date().toISOString(),
    summary: {
      status: findings.length ? 'fail' : 'pass',
      findingCount: findings.length,
    },
    checks: {
      mapArea,
      leftArea,
      inspectorArea,
      summaryText,
    },
    findings,
  };

  writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  writeFileSync(
    mdPath,
    [
      '# Trovan Product UI Audit',
      '',
      `Base URL: ${baseUrl}`,
      `Route: ${routePath}`,
      `Status: ${result.summary.status}`,
      `Findings: ${findings.length}`,
      '',
      findings.length
        ? findings.map((finding) => `- **${finding.severity}** ${finding.id}: ${finding.message}`).join('\n')
        : 'No product UI audit findings.',
      '',
    ].join('\n'),
  );

  await browser.close();

  if (findings.length) {
    console.error(`Product UI audit failed with ${findings.length} finding(s). See ${mdPath}`);
    process.exit(1);
  }
  console.log(`Product UI audit passed. Wrote ${mdPath}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
