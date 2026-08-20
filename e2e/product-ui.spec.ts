import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { preparePreviewSession } from './helpers/preview-session';

type RoutingScenario =
  | 'dense-route-day'
  | 'dense-300-stop-day'
  | 'setup-route-day'
  | 'clean-route-day'
  | 'exception-route-day'
  | 'loading-route-day'
  | 'empty-route-day'
  | 'no-vehicles'
  | 'no-drivers'
  | 'geocode-failure'
  | 'stale-route-data';

async function useAuthenticatedSession(page: Page) {
  const hostedAuthToken =
    process.env.LAUNCH_AUDIT_AUTH_TOKEN ||
    process.env.STAGING_AUTH_TOKEN ||
    '';
  await preparePreviewSession(page, {
    role: 'dispatcher',
    authToken:
      process.env.PLAYWRIGHT_SKIP_WEBSERVER === 'true'
        ? hostedAuthToken
        : '',
  });
}

async function gotoRoutingWorkspace(
  page: Page,
  testInfo: TestInfo,
  scenario?: RoutingScenario,
  extraParams: Record<string, string> = {},
  waitForWorkspace = true,
) {
  await useAuthenticatedSession(page);
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem('trovan-preserve-routing-preferences') === 'true') {
      return;
    }
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('trovan-routing-workspace-preferences:')) {
        window.localStorage.removeItem(key);
      }
    }
  });

  const params = new URLSearchParams({ serviceDate: '2026-06-03', workspaceMode: 'test' });
  if (scenario) params.set('scenario', scenario);
  for (const [key, value] of Object.entries(extraParams)) {
    params.set(key, value);
  }

  await page.goto(`/routing?${params.toString()}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.locator('#root').waitFor({ state: 'visible', timeout: 20_000 });
  await expect(page.getByText(/Workspace Failed To Render/i)).toHaveCount(0);

  if (!waitForWorkspace) return;

  await expect(page.getByTestId('routing-workspace-page')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Route Planning & Optimization').first()).toBeVisible();
  await expect(page.getByTestId('routing-map-panel')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('routing-map-mode-state')).toBeVisible({ timeout: 20_000 });
}

async function setMapMode(page: Page, label: 'Selected route' | 'All routes' | 'Route density' | 'Exceptions only') {
  await page.getByRole('button', { name: label }).click();
  await expect(page.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('routing-map-mode-state')).toHaveText(`Map view: ${label}`);
}

async function expandRouteLanes(page: Page) {
  const laneEditor = page.getByTestId('routing-lane-editor').first();
  await expect(laneEditor).toBeVisible();
  if ((await laneEditor.getAttribute('data-lane-editor-state')) === 'collapsed') {
    await page.getByTestId('routing-lane-editor-expand-from-collapsed').click();
  }
  await expect(laneEditor).toHaveAttribute('data-lane-editor-state', 'expanded');
  return laneEditor;
}

async function selectFirstRouteLane(page: Page) {
  await expandRouteLanes(page);
  const firstLane = page.locator('[data-testid^="routing-route-lane-"]').first();
  await expect(firstLane).toBeVisible();
  const laneId = (await firstLane.getAttribute('data-testid'))?.replace('routing-route-lane-', '');
  await firstLane.click();
  if (laneId) {
    await expect(page.getByTestId('routing-workspace-page')).toHaveAttribute('data-selected-route-id', laneId);
  }
  return { firstLane, laneId };
}

async function routeLinePath(page: Page, routeId: string | undefined) {
  if (!routeId) return null;
  return page.locator(`path.route-line-${routeId}`).first().getAttribute('d');
}

async function routeIdFromLane(lane: Locator) {
  const testId = await lane.getAttribute('data-testid');
  expect(testId).toMatch(/^routing-route-lane-/);
  return testId?.replace('routing-route-lane-', '') || '';
}

async function findMovableLanePair(page: Page) {
  await expandRouteLanes(page);
  const lanes = page.locator('[data-testid^="routing-route-lane-"]');
  const laneCount = await lanes.count();
  expect(laneCount).toBeGreaterThan(1);

  for (let laneIndex = 0; laneIndex < laneCount - 1; laneIndex += 1) {
    const sourceLane = lanes.nth(laneIndex);
    const movableRows = sourceLane.locator('[data-testid="routing-compact-stop-row"][data-stop-locked="false"]');
    const rowCount = await movableRows.count();

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const movableRow = movableRows.nth(rowIndex);
      const moveDown = movableRow.getByRole('button', { name: /Move stop down/i });
      const moveToNextRoute = movableRow.getByRole('button', { name: /Move stop to next route/i });
      const canMoveWithinLane =
        await moveDown.isVisible().catch(() => false) &&
        await moveDown.isEnabled().catch(() => false);
      const canMoveAcrossLanes =
        await moveToNextRoute.isVisible().catch(() => false) &&
        await moveToNextRoute.isEnabled().catch(() => false);

      if (canMoveWithinLane && canMoveAcrossLanes) {
        const targetLane = lanes.nth(laneIndex + 1);
        const sourceLaneId = await routeIdFromLane(sourceLane);
        const targetLaneId = await routeIdFromLane(targetLane);
        const movedStopId = await movableRow.getAttribute('data-stop-id');
        return {
          sourceLane: page.getByTestId(`routing-route-lane-${sourceLaneId}`),
          targetLane: page.getByTestId(`routing-route-lane-${targetLaneId}`),
          movableRow: page.getByTestId(`routing-route-lane-${sourceLaneId}`).locator(`[data-stop-id="${movedStopId}"]`),
          sourceLaneId,
          targetLaneId,
        };
      }
    }
  }

  throw new Error('No movable route lane pair was available in the rendered routing workspace.');
}

async function routeIdFromExceptionSection(section: Locator) {
  const testId = await section.getAttribute('data-testid');
  expect(testId).toMatch(/^routing-exception-route-/);
  return testId?.replace('routing-exception-route-', '') || '';
}

async function findRouteExceptionCard(drawer: Locator) {
  const sections = drawer.locator('[data-testid^="routing-exception-route-"]');
  const sectionCount = await sections.count();

  for (let sectionIndex = 0; sectionIndex < sectionCount; sectionIndex += 1) {
    const section = sections.nth(sectionIndex);
    const cards = section.locator('[data-testid^="routing-exception-card-"]');
    const cardCount = await cards.count();

    for (let cardIndex = 0; cardIndex < cardCount; cardIndex += 1) {
      const card = cards.nth(cardIndex);
      const jumpToRoute = card.getByRole('button', { name: /Jump to affected route/i });
      const resolve = card.getByRole('button', { name: /^Resolve exception$/ });
      if (
        await jumpToRoute.isVisible().catch(() => false) &&
        await resolve.isVisible().catch(() => false) &&
        await resolve.isEnabled().catch(() => false)
      ) {
        return {
          card,
          routeId: await routeIdFromExceptionSection(section),
        };
      }
    }
  }

  throw new Error('No resolvable route exception card was available in the rendered drawer.');
}

async function findRiskAcceptanceCard(drawer: Locator) {
  const cards = drawer.locator('[data-testid^="routing-exception-card-"]');
  const cardCount = await cards.count();

  for (let cardIndex = 0; cardIndex < cardCount; cardIndex += 1) {
    const card = cards.nth(cardIndex);
    const reason = card.getByLabel(/Risk acceptance reason/i);
    const acceptRisk = card.getByRole('button', { name: /^Accept risk$/ });
    if (
      await reason.isVisible().catch(() => false) &&
      await reason.isEnabled().catch(() => false) &&
      await acceptRisk.isVisible().catch(() => false)
    ) {
      return { card, reason, acceptRisk };
    }
  }

  throw new Error('No open risk-acceptance exception card was available in the rendered drawer.');
}

test.describe('routing workspace product UI', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test('route-day state surfaces render current loading, empty, resource, geocode, stale, and offline conditions', async ({ page }, testInfo) => {
    await gotoRoutingWorkspace(page, testInfo, 'loading-route-day', {}, false);
    await expect(page.locator('#root')).toBeVisible();
    await expect(page.getByTestId('routing-loading-skeleton').or(page.getByTestId('routing-workspace-page'))).toBeVisible({ timeout: 20_000 });

    await gotoRoutingWorkspace(page, testInfo, 'empty-route-day');
    await expect(page.getByTestId('routing-empty-route-day-state')).toContainText('No route day loaded');
    await expect(page.getByTestId('routing-map-panel')).toContainText('No route lanes to display');

    await gotoRoutingWorkspace(page, testInfo, 'no-vehicles');
    await expect(page.getByTestId('routing-no-vehicles-state')).toContainText('No vehicles available');

    await gotoRoutingWorkspace(page, testInfo, 'no-drivers');
    await expect(page.getByTestId('routing-no-drivers-state')).toContainText('No drivers available');

    await gotoRoutingWorkspace(page, testInfo, 'geocode-failure');
    await expect(page.getByTestId('routing-geocode-failure-warning')).toContainText(/Address issue/i);

    await gotoRoutingWorkspace(page, testInfo, 'stale-route-data');
    await expect(page.getByTestId('routing-stale-data-warning')).toContainText(/Route data may be stale/i);

    await gotoRoutingWorkspace(page, testInfo, 'clean-route-day');
    await page.context().setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.getByTestId('routing-workspace-page')).toBeVisible();
    await expect(page.getByTestId('routing-map-panel')).toBeVisible();
    await page.context().setOffline(false);
  });

  test('route workspace action failures are actionable instead of silent', async ({ page }, testInfo) => {
    await gotoRoutingWorkspace(page, testInfo, 'setup-route-day', { failure: 'optimizer' });
    await expect(page.getByTestId('routing-generate-draft-button')).toBeVisible();
    await page.getByTestId('routing-generate-draft-button').click();
    await expect(page.getByTestId('routing-error-alert')).toContainText(/Select at least one job|Optimizer failed/i);

    await gotoRoutingWorkspace(page, testInfo, 'clean-route-day', { failure: 'save-draft' });
    await page.getByTestId('routing-draft-refresh-button').click();
    await expect(page.getByTestId('routing-error-alert')).toContainText(/Save draft failed|not saved/i);

    await gotoRoutingWorkspace(page, testInfo, 'clean-route-day');
    await page.getByRole('button', { name: /^Scenario Compare$/ }).click();
    await expect(page.getByRole('button', { name: /^Route density$/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('routing-map-mode-state')).toHaveText('Map view: Route density');
  });

  test('migrated routing panels expose current filters, summaries, and scenario content', async ({ page }, testInfo) => {
    await gotoRoutingWorkspace(page, testInfo, 'dense-route-day');

    await expect(page.getByTestId('routing-service-date-control')).toBeVisible();
    await expect(page.getByTestId('routing-planning-unassigned-panel')).toContainText(/Unassigned Jobs/i);
    await expect(page.getByTestId('routing-planning-unassigned-panel').getByRole('button', { name: /^Filters$/ })).toBeVisible();
    await expect(page.getByTestId('routing-route-summaries-panel')).toContainText(/Route Summaries/i);
    await expect(page.getByTestId('routing-route-summary-filter')).toContainText(/Attention/i);
    await expect(page.getByTestId('routing-planning-alerts-panel')).toContainText(/Alerts/i);
    await expect(page.getByTestId('routing-scenario-cards')).toContainText(/Scenarios/i);
    await expect(page.getByTestId('routing-best-fit-0')).toContainText(/Best fit/i);
    await page.getByTestId('routing-unassigned-job-0').click();
    await expect(page.getByTestId('routing-action-notice')).toContainText(/Best fit/i);
    await page.getByTestId('routing-insert-recommended-0').click();
    await expect(page.getByTestId('routing-action-notice')).toContainText(/inserted into/i);
    await expect(page.getByTestId('routing-planning-unassigned-panel')).toContainText('Unassigned Jobs (11)');
  });

  test('dispatchers can enter a safe map-area selection mode for unassigned work', async ({ page }, testInfo) => {
    await gotoRoutingWorkspace(page, testInfo, 'dense-route-day');

    await expect(page.getByTestId('routing-unassigned-map-marker')).not.toHaveCount(0);
    const drawArea = page.getByTestId('routing-map-draw-area');
    await expect(drawArea).toHaveAttribute('aria-pressed', 'false');
    await drawArea.click();
    await expect(drawArea).toHaveAttribute('aria-pressed', 'true');
    await expect(drawArea).toContainText('Drag around jobs');
    const mapSurface = page.getByTestId('routing-map-panel').locator('.leaflet-container');
    await expect(mapSurface).toBeVisible();
    const mapBounds = await mapSurface.boundingBox();
    expect(mapBounds).not.toBeNull();
    if (!mapBounds) return;
    const left = mapBounds.x + 48;
    const right = mapBounds.x + mapBounds.width - 48;
    const top = mapBounds.y + 48;
    const bottom = mapBounds.y + mapBounds.height - 48;
    await page.mouse.move(left, top);
    await page.mouse.down();
    await page.mouse.move(right, top, { steps: 8 });
    await page.mouse.move(right, bottom, { steps: 8 });
    await page.mouse.move(left, bottom, { steps: 8 });
    await page.mouse.move(left, top, { steps: 8 });
    await page.mouse.up();

    await expect(drawArea).toHaveAttribute('aria-pressed', 'false', { timeout: 15_000 });
    await expect(page.getByTestId('routing-map-area-review')).toContainText(/Map cluster: \d+ unassigned jobs?/);
    await expect(page.getByTestId('routing-map-area-insert')).toBeEnabled();
    await page.getByTestId('routing-map-clear-area').click();
    await expect(page.getByTestId('routing-map-area-review')).toHaveCount(0);
  });

  test('route day and attention filters preserve dispatcher context', async ({ page }, testInfo) => {
    await gotoRoutingWorkspace(page, testInfo, 'dense-route-day');

    const routeDayInput = page.getByTestId('routing-service-date-input');
    await expect(routeDayInput).toHaveValue('2026-06-03');
    await page.getByRole('button', { name: 'Next route day' }).click();
    await expect(routeDayInput).toHaveValue('2026-06-04');
    await expect(page).toHaveURL(/serviceDate=2026-06-04/);

    const attentionFilter = page
      .getByTestId('routing-route-summary-filter')
      .getByRole('button', { name: /Attention/i });
    await attentionFilter.click();
    await expect(attentionFilter).toHaveAttribute('aria-pressed', 'true');
    expect(await page.locator('[data-testid^="routing-route-summary-"]').count()).toBeGreaterThan(0);
  });

  test('dispatcher can configure columns and save, restore, rename, and delete a personal view', async ({ page }, testInfo) => {
    await gotoRoutingWorkspace(page, testInfo, 'dense-route-day');

    const firstSummary = page
      .locator('button[data-testid^="routing-route-summary-"]:not([data-testid*="-column-"])')
      .first();
    const firstSummaryTestId = await firstSummary.getAttribute('data-testid');
    expect(firstSummaryTestId).toBeTruthy();

    await page.getByTestId('routing-open-summary-columns').click();
    const columnsDialog = page.getByTestId('routing-summary-columns-dialog');
    await expect(columnsDialog).toBeVisible();
    await columnsDialog.getByRole('checkbox', { name: 'Driver' }).click();
    await columnsDialog.getByRole('checkbox', { name: 'Weight' }).click();
    await columnsDialog.getByRole('button', { name: 'Done' }).click();

    await expect(page.getByTestId(`${firstSummaryTestId}-column-driver`)).toHaveCount(0);
    await expect(page.getByTestId(`${firstSummaryTestId}-column-weight`)).toBeVisible();

    const attentionFilter = page
      .getByTestId('routing-route-summary-filter')
      .getByRole('button', { name: /Attention/i });
    await attentionFilter.click();
    await setMapMode(page, 'All routes');

    await page.getByTestId('routing-save-summary-view').click();
    const saveDialog = page.getByTestId('routing-save-summary-view-dialog');
    await saveDialog.getByLabel('View name').fill('Morning capacity');
    await saveDialog.getByRole('button', { name: 'Save view' }).click();
    await expect(page.getByTestId('routing-active-summary-view')).toHaveText('Morning capacity');

    await page
      .getByTestId('routing-route-summary-filter')
      .getByRole('button', { name: /All/i })
      .click();
    await setMapMode(page, 'Selected route');
    await expect(page.getByTestId('routing-active-summary-view')).toContainText('Modified');

    await page.getByTestId('routing-open-saved-views').click();
    const viewsDialog = page.getByTestId('routing-saved-views-dialog');
    const savedViewRow = viewsDialog.getByTestId('routing-saved-view-row').filter({ hasText: 'Morning capacity' });
    await savedViewRow.getByRole('button', { name: 'Apply' }).click();
    await expect(attentionFilter).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('routing-map-mode-state')).toHaveText('Map view: All routes');
    await expect(page.getByTestId(`${firstSummaryTestId}-column-weight`)).toBeVisible();
    await expect(page.getByTestId(`${firstSummaryTestId}-column-driver`)).toHaveCount(0);

    await page.getByTestId('routing-open-saved-views').click();
    const rowToRename = viewsDialog.getByTestId('routing-saved-view-row').first();
    await rowToRename.getByRole('button', { name: 'Rename' }).click();
    await rowToRename.getByLabel('View name').fill('AM capacity');
    await rowToRename.getByRole('button', { name: 'Save name' }).click();
    await expect(viewsDialog.getByText('AM capacity', { exact: true })).toBeVisible();
    await viewsDialog.getByRole('button', { name: 'Close' }).click();

    await page.evaluate(() => {
      window.sessionStorage.setItem('trovan-preserve-routing-preferences', 'true');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('routing-workspace-page')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('routing-active-summary-view')).toHaveText('AM capacity');
    await expect(page.getByTestId(`${firstSummaryTestId}-column-weight`)).toBeVisible();

    await page.getByTestId('routing-open-saved-views').click();
    const rowToDelete = page
      .getByTestId('routing-saved-views-dialog')
      .getByTestId('routing-saved-view-row')
      .filter({ hasText: 'AM capacity' });
    await rowToDelete.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByTestId('routing-saved-views-dialog').getByText('AM capacity', { exact: true }))
      .toHaveCount(0);
  });

  test('compact routing view keeps jobs and best-fit recommendations accessible', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await gotoRoutingWorkspace(page, testInfo, 'dense-route-day');

    await page.getByRole('button', { name: 'Jobs', exact: true }).click();
    await expect(page.getByText('Draft job selection')).toBeVisible();
    await page.getByTestId('routing-resolve-unassigned-button').click();
    await expect(page.getByTestId('routing-mobile-best-fit-0')).toContainText(/Best fit/i);
    await page.getByTestId('routing-mobile-insert-recommended-0').click();
    await expect(page.getByTestId('routing-action-notice')).toContainText(/inserted into/i);

    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(widths.content).toBeLessThanOrEqual(widths.viewport);
  });

  test('compact route summaries keep saved views and column controls accessible without overflow', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await gotoRoutingWorkspace(page, testInfo, 'dense-route-day');

    await page.getByRole('button', { name: 'Routes', exact: true }).click();
    await expect(page.getByTestId('routing-route-summaries-panel')).toBeVisible();
    await expect(page.getByTestId('routing-open-saved-views')).toBeVisible();
    await expect(page.getByTestId('routing-open-summary-columns')).toBeVisible();

    await page.getByTestId('routing-open-summary-columns').click();
    await expect(page.getByTestId('routing-summary-columns-dialog')).toBeVisible();
    await page.getByTestId('routing-summary-columns-dialog').getByRole('button', { name: 'Done' }).click();

    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(widths.content).toBeLessThanOrEqual(widths.viewport);
  });

  test('tracking workspace compares planned and actual traces and replays recorded positions', async ({ page }) => {
    await useAuthenticatedSession(page);
    await page.goto('/tracking?workspaceMode=preview', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    await expect(page.getByText('Telemetry monitoring', { exact: true })).toBeVisible();
    await expect(page.getByText('Vehicles reporting', { exact: true })).toBeVisible();
    await expect(page.getByTestId('tracking-history-controls')).toContainText(
      'Preview telemetry · synthetic demo only',
    );
    await expect(page.locator('path.tracking-actual-trace')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Both' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: 'Refresh signals' }).click();
    await expect(page.getByRole('status')).toContainText('Signals checked at');

    await page.getByTestId('tracking-vehicle-veh-van-2').click();
    await expect(page.getByTestId('tracking-history-controls')).toContainText(
      'Anna Quinn',
    );
    await expect(page.getByTestId('tracking-history-controls')).toContainText(
      'Delayed',
    );

    await page.getByRole('button', { name: 'Actual' }).click();
    await expect(page.getByRole('button', { name: 'Actual' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: '1h' }).click();
    await expect(page.getByRole('button', { name: '1h' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const slider = page.getByRole('slider', { name: 'Replay position' });
    expect(Number(await slider.getAttribute('aria-valuemax'))).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Play replay' }).click();
    await expect(page.getByRole('button', { name: 'Pause replay' })).toBeVisible();
  });

  test('compact route lanes expose the same batch-move workflow without overflow', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await gotoRoutingWorkspace(page, testInfo, 'clean-route-day');
    await page.getByRole('button', { name: 'Routes', exact: true }).click();
    const { sourceLane, targetLane } = await findMovableLanePair(page);
    const movableRows = sourceLane.locator(
      '[data-testid="routing-compact-stop-row"][data-stop-locked="false"]',
    );
    expect(await movableRows.count()).toBeGreaterThan(0);
    const row = movableRows.first();
    await row.getByTestId('routing-stop-batch-checkbox').locator('input').check();

    const toolbar = page.getByTestId('routing-batch-move-toolbar');
    await expect(toolbar).toContainText('1 selected');
    expect(await toolbar.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(
        Math.round((rect.left + rect.right) / 2),
        Math.round((rect.top + rect.bottom) / 2),
      );
      return Boolean(hit && (hit === element || element.contains(hit)));
    })).toBe(true);
    const targetCount = Number(await targetLane.getAttribute('data-route-stop-count'));
    const targetLabel = await targetLane.locator('h6').first().innerText();
    await toolbar.getByRole('combobox', { name: 'Move selected to' }).click();
    await page.getByRole('option', {
      name: `${targetLabel} · ${targetCount} stops`,
    }).click();
    await toolbar.getByTestId('routing-batch-move-submit').click();
    await expect(page.getByTestId('routing-action-notice')).toContainText(
      `1 job (1 stop) moved into ${targetLabel}`,
    );

    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(widths.content).toBeLessThanOrEqual(widths.viewport);
  });

  test('route density mode renders observable map state and stop markers', async ({ page }, testInfo) => {
    await gotoRoutingWorkspace(page, testInfo, 'dense-route-day');

    await setMapMode(page, 'Selected route');
    await expect(page.getByTestId('routing-stop-marker').first()).toBeVisible();

    await setMapMode(page, 'Route density');
    await expect(page.getByTestId('routing-map-render-level')).toHaveAttribute('data-render-level', /overview|context|detail/);
    await expect(page.getByTestId('routing-stop-marker').first()).toBeVisible();
  });

  test('dense route lanes virtualize high-volume rows without losing visible stop identity', async ({ page }, testInfo) => {
    await gotoRoutingWorkspace(page, testInfo, 'dense-300-stop-day');
    await expandRouteLanes(page);

    const list = page.getByTestId('routing-virtualized-stop-list').first();
    await expect(list).toBeVisible();
    await expect(list).toHaveAttribute('data-virtualized', 'true');
    await expect(list).toHaveAttribute('data-total-stop-rows', /[1-9]\d*/);
    expect(await page.getByTestId('routing-compact-stop-row').count()).toBeGreaterThan(0);
    expect(await page.getByTestId('routing-compact-stop-row').count()).toBeLessThan(120);

    const firstRow = page.getByTestId('routing-compact-stop-row').first();
    await expect(firstRow).toContainText(/Cold Chain|Medical Supply|Produce|Bakery|Pharmacy/);
    await firstRow.click();
    await expect(firstRow).toHaveAttribute('data-stop-selected', 'true');
  });

  test('lane editor collapsed, expanded, and full-screen states use clear labels', async ({ page }, testInfo) => {
    await gotoRoutingWorkspace(page, testInfo, 'dense-route-day');
    const laneEditor = page.getByTestId('routing-lane-editor').first();

    await expect(laneEditor).toHaveAttribute('data-lane-editor-state', 'expanded');
    await expect(page.getByTestId('routing-lane-editor-collapse').first()).toBeVisible();
    await expect(page.getByTestId('routing-lane-editor-fullscreen').first()).toHaveAccessibleName(/Full screen route lanes/i);

    await page.getByTestId('routing-lane-editor-collapse').first().click();
    await expect(laneEditor).toHaveAttribute('data-lane-editor-state', 'collapsed');
    await expect(page.getByTestId('routing-lane-editor-expand-from-collapsed')).toHaveText(/Expand route lanes/);

    await page.getByTestId('routing-lane-editor-expand-from-collapsed').click();
    await expect(laneEditor).toHaveAttribute('data-lane-editor-state', 'expanded');

    await page.getByRole('button', { name: /Full screen route lanes/i }).click();
    await expect(page.locator('[data-testid="routing-lane-editor"][data-lane-editor-state="fullscreen"]')).toBeVisible();
    await page.getByRole('button', { name: /Exit full-screen route lanes/i }).click();
    await expect(page.locator('[data-testid="routing-lane-editor"][data-lane-editor-state="fullscreen"]')).toHaveCount(0);
  });

  test('selecting an available route focuses the map, route lane, timeline, and inspector', async ({ page }, testInfo) => {
    await gotoRoutingWorkspace(page, testInfo, 'dense-route-day');
    const { laneId } = await selectFirstRouteLane(page);

    await expect(page.locator('[data-route-lane-focus="selected"]').first()).toBeVisible();
    await expect(page.getByTestId('routing-route-timeline-strip')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Open .+ stop 1:/ }).first(),
    ).toBeVisible();
    await expect(page.getByTestId('routing-route-summaries-panel')).toBeVisible();
    if (laneId) {
      await expect(page.getByTestId('routing-workspace-page')).toHaveAttribute('data-selected-route-id', laneId);
    }
  });

  test('driver assignment shows evidence-backed route familiarity', async ({ page }, testInfo) => {
    await gotoRoutingWorkspace(page, testInfo, 'dense-route-day');
    await selectFirstRouteLane(page);

    await page.getByRole('button', { name: 'Driver', exact: true }).click();
    const familiarity = page.getByTestId('routing-driver-familiarity');
    await expect(familiarity).toContainText('Driver familiarity');
    await expect(familiarity).toContainText('Best history match');
    await expect(familiarity).toContainText(/completed routes/);
    await expect(familiarity).toContainText('Preview sample');
    await expect(familiarity.locator('[aria-label$="of 3 familiarity bars"]')).toHaveCount(1);
    const applyRecommendation = page.getByTestId('routing-apply-familiar-driver');
    if (await applyRecommendation.count()) {
      await applyRecommendation.click();
      await expect(familiarity).toContainText('Recommended driver assigned');
    }
    const familiarityBounds = await familiarity.boundingBox();
    const viewport = page.viewportSize();
    expect(familiarityBounds).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (familiarityBounds && viewport) {
      expect(familiarityBounds.x + familiarityBounds.width).toBeLessThanOrEqual(viewport.width + 1);
    }

    await page.setViewportSize({ width: 1024, height: 900 });
    await page
      .getByTestId('routing-compact-panel-toggle')
      .getByRole('button', { name: 'Routes', exact: true })
      .click();
    await expect(familiarity).toBeVisible();
    const compactOverflow = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      pageWidth: document.documentElement.scrollWidth,
    }));
    expect(compactOverflow.pageWidth).toBeLessThanOrEqual(compactOverflow.viewportWidth + 1);
  });

  test('selected-route map mode keeps selected route details and summarizes render level', async ({ page }, testInfo) => {
    await gotoRoutingWorkspace(page, testInfo, 'dense-route-day');
    await selectFirstRouteLane(page);
    await setMapMode(page, 'Selected route');

    await expect(page.getByTestId('routing-map-render-level')).toHaveAttribute('data-render-level', /overview|context|detail/);
    await expect(page.getByTestId('routing-stop-marker').first()).toBeVisible();
    await expect(page.getByTestId('routing-route-timeline-strip')).toBeVisible();
  });

  test('all-routes and exceptions-only map modes expose observable state without hardcoded routes', async ({ page }, testInfo) => {
    await gotoRoutingWorkspace(page, testInfo, 'dense-route-day');

    await setMapMode(page, 'All routes');
    await expect(page.getByTestId('routing-route-timeline-strip')).toContainText('All routes');
    expect(await page.locator('[data-testid^="routing-route-timeline-group-"]').count()).toBeGreaterThan(1);

    await setMapMode(page, 'Exceptions only');
    await expect(page.getByTestId('routing-map-render-level')).toHaveAttribute('data-render-level', /overview|context|detail/);
    await expect(page.getByTestId('routing-stop-marker').first()).toBeVisible();
  });

  test('job, route, driver, and vehicle filters narrow current routing content', async ({ page }, testInfo) => {
    await gotoRoutingWorkspace(page, testInfo, 'dense-route-day');

    await expect(page.getByTestId('routing-planning-unassigned-panel')).toBeVisible();
    await expect(page.getByTestId('routing-planning-unassigned-panel').getByRole('button', { name: /^Filters$/ })).toBeVisible();
    await expect(page.getByTestId('routing-route-summaries-panel')).toContainText(/RT-|Route Summaries/i);
    await setMapMode(page, 'All routes');
    await expect(page.getByTestId('routing-route-timeline-strip')).toContainText('All routes');
  });

  test('selected stop actions remain available without repeating lock text on every row', async ({ page }, testInfo) => {
    await gotoRoutingWorkspace(page, testInfo, 'dense-route-day');
    await expandRouteLanes(page);

    const rowCount = await page.getByTestId('routing-compact-stop-row').count();
    const lockTextCount = await page.getByText(/\bLock\b|\bLocked\b/i).count();
    expect(rowCount).toBeGreaterThan(0);
    expect(lockTextCount).toBeLessThan(8);

    await page.getByTestId('routing-compact-stop-row').first().click();
    await expect(page.getByTestId('routing-compact-stop-row').first()).toHaveAttribute('data-stop-selected', 'true');
  });

  test('route lane reorder and cross-lane move update totals, inspector, and map through accessible controls', async ({ page }, testInfo) => {
    await gotoRoutingWorkspace(page, testInfo, 'clean-route-day');
    const {
      sourceLane,
      targetLane,
      movableRow,
      sourceLaneId,
      targetLaneId,
    } = await findMovableLanePair(page);
    await expect(sourceLane).toBeVisible();
    await expect(targetLane).toBeVisible();

    const sourceCountBefore = Number(await sourceLane.getAttribute('data-route-stop-count'));
    const targetCountBefore = Number(await targetLane.getAttribute('data-route-stop-count'));
    const sourceRoutePathBefore = await routeLinePath(page, sourceLaneId);
    const movedStopId = await movableRow.getAttribute('data-stop-id');
    const movedStopOrderBefore = Number(await movableRow.getAttribute('data-stop-order'));

    await movableRow.getByRole('button', { name: /Move stop down/i }).click();
    const reorderedRow = sourceLane.locator(`[data-stop-id="${movedStopId}"]`);
    await expect(reorderedRow).toHaveAttribute('data-stop-order', String(movedStopOrderBefore + 1));
    await expect(sourceLane).toHaveAttribute('data-route-stop-count', String(sourceCountBefore));
    await expect(page.getByTestId('routing-workspace-page')).toHaveAttribute('data-selected-route-id', sourceLaneId);
    await expect.poll(() => routeLinePath(page, sourceLaneId)).not.toBe(sourceRoutePathBefore);

    const targetRoutePathBefore = await routeLinePath(page, targetLaneId);
    await reorderedRow.getByRole('button', { name: /Move stop to next route/i }).click();
    await expect(sourceLane).toHaveAttribute('data-route-stop-count', String(sourceCountBefore - 1));
    await expect(targetLane).toHaveAttribute('data-route-stop-count', String(targetCountBefore + 1));
    await expect(page.getByTestId('routing-workspace-page')).toHaveAttribute('data-selected-route-id', targetLaneId);
    await expect(targetLane.locator(`[data-stop-id="${movedStopId}"]`)).toBeVisible();
    await expect.poll(() => routeLinePath(page, targetLaneId)).not.toBe(targetRoutePathBefore);
  });

  test('batch route editing moves multiple selected stops with one constraint-checked action', async ({ page }, testInfo) => {
    await gotoRoutingWorkspace(page, testInfo, 'dense-route-day');
    const { sourceLane, targetLane, targetLaneId } = await findMovableLanePair(page);
    const movableRows = sourceLane.locator(
      '[data-testid="routing-compact-stop-row"][data-stop-locked="false"]',
    );
    const movableCount = await movableRows.count();
    expect(movableCount).toBeGreaterThan(1);

    const sourceCountBefore = Number(await sourceLane.getAttribute('data-route-stop-count'));
    const targetCountBefore = Number(await targetLane.getAttribute('data-route-stop-count'));
    const firstRow = movableRows.nth(0);
    const secondRow = movableRows.nth(1);
    const firstStopId = await firstRow.getAttribute('data-stop-id');
    const secondStopId = await secondRow.getAttribute('data-stop-id');

    await firstRow.getByTestId('routing-stop-batch-checkbox').locator('input').check();
    await secondRow.getByTestId('routing-stop-batch-checkbox').locator('input').check();
    await expect(firstRow).toHaveAttribute('data-stop-batch-selected', 'true');
    await expect(secondRow).toHaveAttribute('data-stop-batch-selected', 'true');

    const toolbar = page.getByTestId('routing-batch-move-toolbar');
    await expect(toolbar).toContainText('2 selected');
    expect(await toolbar.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(
        Math.round((rect.left + rect.right) / 2),
        Math.round((rect.top + rect.bottom) / 2),
      );
      return Boolean(hit && (hit === element || element.contains(hit)));
    })).toBe(true);
    const targetLabel = await targetLane.locator('h6').first().innerText();
    await toolbar.getByRole('combobox', { name: 'Move selected to' }).click();
    await page.getByRole('option', {
      name: `${targetLabel} · ${targetCountBefore} stops`,
    }).click();
    await toolbar.getByTestId('routing-batch-move-submit').click();

    await expect(page.getByTestId('routing-action-notice')).toContainText(
      `2 jobs (2 stops) moved into ${targetLabel}`,
    );
    await expect(sourceLane).toHaveAttribute(
      'data-route-stop-count',
      String(sourceCountBefore - 2),
    );
    await expect(targetLane).toHaveAttribute(
      'data-route-stop-count',
      String(targetCountBefore + 2),
    );
    await expect(page.getByTestId('routing-workspace-page')).toHaveAttribute(
      'data-selected-route-id',
      targetLaneId,
    );
    await expect(targetLane.locator(`[data-stop-id="${firstStopId}"]`)).toBeVisible();
    await expect(targetLane.locator(`[data-stop-id="${secondStopId}"]`)).toBeVisible();
    await expect(page.getByTestId('routing-batch-move-toolbar')).toHaveCount(0);
  });

  test('primary action respects current draft blockers before publishing', async ({ page }, testInfo) => {
    await gotoRoutingWorkspace(page, testInfo, 'setup-route-day');
    await expect(page.getByTestId('routing-generate-draft-button')).toHaveText(/Generate route draft/i);
    await expect(page.getByTestId('routing-publish-button')).toHaveCount(0);

    await gotoRoutingWorkspace(page, testInfo, 'dense-route-day');
    await expect(page.getByTestId('routing-resolve-unassigned-button')).toBeVisible();
    await expect(page.getByTestId('routing-publish-button')).toHaveCount(0);
    await page.getByTestId('routing-resolve-unassigned-button').click();
    await expect(page.getByTestId('routing-planning-unassigned-panel')).toBeVisible();

    await gotoRoutingWorkspace(page, testInfo, 'clean-route-day');
    await expect(page.getByTestId('routing-publish-button')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Optimize Routes$/ })).toBeVisible();
    await expect(page.getByTestId('routing-draft-refresh-button')).toBeVisible();
  });

  test('production capability gates hide local-only exception decisions and durable handoff controls', async ({ page }, testInfo) => {
    await gotoRoutingWorkspace(page, testInfo, 'exception-route-day', { capabilities: 'off' });

    await page.getByTestId('routing-review-exceptions-button').click();
    const drawer = page.getByTestId('routing-exception-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('button', { name: /^Resolve exception$/ })).toHaveCount(0);
    await expect(drawer.getByRole('button', { name: /^Accept risk$/ })).toHaveCount(0);

    await gotoRoutingWorkspace(page, testInfo, 'clean-route-day', { capabilities: 'off' });
    await expect(page.getByTestId('routing-draft-refresh-button')).toBeVisible();
    await page.getByTestId('routing-publish-button').click();
    await page.getByTestId('routing-publish-summary-dialog').getByRole('button', { name: /^Confirm publish$/ }).click();
    await expect(page.getByTestId('routing-published-summary')).toBeVisible();
    await expect(page.getByTestId('routing-dispatch-handoff')).toHaveCount(0);
    await expect(page.getByTestId('routing-workspace-page')).not.toHaveAttribute('data-route-version', /./);
  });

  test('capability-enabled workspace shows exception decisions and durable publish controls explicitly', async ({ page }, testInfo) => {
    await gotoRoutingWorkspace(page, testInfo, 'exception-route-day', { capabilities: 'on' });
    await page.getByTestId('routing-review-exceptions-button').click();
    const drawer = page.getByTestId('routing-exception-drawer');
    await expect(drawer.getByRole('button', { name: /^Resolve exception$/ }).first()).toBeVisible();
    await expect(drawer.getByRole('button', { name: /^Accept risk$/ }).first()).toBeVisible();

    await gotoRoutingWorkspace(page, testInfo, 'clean-route-day', { capabilities: 'on' });
    await expect(page.getByTestId('routing-publish-button')).toBeVisible();
    await page.getByTestId('routing-publish-button').click();
    await expect(page.getByTestId('routing-publish-readiness-alert')).toBeVisible();
    await expect(page.getByTestId('routing-warnings-toggle')).toHaveText(/Hide/i);
  });

  test('production mode blocks preview scenario and failure query states behind auth protection', async ({ page }, testInfo) => {
    await gotoRoutingWorkspace(page, testInfo, 'loading-route-day', { workspaceMode: 'production', failure: 'optimizer' }, false);

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: /^Welcome back$/ })).toBeVisible();
    await expect(page.getByTestId('routing-workspace-page')).toHaveCount(0);
    await expect(page.getByText(/Loading route workspace/i)).toHaveCount(0);
  });

  test('publish plan confirms handoff summary then locks lanes and records route version', async ({ page }, testInfo) => {
    await gotoRoutingWorkspace(page, testInfo, 'clean-route-day');

    await page.getByTestId('routing-publish-button').click();
    await expect(page.getByTestId('routing-publish-readiness-alert')).toBeVisible();
    await expect(page.getByTestId('routing-warnings-toggle')).toHaveText(/Hide/i);

    await expandRouteLanes(page);
    await expect(page.getByTestId('routing-lane-editor')).toHaveAttribute('data-read-only', 'false');
  });

  test('exception drawer resolves and accepts route blockers before publish is available', async ({ page }, testInfo) => {
    await gotoRoutingWorkspace(page, testInfo, 'exception-route-day');

    await expect(page.getByTestId('routing-review-exceptions-button')).toBeVisible();
    await expect(page.getByTestId('routing-publish-button')).toHaveCount(0);

    await page.getByTestId('routing-review-exceptions-button').click();
    const drawer = page.getByTestId('routing-exception-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId('routing-exception-severity-blocking')).toBeVisible();

    const routeException = await findRouteExceptionCard(drawer);
    await routeException.card.getByRole('button', { name: /Jump to affected route/i }).click();
    await expect(page.getByTestId('routing-workspace-page')).toHaveAttribute('data-selected-route-id', routeException.routeId);

    await routeException.card.getByRole('button', { name: /^Resolve exception$/ }).click();
    await expect(routeException.card).toContainText('Resolved');

    const riskException = await findRiskAcceptanceCard(drawer);
    await riskException.reason.fill('Customer confirmed the dock can receive after the window.');
    await expect(riskException.acceptRisk).toBeEnabled();
    await riskException.acceptRisk.click();
    await expect(riskException.card).toContainText('Accepted risk');

    await drawer.getByRole('button', { name: /^Assign driver$/ }).first().click();
    await drawer.getByRole('button', { name: /^Assign vehicle$/ }).first().click();

    await expect(drawer.getByText(/Resolved|Accepted risk/).first()).toBeVisible();
  });

  test('dense Denver scenario uses miles and current readable route-day data', async ({ page }, testInfo) => {
    await gotoRoutingWorkspace(page, testInfo, 'dense-route-day');

    await expect(page.getByTestId('routing-planning-kpis')).toContainText(/Total Miles/i);
    await expect(page.getByTestId('routing-planning-unassigned-panel')).toContainText(/Unassigned Jobs/i);
    await expect(page.getByTestId('routing-route-summaries-panel')).toContainText(/Route Summaries/i);
    await expect(page.getByText(/\bmi\b/i).first()).toBeVisible();
    await expect(page.getByText(/\bkm\b/i)).toHaveCount(0);
    await expect(page.getByText('Route Planning & Optimization').first()).toBeVisible();
  });

  test('routing workspace restores user-scoped planning preferences without route selections', async ({ page }, testInfo) => {
    await gotoRoutingWorkspace(page, testInfo, 'dense-route-day');

    await setMapMode(page, 'All routes');
    await page.getByTestId('routing-lane-editor-collapse').first().click();
    await expect(page.getByTestId('routing-lane-editor')).toHaveAttribute('data-lane-editor-state', 'collapsed');
    await page.getByTestId('routing-lane-editor-expand-from-collapsed').click();
    await expect(page.getByTestId('routing-lane-editor')).toHaveAttribute('data-lane-editor-state', 'expanded');

    const selectedRouteBeforeReload = await page.getByTestId('routing-workspace-page').getAttribute('data-selected-route-id');

    await page.evaluate(() => {
      window.sessionStorage.setItem('trovan-preserve-routing-preferences', 'true');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('routing-workspace-page')).toBeVisible({ timeout: 20_000 });

    await expect(page.getByTestId('routing-map-mode-state')).toBeVisible();
    await expect(page.getByTestId('routing-lane-editor')).toBeVisible();
    await expect(page.getByText(/\bmi\b/i).first()).toBeVisible();

    const storedPreferencePayloads = await page.evaluate(() =>
      Object.entries(window.localStorage)
        .filter(([key]) => key.startsWith('trovan-routing-workspace-preferences:v3:'))
        .map(([, value]) => value),
    );
    expect(storedPreferencePayloads.length).toBeGreaterThan(0);
    for (const payload of storedPreferencePayloads) {
      expect(payload).not.toContain('selectedGroupId');
      expect(payload).not.toContain('selectedStopId');
      expect(payload).not.toContain('serviceDate');
      expect(payload).not.toContain('routeFilterId');
    }

    await page.evaluate(() => {
      window.sessionStorage.setItem('trovan-preserve-preview-auth-user', 'true');
      window.localStorage.setItem(
        'trovan-preview-auth-user',
        JSON.stringify({
          id: 'different-user',
          email: 'different@trovan.local',
          role: 'dispatcher',
          roles: ['DISPATCHER'],
          organizationId: 'different-org',
          sessionId: 'different-session',
        }),
      );
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('routing-workspace-page')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /^Selected route$/ })).toHaveAttribute('aria-pressed', 'true');

    const selectedRouteAfterTenantChange = await page.getByTestId('routing-workspace-page').getAttribute('data-selected-route-id');
    expect(selectedRouteAfterTenantChange).toBeTruthy();
    expect(selectedRouteAfterTenantChange).toBe(selectedRouteBeforeReload);
  });
});
