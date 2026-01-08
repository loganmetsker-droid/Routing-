// backend/seed-multi.ts
import { DataSource } from 'typeorm';
import { Driver } from './src/modules/drivers/entities/driver.entity';
import { Vehicle } from './src/modules/vehicles/entities/vehicle.entity';
import { Job } from './src/modules/jobs/entities/job.entity';
import { Route, RouteStatus } from './src/modules/dispatch/entities/route.entity';
import { AppDataSource } from './src/data-source';

type Address = {
  street: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
};

function generateAddresses(): Address[] {
  const streets = ['Main St', 'Oak Ave', 'Pine Rd', 'Elm St', 'Maple Ln', 'Cedar Ct'];
  const cities = ['Denver', 'Aurora', 'Boulder', 'Lakewood', 'Englewood'];
  const states = ['CO'];
  const zips = ['80202', '80203', '80204', '80205', '80206'];

  const addresses: Address[] = [];
  for (let i = 0; i < 20; i++) {
    addresses.push({
      street: `${Math.floor(Math.random() * 999)} ${streets[Math.floor(Math.random() * streets.length)]}`,
      street2: Math.random() > 0.5 ? `Apt ${Math.floor(Math.random() * 999)}` : '',
      city: cities[Math.floor(Math.random() * cities.length)],
      state: states[0],
      zip: zips[Math.floor(Math.random() * zips.length)],
    });
  }
  return addresses;
}

async function seed() {
  await AppDataSource.initialize();
  console.log('Database connected ✅');

  // --- Clear existing test data first ---
  const routeRepo = AppDataSource.getRepository(Route);
  const jobRepo = AppDataSource.getRepository(Job);
  const vehicleRepo = AppDataSource.getRepository(Vehicle);
  const driverRepo = AppDataSource.getRepository(Driver);

  console.log('Clearing existing test data...');
  // Delete in correct order to avoid foreign key constraints
  await AppDataSource.query('DELETE FROM routes');
  await AppDataSource.query('DELETE FROM jobs');
  await AppDataSource.query('DELETE FROM vehicles');
  await AppDataSource.query('DELETE FROM drivers');
  console.log('Existing test data cleared ✅');

  // --- 1. Create Drivers ---
  const drivers = [
    driverRepo.create({
      firstName: 'Alice',
      lastName: 'Johnson',
      email: 'alice@example.com',
      phone: '555-0101',
      licenseNumber: 'DL-ALICE-001',
      licenseExpiryDate: new Date('2027-12-31'),
      roles: ['DRIVER'],
    }),
    driverRepo.create({
      firstName: 'Bob',
      lastName: 'Smith',
      email: 'bob@example.com',
      phone: '555-0102',
      licenseNumber: 'DL-BOB-002',
      licenseExpiryDate: new Date('2027-12-31'),
      roles: ['DRIVER'],
    }),
    driverRepo.create({
      firstName: 'Charlie',
      lastName: 'Brown',
      email: 'charlie@example.com',
      phone: '555-0103',
      licenseNumber: 'DL-CHARLIE-003',
      licenseExpiryDate: new Date('2027-12-31'),
      roles: ['DRIVER'],
    }),
  ];
  await driverRepo.save(drivers);
  console.log('Drivers created ✅');

  // --- 2. Create Vehicles ---
  const vehicles = drivers.map((driver, i) =>
    vehicleRepo.create({
      make: 'Ford',
      model: `Transit ${i + 1}`,
      year: 2023,
      licensePlate: `ABC${100 + i}`,
      vehicleType: 'van',
      fuelType: 'diesel',
      currentLocation: { lat: 39.7392 + i * 0.001, lng: -104.9903 - i * 0.001 },
    }),
  );
  await vehicleRepo.save(vehicles);
  console.log('Vehicles created ✅');

  // --- 3. Generate Jobs ---
  const addresses = generateAddresses();
  const jobs: Job[] = [];

  const statuses = ['unscheduled', 'scheduled', 'in_progress', 'completed'];
  const billingStatuses = ['unpaid', 'paid'];

  for (let i = 0; i < 20; i++) {
    const pickup = addresses[i];
    const delivery = addresses[(i + 10) % 20];
    const status = statuses[i % 4];
    const hasStartDate = status !== 'unscheduled';
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + (i - 10)); // Mix of past and future jobs

    jobs.push(
      jobRepo.create({
        customerName: `Customer ${i + 1}`,
        customerPhone: `555-02${String(i).padStart(2, '0')}`,
        customerEmail: `customer${i + 1}@example.com`,
        // Legacy format address
        pickupAddress: `${pickup.street}${pickup.street2 ? ', ' + pickup.street2 : ''}, ${pickup.city}, ${pickup.state} ${pickup.zip}`,
        deliveryAddress: `${delivery.street}${delivery.street2 ? ', ' + delivery.street2 : ''}, ${delivery.city}, ${delivery.state} ${delivery.zip}`,
        // Structured addresses
        pickupAddressStructured: {
          line1: pickup.street,
          line2: pickup.street2 || null,
          city: pickup.city,
          state: pickup.state,
          zip: pickup.zip,
        },
        deliveryAddressStructured: {
          line1: delivery.street,
          line2: delivery.street2 || null,
          city: delivery.city,
          state: delivery.state,
          zip: delivery.zip,
        },
        timeWindowStart: new Date(baseDate.getTime() + 8 * 60 * 60 * 1000), // 8 AM
        timeWindowEnd: new Date(baseDate.getTime() + 17 * 60 * 60 * 1000), // 5 PM
        weight: 100 + Math.random() * 200,
        priority: ['normal', 'high', 'urgent'][i % 3] as any,
        status: status as any,
        // Multi-day job support
        startDate: hasStartDate ? new Date(baseDate.getTime() + 9 * 60 * 60 * 1000) : undefined,
        endDate: hasStartDate ? new Date(baseDate.getTime() + 16 * 60 * 60 * 1000) : undefined,
        // Billing
        billingStatus: billingStatuses[i % 2] as any,
        billingAmount: Math.floor(Math.random() * 500) + 100,
        billingNotes: i % 2 === 0 ? `Invoice #INV-${1000 + i}` : undefined,
        invoiceRef: i % 2 === 0 ? `INV-${1000 + i}` : undefined,
        notes: i % 3 === 0 ? 'Handle with care - fragile items' : undefined,
      }),
    );
  }
  await jobRepo.save(jobs);
  console.log('Jobs created ✅');

  // --- 4. Create Routes ---
  const routes: Route[] = [];

  for (let r = 0; r < 5; r++) {
    const routeJobs = jobs.slice(r * 4, r * 4 + 4); // 4 stops per route
    routes.push(
      routeRepo.create({
        vehicleId: vehicles[r % vehicles.length].id,
        driverId: drivers[r % drivers.length].id,
        jobIds: routeJobs.map((j) => j.id),
        jobCount: routeJobs.length,
        status: 'planned' as any,
        totalDistanceKm: 0,
        totalDurationMinutes: 0,
        color: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'][r],
      }),
    );
  }

  await routeRepo.save(routes);
  console.log('Routes created ✅');

  console.log('Seeding complete! 🎉');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed ❌', err);
  process.exit(1);
});
