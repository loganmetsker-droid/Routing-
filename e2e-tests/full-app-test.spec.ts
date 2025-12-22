import { test, expect } from '@playwright/test';

const BASE_URL = 'https://frontend-seven-mu-49.vercel.app';

test.describe('Full App E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test('1. Add a new driver and verify it persists', async ({ page }) => {
    // Navigate to Drivers page
    await page.click('text=Drivers');
    await page.waitForLoadState('networkidle');

    // Click "Add Driver" button
    await page.click('button:has-text("Add Driver")');

    // Fill in driver details
    const driverName = `Test Driver ${Date.now()}`;
    const driverEmail = `driver${Date.now()}@test.com`;
    const driverPhone = '555-123-4567';
    const driverLicense = `DL${Date.now()}`;

    await page.fill('input[name="name"]', driverName);
    await page.fill('input[name="email"]', driverEmail);
    await page.fill('input[name="phone"]', driverPhone);
    await page.fill('input[name="licenseNumber"]', driverLicense);

    // Save driver
    await page.click('button:has-text("Save")');

    // Wait for success message or dialog to close
    await page.waitForTimeout(2000);

    // Verify driver appears in the list
    await expect(page.locator(`text=${driverName}`)).toBeVisible();

    // Reload page and verify driver still exists
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator(`text=${driverName}`)).toBeVisible();

    // Click on the driver to verify details
    await page.click(`text=${driverName}`);
    await page.waitForTimeout(1000);

    // Verify all fields are populated correctly
    await expect(page.locator(`text=${driverEmail}`)).toBeVisible();
    await expect(page.locator(`text=${driverPhone}`)).toBeVisible();
  });

  test('2. Add a new vehicle and assign to driver', async ({ page }) => {
    // Navigate to Vehicles page
    await page.click('text=Vehicles');
    await page.waitForLoadState('networkidle');

    // Click "Add Vehicle" button
    await page.click('button:has-text("Add Vehicle")');

    // Fill in vehicle details
    const vehiclePlate = `ABC${Date.now()}`;
    const vehicleMake = 'Ford';
    const vehicleModel = 'Transit';
    const vehicleYear = '2023';

    await page.fill('input[name="licensePlate"]', vehiclePlate);
    await page.fill('input[name="make"]', vehicleMake);
    await page.fill('input[name="model"]', vehicleModel);
    await page.fill('input[name="year"]', vehicleYear);

    // Save vehicle
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(2000);

    // Verify vehicle appears in the list
    await expect(page.locator(`text=${vehiclePlate}`)).toBeVisible();

    // Reload and verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator(`text=${vehiclePlate}`)).toBeVisible();
  });

  test('3. Add customers with validated addresses', async ({ page }) => {
    // Navigate to Customers/Jobs page
    await page.click('text=Jobs');
    await page.waitForLoadState('networkidle');

    // Click "Add Customer" or "Add Job"
    await page.click('button:has-text("Add")');

    // Test multiple real addresses
    const customers = [
      {
        company: 'Acme Corp',
        address: '1600 Amphitheatre Parkway, Mountain View, CA, 94043'
      },
      {
        company: 'Tech Solutions Inc',
        address: '1 Apple Park Way, Cupertino, CA, 95014'
      },
      {
        company: 'Global Services LLC',
        address: '350 5th Ave, New York, NY, 10118' // Empire State Building
      }
    ];

    for (const customer of customers) {
      // Fill in customer details
      await page.fill('input[name="companyName"]', customer.company);
      await page.fill('input[name="address"]', customer.address);

      // Wait for address validation
      await page.waitForTimeout(1500);

      // Check if address validation passed (look for green checkmark or no error)
      const hasError = await page.locator('text=Invalid address').isVisible().catch(() => false);
      expect(hasError).toBe(false);

      // Save customer
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(2000);

      // Verify customer appears
      await expect(page.locator(`text=${customer.company}`)).toBeVisible();

      // Add next customer
      if (customers.indexOf(customer) < customers.length - 1) {
        await page.click('button:has-text("Add")');
      }
    }

    // Reload and verify all customers persist
    await page.reload();
    await page.waitForLoadState('networkidle');

    for (const customer of customers) {
      await expect(page.locator(`text=${customer.company}`)).toBeVisible();
    }
  });

  test('4. Create and optimize routes', async ({ page }) => {
    // Navigate to Routes page
    await page.click('text=Routes');
    await page.waitForLoadState('networkidle');

    // Click "Create Route" or "Optimize Route"
    await page.click('button:has-text("Create Route")');

    // Fill in route details
    const routeName = `Route ${Date.now()}`;
    await page.fill('input[name="name"]', routeName);

    // Select jobs/stops for the route
    // This will depend on your UI - might be checkboxes or a multi-select
    await page.click('text=Select Jobs');
    await page.click('[role="option"]:first-child');
    await page.click('[role="option"]:nth-child(2)');
    await page.click('[role="option"]:nth-child(3)');

    // Click "Optimize Route" button
    await page.click('button:has-text("Optimize")');

    // Wait for route optimization to complete
    await page.waitForTimeout(5000);

    // Verify optimized route is displayed
    await expect(page.locator('text=Optimized')).toBeVisible();

    // Check that route shows on map
    await expect(page.locator('.leaflet-container')).toBeVisible();

    // Save the route
    await page.click('button:has-text("Save Route")');
    await page.waitForTimeout(2000);

    // Verify route appears in routes list
    await expect(page.locator(`text=${routeName}`)).toBeVisible();

    // Reload and verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator(`text=${routeName}`)).toBeVisible();
  });

  test('5. Assign optimized route to driver', async ({ page }) => {
    // Navigate to Dispatch page
    await page.click('text=Dispatch');
    await page.waitForLoadState('networkidle');

    // Find a route that needs assignment
    const routeCard = page.locator('[data-testid="route-card"]').first();
    await routeCard.click();

    // Click "Assign Driver" button
    await page.click('button:has-text("Assign Driver")');

    // Select a driver from dropdown
    await page.click('[role="combobox"]');
    await page.click('[role="option"]:first-child');

    // Confirm assignment
    await page.click('button:has-text("Confirm")');
    await page.waitForTimeout(2000);

    // Verify driver is assigned
    await expect(page.locator('text=Assigned to')).toBeVisible();

    // Reload and verify assignment persists
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Assigned to')).toBeVisible();
  });

  test('6. End-to-end workflow: Driver → Vehicle → Customer → Route → Assignment', async ({ page }) => {
    const timestamp = Date.now();

    // Step 1: Create Driver
    await page.click('text=Drivers');
    await page.click('button:has-text("Add Driver")');
    await page.fill('input[name="name"]', `E2E Driver ${timestamp}`);
    await page.fill('input[name="email"]', `e2e${timestamp}@test.com`);
    await page.fill('input[name="phone"]', '555-999-8888');
    await page.fill('input[name="licenseNumber"]', `E2E${timestamp}`);
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(2000);

    // Step 2: Create Vehicle
    await page.click('text=Vehicles');
    await page.click('button:has-text("Add Vehicle")');
    await page.fill('input[name="licensePlate"]', `E2E${timestamp}`);
    await page.fill('input[name="make"]', 'Toyota');
    await page.fill('input[name="model"]', 'Tacoma');
    await page.fill('input[name="year"]', '2024');
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(2000);

    // Step 3: Create Customers with real addresses
    await page.click('text=Jobs');
    const addresses = [
      '1 Microsoft Way, Redmond, WA, 98052',
      '410 Terry Ave N, Seattle, WA, 98109', // Amazon
      '2150 Shattuck Ave, Berkeley, CA, 94704'
    ];

    for (let i = 0; i < addresses.length; i++) {
      await page.click('button:has-text("Add")');
      await page.fill('input[name="companyName"]', `E2E Customer ${i + 1}`);
      await page.fill('input[name="address"]', addresses[i]);
      await page.waitForTimeout(1500); // Address validation
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(2000);
    }

    // Step 4: Create and optimize route
    await page.click('text=Routes');
    await page.click('button:has-text("Create Route")');
    await page.fill('input[name="name"]', `E2E Route ${timestamp}`);

    // Select all jobs
    await page.click('text=Select Jobs');
    for (let i = 0; i < 3; i++) {
      await page.click(`[role="option"]:nth-child(${i + 1})`);
    }

    // Optimize
    await page.click('button:has-text("Optimize")');
    await page.waitForTimeout(5000);

    // Save route
    await page.click('button:has-text("Save Route")');
    await page.waitForTimeout(2000);

    // Step 5: Assign to driver
    await page.click('text=Dispatch');
    await page.click(`text=E2E Route ${timestamp}`);
    await page.click('button:has-text("Assign Driver")');
    await page.click('[role="combobox"]');
    await page.click(`text=E2E Driver ${timestamp}`);
    await page.click('button:has-text("Confirm")');
    await page.waitForTimeout(2000);

    // Final verification
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator(`text=E2E Driver ${timestamp}`)).toBeVisible();
    await expect(page.locator(`text=E2E Route ${timestamp}`)).toBeVisible();
  });

  test('7. Verify data persistence after browser refresh', async ({ page }) => {
    // Load initial state
    await page.click('text=Dashboard');
    await page.waitForLoadState('networkidle');

    // Get counts of existing data
    const driverCountBefore = await page.locator('[data-testid="driver-count"]').textContent();
    const vehicleCountBefore = await page.locator('[data-testid="vehicle-count"]').textContent();
    const routeCountBefore = await page.locator('[data-testid="route-count"]').textContent();

    // Reload page multiple times
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify counts haven't changed
    const driverCountAfter = await page.locator('[data-testid="driver-count"]').textContent();
    const vehicleCountAfter = await page.locator('[data-testid="vehicle-count"]').textContent();
    const routeCountAfter = await page.locator('[data-testid="route-count"]').textContent();

    expect(driverCountAfter).toBe(driverCountBefore);
    expect(vehicleCountAfter).toBe(vehicleCountBefore);
    expect(routeCountAfter).toBe(routeCountBefore);
  });
});
