import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const auditEmail = process.env.LAUNCH_AUDIT_EMAIL || process.env.AUTH_ADMIN_EMAIL || 'launch-audit@example.com';
const auditPassword = process.env.LAUNCH_AUDIT_PASSWORD || process.env.AUTH_ADMIN_PASSWORD || 'local-launch-audit-password';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(auditEmail);
  await page.getByTestId('login-password').fill(auditPassword);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('Operations Dashboard', { exact: true })).toBeVisible();
}

async function findCustomer(page: Page, customerName: string) {
  await page.goto('/customers');
  await expect(page.getByTestId('customers-page')).toBeVisible();
  await page.getByPlaceholder('Search customers...').fill(customerName);
  const row = page.getByRole('row').filter({ hasText: customerName });
  await expect(row).toHaveCount(1);
  await row.click();
  return row;
}

async function closeContext(context: BrowserContext) {
  await context.close().catch(() => undefined);
}

test('live core entity data survives reload, sign-out/sign-in, and a fresh browser context', async ({
  browser,
  page,
}) => {
  test.setTimeout(300_000);
  test.skip(
    process.env.PLAYWRIGHT_LIVE_PERSISTENCE !== 'true',
    'Requires the isolated live backend and PostGIS audit database.',
  );
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const customerName = `Launch Audit Customer ${uniqueSuffix}`;
  const updatedNote = `Persistence verified ${uniqueSuffix}`;
  const driverName = `Launch Driver ${uniqueSuffix}`;
  const vehicleModel = `Audit Van ${uniqueSuffix}`;
  const vehicleName = `Launch ${vehicleModel}`;
  const jobCustomerName = `Launch Job ${uniqueSuffix}`;
  const proof: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    baseURL: test.info().project.use.baseURL,
    customerName,
    checkpoints: [],
  };
  const checkpoints = proof.checkpoints as Array<Record<string, unknown>>;

  await login(page);
  checkpoints.push({ checkpoint: 'authenticated-live-session', status: 'passed' });

  await page.goto('/customers');
  await page.getByRole('button', { name: 'Add Customer', exact: true }).click();
  const createDialog = page.getByRole('dialog', { name: 'Add Customer' });
  await createDialog.getByLabel('Customer name').fill(customerName);
  await createDialog.getByLabel('Business name').fill('Launch Audit');
  await createDialog.getByLabel('Phone').fill('312-555-0199');
  await createDialog.getByLabel('Email').fill(`audit-${uniqueSuffix}@example.com`);
  await createDialog.getByLabel('Default address').fill('100 Persistence Way, Chicago, IL');
  await createDialog.getByLabel('Notes').fill('Created by the launch persistence audit.');

  const createResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/api/customers'),
  );
  await createDialog.getByRole('button', { name: 'Save Customer' }).click();
  const createResponse = await createResponsePromise;
  expect(createResponse.ok()).toBeTruthy();
  const createPayload = await createResponse.json();
  const customerId = createPayload?.data?.customer?.id as string | undefined;
  expect(customerId).toBeTruthy();
  await expect(page.getByText('Customer created.')).toBeVisible();
  checkpoints.push({
    checkpoint: 'create-through-ui-and-api',
    status: 'passed',
    responseStatus: createResponse.status(),
    customerId,
  });

  await findCustomer(page, customerName);
  await page.getByRole('button', { name: 'Edit customer', exact: true }).click();
  const editDialog = page.getByRole('dialog', { name: 'Edit Customer' });
  await editDialog.getByLabel('Notes').fill(updatedNote);
  const updateResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url().endsWith(`/api/customers/${customerId}`),
  );
  await editDialog.getByRole('button', { name: 'Save Customer' }).click();
  const updateResponse = await updateResponsePromise;
  expect(updateResponse.ok()).toBeTruthy();
  await expect(page.getByText('Customer updated.')).toBeVisible();
  checkpoints.push({
    checkpoint: 'update-through-ui-and-api',
    status: 'passed',
    responseStatus: updateResponse.status(),
  });

  await page.goto('/drivers');
  await page.getByRole('button', { name: 'Add Driver', exact: true }).click();
  const driverDialog = page.getByRole('dialog', { name: 'Add Driver' });
  await driverDialog.getByLabel('First name').fill('Launch');
  await driverDialog.getByLabel('Last name').fill(`Driver ${uniqueSuffix}`);
  await driverDialog.getByLabel('Email').fill(`driver-${uniqueSuffix}@example.com`);
  await driverDialog.getByLabel('Phone').fill('312-555-0188');
  await driverDialog.getByLabel('License number').fill(`AUDIT-${uniqueSuffix}`);
  const driverResponsePromise = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/api/drivers'),
  );
  await driverDialog.getByRole('button', { name: 'Save Driver' }).click();
  const driverResponse = await driverResponsePromise;
  expect(driverResponse.ok()).toBeTruthy();
  const driverPayload = await driverResponse.json();
  const driverId = driverPayload?.data?.driver?.id as string | undefined;
  expect(driverId).toBeTruthy();
  await expect(page.getByText(driverName, { exact: true }).first()).toBeVisible();
  checkpoints.push({ checkpoint: 'driver-create-through-ui-and-api', status: 'passed', responseStatus: driverResponse.status(), driverId });

  await page.goto('/vehicles');
  await page.getByRole('button', { name: 'Add Vehicle', exact: true }).click();
  const vehicleDialog = page.getByRole('dialog', { name: 'Add Vehicle' });
  await vehicleDialog.getByLabel('Make').fill('Launch');
  await vehicleDialog.getByLabel('Model').fill(vehicleModel);
  await vehicleDialog.getByLabel('Year').fill('2026');
  await vehicleDialog.getByLabel('License plate').fill(`LA${uniqueSuffix}`.replace(/[^A-Za-z0-9]/g, '').slice(0, 12));
  await vehicleDialog.getByLabel('VIN').fill(`VIN${uniqueSuffix}`.replace(/[^A-Za-z0-9]/g, '').slice(0, 17));
  await vehicleDialog.getByLabel('Capacity', { exact: true }).fill('2400');
  const vehicleResponsePromise = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/api/vehicles'),
  );
  await vehicleDialog.getByRole('button', { name: 'Save Vehicle' }).click();
  const vehicleResponse = await vehicleResponsePromise;
  expect(vehicleResponse.ok()).toBeTruthy();
  const vehiclePayload = await vehicleResponse.json();
  const vehicleId = vehiclePayload?.data?.vehicle?.id as string | undefined;
  expect(vehicleId).toBeTruthy();
  await expect(page.getByText(vehicleName, { exact: true }).first()).toBeVisible();
  checkpoints.push({ checkpoint: 'vehicle-create-through-ui-and-api', status: 'passed', responseStatus: vehicleResponse.status(), vehicleId });

  await page.goto('/jobs');
  await page.getByRole('button', { name: 'New Job', exact: true }).click();
  const jobDialog = page.getByRole('dialog', { name: 'Create Job' });
  await jobDialog.getByRole('combobox', { name: 'Customer', exact: true }).click();
  await page.getByRole('option', { name: customerName, exact: true }).click();
  await jobDialog.getByLabel('Customer name').fill(jobCustomerName);
  await jobDialog.getByLabel('Delivery address').fill('200 Durable Data Ave, Chicago, IL');
  await jobDialog.getByLabel('Pickup address').fill('100 Persistence Way, Chicago, IL');
  const jobResponsePromise = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/api/jobs'),
  );
  await jobDialog.getByRole('button', { name: 'Create Job' }).click();
  const jobResponse = await jobResponsePromise;
  expect(jobResponse.ok()).toBeTruthy();
  const jobPayload = await jobResponse.json();
  const jobId = jobPayload?.data?.job?.id as string | undefined;
  expect(jobId).toBeTruthy();
  await expect(page.getByRole('alert').filter({ hasText: 'Job added with routing constraints and readiness context.' })).toBeVisible();
  checkpoints.push({ checkpoint: 'job-create-through-ui-and-api', status: 'passed', responseStatus: jobResponse.status(), jobId });

  await page.reload();
  await findCustomer(page, customerName);
  await expect(page.getByText(updatedNote).first()).toBeVisible();
  await page.goto('/drivers');
  await page.getByPlaceholder('Search drivers...').fill(driverName);
  await expect(page.getByRole('row').filter({ hasText: driverName })).toHaveCount(1);
  await page.goto('/vehicles');
  await expect(page.getByText(vehicleName, { exact: true }).first()).toBeVisible();
  await page.goto('/jobs');
  await page.getByPlaceholder('Search jobs, customers, addresses...').fill(jobCustomerName);
  await expect(page.getByRole('row').filter({ hasText: jobCustomerName })).toHaveCount(1);
  checkpoints.push({ checkpoint: 'browser-reload-all-core-entities', status: 'passed' });

  await page.getByRole('button', { name: /Open account menu for/ }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  const tokenAfterSignOut = await page.evaluate(() =>
    window.localStorage.getItem('authToken'),
  );
  expect(tokenAfterSignOut).toBeNull();
  checkpoints.push({ checkpoint: 'sign-out-clears-session', status: 'passed' });

  await login(page);
  await findCustomer(page, customerName);
  await expect(page.getByText(updatedNote).first()).toBeVisible();
  checkpoints.push({ checkpoint: 'sign-out-sign-in-round-trip', status: 'passed' });

  const freshContext = await browser.newContext();
  try {
    const freshPage = await freshContext.newPage();
    await login(freshPage);
    await findCustomer(freshPage, customerName);
    await expect(freshPage.getByText(updatedNote).first()).toBeVisible();
    const apiProof = await freshPage.evaluate(async (expected) => {
      const token = window.localStorage.getItem('authToken');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const paths = ['customers', 'drivers', 'vehicles', 'jobs'] as const;
      const responses = await Promise.all(paths.map(async (path) => {
        const response = await fetch(`http://127.0.0.1:3005/api/${path}`, { headers });
        return { path, status: response.status, payload: await response.json() };
      }));
      const list = (payload: any, key: string) => payload?.data?.[key] ?? payload?.data?.items ?? payload?.data ?? [];
      return {
        statuses: Object.fromEntries(responses.map((response) => [response.path, response.status])),
        customerFound: list(responses[0].payload, 'customers').some((item: any) => item?.id === expected.customerId),
        driverFound: list(responses[1].payload, 'drivers').some((item: any) => item?.id === expected.driverId),
        vehicleFound: list(responses[2].payload, 'vehicles').some((item: any) => item?.id === expected.vehicleId),
        jobFound: list(responses[3].payload, 'jobs').some((item: any) => item?.id === expected.jobId),
      };
    }, { customerId, driverId, vehicleId, jobId });
    expect(Object.values(apiProof.statuses)).toEqual([200, 200, 200, 200]);
    expect(apiProof.customerFound).toBe(true);
    expect(apiProof.driverFound).toBe(true);
    expect(apiProof.vehicleFound).toBe(true);
    expect(apiProof.jobFound).toBe(true);
    checkpoints.push({
      checkpoint: 'fresh-browser-context-and-api-read-all-core-entities',
      status: 'passed',
      responseStatuses: apiProof.statuses,
    });
  } finally {
    await closeContext(freshContext);
  }

  const artifactDirectory = resolve(process.cwd(), '.codex/launch-audit');
  mkdirSync(artifactDirectory, { recursive: true });
  writeFileSync(
    resolve(artifactDirectory, 'persistence-proof.json'),
    `${JSON.stringify({ ...proof, customerId, driverId, vehicleId, jobId, status: 'passed' }, null, 2)}\n`,
    'utf8',
  );
});
