import { expect, test, type Page } from '@playwright/test';

async function gotoRoutingWorkspace(
  page: Page,
  scenario?:
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
    | 'stale-route-data',
  extraParams: Record<string, string> = {},
  waitForWorkspace = true,
) {
  await page.addInitScript(() => {
    window.localStorage.setItem('authToken', 'preview-auth-bypass');
    if (!window.localStorage.getItem('trovan-preview-auth-user')) {
      window.localStorage.setItem('trovan-preview-auth-user', JSON.stringify({
        id: 'product-ui-dispatcher',
        email: 'dispatcher@trovan.local',
        role: 'dispatcher',
        roles: ['DISPATCHER'],
        organizationId: 'product-ui-org',
        sessionId: 'product-ui-session',
      }));
    }
  });
  const params = new URLSearchParams({ serviceDate: '2026-06-03' });
  if (scenario) params.set('scenario', scenario);
  for (const [key, value] of Object.entries(extraParams)) {
    params.set(key, value);
  }
  const path = `/routing?${params.toString()}`;
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  if (!waitForWorkspace) return;
  await expect(page.getByTestId('routing-workspace-page')).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {});
  await expect(page.getByText(/Workspace Failed To Render/i)).toHaveCount(0);
}

async function chooseFilterOption(
  page: Page,
  panelTestId: string,
  label: string,
  option: string | RegExp,
) {
  await page
    .getByTestId(panelTestId)
    .getByRole('combobox', { name: new RegExp(`^${label}\\b`) })
    .click();
  await page.getByRole('option', { name: option }).click();
}

async function visibleCount(page: Page, selector: string) {
  const locator = page.locator(selector);
  const count = await locator.count();
  let visible = 0;
  for (let index = 0; index < count; index += 1) {
    if (await locator.nth(index).isVisible().catch(() => false)) {
      visible += 1;
    }
  }
  return visible;
}

async function routeLinePath(page: Page, routeId: string) {
  return page
    .locator(`path.route-line-${routeId}`)
    .first()
    .getAttribute('d');
}

test.describe('routing workspace product UI', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test('production route-day states cover loading, empty data, resource gaps, stale data, geocode issues, and offline work', async ({ page }) => {
    await gotoRoutingWorkspace(page, 'loading-route-day', {}, false);
    await expect(page.getByTestId('routing-loading-skeleton')).toBeVisible();
    await expect(page.getByText(/Loading route workspace/i)).toBeVisible();

    await gotoRoutingWorkspace(page, 'empty-route-day');
    await expect(page.getByTestId('routing-empty-route-day-state')).toContainText('No route day loaded');
    await expect(page.getByTestId('routing-empty-route-day-state')).toContainText(/Import jobs/i);
    await expect(page.getByTestId('routing-map-panel')).toContainText('No route lanes to display');

    await gotoRoutingWorkspace(page, 'no-vehicles');
    await expect(page.getByTestId('routing-no-vehicles-state')).toContainText('No vehicles available');
    await expect(page.getByTestId('routing-generate-draft-button')).toBeDisabled();

    await gotoRoutingWorkspace(page, 'no-drivers');
    await expect(page.getByTestId('routing-no-drivers-state')).toContainText('No drivers available');
    await expect(page.getByTestId('routing-route-day-summary')).toContainText(/Review exceptions|Needs review/);

    await gotoRoutingWorkspace(page, 'geocode-failure');
    await expect(page.getByTestId('routing-geocode-failure-warning')).toContainText(/Address issue/i);
    await expect(page.getByTestId('routing-geocode-failure-warning')).toContainText(/coordinates/i);

    await gotoRoutingWorkspace(page, 'stale-route-data');
    await expect(page.getByTestId('routing-stale-data-warning')).toContainText(/Route data may be stale/i);

    await gotoRoutingWorkspace(page, 'clean-route-day');
    await page.context().setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.getByTestId('routing-offline-warning')).toContainText(/Offline/i);
    await page.context().setOffline(false);
  });

  test('route workspace action failures are actionable instead of silent', async ({ page }) => {
    await gotoRoutingWorkspace(page, 'setup-route-day', { failure: 'optimizer' });
    await page.getByTestId('routing-generate-draft-button').click();
    await expect(page.getByTestId('routing-error-alert')).toContainText(/Optimizer failed/i);
    await expect(page.getByTestId('routing-error-alert')).toContainText(/constraints/i);

    await gotoRoutingWorkspace(page, 'clean-route-day', { failure: 'save-draft' });
    await page.getByRole('button', { name: /^Save draft$/ }).click();
    await expect(page.getByTestId('routing-error-alert')).toContainText(/Save draft failed/i);
    await expect(page.getByTestId('routing-error-alert')).toContainText(/not saved/i);

    await gotoRoutingWorkspace(page, 'clean-route-day', { failure: 'publish' });
    await page.getByTestId('routing-publish-button').click();
    const dialog = page.getByTestId('routing-publish-summary-dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /^Confirm publish$/ }).click();
    await expect(page.getByTestId('routing-error-alert')).toContainText(/Publish failed/i);
    await expect(page.getByTestId('routing-error-alert')).toContainText(/Dispatch handoff/i);
    await expect(page.getByTestId('routing-dispatch-handoff')).toHaveCount(0);
  });

  test('Jobs, Routes, and Vehicles tabs switch with tab-specific filter bodies', async ({ page }) => {
    await gotoRoutingWorkspace(page, 'dense-route-day');

    await expect(page.getByRole('button', { name: /^Jobs$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Routes$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Vehicles$/ })).toBeVisible();

    await page.getByRole('button', { name: /^Jobs$/ }).click();
    await expect(page.getByTestId('routing-job-filter-panel')).toBeVisible();
    await expect(page.getByText(/^Unassigned jobs$/)).toBeVisible();
    await expect(page.getByTestId('routing-route-filter-panel')).toHaveCount(0);

    await page.getByRole('button', { name: /^Routes$/ }).click();
    await expect(page.getByTestId('routing-route-filter-panel')).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Routes$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Ready$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Needs driver$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Needs vehicle$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Has exceptions$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Has unassigned$/ })).toBeVisible();
    await expect(page.getByTestId('routing-job-filter-panel')).toHaveCount(0);
    await expect(page.getByLabel(/^Search stops$/)).toHaveCount(0);
    await expect(page.getByLabel(/^Stop filters$/)).toHaveCount(0);

    await page.getByRole('button', { name: /^Vehicles$/ }).click();
    await expect(page.getByTestId('routing-vehicle-filter-panel')).toBeVisible();
    await expect(page.getByText(/^Vehicle list$/)).toBeVisible();
    await expect(page.getByText(/^Unassigned jobs$/)).toHaveCount(0);
  });

  test('compact density renders stop identity and issue indicators instead of heavy cards', async ({ page }) => {
    await gotoRoutingWorkspace(page, 'dense-route-day');

    await page.getByRole('button', { name: /^Comfortable$/ }).click();
    await expect(page.getByTestId('routing-stop-card').first()).toBeVisible();
    await expect(page.getByTestId('routing-compact-stop-row')).toHaveCount(0);

    await page.getByRole('button', { name: /^Compact$/ }).click();
    const firstRow = page.getByTestId('routing-compact-stop-row').first();
    await expect(firstRow).toBeVisible();
    await expect(firstRow).toContainText(/Cold Chain|Medical Supply|Produce|Bakery|Pharmacy/);
    await expect(firstRow).toContainText(/Boulder|Broomfield|Westminster|Denver|Aurora/);
    await expect(page.getByTestId('routing-stop-card')).toHaveCount(0);
  });

  test('compact route lanes virtualize dense 300-stop rows without losing visible stop identity', async ({ page }) => {
    await gotoRoutingWorkspace(page, 'dense-300-stop-day');
    await page.getByRole('button', { name: /^Compact$/ }).click();

    await expect(page.getByTestId('routing-route-day-summary')).toContainText('300 routed');
    await expect(page.getByTestId('routing-virtualized-stop-list').first()).toBeVisible();
    await expect(page.getByTestId('routing-virtualized-stop-list').first()).toHaveAttribute('data-virtualized', 'true');

    const renderedRows = await page.getByTestId('routing-compact-stop-row').count();
    expect(renderedRows).toBeGreaterThan(0);
    expect(renderedRows).toBeLessThan(120);

    const firstRow = page.getByTestId('routing-compact-stop-row').first();
    await expect(firstRow).toContainText(/Cold Chain|Medical Supply|Produce|Bakery|Pharmacy/);
    await expect(firstRow).toContainText(/Boulder|Broomfield|Westminster|Denver|Aurora/);

    await firstRow.click();
    await expect(firstRow).toHaveAttribute('data-stop-selected', 'true');
    await expect(page.locator('[data-testid="routing-compact-stop-row"] [aria-label="Protected stop"]').first()).toBeVisible();

    const list = page.getByTestId('routing-virtualized-stop-list').first();
    await list.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    await expect(page.getByTestId('routing-compact-stop-row').first()).toBeVisible();
    expect(await page.getByTestId('routing-compact-stop-row').count()).toBeLessThan(120);
  });

  test('lane editor collapsed, expanded, and full-screen states use clear labels', async ({ page }) => {
    await gotoRoutingWorkspace(page, 'dense-route-day');
    const laneEditor = page.getByTestId('routing-lane-editor').first();

    await page.getByTestId('routing-lane-editor-collapse').first().click();
    await expect(laneEditor).toHaveAttribute('data-lane-editor-state', 'collapsed');
    await expect(page.getByTestId('routing-lane-editor-expand-from-collapsed')).toBeVisible();
    await expect(page.getByTestId('routing-lane-editor-expand-from-collapsed')).toHaveText(/Expand route lanes/);

    await page.getByTestId('routing-lane-editor-expand-from-collapsed').click();
    await expect(laneEditor).toHaveAttribute('data-lane-editor-state', 'expanded');

    await page.getByTestId('routing-lane-editor-fullscreen').first().click();
    await expect(page.locator('[data-testid="routing-lane-editor"][data-lane-editor-state="fullscreen"]')).toBeVisible();
  });

  test('selecting a route focuses the map, simplifies unrelated routes, and updates inspector', async ({ page }) => {
    await gotoRoutingWorkspace(page, 'dense-route-day');
    await page.getByRole('button', { name: /^Compact$/ }).click();
    await expect(page.getByTestId('routing-map-mode-toggle')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Selected route$/ })).toHaveAttribute('aria-pressed', 'true');

    const routeLanes = page.locator('[data-testid^="routing-route-lane-"]');
    await expect(routeLanes.nth(2)).toBeVisible();
    await routeLanes.nth(2).click();

    await expect(page.getByTestId('routing-workspace-page')).toHaveAttribute('data-selected-route-id', /dense-route-/);
    await expect(page.locator('[data-route-lane-focus="selected"]').first()).toBeVisible();
    expect(await visibleCount(page, '[data-route-lane-focus="muted"]')).toBeGreaterThan(0);

    await expect(page.locator('path.trovan-route-line.is-selected')).toHaveCount(1);
    expect(await page.locator('path.trovan-route-line.is-simplified').count()).toBeGreaterThan(0);

    const selectedStroke = Number(
      await page.locator('path.trovan-route-line.is-selected').first().getAttribute('stroke-width'),
    );
    const simplifiedOpacity = Number(
      await page.locator('path.trovan-route-line.is-simplified').first().getAttribute('stroke-opacity'),
    );
    expect(selectedStroke).toBeGreaterThan(3);
    expect(simplifiedOpacity).toBeLessThan(0.2);

    await expect(page.getByTestId('routing-route-readiness-summary')).toBeVisible();
    for (const label of ['Status', 'Stops', 'Distance', 'Driver', 'Vehicle', 'Unassigned impact', 'Next action']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });

  test('dense selected-route map declutters unrelated routes into clusters', async ({ page }) => {
    await gotoRoutingWorkspace(page, 'dense-route-day');
    await page.getByRole('button', { name: /^Compact$/ }).click();

    const routeLanes = page.locator('[data-testid^="routing-route-lane-"]');
    await expect(routeLanes.nth(2)).toBeVisible();
    await routeLanes.nth(2).click();

    await expect(page.getByRole('button', { name: /^Selected route$/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-testid="routing-map-render-level"]')).toHaveAttribute('data-render-level', /overview|context/);
    await expect(page.locator('[data-testid="routing-route-cluster-marker"]').first()).toBeVisible();

    const selectedMarkers = await page.locator('[data-testid="routing-stop-marker"][data-route-focus="selected"]').count();
    const mutedNormalMarkers = await page.locator('[data-testid="routing-stop-marker"][data-route-focus="muted"][data-stop-importance="normal"]').count();
    const exceptionMarkers = await page.locator('[data-testid="routing-exception-marker"]').count();

    expect(selectedMarkers).toBeGreaterThanOrEqual(15);
    expect(mutedNormalMarkers).toBe(0);
    expect(exceptionMarkers).toBeGreaterThan(0);
    expect(await page.locator('[data-testid="routing-stop-marker"]').count()).toBeLessThanOrEqual(40);
  });

  test('dense map modes cluster low-zoom all-routes views and preserve detail at high zoom', async ({ page }) => {
    await gotoRoutingWorkspace(page, 'dense-route-day');

    await page.getByRole('button', { name: /^All routes$/ }).click();
    await expect(page.getByRole('button', { name: /^All routes$/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-testid="routing-route-cluster-marker"]').first()).toBeVisible();
    expect(await page.locator('[data-testid="routing-stop-marker"]').count()).toBeLessThanOrEqual(40);

    await page.getByRole('button', { name: /^Route density$/ }).click();
    await expect(page.getByRole('button', { name: /^Route density$/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-testid="routing-route-cluster-marker"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="routing-stop-marker"][data-stop-importance="normal"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="routing-exception-marker"]').first()).toBeVisible();

    await page.getByRole('button', { name: /^Exceptions only$/ }).click();
    await expect(page.getByRole('button', { name: /^Exceptions only$/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-testid="routing-exception-marker"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="routing-stop-marker"][data-stop-importance="normal"]')).toHaveCount(0);

    await page.getByRole('button', { name: /^Selected route$/ }).click();
    for (let index = 0; index < 8; index += 1) {
      await page.locator('.leaflet-control-zoom-in').click();
    }
    await expect(page.locator('[data-testid="routing-map-render-level"]')).toHaveAttribute('data-render-level', 'detail');
    await expect(page.locator('[data-testid="routing-stop-marker"][data-route-focus="selected"]').first()).toBeVisible();
  });

  test('job, route, driver, and vehicle filters narrow the correct tab content', async ({ page }) => {
    await gotoRoutingWorkspace(page, 'dense-route-day');
    await page.getByRole('button', { name: /^Compact$/ }).click();

    await page.getByRole('button', { name: /^Jobs$/ }).click();
    const initialJobs = await page.locator('[data-testid^="routing-job-row-"]').count();
    expect(initialJobs).toBeGreaterThan(20);
    await page.getByTestId('routing-job-search').getByRole('textbox').fill('Cold Chain');
    await expect(page.locator('[data-testid^="routing-job-row-"]').first()).toBeVisible();
    expect(await page.locator('[data-testid^="routing-job-row-"]').count()).toBeLessThan(initialJobs);

    const jobFilterPanel = page.getByTestId('routing-job-filter-panel');
    await jobFilterPanel.getByRole('button', { name: /^Unassigned$/ }).click();
    await expect(page.locator('[data-testid^="routing-job-row-"]').first()).toBeVisible();
    await page.getByTestId('routing-job-search').getByRole('textbox').fill('');

    await page.getByRole('button', { name: /^Routes$/ }).click();
    await expect(page.getByTestId('routing-route-filter-panel')).toBeVisible();
    await page.getByTestId('routing-route-search').getByRole('textbox').fill('DEN-111');
    await expect(page.locator('[data-testid^="routing-route-lane-"]')).toHaveCount(1);

    await page.getByTestId('routing-route-search').getByRole('textbox').fill('');
    await chooseFilterOption(page, 'routing-route-filter-panel', 'Driver', /Jon Reed/);
    await expect(page.locator('[data-testid^="routing-route-lane-"]')).toHaveCount(1);

    await chooseFilterOption(page, 'routing-route-filter-panel', 'Driver', /^All drivers$/);
    await chooseFilterOption(page, 'routing-route-filter-panel', 'Vehicle', /DEN-111/);
    await expect(page.locator('[data-testid^="routing-route-lane-"]')).toHaveCount(1);

    await page.getByRole('button', { name: /^Vehicles$/ }).click();
    await page.getByTestId('routing-vehicle-search').getByRole('textbox').fill('DEN-111');
    await expect(page.getByTestId('routing-vehicle-list-panel').getByText(/^DEN-111$/)).toBeVisible();
  });

  test('Lock text is not repeated on every compact row and selected stop actions remain available', async ({ page }) => {
    await gotoRoutingWorkspace(page, 'dense-route-day');
    await page.getByRole('button', { name: /^Compact$/ }).click();

    const rowCount = await page.getByTestId('routing-compact-stop-row').count();
    const lockTextCount = await page.getByText(/\bLock\b|\bLocked\b/i).count();
    expect(rowCount).toBeGreaterThan(20);
    expect(lockTextCount).toBeLessThan(8);

    await page.getByTestId('routing-compact-stop-row').first().click();
    await page.getByRole('button', { name: /^Stops$/ }).click();
    await expect(page.getByRole('button', { name: /Lock selected stop|Unlock selected stop/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Protect route order/i })).toBeVisible();
  });

  test('route lane reorder and cross-lane move update totals, inspector, and map through accessible controls', async ({ page }) => {
    await gotoRoutingWorkspace(page, 'clean-route-day');
    await page.getByRole('button', { name: /^Compact$/ }).click();

    const sourceLane = page.getByTestId('routing-route-lane-clean-route-1');
    const targetLane = page.getByTestId('routing-route-lane-clean-route-2');
    await expect(sourceLane).toHaveAttribute('data-route-stop-count', '15');
    await expect(targetLane).toHaveAttribute('data-route-stop-count', '15');

    const routeOnePathBefore = await routeLinePath(page, 'clean-route-1');
    const movableRow = sourceLane.locator('[data-testid="routing-compact-stop-row"][data-stop-locked="false"]').first();
    await expect(movableRow).toBeVisible();
    const movedStopId = await movableRow.getAttribute('data-stop-id');
    const movedStopOrderBefore = await movableRow.getAttribute('data-stop-order');
    await expect(movableRow.getByTestId('routing-stop-drag-handle')).toBeVisible();
    await expect(movableRow.getByRole('button', { name: /Move stop down/i })).toBeVisible();
    await expect(movableRow.getByRole('button', { name: /Move stop to next route/i })).toBeVisible();

    await movableRow.getByRole('button', { name: /Move stop down/i }).click();
    const reorderedRow = sourceLane.locator(`[data-stop-id="${movedStopId}"]`);
    await expect(reorderedRow).toHaveAttribute(
      'data-stop-order',
      String(Number(movedStopOrderBefore || '0') + 1),
    );
    await expect(sourceLane).toHaveAttribute('data-route-stop-count', '15');
    await expect(page.getByTestId('routing-workspace-page')).toHaveAttribute('data-selected-route-id', 'clean-route-1');
    await expect(page.getByTestId('routing-route-readiness-summary')).toContainText('15 sequenced');
    await expect
      .poll(() => routeLinePath(page, 'clean-route-1'))
      .not.toBe(routeOnePathBefore);

    const routeTwoPathBefore = await routeLinePath(page, 'clean-route-2');
    await reorderedRow.getByRole('button', { name: /Move stop to next route/i }).click();
    await expect(sourceLane).toHaveAttribute('data-route-stop-count', '14');
    await expect(targetLane).toHaveAttribute('data-route-stop-count', '16');
    await expect(page.getByTestId('routing-workspace-page')).toHaveAttribute('data-selected-route-id', 'clean-route-2');
    await expect(page.getByTestId('routing-route-readiness-summary')).toContainText('16 sequenced');
    await expect(targetLane.locator(`[data-stop-id="${movedStopId}"]`)).toBeVisible();
    await expect
      .poll(() => routeLinePath(page, 'clean-route-2'))
      .not.toBe(routeTwoPathBefore);

    const lockedRow = targetLane.locator('[data-testid="routing-compact-stop-row"][data-stop-locked="true"]').first();
    await expect(lockedRow).toBeVisible();
    await expect(lockedRow.getByTestId('routing-stop-drag-handle')).toHaveAttribute('aria-disabled', 'true');
    await expect(lockedRow.getByRole('button', { name: /Move stop up/i })).toBeDisabled();
    await expect(lockedRow.getByRole('button', { name: /Move stop to previous route/i })).toBeDisabled();
  });

  test('primary action respects draft blockers before publishing', async ({ page }) => {
    await gotoRoutingWorkspace(page, 'setup-route-day');

    await expect(page.getByTestId('routing-generate-draft-button')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Generate route draft$/ })).toBeVisible();
    await expect(page.getByTestId('routing-publish-button')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Manual setup$/ })).toBeVisible();

    await gotoRoutingWorkspace(page, 'dense-route-day');
    await expect(page.getByTestId('routing-resolve-unassigned-button')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Resolve unassigned$/ })).toBeVisible();
    await expect(page.getByTestId('routing-publish-button')).toHaveCount(0);
    await expect(page.getByTestId('routing-publish-summary-dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Publish partial plan$/ })).toHaveCount(0);
    await expect(page.getByTestId('routing-route-day-summary')).toContainText('Resolve unassigned');
    await expect(page.getByTestId('routing-route-day-summary')).not.toContainText(/Draft ready/i);
    await expect(page.getByTestId('routing-route-readiness-summary')).toContainText('Resolve unassigned');
    await expect(page.getByTestId('routing-readiness-alert').first()).toContainText(/unassigned jobs/i);

    await page.getByTestId('routing-resolve-unassigned-button').click();
    await expect(page.getByRole('button', { name: /^Jobs$/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('routing-job-filter-panel')).toBeVisible();

    await gotoRoutingWorkspace(page, 'clean-route-day');
    await expect(page.getByTestId('routing-publish-button')).toHaveCount(1);
    await expect(page.getByTestId('routing-route-day-summary')).toContainText('Ready to publish');
    await expect(page.getByRole('button', { name: /^Reoptimize plan$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Save draft$/ })).toBeVisible();
  });

  test('publish plan confirms handoff summary then locks lanes and records route version', async ({ page }) => {
    await gotoRoutingWorkspace(page, 'clean-route-day');

    await page.getByTestId('routing-publish-button').click();
    const dialog = page.getByTestId('routing-publish-summary-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /^Publish route plan$/ })).toBeVisible();
    await expect(dialog).toContainText('Routes');
    await expect(dialog).toContainText('8');
    await expect(dialog).toContainText('Routed stops');
    await expect(dialog).toContainText('120');
    await expect(dialog).toContainText('Unassigned jobs');
    await expect(dialog).toContainText('0');
    await expect(dialog).toContainText('Accepted exceptions');
    await expect(dialog).toContainText('Drivers assigned');
    await expect(dialog).toContainText('Vehicles assigned');

    await dialog.getByRole('button', { name: /^Confirm publish$/ }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('routing-route-day-summary')).toContainText('Published');
    await expect(page.getByTestId('routing-workspace-page')).toHaveAttribute('data-route-version', /^v\d+/);
    await expect(page.getByTestId('routing-dispatch-handoff')).toBeVisible();
    await expect(page.getByTestId('routing-dispatch-handoff')).toContainText(/Route version v\d+/);
    await expect(page.getByRole('link', { name: /^Open dispatch board$/ })).toHaveAttribute('href', '/dispatch');
    await expect(page.getByTestId('routing-lane-editor')).toHaveAttribute('data-read-only', 'true');
    const unlockedDragHandle = page
      .locator('[data-testid="routing-compact-stop-row"][data-stop-locked="false"] [data-testid="routing-stop-drag-handle"]')
      .first();
    await expect(unlockedDragHandle).toBeDisabled();
    await expect(page.getByRole('button', { name: /^Start revision$/ })).toBeVisible();

    await page.getByRole('button', { name: /^Start revision$/ }).click();
    await expect(page.getByTestId('routing-lane-editor')).toHaveAttribute('data-read-only', 'false');
    await expect(unlockedDragHandle).toBeEnabled();
  });

  test('exception drawer resolves and accepts route blockers before publish is available', async ({ page }) => {
    await gotoRoutingWorkspace(page, 'exception-route-day');

    await expect(page.getByTestId('routing-review-exceptions-button')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Review exceptions$/ })).toBeVisible();
    await expect(page.getByTestId('routing-publish-button')).toHaveCount(0);
    await expect(page.getByTestId('routing-route-day-summary')).toContainText('4 open exceptions');

    await page.getByTestId('routing-review-exceptions-button').click();
    const drawer = page.getByTestId('routing-exception-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('heading', { name: /^Exception resolution$/ })).toBeVisible();
    await expect(drawer.getByTestId('routing-exception-severity-blocking')).toBeVisible();
    await expect(drawer.getByTestId('routing-exception-route-exception-route-1')).toBeVisible();

    const dockException = drawer.getByTestId('routing-exception-card-route-warning-exception-route-1-0');
    await expect(dockException).toContainText('Type');
    await expect(dockException).toContainText(/Route warning|Dock delay/i);
    await expect(dockException).toContainText('Affected');
    await expect(dockException).toContainText('Severity');
    await expect(dockException).toContainText('Recommended action');
    await expect(dockException).toContainText(/Owner \/ status/i);

    await dockException.getByRole('button', { name: /Jump to affected route/i }).click();
    await expect(page.getByTestId('routing-workspace-page')).toHaveAttribute('data-selected-route-id', 'exception-route-1');
    await expect(page.locator('path.route-line-exception-route-1.is-selected')).toHaveCount(1);

    await dockException.getByRole('button', { name: /^Resolve exception$/ }).click();
    await expect(dockException).toContainText('Resolved');

    const stopException = drawer.getByTestId('routing-exception-card-stop-exception-exception-stop-6');
    await expect(stopException).toContainText(/Affected stop/i);
    await stopException.getByLabel(/Risk acceptance reason/i).fill('Customer confirmed the dock can receive after the window.');
    await stopException.getByRole('button', { name: /^Accept risk$/ }).click();
    await expect(stopException).toContainText('Accepted risk');

    const missingDriver = drawer.getByTestId('routing-exception-card-missing-driver-exception-route-3');
    await missingDriver.getByRole('button', { name: /^Assign driver$/ }).click();
    await expect(missingDriver).toContainText('Resolved');

    const missingVehicle = drawer.getByTestId('routing-exception-card-missing-vehicle-exception-route-4');
    await missingVehicle.getByRole('button', { name: /^Assign vehicle$/ }).click();
    await expect(missingVehicle).toContainText('Resolved');

    await expect(page.getByTestId('routing-route-day-summary')).toContainText('0 open exceptions');
    await expect(page.getByTestId('routing-route-day-summary')).toContainText('Ready to publish');
    await expect(page.getByTestId('routing-route-readiness-summary')).toContainText('Ready to publish');
    await expect(page.getByTestId('routing-publish-button')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Review exceptions$/ })).toHaveCount(0);
  });

  test('dense Denver scenario uses miles and consistent readable dates', async ({ page }) => {
    await gotoRoutingWorkspace(page, 'dense-route-day');

    await expect(page.getByTestId('routing-route-day-summary')).toContainText('132 total jobs');
    await expect(page.getByTestId('routing-route-day-summary')).toContainText('120 routed');
    await expect(page.getByTestId('routing-route-day-summary')).toContainText('12 unassigned');
    await expect(page.getByTestId('routing-route-day-summary')).toContainText('8 routes');
    await expect(page.getByTestId('routing-route-day-summary')).toContainText('3 open exceptions');
    await expect(page.getByText(/\bmi\b/i).first()).toBeVisible();
    await expect(page.getByText(/\bkm\b/i)).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: /^Service date$/ })).toHaveValue('Jun 3, 2026');
    await expect(page.getByText('Service date: Jun 3, 2026')).toBeVisible();
  });

  test('routing workspace restores user-scoped planning preferences without route selections', async ({ page }) => {
    await gotoRoutingWorkspace(page, 'dense-route-day');

    await page.getByRole('button', { name: /^Comfortable$/ }).click();
    await page.getByRole('button', { name: /^All routes$/ }).click();
    await page.getByRole('button', { name: /^Jobs$/ }).click();
    await page.getByTestId('routing-lane-editor-collapse').first().click();
    await page.getByLabel(/^Units$/).click();
    await page.getByRole('option', { name: /^Kilometers$/ }).click();
    await page.getByLabel(/^Date display$/).click();
    await page.getByRole('option', { name: /^ISO date$/ }).click();

    const selectedRouteBeforeReload = await page.getByTestId('routing-workspace-page').getAttribute('data-selected-route-id');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('routing-workspace-page')).toBeVisible({ timeout: 20_000 });

    await expect(page.getByRole('button', { name: /^Comfortable$/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /^All routes$/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /^Jobs$/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('routing-lane-editor')).toHaveAttribute('data-lane-editor-state', 'collapsed');
    await expect(page.getByLabel(/^Units$/)).toHaveText(/Kilometers/);
    await expect(page.getByLabel(/^Date display$/)).toHaveText(/ISO date/);
    await expect(page.getByText(/\bkm\b/i).first()).toBeVisible();
    await expect(page.getByRole('textbox', { name: /^Service date$/ })).toHaveValue('2026-06-03');
    const storedPreferencePayloads = await page.evaluate(() =>
      Object.entries(window.localStorage)
        .filter(([key]) => key.startsWith('trovan-routing-workspace-preferences:v1:'))
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
      window.localStorage.setItem('trovan-preview-auth-user', JSON.stringify({
        id: 'different-user',
        email: 'different@trovan.local',
        role: 'dispatcher',
        roles: ['DISPATCHER'],
        organizationId: 'different-org',
        sessionId: 'different-session',
      }));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('routing-workspace-page')).toBeVisible({ timeout: 20_000 });

    await expect(page.getByRole('button', { name: /^Compact$/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /^Selected route$/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /^Routes$/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel(/^Units$/)).toHaveText(/Miles/);
    await expect(page.getByLabel(/^Date display$/)).toHaveText(/Readable date/);

    const selectedRouteAfterTenantChange = await page.getByTestId('routing-workspace-page').getAttribute('data-selected-route-id');
    expect(selectedRouteAfterTenantChange).toBeTruthy();
    expect(selectedRouteAfterTenantChange).toBe(selectedRouteBeforeReload);
  });
});
