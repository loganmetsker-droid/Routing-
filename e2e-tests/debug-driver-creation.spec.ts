import { test, expect } from '@playwright/test';

const BASE_URL = 'https://frontend-seven-mu-49.vercel.app';
const API_URL = 'https://backend-delta-eight-39.vercel.app';

test('Debug driver creation flow', async ({ page }) => {
  // Enable console logging
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  page.on('response', response => {
    if (response.url().includes('routing-backend')) {
      console.log('API RESPONSE:', response.status(), response.url());
    }
  });

  console.log('1. Navigate to frontend');
  await page.goto(BASE_URL);
  await page.waitForTimeout(2000);

  // Take screenshot of homepage
  await page.screenshot({ path: 'debug-1-homepage.png', fullPage: true });

  console.log('2. Click Drivers menu item');
  await page.click('text=Drivers');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'debug-2-drivers-page.png', fullPage: true });

  console.log('3. Look for Add Driver button');
  const addButton = page.locator('button:has-text("Add Driver")');
  const addButtonCount = await addButton.count();
  console.log('Add Driver button count:', addButtonCount);

  if (addButtonCount > 0) {
    console.log('4. Click Add Driver button');
    await addButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'debug-3-dialog-open.png', fullPage: true });

    console.log('5. Fill in form fields');
    // Material-UI TextField - click and type into the fields by label
    await page.getByLabel('First Name *').click();
    await page.getByLabel('First Name *').fill('Test');
    await page.getByLabel('Last Name *').click();
    await page.getByLabel('Last Name *').fill('Driver');
    await page.getByLabel('Email *').click();
    await page.getByLabel('Email *').fill('test@example.com');
    await page.getByLabel('Phone *').click();
    await page.getByLabel('Phone *').fill('555-1234');
    await page.getByLabel('License Number *').click();
    await page.getByLabel('License Number *').fill('DL12345');
    await page.screenshot({ path: 'debug-4-form-filled.png', fullPage: true });

    console.log('6. Click Save button');
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'debug-5-after-save.png', fullPage: true });

    console.log('7. Check if driver appears in list');
    const driverName = await page.locator('text=Test Driver').count();
    console.log('Driver appears in list:', driverName > 0);
  } else {
    console.log('ERROR: Add Driver button not found!');
  }

  console.log('8. Test direct API call');
  const response = await page.request.get(`${API_URL}/health/ping`);
  console.log('Health check status:', response.status());
  console.log('Health check body:', await response.text());

  const driversResponse = await page.request.get(`${API_URL}/api/drivers`);
  console.log('Drivers API status:', driversResponse.status());
  console.log('Drivers API body:', await driversResponse.text());
});
