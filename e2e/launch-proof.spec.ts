import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TRACKING_STALE_SIGNAL_MS } from '../shared/contracts/index';
import {
  preparePreviewSession,
  type PreviewSessionRole,
} from './helpers/preview-session';

type PreviewSeed = {
  jobs: Array<{
    id: string;
    customerName?: string | null;
    status?: string | null;
    assignedRouteId?: string | null;
  }>;
  routes: Array<{
    status?: string | null;
    workflowStatus?: string | null;
    driverId?: string | null;
    jobIds: string[];
    totalDistanceKm?: number | null;
    totalDurationMinutes?: number | null;
    optimizedStops?: unknown[];
    planningWarnings?: unknown[];
    vehicleId?: string | null;
    createdAt?: string | null;
    dispatchedAt?: string | null;
    routeData?: { route?: Array<Record<string, unknown>> } | null;
  }>;
  vehicles: Array<{
    status?: string | null;
    vehicleType?: string | null;
    type?: string | null;
  }>;
  drivers: Array<{
    status?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    licenseNumber?: string | null;
    assignedVehicleId?: string | null;
  }>;
};

const calculationProof: Array<Record<string, unknown>> = [];
const conditionalControlProof: Array<Record<string, unknown>> = [];
let proofRunFailed = false;

async function readPreviewState(page: Page): Promise<PreviewSeed> {
  const raw = await page.evaluate(() => window.localStorage.getItem('trovan-preview-state-v2'));
  expect(raw).toBeTruthy();
  return JSON.parse(raw || '{}') as PreviewSeed;
}

async function gotoReady(page: Page, path: string) {
  const role: PreviewSessionRole = path.startsWith('/driver/')
    ? 'driver'
    : 'dispatcher';
  const authToken =
    role === 'driver'
      ? process.env.STAGING_DRIVER_AUTH_TOKEN ||
        process.env.LAUNCH_AUDIT_DRIVER_AUTH_TOKEN ||
        ''
      : process.env.LAUNCH_AUDIT_AUTH_TOKEN ||
        process.env.STAGING_AUTH_TOKEN ||
        '';
  await preparePreviewSession(page, {
    role,
    authToken,
  });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.locator('#root').waitFor({ state: 'visible' });
  if (path.startsWith('/driver/')) {
    await page.getByTestId('driver-route-run-page').waitFor({ state: 'visible' });
  } else if (path === '/pricing') {
    await page.getByRole('heading', { name: /pricing/i }).first().waitFor({ state: 'visible' });
  } else {
    await page.getByRole('button', { name: /^(Collapse|Expand) sidebar$/ }).waitFor({ state: 'visible' });
  }
  await expect(page.getByText(/Workspace Failed To Render/i)).toHaveCount(0);
}

const roundedPercent = (value: number, total: number) =>
  total > 0 ? Math.round((value / total) * 100) : 0;

test.describe('launch calculation and control proof', () => {
  test.afterEach(({}, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      proofRunFailed = true;
    }
  });

  test.afterAll(() => {
    const artifactDirectory = resolve(process.cwd(), '.codex/launch-audit');
    mkdirSync(artifactDirectory, { recursive: true });
    writeFileSync(
      resolve(artifactDirectory, 'calculation-proof.json'),
      `${JSON.stringify({
        generatedAt: new Date().toISOString(),
        status: proofRunFailed ? 'failed' : 'passed',
        checks: calculationProof,
      }, null, 2)}\n`,
      'utf8',
    );
    writeFileSync(
      resolve(artifactDirectory, 'conditional-control-proof.json'),
      `${JSON.stringify({
        generatedAt: new Date().toISOString(),
        status: proofRunFailed ? 'failed' : 'passed',
        checks: conditionalControlProof,
      }, null, 2)}\n`,
      'utf8',
    );
  });

  test('global shell controls have observable outcomes', async ({ page }) => {
    await gotoReady(page, '/dashboard');

    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();

    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.getByRole('button', { name: 'Notifications' }).click();
    await expect(page.getByText('You are all caught up. There are no new operational alerts.')).toBeVisible();
    await page.getByRole('link', { name: 'Open notification settings' }).click();
    await expect(page).toHaveURL(/\/settings$/);

    await gotoReady(page, '/dashboard');
    await page.getByRole('button', { name: 'Open full-screen map' }).click();
    await expect(page).toHaveURL(/\/tracking$/);
  });

  test('public ROI calculator reconciles every displayed output and caps impossible mileage savings', async ({ page }) => {
    await gotoReady(page, '/pricing');
    const calculator = page.getByTestId('roi-calculator');
    const inputs = {
      routesPerDay: 10,
      stopsPerRoute: 20,
      deliveryDaysPerWeek: 4,
      avgDriverHourlyCost: 30,
      avgMilesPerRoute: 5,
      estimatedMinutesSavedPerRoute: 15,
      estimatedMilesSavedPerRoute: 8,
      failedDeliveryCost: 100,
      failedDeliveriesAvoidedPerWeek: 2,
      costPerMile: 0.75,
    };
    const valuesByLabel: Array<[string, number]> = [
      ['Routes per day', inputs.routesPerDay],
      ['Stops per route', inputs.stopsPerRoute],
      ['Delivery days per week', inputs.deliveryDaysPerWeek],
      ['Average driver hourly cost', inputs.avgDriverHourlyCost],
      ['Average miles per route', inputs.avgMilesPerRoute],
      ['Estimated minutes saved per route', inputs.estimatedMinutesSavedPerRoute],
      ['Estimated miles saved per route', inputs.estimatedMilesSavedPerRoute],
      ['Failed delivery cost', inputs.failedDeliveryCost],
      ['Failed deliveries avoided per week', inputs.failedDeliveriesAvoidedPerWeek],
      ['Cost per mile', inputs.costPerMile],
    ];
    for (const [label, value] of valuesByLabel) {
      await calculator.getByLabel(label).fill(String(value));
    }

    const monthlyLabor = inputs.routesPerDay * inputs.deliveryDaysPerWeek * (inputs.estimatedMinutesSavedPerRoute / 60) * inputs.avgDriverHourlyCost * 4.33;
    const effectiveMilesSaved = Math.min(inputs.estimatedMilesSavedPerRoute, inputs.avgMilesPerRoute);
    const monthlyMileage = inputs.routesPerDay * inputs.deliveryDaysPerWeek * effectiveMilesSaved * inputs.costPerMile * 4.33;
    const monthlyFailed = inputs.failedDeliveryCost * inputs.failedDeliveriesAvoidedPerWeek * 4.33;
    const total = monthlyLabor + monthlyMileage + monthlyFailed;
    const routeDays = inputs.routesPerDay * inputs.deliveryDaysPerWeek * 4.33;
    const perRoute = total / routeDays;
    const breakEven = Math.ceil(899 / perRoute);
    const currency = (value: number) => new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);

    await expect(calculator.getByText(currency(total), { exact: true })).toBeVisible();
    await expect(calculator.getByText('Labor savings', { exact: true }).locator('..')).toContainText(currency(monthlyLabor));
    await expect(calculator.getByText('Mileage/fuel savings', { exact: true }).locator('..')).toContainText(currency(monthlyMileage));
    await expect(calculator.getByText('Avoided failed-delivery cost', { exact: true }).locator('..')).toContainText(currency(monthlyFailed));
    await expect(calculator.getByText('Estimated savings per route', { exact: true }).locator('..')).toContainText(currency(perRoute));
    await expect(calculator).toContainText(`Based on ${(inputs.routesPerDay * inputs.stopsPerRoute * inputs.deliveryDaysPerWeek).toLocaleString()} weekly stops`);
    await expect(calculator).toContainText(`Break-even estimate against the Scale package: ${breakEven} route days`);
    await expect(calculator.getByRole('alert').filter({ hasText: 'capped at the average miles per route' })).toBeVisible();
    calculationProof.push({ area: 'public-pricing-roi', status: 'passed', inputs: valuesByLabel.length, outputs: 7 });
  });

  test('dashboard KPIs and status totals reconcile with the preview records', async ({ page }) => {
    await gotoReady(page, '/dashboard');
    const seed = await readPreviewState(page);

    const activeRoutes = seed.routes.filter((route) =>
      ['assigned', 'ready_for_dispatch', 'in_progress'].includes(
        String(route.workflowStatus || route.status || '').toLowerCase(),
      ),
    ).length;
    const readyVehicles = seed.vehicles.filter((vehicle) =>
      ['available', 'active', 'ready'].includes(String(vehicle.status || '').toLowerCase()),
    ).length;
    const activeDrivers = seed.drivers.filter((driver) =>
      ['active', 'on_duty', 'on_route'].includes(String(driver.status || '').toLowerCase()),
    ).length;
    const openExceptions = seed.routes.filter(
      (route) => String(route.status).toLowerCase() === 'in_progress',
    ).length;

    await expect(page.getByText('Jobs Today', { exact: true }).locator('..')).toContainText(String(seed.jobs.length));
    await expect(page.getByText('On-Time Rate', { exact: true }).locator('..')).toContainText('0%');
    await expect(page.getByText('Active Routes', { exact: true }).locator('..')).toContainText(String(activeRoutes));
    await expect(page.getByText('Vehicles in Service', { exact: true }).locator('..')).toContainText(`${readyVehicles} / ${seed.vehicles.length}`);
    await expect(page.getByText('Driver Utilization', { exact: true }).locator('..')).toContainText(`${roundedPercent(activeDrivers, seed.drivers.length)}%`);
    await expect(page.getByText('Require Attention', { exact: true }).locator('..')).toContainText(String(openExceptions));

    const completedJobs = seed.jobs.filter((job) => ['completed', 'delivered'].includes(String(job.status).toLowerCase())).length;
    const inProgressJobs = seed.jobs.filter((job) => ['in_progress', 'en_route', 'arrived'].includes(String(job.status).toLowerCase())).length;
    const failedJobs = seed.jobs.filter((job) => ['failed', 'cancelled', 'canceled', 'exception'].includes(String(job.status).toLowerCase())).length;
    const pendingJobs = seed.jobs.length - completedJobs - inProgressJobs - failedJobs;

    await expect(page.getByText(`Completed ${completedJobs}`, { exact: true })).toBeVisible();
    await expect(page.getByText(`In Progress ${inProgressJobs}`, { exact: true })).toBeVisible();
    await expect(page.getByText(`Pending ${pendingJobs}`, { exact: true })).toBeVisible();
    await expect(page.getByText(`Failed / Cancelled ${failedJobs}`, { exact: true })).toBeVisible();
    expect(completedJobs + inProgressJobs + pendingJobs + failedJobs).toBe(seed.jobs.length);

    const totalMiles = Number(
      (seed.routes.reduce((sum, route) => sum + Number(route.totalDistanceKm || 0), 0) * 0.621371).toFixed(2),
    );
    const totalMinutes = seed.routes.reduce(
      (sum, route) => sum + Number(route.totalDurationMinutes || 0),
      0,
    );
    const milesSaved = totalMiles * 0.25;
    const fuelSavings = milesSaved * 0.685;
    const laborSavings = (totalMinutes * 0.12 / 60) * 60;
    const estimatedRunCost = totalMiles * 0.685 + (totalMinutes / 60) * 60;
    const roi = estimatedRunCost > 0
      ? Math.round(((fuelSavings + laborSavings) / estimatedRunCost) * 100)
      : 0;

    await expect(page.getByText('Miles Saved', { exact: true }).locator('..')).toContainText(`${milesSaved.toFixed(1)} mi`);
    await expect(page.getByText('Fuel Savings', { exact: true }).locator('..')).toContainText(`$${fuelSavings.toFixed(2)}`);
    await expect(page.getByText('Labor Savings', { exact: true }).locator('..')).toContainText(`$${laborSavings.toFixed(2)}`);
    await expect(page.getByText('ROI', { exact: true }).locator('..')).toContainText(`${roi}%`);

    for (const route of seed.routes) {
      const row = page.getByText(route.id.replace(/^route-/, 'Route '), { exact: false }).first().locator('..');
      await expect(row).toContainText('0%');
    }
    calculationProof.push({ area: 'dashboard', status: 'passed', records: seed.jobs.length });
  });

  test('routing planning metrics reconcile with route groups and blockers', async ({ page }) => {
    await gotoReady(page, '/routing');
    const seed = await readPreviewState(page);
    const kpis = page.getByTestId('routing-planning-kpis');
    await expect(kpis).toBeVisible();

    const routeDistancesKm = seed.routes.map((route) => Math.max(route.jobIds.length, 1) * 7.4);
    const routeDurations = seed.routes.map((route) => route.jobIds.length * 14 + (route.jobIds.length ? 10 : 0));
    const totalDistanceKm = routeDistancesKm.reduce((sum, value) => sum + value, 0);
    const totalDistanceMiles = totalDistanceKm * 0.621371;
    const totalDurationMinutes = routeDurations.reduce((sum, value) => sum + value, 0);
    const averageDistanceKm = totalDistanceKm / routeDistancesKm.length;
    const maxDistanceSpreadKm = Math.max(...routeDistancesKm.map((value) => Math.abs(value - averageDistanceKm)));
    const balanceScore = Math.max(0, Math.round(100 - (maxDistanceSpreadKm / averageDistanceKm) * 100));
    const routedJobs = seed.routes.reduce((sum, route) => sum + route.jobIds.length, 0);
    const unassignedJobs = seed.jobs.length - routedJobs;
    const openBlockers = seed.routes.filter((route) => !route.driverId).length;
    const sla = Math.max(0, Math.round(100 - ((unassignedJobs + openBlockers) / seed.jobs.length) * 100));

    await expect(kpis).toContainText(`${totalDistanceMiles.toFixed(1)} mi`);
    await expect(kpis).toContainText(`$${(totalDistanceMiles * 0.68).toFixed(2)}`);
    await expect(kpis).toContainText('1h 26m');
    await expect(kpis).toContainText(`${balanceScore} / 100`);
    await expect(kpis).toContainText(`${sla}%`);
    expect(totalDurationMinutes).toBe(86);
    calculationProof.push({ area: 'routing', status: 'passed', routes: seed.routes.length });
  });

  test('analytics percentages and averages reconcile with source records', async ({ page }) => {
    await gotoReady(page, '/analytics');
    const seed = await readPreviewState(page);

    const totalRoutes = seed.routes.length;
    const totalStops = seed.routes.reduce((sum, route) => sum + (route.optimizedStops?.length || 0), 0);
    const completedRoutes = seed.routes.filter((route) => String(route.status).toLowerCase() === 'completed');
    const servicedStops = completedRoutes.reduce((sum, route) => sum + (route.optimizedStops?.length || 0), 0);
    const exceptionRoutes = seed.routes.filter((route) => (route.planningWarnings?.length || 0) > 0).length;
    const activeRoutes = seed.routes.filter((route) => ['assigned', 'in_progress'].includes(String(route.status).toLowerCase())).length;
    const plannedRoutes = seed.routes.filter((route) => String(route.status).toLowerCase() === 'planned').length;
    const activeVehicles = seed.vehicles.filter((vehicle) => ['available', 'in_use', 'active'].includes(String(vehicle.status).toLowerCase())).length;
    const activeDrivers = seed.drivers.filter((driver) => ['active', 'on_duty', 'on_route'].includes(String(driver.status).toLowerCase())).length;
    const averageDistanceKm = Number((seed.routes.reduce((sum, route) => sum + Number(route.totalDistanceKm || 0), 0) / totalRoutes).toFixed(1));
    const averageDuration = Number((seed.routes.reduce((sum, route) => sum + Number(route.totalDurationMinutes || 0), 0) / totalRoutes).toFixed(1));
    const exceptionRate = Number(((exceptionRoutes / totalRoutes) * 100).toFixed(1));
    const onTimeRate = totalStops ? Number(((servicedStops / totalStops) * 100).toFixed(1)) : 0;

    await expect(page.getByText('On-time rate', { exact: true }).locator('..')).toContainText(`${onTimeRate}%`);
    await expect(page.getByText('Active routes', { exact: true }).locator('..')).toContainText(String(activeRoutes));
    await expect(page.getByText('Open exceptions', { exact: true }).locator('..')).toContainText(String(exceptionRoutes));
    await expect(page.getByText('Average distance', { exact: true }).locator('..')).toContainText(`${(averageDistanceKm * 0.621371).toFixed(1)} mi`);
    await expect(page.getByText('Average duration', { exact: true }).locator('..')).toContainText(`${averageDuration} min`);
    await expect(page.getByText(`${roundedPercent(activeVehicles, seed.vehicles.length)}% ready`, { exact: true })).toBeVisible();
    await expect(page.getByText('Active drivers', { exact: true }).locator('..')).toContainText(`${activeDrivers} of ${seed.drivers.length}`);
    await expect(page.getByText('Planning backlog', { exact: true }).locator('..')).toContainText(String(plannedRoutes));
    await expect(page.getByText(`${exceptionRate}%`, { exact: true })).toBeVisible();
    calculationProof.push({ area: 'analytics', status: 'passed', routes: seed.routes.length });
  });

  test('driver KPIs reconcile with driver assignments and saved fields', async ({ page }) => {
    await gotoReady(page, '/drivers');
    const seed = await readPreviewState(page);
    const active = seed.drivers.filter((driver) => String(driver.status || '').toUpperCase() === 'ACTIVE');
    const onRoute = active.filter((driver) => Boolean(driver.assignedVehicleId));
    const available = active.filter((driver) => !driver.assignedVehicleId);
    const offShift = seed.drivers.filter((driver) =>
      ['OFF_DUTY', 'INACTIVE'].includes(String(driver.status || '').toUpperCase()),
    );
    const complianceIssues = seed.drivers.filter((driver) => !driver.phone || !driver.licenseNumber);
    const utilization = active.length ? Math.round((onRoute.length / active.length) * 100) : 0;

    await expect(page.getByText(`Available Drivers${available.length}`, { exact: true })).toBeVisible();
    await expect(page.getByText(`On Route${onRoute.length}`, { exact: true })).toBeVisible();
    await expect(page.getByText(`Off Shift${offShift.length}`, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(`Compliance Issues${complianceIssues.length}`, { exact: true })).toBeVisible();
    await expect(page.getByText(`Utilization${utilization}%`, { exact: true })).toBeVisible();
    await expect(page.getByText(`Showing 1 to ${seed.drivers.length} of ${seed.drivers.length} drivers`, { exact: true })).toBeVisible();
    calculationProof.push({ area: 'drivers', status: 'passed', records: seed.drivers.length });
  });

  test('vehicle type totals reconcile with every saved vehicle record', async ({ page }) => {
    await gotoReady(page, '/vehicles');
    const seed = await readPreviewState(page);
    const aliases: Record<string, string> = { van: 'cargo_van', truck: 'box_truck', semi_tractor: 'semi_truck' };
    const normalizeType = (value?: string | null) => {
      const type = String(value || 'box_truck').trim().toLowerCase();
      return aliases[type] || type;
    };
    const profiles: Record<string, { label: string; capacity: string; volume: string }> = {
      cargo_van: { label: 'Cargo van', capacity: '3500 lb', volume: '260 cu ft' },
      box_truck: { label: 'Box truck', capacity: '10000 lb', volume: '900 cu ft' },
      straight_truck: { label: 'Straight truck', capacity: '18000 lb', volume: '1200 cu ft' },
      semi_truck: { label: 'Semi truck', capacity: '45000 lb', volume: 'Trailer dependent' },
    };

    for (const [type, profile] of Object.entries(profiles)) {
      const count = seed.vehicles.filter((vehicle) => normalizeType(vehicle.vehicleType || vehicle.type) === type).length;
      await expect(
        page.getByText(`${profile.label}${count}${profile.capacity} • ${profile.volume}`, { exact: true }),
      ).toBeVisible();
    }
    const directoryRows = page.getByRole('table').getByRole('row');
    await expect(directoryRows).toHaveCount(seed.vehicles.length + 1);
    calculationProof.push({ area: 'vehicles', status: 'passed', records: seed.vehicles.length });
  });

  test('job queue totals reconcile with assignment and lifecycle state', async ({ page }) => {
    await gotoReady(page, '/jobs');
    const seed = await readPreviewState(page);
    const active = seed.jobs.filter((job) => String(job.status).toLowerCase() !== 'archived');

    await expect(page.getByText(`${active.length} active`, { exact: true })).toBeVisible();
    await expect(page.getByText(`Showing 1 - ${active.length} of ${active.length} jobs`, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '0 selected', exact: true })).toBeVisible();
    await expect(page.getByTestId('jobs-table-panel').getByRole('row')).toHaveCount(active.length + 1);
    calculationProof.push({ area: 'jobs', status: 'passed', records: active.length });
  });

  test('dispatch and exception counts reconcile with route and job source records', async ({ page }) => {
    await gotoReady(page, '/dispatch');
    const seed = await readPreviewState(page);
    const exceptions = seed.routes.filter(
      (route) => String(route.status).toLowerCase() === 'in_progress' || (route.planningWarnings?.length || 0) > 0,
    );
    const openExceptions = exceptions.filter((route) => String(route.status).toLowerCase() === 'in_progress').length;
    const activeDrivers = seed.drivers.filter((driver) =>
      ['active', 'available', 'en_route', 'on_route'].includes(String(driver.status || '').toLowerCase()),
    ).length;
    const jobsInProgress = seed.jobs.filter((job) =>
      ['in_progress', 'assigned', 'ready'].includes(String(job.status || '').toLowerCase()),
    ).length;

    await expect(page.getByText('Active Routes', { exact: true }).locator('..')).toContainText(String(seed.routes.length));
    await expect(page.getByText('Active Drivers', { exact: true }).locator('..')).toContainText(`${activeDrivers} / ${seed.drivers.length}`);
    await expect(page.getByText('Jobs in Progress', { exact: true }).locator('..')).toContainText(String(jobsInProgress));
    await expect(page.getByText(`Exceptions${openExceptions}`, { exact: true })).toBeVisible();

    await gotoReady(page, '/exceptions');
    const acknowledged = exceptions.length - openExceptions;
    await expect(page.getByRole('button', { name: `All ${exceptions.length}`, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: `Open ${openExceptions}`, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: `Acknowledged ${acknowledged}`, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resolved 0', exact: true })).toBeVisible();
    await expect(page.getByText(`${exceptions.length} visible`, { exact: true })).toBeVisible();
    calculationProof.push({ area: 'dispatch-and-exceptions', status: 'passed', routes: seed.routes.length });
  });

  test('tracking and proof-of-delivery totals reconcile with route stops', async ({ page }) => {
    await gotoReady(page, '/tracking');
    const seed = await readPreviewState(page);
    const hasCoordinate = (route: PreviewSeed['routes'][number]) => {
      const stops = [
        ...(route.optimizedStops || []),
        ...(Array.isArray(route.routeData?.route) ? route.routeData.route : []),
      ];
      return stops.some((value) => {
        if (!value || typeof value !== 'object') return false;
        const record = value as Record<string, unknown>;
        const location = record.location && typeof record.location === 'object'
          ? record.location as Record<string, unknown>
          : {};
        const latitude = Number(location.latitude ?? record.latitude ?? record.lat);
        const longitude = Number(location.longitude ?? record.longitude ?? record.lng);
        return Number.isFinite(latitude) && Number.isFinite(longitude);
      });
    };
    const liveRoutes = seed.routes.filter((route) => route.vehicleId && hasCoordinate(route));
    const staleSignals = liveRoutes.filter((route) => {
      const timestamp = route.dispatchedAt || route.createdAt;
      return (
        !timestamp ||
        Date.now() - new Date(timestamp).getTime() >
          TRACKING_STALE_SIGNAL_MS
      );
    }).length;
    const adherence = liveRoutes.length ? Math.max(62, 100 - staleSignals * 12) : 0;

    await expect(page.getByText('Vehicles live now', { exact: true }).locator('..')).toContainText(String(liveRoutes.length));
    await expect(page.getByText('Last update', { exact: true }).locator('..')).toContainText(`${staleSignals} stale signals need review`);
    await expect(page.getByText('Route adherence', { exact: true }).locator('..')).toContainText(`${adherence}%`);

    await gotoReady(page, '/pod');
    const podCount = seed.routes.reduce((sum, route) => sum + route.jobIds.length, 0);
    const missingPodCount = seed.routes.filter((route) => route.jobIds.length > 0).length;
    const deliveredCount = podCount - missingPodCount;
    const podTable = page.getByRole('table', { name: 'Proof of delivery queue' });
    await expect(page.getByText(`1 - ${podCount} of ${podCount} PODs`, { exact: true })).toBeVisible();
    await expect(podTable.locator('tbody tr').filter({ hasText: 'Delivered' })).toHaveCount(deliveredCount);
    await expect(podTable.locator('tbody tr').filter({ hasText: 'Missing POD' })).toHaveCount(missingPodCount);
    calculationProof.push({ area: 'tracking-and-pod', status: 'passed', records: podCount });
  });

  test('customer KPI totals reconcile with customer rows and job records', async ({ page }) => {
    await gotoReady(page, '/customers');
    const seed = await readPreviewState(page);
    const customerTable = page.getByRole('table');
    const customerRows = customerTable.getByRole('row');
    const rowCount = await customerRows.count() - 1;
    const completedJobs = seed.jobs.filter((job) =>
      ['completed', 'delivered'].includes(String(job.status || '').toLowerCase()),
    ).length;

    await expect(page.getByText('Completed Jobs', { exact: true }).locator('..')).toContainText(String(completedJobs));
    await expect(page.getByText('Customer Jobs', { exact: true }).locator('..')).toContainText(String(seed.jobs.length));
    await expect(page.getByText(`Customers${rowCount}`, { exact: true })).toBeVisible();
    await expect(page.getByText(`Showing 1 to ${rowCount} of ${rowCount} customers`, { exact: true })).toBeVisible();
    calculationProof.push({ area: 'customers', status: 'passed', records: rowCount });
  });

  test('job bulk actions enable from selection and produce the intended outcome', async ({ page }) => {
    const selectFirstJob = async () => {
      const checkbox = page.getByTestId('jobs-table-panel').locator('tbody input[type="checkbox"]').first();
      await checkbox.check();
      await expect(page.getByTestId('jobs-bulk-bar')).toBeVisible();
    };

    await gotoReady(page, '/jobs');
    await selectFirstJob();
    const commandPanel = page.getByTestId('jobs-command-panel');
    await expect(commandPanel.getByRole('button', { name: 'Batch Assign' })).toBeEnabled();
    await commandPanel.getByRole('button', { name: 'Batch Assign' }).click();
    await expect(page).toHaveURL(/\/routing\?jobId=/);

    await gotoReady(page, '/jobs');
    await selectFirstJob();
    await commandPanel.getByRole('button', { name: 'Archive' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Selected jobs archived from the operator queue.' })).toBeVisible();

    await gotoReady(page, '/jobs');
    await selectFirstJob();
    await commandPanel.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Selected jobs marked cancelled.' })).toBeVisible();

    await gotoReady(page, '/jobs');
    const viewCustomer = page.getByTestId('jobs-inspector').getByRole('button', { name: 'View customer' });
    await expect(viewCustomer).toBeEnabled();
    await viewCustomer.click();
    await expect(page).toHaveURL(/\/customers\?customerId=CUST-ROUTE-1001/);
    await expect(page.getByText('Jane & Sons Bakery', { exact: true }).first()).toBeVisible();

    conditionalControlProof.push({
      area: 'jobs',
      controls: ['Batch Assign', 'Archive', 'Cancel', 'View customer'],
      status: 'passed',
    });
  });

  test('exception acknowledgement enables for an open exception and persists in the queue state', async ({ page }) => {
    await gotoReady(page, '/exceptions');
    const openFilter = page.getByRole('button', { name: /^Open \d+$/ });
    await openFilter.click();
    const acknowledge = page.getByRole('button', { name: 'Acknowledge', exact: true });
    await expect(acknowledge).toBeEnabled();
    await acknowledge.click();
    await expect(acknowledge).toBeDisabled();
    await expect(page.getByText('Current state', { exact: true }).locator('..')).toContainText('ACKNOWLEDGED');
    conditionalControlProof.push({ area: 'exceptions', control: 'Acknowledge', status: 'passed' });
  });

  test('dispatch selection enables save, send, and a ready route dispatch with visible confirmation', async ({ page }) => {
    await gotoReady(page, '/dispatch');
    const routeSelectors = page.locator('[role="button"][aria-label^="Select "]');
    expect(await routeSelectors.count()).toBeGreaterThan(0);
    const routeCount = await routeSelectors.count();
    let selectedRoute = page.locator('[role="button"][aria-label^="Select "][aria-pressed="true"]');
    let saved = false;
    for (let index = 0; index < routeCount; index += 1) {
      await routeSelectors.nth(index).click();
      selectedRoute = page.locator('[role="button"][aria-label^="Select "][aria-pressed="true"]');
      const save = selectedRoute.getByRole('button', { name: 'Save', exact: true });
      if (await save.isEnabled()) {
        await save.click();
        saved = true;
        break;
      }
    }
    expect(saved).toBe(true);
    await expect(page.getByRole('alert').filter({ hasText: 'assignment saved.' })).toBeVisible();

    await page.getByLabel('Type message').fill('Launch proof dispatch update');
    const send = page.getByRole('button', { name: 'Send', exact: true });
    await expect(send).toBeEnabled();
    await send.click();
    await expect(page.getByText('Launch proof dispatch update', { exact: true })).toBeVisible();

    let dispatched = false;
    for (let index = 0; index < routeCount; index += 1) {
      await routeSelectors.nth(index).click();
      selectedRoute = page.locator('[role="button"][aria-label^="Select "][aria-pressed="true"]');
      const dispatch = selectedRoute.getByRole('button', { name: 'Dispatch', exact: true });
      if (await dispatch.isEnabled()) {
        await dispatch.click();
        await expect(page.getByRole('alert').filter({ hasText: 'sent to the assigned driver.' })).toBeVisible();
        dispatched = true;
        break;
      }
    }
    expect(dispatched).toBe(true);
    conditionalControlProof.push({
      area: 'dispatch',
      controls: ['Select route', 'Save', 'Send', 'Dispatch'],
      status: 'passed',
    });
  });

  test('route-run lifecycle, stop actions, messaging, proof, and exception controls persist their outcomes', async ({ context, page }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const openRoute = async () => {
      await gotoReady(page, '/route-runs/route-alpha-001');
      await expect(page.getByTestId('route-run-detail-page')).toBeVisible();
    };
    const runModalAction = async (buttonTestId: string, dialogName: string, value: string) => {
      await page.getByTestId(buttonTestId).click();
      const dialog = page.getByRole('dialog', { name: dialogName });
      const input = dialog.getByLabel(dialogName === 'Attach Proof' ? 'Proof URI' : 'Details');
      await input.fill(value);
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(dialog).toBeHidden();
    };

    await openRoute();
    await page.getByTestId('route-run-start-button').click();
    await expect(page.getByTestId('route-run-status-chip')).toContainText('in_progress');

    await openRoute();
    await page.getByTestId('route-run-complete-button').click();
    await expect(page.getByTestId('route-run-status-chip')).toContainText('completed');

    await openRoute();
    await page.getByTestId('route-run-stop-arrived-button-0').click();
    await expect(page.getByTestId('route-run-stop-card-0')).toContainText('ARRIVED');

    await openRoute();
    await page.getByTestId('route-run-stop-serviced-button-0').click();
    await expect(page.getByTestId('route-run-stop-card-0')).toContainText('SERVICED');

    await openRoute();
    await runModalAction('route-run-stop-reschedule-button-0', 'Reschedule Stop', 'Customer requested a later window');
    await expect(page.getByTestId('route-run-stop-card-0')).toContainText('RESCHEDULED');

    await openRoute();
    await runModalAction('route-run-stop-fail-button-0', 'Fail Stop', 'Receiver was unavailable');
    await expect(page.getByTestId('route-run-stop-card-0')).toContainText('FAILED');

    await openRoute();
    await runModalAction('route-run-stop-note-button-0', 'Add Stop Note', 'Gate code confirmed');
    await expect(page.getByTestId('route-run-stop-card-0')).toContainText('Latest note: Gate code confirmed');

    await openRoute();
    await runModalAction('route-run-stop-proof-button-0', 'Attach Proof', 'https://example.com/proof/launch-audit');
    await expect(page.getByTestId('route-run-stop-card-0')).toContainText('https://example.com/proof/launch-audit');
    const proofDownload = page.waitForEvent('download');
    await page.getByTestId('route-run-stop-card-0').getByRole('button', { name: 'Download proof' }).click();
    expect((await proofDownload).suggestedFilename()).toBeTruthy();

    await openRoute();
    await page.getByRole('button', { name: 'Copy tracking link', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Tracking link copied:' })).toBeVisible();
    await page.getByLabel('Message driver').fill('Route detail launch proof message');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.getByLabel('Message driver')).toHaveValue('', { timeout: 20_000 });
    await expect(page.getByRole('listitem').filter({ hasText: 'Route detail launch proof message' })).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'New exception', exact: true }).click();
    const exceptionDialog = page.getByRole('dialog', { name: 'Create Exception' });
    await exceptionDialog.getByLabel('Code').fill('AUDIT');
    await exceptionDialog.getByLabel('Message').fill('Route detail exception persisted');
    await exceptionDialog.getByRole('button', { name: 'Create exception', exact: true }).click();
    await expect(exceptionDialog).toBeHidden();
    await expect(page.getByText('Route detail exception persisted', { exact: true })).toBeVisible();

    conditionalControlProof.push({
      area: 'route-run-detail',
      controls: ['Start Route', 'Complete Route', 'Mark arrived', 'Mark serviced', 'Reschedule', 'Fail', 'Add note', 'Add proof', 'Download proof', 'Copy tracking link', 'Send message', 'Create exception'],
      status: 'passed',
    });
  });

  test('driver route workflow completes every proof stage, note, message, location, and both stops', async ({ context, page }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 39.7392, longitude: -104.9903 });
    await gotoReady(page, '/driver/route-runs/route-alpha-001');
    await expect(page.getByRole('heading', { name: 'Stop 1 of 2' })).toBeVisible();

    await page.getByRole('button', { name: 'Location', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Location shared with dispatch.' })).toBeVisible();

    await page.getByRole('button', { name: 'Open stop details' }).click();
    await expect(page.getByRole('heading', { name: 'Stop details' })).toBeVisible();
    await page.getByLabel('Driver note').fill('Driver launch proof note');
    await page.getByRole('button', { name: 'Save note', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Note saved.' })).toBeVisible();
    await page.getByRole('button', { name: 'Close stop details' }).click();

    await page.getByRole('button', { name: 'Open dispatch messages' }).click();
    await expect(page.getByRole('heading', { name: 'Dispatch messages' })).toBeVisible();
    await page.getByLabel('Message dispatch').fill('Driver launch proof message');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText('Driver launch proof message', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close messages' }).click();

    await page.getByRole('button', { name: 'Arrive', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Arrival recorded.' })).toBeVisible();
    const bolChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload BOL', exact: true }).click();
    const bolChooser = await bolChooserPromise;
    await bolChooser.setFiles({ name: 'launch-proof-bol.pdf', mimeType: 'application/pdf', buffer: Buffer.from('launch proof bol') });
    await expect(page.getByRole('alert').filter({ hasText: 'BOL uploaded.' })).toBeVisible();
    await page.getByRole('button', { name: 'No documents needed', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Documents marked not needed.' })).toBeVisible();
    await page.getByRole('button', { name: 'Depart', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Stop 2 of 2' })).toBeVisible();

    await page.getByRole('button', { name: 'Arrive', exact: true }).click();
    await page.getByRole('button', { name: 'Capture signature', exact: true }).click();
    const signatureDialog = page.getByRole('dialog', { name: 'Capture signature' });
    await signatureDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Capture signature', exact: true }).click();
    await signatureDialog.getByLabel('Signer name').fill('Launch Proof Receiver');
    const canvas = signatureDialog.getByLabel('Signature canvas');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move((box?.x || 0) + 40, (box?.y || 0) + 80);
    await page.mouse.down();
    await page.mouse.move((box?.x || 0) + 180, (box?.y || 0) + 120, { steps: 6 });
    await page.mouse.up();
    await signatureDialog.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(signatureDialog.getByRole('button', { name: 'Accept signature', exact: true })).toBeDisabled();
    await page.mouse.move((box?.x || 0) + 55, (box?.y || 0) + 95);
    await page.mouse.down();
    await page.mouse.move((box?.x || 0) + 210, (box?.y || 0) + 105, { steps: 8 });
    await page.mouse.up();
    await signatureDialog.getByRole('button', { name: 'Accept signature', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Signature captured.' })).toBeVisible();

    await page.getByRole('button', { name: 'No BOL needed', exact: true }).click();
    const documentChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload document', exact: true }).click();
    const documentChooser = await documentChooserPromise;
    await documentChooser.setFiles({ name: 'launch-proof-document.pdf', mimeType: 'application/pdf', buffer: Buffer.from('launch proof document') });
    await expect(page.getByRole('alert').filter({ hasText: 'Document uploaded.' })).toBeVisible();
    await page.getByRole('button', { name: 'Depart', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Route complete' })).toBeVisible();
    await expect(page.getByText('2/2 complete', { exact: true })).toBeVisible();

    conditionalControlProof.push({
      area: 'driver-route-run',
      controls: ['Location', 'Open/close stop details', 'Save note', 'Open/close messages', 'Send message', 'Arrive', 'Upload BOL', 'No documents needed', 'Depart', 'Capture/cancel/clear/accept signature', 'No BOL needed', 'Upload document'],
      status: 'passed',
    });
  });

  test('settings state-dependent administration controls have honest outcomes', async ({ page }) => {
    await gotoReady(page, '/settings');
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const createOrganization = page.getByRole('button', { name: 'Create organization' });
    await expect(createOrganization).toBeDisabled();
    await page.getByLabel('Organization name').fill(`Launch proof org ${unique}`);
    await page.getByLabel('Slug').fill(`launch-proof-${unique}`);
    await expect(createOrganization).toBeEnabled();
    await createOrganization.click();
    await expect(page.getByRole('alert').filter({ hasText: 'Organization created.' })).toBeVisible();
    conditionalControlProof.push({ area: 'settings', control: 'Create organization', status: 'passed' });

    await page.getByRole('button', { name: /^Platform API keys/i }).click();
    await expect(page.getByText('API keys', { exact: true })).toBeVisible();
    const createApiKey = page.getByRole('button', { name: 'Create API key' });
    await expect(createApiKey).toBeDisabled();
    await page.getByLabel('Key name').fill(`Launch proof ${unique}`);
    await expect(createApiKey).toBeEnabled();
    await createApiKey.click();
    await expect(page.getByRole('alert').filter({ hasText: 'API key created. Copy the secret now.' })).toBeVisible();
    const keyItem = page.getByRole('listitem').filter({ hasText: `Launch proof ${unique}` });
    await expect(keyItem).toBeVisible();
    await keyItem.getByRole('button', { name: 'Revoke' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'API key revoked.' })).toBeVisible();

    const createWebhook = page.getByRole('button', { name: 'Create webhook' });
    await expect(createWebhook).toBeDisabled();
    await page.getByLabel('Webhook name').fill(`Launch hook ${unique}`);
    await page.getByLabel('Webhook URL').fill('https://example.com/trovan-launch-proof');
    await expect(createWebhook).toBeEnabled();
    await createWebhook.click();
    await expect(page.getByRole('alert').filter({ hasText: 'Webhook endpoint created. Copy the signing secret now.' })).toBeVisible();
    const webhookItem = page.getByRole('listitem').filter({ hasText: `Launch hook ${unique}` });
    await webhookItem.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Webhook paused.' })).toBeVisible();
    await webhookItem.getByRole('button', { name: 'Rotate' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Webhook signing secret rotated.' })).toBeVisible();

    await page.getByRole('button', { name: /^Team Members/i }).click();
    const sendInvitation = page.getByRole('button', { name: 'Send invitation' });
    await expect(sendInvitation).toBeDisabled();
    const invitationEmail = `launch-proof-${unique}@example.com`;
    await page.getByLabel('Email', { exact: true }).fill(invitationEmail);
    await sendInvitation.click();
    await expect(page.getByRole('alert').filter({ hasText: 'Invitation created.' })).toBeVisible();
    const invitationItem = page.getByRole('listitem').filter({ hasText: invitationEmail });
    await expect(invitationItem).toBeVisible();
    await invitationItem.getByRole('button', { name: 'Revoke' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Invitation revoked.' })).toBeVisible();
    conditionalControlProof.push({
      area: 'settings',
      controls: ['Create API key', 'Revoke key', 'Create webhook', 'Pause webhook', 'Rotate webhook', 'Send invitation', 'Revoke invitation'],
      status: 'passed',
    });
  });
});
