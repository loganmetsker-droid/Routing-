import { expect, test, type Page } from '@playwright/test';
import { preparePreviewSession } from './helpers/preview-session';

const authToken =
  process.env.STAGING_DRIVER_AUTH_TOKEN ||
  process.env.LAUNCH_AUDIT_DRIVER_AUTH_TOKEN ||
  process.env.LAUNCH_AUDIT_AUTH_TOKEN ||
  process.env.STAGING_AUTH_TOKEN ||
  '';

async function gotoReady(page: Page, routePath: string) {
  await preparePreviewSession(page, {
    role: 'driver',
    authToken,
  });
  await page.goto(routePath, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.locator('#root').waitFor({ state: 'visible', timeout: 10_000 });
  await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {});
  await expect(page.getByText(/Workspace Failed To Render/i)).toHaveCount(0);
  await expect(page.getByText(/Preview mode is enabled/i)).toHaveCount(0);
}

async function drawSignature(page: Page) {
  const canvas = page.getByLabel(/signature canvas/i);
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;
  await page.mouse.move(box.x + box.width * 0.18, box.y + box.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.34, box.y + box.height * 0.38);
  await page.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.68);
  await page.mouse.move(box.x + box.width * 0.76, box.y + box.height * 0.42);
  await page.mouse.up();
}

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    docScrollWidth: document.documentElement.scrollWidth,
    docClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
  }));
  expect(metrics.docScrollWidth).toBeLessThanOrEqual(metrics.docClientWidth + 1);
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.bodyClientWidth + 1);
}

test.describe('driver mobile execution flow', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('driver-only session is redirected away from dispatch console routes', async ({ page }) => {
    await gotoReady(page, '/dispatch');
    await expect(page).toHaveURL(/\/driver$/);
    await expect(page.getByText(/Dispatcher console|Dispatch Board|Routing workspace|Dashboard/i)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Anna Quinn/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('driver can complete the guided arrive, proof, message, and depart flow', async ({ page }) => {
    const failedResponses: string[] = [];
    page.on('response', (response) => {
      if (response.status() >= 500) {
        failedResponses.push(`${response.status()} ${response.url()}`);
      }
    });

    await gotoReady(page, '/driver');
    await expect(page.getByRole('heading', { name: /Anna Quinn/i })).toBeVisible();
    await expect(page.getByText(/Dispatcher console|Dispatch Board|Routing workspace|Dashboard/i)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await page.getByRole('link', { name: /start stop flow/i }).first().click();

    await expect(page.getByRole('heading', { name: /Stop 1 of 1/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expect(page.getByRole('button', { name: /^Depart$/i })).toHaveCount(0);

    await page.getByRole('button', { name: /^Arrive$/i }).click();
    await expect(page.getByText(/Arrival recorded/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /capture signature/i })).toBeVisible();

    await page.getByRole('button', { name: 'Stop details', exact: true }).click();
    await page.getByLabel(/driver note/i).fill('Gate was clear during Playwright QA.');
    await page.getByRole('button', { name: /save note/i }).click();
    await expect(page.getByText(/Note saved/i)).toBeVisible();
    await page.getByRole('button', { name: /close stop details/i }).click();

    await page.getByRole('button', { name: 'Message dispatch', exact: true }).click();
    await page.getByLabel(/message dispatch/i).fill('Playwright QA check-in from driver.');
    await page.getByRole('button', { name: /send message/i }).click();
    await expect(page.getByText('Playwright QA check-in from driver.')).toBeVisible();
    await page.getByRole('button', { name: /close messages/i }).click();

    await page.getByRole('button', { name: /capture signature/i }).click();
    await page.getByLabel(/signer name/i).fill('Pat Receiver');
    await drawSignature(page);
    await expect(page.getByRole('button', { name: /accept signature/i })).toBeEnabled();
    await page.getByRole('button', { name: /accept signature/i }).click();

    await expect(page.getByText(/Signature captured/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /upload bol/i })).toBeVisible();
    await page.getByLabel(/BOL file/i).setInputFiles({
      name: 'qa-bol.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n% Trovan QA BOL\n'),
    });
    await expect(page.getByText(/BOL uploaded/i)).toBeVisible();

    await expect(page.getByRole('button', { name: /upload document/i })).toBeVisible();
    await page.getByLabel(/Document file/i).setInputFiles({
      name: 'qa-document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n% Trovan QA document\n'),
    });
    await expect(page.getByText(/Document uploaded/i)).toBeVisible();

    await expect(page.getByRole('button', { name: /^Depart$/i })).toBeEnabled();
    await page.getByRole('button', { name: /^Depart$/i }).click();

    await expect(page.getByText(/Departed. Next stop loaded/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Route complete' }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(failedResponses).toEqual([]);
  });
});
