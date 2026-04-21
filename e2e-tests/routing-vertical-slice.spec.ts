import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

function readBackendEnv() {
  const envPath = path.join(process.cwd(), 'backend', '.env.local');
  const raw = fs.readFileSync(envPath, 'utf8');
  const env: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    env[key] = rest.join('=').trim();
  }
  return env;
}

const backendEnv = readBackendEnv();
const authEmail = process.env.PLAYWRIGHT_AUTH_EMAIL || backendEnv.AUTH_ADMIN_EMAIL || 'admin@routing.local';
const authPassword = process.env.PLAYWRIGHT_AUTH_PASSWORD || backendEnv.AUTH_ADMIN_PASSWORD || 'LocalAdmin123!';

test('routing vertical slice works end to end in a real authenticated browser session', async ({ page }) => {
  let routeRunId = '';

  await page.goto('/login');
  await page.getByTestId('login-email').fill(authEmail);
  await page.getByTestId('login-password').fill(authPassword);
  await page.getByTestId('login-submit').click();
  await page.waitForFunction(() => Object.keys(localStorage).some((key) => key.toLowerCase().includes('auth')));
  await page.waitForFunction(() => window.location.pathname !== '/login');
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();

  await page.goto('/routing');
  await page.waitForURL('**/routing');
  await expect(page.getByTestId('routing-workspace-page')).toBeVisible();

  const jobCheckboxes = page.locator('[data-testid^="routing-job-checkbox-"]');
  const jobCount = await jobCheckboxes.count();
  expect(jobCount).toBeGreaterThanOrEqual(1);
  for (let index = 0; index < jobCount; index += 1) {
    const checkboxInput = jobCheckboxes.nth(index).locator('input');
    if (await checkboxInput.isChecked()) {
      await checkboxInput.uncheck();
    }
  }
  const selectedJobTargetCount = Math.min(2, jobCount);
  for (let index = 0; index < selectedJobTargetCount; index += 1) {
    await jobCheckboxes.nth(index).locator('input').check();
  }

  const vehicleCheckboxes = page.locator('[data-testid^="routing-vehicle-checkbox-"]');
  const vehicleCount = await vehicleCheckboxes.count();
  expect(vehicleCount).toBeGreaterThanOrEqual(1);
  for (let index = 0; index < vehicleCount; index += 1) {
    const checkboxInput = vehicleCheckboxes.nth(index).locator('input');
    if (await checkboxInput.isChecked()) {
      await checkboxInput.uncheck();
    }
  }
  await vehicleCheckboxes.nth(0).locator('input').check();

  const publishResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/route-plans/') && response.url().endsWith('/publish') && response.request().method() === 'POST',
  );

  await page.getByTestId('routing-generate-draft-button').click();
  await expect(page.getByTestId('routing-draft-route-card-0')).toBeVisible();

  await page.getByTestId('routing-publish-button').click();
  const publishResponse = await publishResponsePromise;
  const publishPayload = await publishResponse.json();
  const publishData = publishPayload?.data ?? publishPayload;
  const routeRuns = Array.isArray(publishData?.routeRuns)
    ? publishData.routeRuns
    : Array.isArray(publishData?.items)
      ? publishData.items
      : [];
  routeRunId = routeRuns[0]?.id || '';
  expect(routeRunId).toBeTruthy();
  expect(Number(routeRuns[0]?.jobCount || 0)).toBeGreaterThan(0);

  await page.waitForURL('**/dispatch');
  await expect(page.getByTestId('dispatch-board-page')).toBeVisible();
  await page.getByTestId(`dispatch-route-card-${routeRunId}`).scrollIntoViewIfNeeded();
  await page.getByTestId(`dispatch-route-dispatch-button-${routeRunId}`).click({ force: true });

  await page.goto(`/route-runs/${routeRunId}`);
  await page.waitForURL(`**/route-runs/${routeRunId}`);
  await expect(page.getByTestId('route-run-detail-page')).toBeVisible();
  await page.getByTestId('route-run-start-button').click();

  const firstStopCard = page.getByTestId('route-run-stop-card-0');
  await expect(firstStopCard).toBeVisible();
  await page.getByTestId('route-run-stop-arrived-button-0').click();

  await page.getByTestId('route-run-stop-note-button-0').click();
  await page.getByTestId('route-run-action-input').fill('Playwright stop note');
  await page.getByTestId('route-run-action-save').click();

  await page.getByTestId('route-run-stop-proof-button-0').click();
  await page.getByTestId('route-run-action-input').fill('https://example.test/playwright-proof.jpg');
  await page.getByTestId('route-run-action-save').click();

  await page.getByTestId('route-run-stop-serviced-button-0').click();
  await page.getByTestId('route-run-complete-button').click();

  await expect(page.getByTestId('route-run-status-chip')).toContainText(/completed/i);
  await expect(page.getByTestId('route-run-stop-timeline-0')).toContainText(/ARRIVED/i);
  await expect(page.getByTestId('route-run-stop-timeline-0')).toContainText(/NOTE_ADDED/i);
  await expect(page.getByTestId('route-run-stop-timeline-0')).toContainText(/PROOF_CAPTURED/i);
  await expect(page.getByTestId('route-run-stop-timeline-0')).toContainText(/SERVICED/i);
  await expect(page.getByTestId('route-run-stop-proofs-0')).toContainText('playwright-proof.jpg');

  await page.goto('/dispatch');
  await expect(page.getByTestId(`dispatch-route-card-${routeRunId}`)).toContainText(/completed/i);

  const auditEvidence = await page.evaluate(async () => {
    const tokenEntry = Object.entries(localStorage).find(([key]) => key.toLowerCase().includes('auth'));
    const token = tokenEntry?.[1] || '';
    const response = await fetch('http://127.0.0.1:3001/api/audit?limit=50', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const payload = await response.json();
    const data = payload?.data ?? payload;
    const items = Array.isArray(data?.entries) ? data.entries : Array.isArray(data?.items) ? data.items : [];
    return items.map((entry: any) => entry.action);
  });

  expect(auditEvidence).toContain('route-plan.published');
  expect(auditEvidence).toContain('route-run.started');
  expect(auditEvidence).toContain('route-run.completed');
  expect(auditEvidence).toContain('route-run-stop.serviced');
});
