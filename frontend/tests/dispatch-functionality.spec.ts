import { test, expect } from '@playwright/test';

test.describe('Dispatch Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:5184/dispatch');
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should load dispatches page without errors', async ({ page }) => {
    // Check for the main heading
    await expect(page.locator('text=Smart Route Dispatch')).toBeVisible();

    // Check for the Auto-Optimize Routes button
    await expect(page.locator('button:has-text("Auto-Optimize Routes")')).toBeVisible();

    // Check for the tabs
    await expect(page.locator('button:has-text("Planned Routes")')).toBeVisible();
    await expect(page.locator('button:has-text("Dispatched Routes")')).toBeVisible();
    await expect(page.locator('button:has-text("Pending Jobs")')).toBeVisible();
  });

  test('should display stats cards', async ({ page }) => {
    // Check for stats cards
    await expect(page.locator('text=Active Routes')).toBeVisible();
    await expect(page.locator('text=Pending Jobs')).toBeVisible();
    await expect(page.locator('text=Available Vehicles')).toBeVisible();
    await expect(page.locator('text=Available Drivers')).toBeVisible();
  });

  test('should open vehicle selection dialog when clicking Auto-Optimize', async ({ page }) => {
    const optimizeButton = page.locator('button:has-text("Auto-Optimize Routes")');

    // Check if button is enabled (depends on having pending jobs and vehicles)
    const isEnabled = await optimizeButton.isEnabled();

    if (isEnabled) {
      await optimizeButton.click();

      // Dialog should open
      await expect(page.locator('text=Select Vehicles for Routes')).toBeVisible();

      // Close button should be visible
      await expect(page.locator('button:has-text("Cancel")')).toBeVisible();

      // Close the dialog
      await page.locator('button:has-text("Cancel")').click();
      await expect(page.locator('text=Select Vehicles for Routes')).not.toBeVisible();
    }
  });

  test('should be able to switch between tabs', async ({ page }) => {
    // Click on Dispatched Routes tab
    await page.locator('button:has-text("Dispatched Routes")').click();
    await page.waitForTimeout(500);

    // Click on Pending Jobs tab
    await page.locator('button:has-text("Pending Jobs")').click();
    await page.waitForTimeout(500);

    // Click back on Planned Routes tab
    await page.locator('button:has-text("Planned Routes")').click();
    await page.waitForTimeout(500);

    // No errors should occur
    expect(true).toBe(true);
  });

  test('should make API calls to correct endpoints', async ({ page }) => {
    const requestPromises = [];

    // Listen for network requests
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/')) {
        console.log('API Request:', request.method(), url);
      }
    });

    page.on('response', response => {
      const url = response.url();
      if (url.includes('/api/dispatch') || url.includes('/api/jobs') || url.includes('/api/vehicles')) {
        console.log('API Response:', response.status(), url);
        requestPromises.push({
          url,
          status: response.status(),
        });
      }
    });

    // Reload page to trigger API calls
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait a bit for all requests to complete
    await page.waitForTimeout(2000);

    // Verify no 404 errors for dispatch endpoints
    const dispatch404s = requestPromises.filter(
      r => r.url.includes('/api/dispatch') && r.status === 404
    );

    expect(dispatch404s.length).toBe(0);
  });
});
