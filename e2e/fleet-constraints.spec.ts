import { expect, test, type Page } from '@playwright/test';
import { preparePreviewSession } from './helpers/preview-session';

async function gotoPreview(page: Page, path: string, role: 'dispatcher' | 'driver' = 'dispatcher') {
  await preparePreviewSession(page, { role });
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.locator('#root').waitFor({ state: 'visible', timeout: 10_000 });
  await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {});
  await expect(page.getByText(/Workspace Failed To Render/i)).toHaveCount(0);
}

test.describe('fleet constraints and load planning', () => {
  test('dispatcher can configure a load-fit vehicle and operating rule', async ({ page }) => {
    await gotoPreview(page, '/vehicles');

    await expect(page.getByRole('heading', { name: 'Fleet Directory' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Available now' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Active exceptions' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Load-fit ready' })).toBeVisible();
    await expect(page.getByRole('row', { name: /Ford Transit.*3,500 lb.*3 pallet positions.*1 operating rule/i })).toBeVisible();

    await page.getByRole('button', { name: 'Add Vehicle' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cargo envelope and pallet fit' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Driver eligibility' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Vehicle operating rules' })).toBeVisible();

    await page.getByLabel('Make').fill('QA');
    await page.getByLabel('Model').fill('Loadfit Box');
    await page.getByLabel('License plate').fill('QA-FIT-1');
    await page.getByLabel('Payload capacity (lb)').fill('12000');
    await page.getByLabel('Volume capacity (cu ft)').fill('900');
    await page.getByLabel('Interior length (in)').fill('240');
    await page.getByLabel('Interior width (in)').fill('96');
    await page.getByLabel('Interior height (in)').fill('96');
    await page.getByLabel('Door height (in)').fill('90');
    await page.getByLabel('Pallet positions').fill('10');
    await page.getByLabel('Max pallet weight (lb)').fill('2400');
    await page.getByLabel('Vehicle features').fill('liftgate, pallet jack');

    await page.getByRole('button', { name: 'Add rule' }).click();
    await page.getByLabel('Rule name').fill('Glass securement');
    await page.getByLabel('Instruction').fill('Use E-track straps and corner protectors.');
    await page.getByRole('button', { name: 'Save Vehicle' }).click();

    await expect(page.getByText('Vehicle added.')).toBeVisible();
    await expect(page.getByRole('row', { name: /QA Loadfit Box.*12,000 lb.*10 pallet positions.*1 operating rule/i })).toBeVisible();
  });

  test('dispatcher sees fit and blocker reasons for fragile pallet work', async ({ page }) => {
    await gotoPreview(page, '/jobs');

    const fitPanel = page.getByTestId('job-fleet-fit-estimate');
    await expect(fitPanel).toBeVisible();
    await expect(fitPanel.getByText(/4 pallets.*4 floor positions.*1,800 lb/i)).toHaveCount(5);
    await expect(fitPanel.getByText('Fits', { exact: true })).toHaveCount(3);
    await expect(fitPanel.getByText('Blocked', { exact: true })).toHaveCount(2);
    await expect(fitPanel.getByText(/missing required feature: liftgate/i)).toHaveCount(2);
    await expect(fitPanel.getByText(/Do not stack\. Glass faces must remain upright and strapped\./i)).toHaveCount(3);
  });

  test('driver receives protected access instructions and vehicle rules', async ({ page }) => {
    await gotoPreview(page, '/driver/route-runs/route-alpha-001', 'driver');

    await expect(page.getByRole('heading', { name: 'Access code required' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '••••' })).toBeVisible();
    await expect(page.getByText(/enter the code at the black keypad/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Vehicle operating rules' })).toBeVisible();
    await expect(page.getByText(/Do not assign to mountain roads requiring more than 9 ft clearance/i)).toBeVisible();

    await page.getByRole('button', { name: 'Reveal' }).click();
    await expect(page.getByRole('heading', { name: '4827' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hide' })).toBeVisible();
  });

  test('dispatcher can save certifications used by driver eligibility rules', async ({ page }) => {
    await gotoPreview(page, '/drivers');

    const annaRow = page.getByRole('row', { name: /Select driver Anna Quinn/i });
    await expect(annaRow).toBeVisible();
    await annaRow.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Certifications').fill('cold_chain, hazmat');
    await page.getByRole('button', { name: 'Save Driver' }).click();

    await expect(page.getByText('Driver updated.')).toBeVisible();
    const certificationList = page.getByTestId('driver-certifications');
    await expect(certificationList.getByText('cold_chain', { exact: true })).toBeVisible();
    await expect(certificationList.getByText('hazmat', { exact: true })).toBeVisible();
  });

  test('dispatcher saves a stable required-driver rule on a job', async ({ page }) => {
    await gotoPreview(page, '/jobs');

    await page.getByRole('button', { name: 'New Job' }).click();
    await page.getByLabel('Customer name').fill('Required Driver QA');
    await page.getByLabel('Delivery address').fill('1701 Wynkoop St, Denver, CO 80202');
    await page.getByRole('combobox', { name: 'Required driver', exact: true }).click();
    await page.getByRole('option', { name: 'Anna Quinn' }).click();
    await expect(page.getByLabel('Access code required')).toBeVisible();
    await page.getByRole('button', { name: 'Create Job' }).click();
    await expect(page.getByRole('alert')).toContainText('Job added with routing constraints');

    const savedRequirement = await page.evaluate(() => {
      const raw = window.localStorage.getItem('trovan-preview-state-v2');
      const state = raw ? JSON.parse(raw) : null;
      const job = state?.jobs?.find((candidate: { customerName?: string }) =>
        candidate.customerName === 'Required Driver QA');
      return job?.routingRequirements;
    });
    expect(savedRequirement).toMatchObject({
      requiredDriverId: 'driver-anna-2',
      requiredDriverName: 'Anna Quinn',
    });
  });
});
