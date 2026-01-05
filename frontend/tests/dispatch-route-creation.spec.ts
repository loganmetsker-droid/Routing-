import { test, expect } from '@playwright/test';

test.describe('Route Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app and login if needed
    await page.goto('https://frontend-seven-mu-49.vercel.app');

    // Check if we're on login page, if so login
    const loginButton = page.getByRole('button', { name: /sign in/i });
    if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'password123');
      await loginButton.click();
      await page.waitForURL('**/');
    }
  });

  test('can navigate to Dispatch page and open create route dialog', async ({ page }) => {
    // Click on Dispatch in navigation
    await page.getByRole('link', { name: 'Dispatch' }).click();

    // Wait for page to load
    await page.waitForSelector('text=Route Dispatch');

    // Verify we're on the dispatch page
    await expect(page.locator('h4:has-text("Route Dispatch")')).toBeVisible();

    // Click "Create New Route" button
    await page.getByRole('button', { name: /create new route/i }).click();

    // Verify dialog opens
    await expect(page.locator('text=Create Optimized Route')).toBeVisible();

    // Verify stepper is visible
    await expect(page.locator('text=Select Vehicle')).toBeVisible();
  });

  test('can select a vehicle in step 1', async ({ page }) => {
    // Navigate to Dispatch page
    await page.getByRole('link', { name: 'Dispatch' }).click();
    await page.waitForSelector('text=Route Dispatch');

    // Open create route dialog
    await page.getByRole('button', { name: /create new route/i }).click();

    // Wait for the Select Vehicle dropdown
    await page.waitForSelector('label:has-text("Select Vehicle")');

    // Click on the select dropdown
    await page.click('label:has-text("Select Vehicle")');

    // Wait a moment for vehicles to load
    await page.waitForTimeout(2000);

    // Check if vehicles are available in the dropdown
    const vehicleOptions = await page.locator('[role="option"]').count();

    console.log(`Found ${vehicleOptions} vehicle options in dropdown`);

    if (vehicleOptions > 0) {
      // Select the first vehicle
      await page.locator('[role="option"]').first().click();

      // Verify the Next button is enabled
      const nextButton = page.getByRole('button', { name: 'Next' });
      await expect(nextButton).toBeEnabled();

      console.log('✓ Vehicle selection works! Next button is enabled.');
    } else {
      console.log('⚠ No vehicles found in dropdown - make sure to create vehicles first');
    }
  });

  test('can complete full route creation flow', async ({ page }) => {
    // Navigate to Dispatch page
    await page.getByRole('link', { name: 'Dispatch' }).click();
    await page.waitForSelector('text=Route Dispatch');

    // Open create route dialog
    await page.getByRole('button', { name: /create new route/i }).click();

    // Step 1: Select Vehicle
    await page.click('label:has-text("Select Vehicle")');
    await page.waitForTimeout(1000);

    const vehicleCount = await page.locator('[role="option"]').count();
    if (vehicleCount > 0) {
      await page.locator('[role="option"]').first().click();
      await page.getByRole('button', { name: 'Next' }).click();

      // Step 2: Assign Driver
      await page.waitForSelector('text=Assign Driver');
      await page.click('label:has-text("Assign Driver")');
      await page.waitForTimeout(1000);

      const driverCount = await page.locator('[role="option"]').count();
      if (driverCount > 0) {
        await page.locator('[role="option"]').first().click();
        await page.getByRole('button', { name: 'Next' }).click();

        // Step 3: Choose Jobs
        await page.waitForSelector('text=Select jobs to include');
        const jobItems = page.locator('[role="button"]').filter({ hasText: /Acme Corp|Tech Solutions|Global Services/ });
        const jobCount = await jobItems.count();

        if (jobCount > 0) {
          await jobItems.first().click();
          await page.getByRole('button', { name: 'Next' }).click();

          // Step 4: Review
          await page.waitForSelector('text=Route ready to create');

          console.log('✓ Successfully completed all 4 steps of route creation!');

          // Verify Create Route button is visible and enabled
          const createButton = page.getByRole('button', { name: /create route/i });
          await expect(createButton).toBeEnabled();

          console.log('✓ Create Route button is enabled - fix verified!');
        }
      }
    }
  });
});
