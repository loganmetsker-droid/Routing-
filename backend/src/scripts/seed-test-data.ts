import { DataSource } from 'typeorm';

// Seed test data for frontend feature testing
async function seedTestData() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'postgres',
    database: 'fleet_management',
  });

  await dataSource.initialize();
  console.log('✅ Connected to database');

  try {
    // Clear existing data
    await dataSource.query('TRUNCATE drivers, vehicles, jobs, routes CASCADE');
    console.log('🧹 Cleared existing data');

    // Insert 5 drivers (3 available, 2 busy)
    const drivers = await dataSource.query(`
      INSERT INTO drivers (id, first_name, last_name, email, phone, license_number, license_expiry_date, status, total_hours_driven, created_at, updated_at)
      VALUES
        (gen_random_uuid(), 'John', 'Doe', 'john.doe@example.com', '555-0001', 'DL001', '2026-12-31', 'available', 0, NOW(), NOW()),
        (gen_random_uuid(), 'Sarah', 'Martinez', 'sarah.m@example.com', '555-0002', 'DL002', '2026-12-31', 'available', 6.5, NOW(), NOW()),
        (gen_random_uuid(), 'Mike', 'Johnson', 'mike.j@example.com', '555-0003', 'DL003', '2026-12-31', 'available', 7.2, NOW(), NOW()),
        (gen_random_uuid(), 'Lisa', 'Chen', 'lisa.c@example.com', '555-0004', 'DL004', '2026-12-31', 'available', 2.5, NOW(), NOW()),
        (gen_random_uuid(), 'David', 'Brown', 'david.b@example.com', '555-0005', 'DL005', '2026-12-31', 'available', 0, NOW(), NOW())
      RETURNING id, first_name, last_name, total_hours_driven
    `);
    console.log(`✅ Created ${drivers.length} drivers`);

    // Insert 2 vehicles
    const vehicles = await dataSource.query(`
      INSERT INTO vehicles (id, make, model, year, license_plate, vehicle_type, status, fuel_type, current_odometer_km, created_at, updated_at)
      VALUES
        (gen_random_uuid(), 'Ford', 'Transit', 2023, 'ABC-123', 'van', 'available', 'diesel', 0, NOW(), NOW()),
        (gen_random_uuid(), 'Mercedes', 'Sprinter', 2024, 'XYZ-789', 'van', 'available', 'diesel', 0, NOW(), NOW())
      RETURNING id, make, model, license_plate
    `);
    console.log(`✅ Created ${vehicles.length} vehicles`);

    // Insert 5 jobs (4 pending, 1 completed today)
    const jobs = await dataSource.query(`
      INSERT INTO jobs (id, customer_name, pickup_address, delivery_address, time_window_start, time_window_end, priority, status, completed_at, created_at, updated_at)
      VALUES
        (gen_random_uuid(), 'Acme Corp', '123 Main St, Denver, CO', '456 Oak Ave, Denver, CO', NOW() + INTERVAL '2 hours', NOW() + INTERVAL '6 hours', 'high', 'pending', NULL, NOW(), NOW()),
        (gen_random_uuid(), 'TechStart Inc', '789 Pine St, Denver, CO', '321 Elm St, Denver, CO', NOW() + INTERVAL '3 hours', NOW() + INTERVAL '7 hours', 'normal', 'pending', NULL, NOW(), NOW()),
        (gen_random_uuid(), 'Global Supplies', '555 Maple Dr, Denver, CO', '777 Birch Ln, Denver, CO', NOW() + INTERVAL '1 hours', NOW() + INTERVAL '5 hours', 'urgent', 'pending', NULL, NOW(), NOW()),
        (gen_random_uuid(), 'BuildCo', '888 Cedar Rd, Denver, CO', '999 Spruce Way, Denver, CO', NOW() + INTERVAL '4 hours', NOW() + INTERVAL '8 hours', 'normal', 'pending', NULL, NOW(), NOW()),
        (gen_random_uuid(), 'QuickShip LLC', '111 Aspen Ct, Denver, CO', '222 Willow Dr, Denver, CO', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '2 hours', 'normal', 'completed', NOW(), NOW() - INTERVAL '2 hours', NOW())
      RETURNING id, customer_name, status, priority
    `);
    console.log(`✅ Created ${jobs.length} jobs (${jobs.filter((j: any) => j.status === 'completed').length} completed)`);

    // Create 2 routes assigned to the SAME driver (conflict scenario)
    const conflictDriver = drivers[1]; // Sarah Martinez with 6.5 hours
    const vehicle1 = vehicles[0];
    const vehicle2 = vehicles[1];
    const pendingJobs = jobs.filter((j: any) => j.status === 'pending');

    const routes = await dataSource.query(`
      INSERT INTO routes (id, vehicle_id, driver_id, "jobIds", status, "totalDistanceKm", "totalDurationMinutes", "jobCount", created_at, updated_at)
      VALUES
        (gen_random_uuid(), $1, $2, jsonb_build_array($3::text, $4::text), 'assigned', 15.5, 45, 2, NOW(), NOW()),
        (gen_random_uuid(), $5, $2, jsonb_build_array($6::text), 'assigned', 8.2, 25, 1, NOW(), NOW())
      RETURNING id, vehicle_id, driver_id, status
    `, [
      vehicle1.id,
      conflictDriver.id,
      pendingJobs[0].id,
      pendingJobs[1].id,
      vehicle2.id,
      pendingJobs[2].id,
    ]);
    console.log(`✅ Created ${routes.length} routes`);

    // Verify conflict
    console.log('\n📊 CONFLICT SCENARIO CREATED:');
    console.log(`   Driver: ${conflictDriver.first_name} ${conflictDriver.last_name}`);
    console.log(`   Routes: ${routes.length} routes assigned to same driver`);
    console.log(`   Hours Driven: ${conflictDriver.total_hours_driven} (should trigger warning if > 8)`);

    console.log('\n✅ SEED COMPLETE - Test data ready!');
    console.log('\nData Summary:');
    console.log(`   Drivers: ${drivers.length} (5 total)`);
    console.log(`   Vehicles: ${vehicles.length}`);
    console.log(`   Jobs: ${jobs.length} (${jobs.filter((j: any) => j.status === 'pending').length} pending, ${jobs.filter((j: any) => j.status === 'completed').length} completed)`);
    console.log(`   Routes: ${routes.length} (conflict: same driver on 2 routes)`);
    console.log('\nNow test the frontend features!');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await dataSource.destroy();
  }
}

seedTestData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
