import { expect, test } from '@playwright/test';
import { implementationGuideSections } from '../shared/contracts/implementationGuide';
import { preparePreviewSession } from './helpers/preview-session';

test.describe('Trovan self-service onboarding', () => {
  test('public support search and launch docket downloads are real', async ({ page, request }) => {
    await page.goto('/support');
    await expect(page.getByRole('heading', { name: /Common questions, answered clearly/i })).toBeVisible();
    await page.getByRole('textbox', { name: /Search the Trovan knowledge base/i }).fill('provider-backed');
    await expect(page.getByText('1 answer found')).toBeVisible();
    await expect(page.getByText(/What does provider-backed mean/i)).toBeVisible();
    await page.getByRole('textbox', { name: /Search the Trovan knowledge base/i }).fill('CSV import rejects the file');
    await expect(page.getByText('CSV import rejects the file', { exact: true })).toBeVisible();

    await page.goto('/resources/downloads');
    await expect(page.getByRole('heading', { name: /Everything a customer needs to implement Trovan/i })).toBeVisible();
    const docket = await request.get('/downloads/trovan-customer-launch-docket-v1.zip');
    const pdf = await request.get('/downloads/trovan-customer-launch-docket-v1.pdf');
    expect(docket.ok()).toBe(true);
    expect(pdf.ok()).toBe(true);
    expect((await docket.body()).length).toBeGreaterThan(10_000);
    expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');
  });

  test('Owner can use all eight stages, 21 procedures, pictures, Q&A, and troubleshooting', async ({ page, request }) => {
    await preparePreviewSession(page, { role: 'owner' });
    await page.goto('/academy/guide');
    await expect(page.getByRole('heading', { name: /Click-by-click launch instructions/i })).toBeVisible();
    await expect(page.getByRole('navigation', { name: /Implementation guide index/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Start-to-finish program index/i })).toBeVisible();
    await expect(page.getByTestId('implementation-stage')).toHaveCount(8);
    await expect(page.locator('[id^="guide-"]')).toHaveCount(21);
    await expect(page.getByText(/Choose the format that works for you/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Assign the Customer Champion/i })).toBeVisible();
    await expect(page.getByRole('img', { name: /Academy overview with the Launch readiness panel/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Common Q&A/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Troubleshooting', exact: true })).toBeVisible();

    await page.getByRole('textbox', { name: /Search written implementation guide/i }).fill('proof will not save');
    const troubleshootingItem = page.getByText('Arrival, departure, or proof will not save', { exact: true });
    await expect(troubleshootingItem).toBeVisible();
    await troubleshootingItem.click();
    await expect(page.getByText(/Network interruption, missing required field/i)).toBeVisible();

    for (const src of new Set(implementationGuideSections.map((section) => section.screenshot.src))) {
      const image = await request.get(src);
      expect(image.ok(), `${src} should load`).toBe(true);
      expect(image.headers()['content-type']).toMatch(/^image\//);
      expect((await image.body()).length).toBeGreaterThan(1_000);
    }
  });

  test('Owner completes a versioned Academy lesson and sees persisted progress', async ({ page }) => {
    await preparePreviewSession(page, { role: 'owner' });
    await page.goto('/academy');
    await expect(page.getByRole('heading', { name: /Launch one route day at a time/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Download launch docket/i })).toHaveAttribute('href', /trovan-customer-launch-docket-v1\.zip/);

    await page.getByRole('link', { name: /^Watch video$/ }).first().click();
    await expect(page.getByRole('heading', { name: /Start here: own the rollout/i })).toBeVisible();
    await expect(page.locator('video source')).toHaveAttribute('src', /start-here\.mp4/);
    await expect(page.locator('track[kind="captions"]')).toHaveAttribute('src', /start-here\.vtt/);
    await expect(page.getByRole('button', { name: /0:00 · How customer-led implementation works/i })).toBeVisible();
    await page.getByRole('button', { name: /0:28 · Champion ownership and team roles/i }).click();
    await expect.poll(() => page.locator('#training-video').evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThanOrEqual(28);
    await page.getByRole('radio', { name: 'The customer Champion' }).check();
    await page.getByRole('radio', { name: 'One 30-minute readiness review' }).check();
    await page.getByRole('button', { name: /Submit knowledge check/i }).click();
    await expect(page.getByText(/Passed with 100%/i)).toBeVisible();

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('trovan.preview.onboarding-progress.v1') || '[]'));
    expect(stored).toEqual(expect.arrayContaining([expect.objectContaining({ moduleKey: 'start-here', status: 'COMPLETED', score: 100, contentVersion: '1.2.0' })]));
    await page.getByRole('link', { name: /Back to Academy/i }).click();
    await expect(page.getByRole('link', { name: 'Review video' }).first()).toBeVisible();
  });

  test('Driver Quick Start is mobile-safe and captioned', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await preparePreviewSession(page, { role: 'driver' });
    await page.goto('/driver/help');
    await expect(page.getByRole('heading', { name: 'Driver Quick Start' })).toBeVisible();
    await expect(page.locator('track[kind="captions"]')).toHaveAttribute('src', /driver-quick-start\.vtt/);
    const metrics = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(metrics.scroll).toBeLessThanOrEqual(metrics.client + 1);
  });
});
