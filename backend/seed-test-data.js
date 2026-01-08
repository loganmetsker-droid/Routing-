const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const API_URL = 'http://localhost:3000/api';

// 10 Test Vehicles
const vehicles = [
  { make: 'Ford', model: 'Transit 350', year: 2022, licensePlate: 'ABC-1234', vehicleType: 'van', capacityWeightKg: 1500, fuelType: 'diesel' },
  { make: 'Mercedes', model: 'Sprinter', year: 2023, licensePlate: 'DEF-5678', vehicleType: 'van', capacityWeightKg: 1800, fuelType: 'diesel' },
  { make: 'RAM', model: 'ProMaster', year: 2021, licensePlate: 'GHI-9012', vehicleType: 'van', capacityWeightKg: 1600, fuelType: 'gasoline' },
  { make: 'Chevrolet', model: 'Express 3500', year: 2022, licensePlate: 'JKL-3456', vehicleType: 'van', capacityWeightKg: 1700, fuelType: 'gasoline' },
  { make: 'Nissan', model: 'NV3500', year: 2023, licensePlate: 'MNO-7890', vehicleType: 'van', capacityWeightKg: 1650, fuelType: 'gasoline' },
  { make: 'Ford', model: 'F-150', year: 2022, licensePlate: 'PQR-1122', vehicleType: 'truck', capacityWeightKg: 1200, fuelType: 'gasoline' },
  { make: 'Isuzu', model: 'NPR', year: 2021, licensePlate: 'STU-3344', vehicleType: 'truck', capacityWeightKg: 2000, fuelType: 'diesel' },
  { make: 'Freightliner', model: 'M2 106', year: 2022, licensePlate: 'VWX-5566', vehicleType: 'truck', capacityWeightKg: 2500, fuelType: 'diesel' },
  { make: 'GMC', model: 'Savana 2500', year: 2023, licensePlate: 'YZA-7788', vehicleType: 'van', capacityWeightKg: 1550, fuelType: 'gasoline' },
  { make: 'Mercedes', model: 'Metris', year: 2022, licensePlate: 'BCD-9900', vehicleType: 'van', capacityWeightKg: 1100, fuelType: 'gasoline' },
];

// 10 Test Drivers
const drivers = [
  { firstName: 'John', lastName: 'Smith', email: 'john.smith@fleet.com', phone: '555-0101', licenseNumber: 'DL1001', licenseClass: 'C', licenseExpiryDate: '2026-12-31', hireDate: '2023-01-15' },
  { firstName: 'Maria', lastName: 'Garcia', email: 'maria.garcia@fleet.com', phone: '555-0102', licenseNumber: 'DL1002', licenseClass: 'C', licenseExpiryDate: '2027-06-30', hireDate: '2023-02-20' },
  { firstName: 'David', lastName: 'Johnson', email: 'david.johnson@fleet.com', phone: '555-0103', licenseNumber: 'DL1003', licenseClass: 'B', licenseExpiryDate: '2026-09-15', hireDate: '2022-11-10' },
  { firstName: 'Sarah', lastName: 'Williams', email: 'sarah.williams@fleet.com', phone: '555-0104', licenseNumber: 'DL1004', licenseClass: 'C', licenseExpiryDate: '2027-03-20', hireDate: '2023-04-05' },
  { firstName: 'Michael', lastName: 'Brown', email: 'michael.brown@fleet.com', phone: '555-0105', licenseNumber: 'DL1005', licenseClass: 'C', licenseExpiryDate: '2026-11-30', hireDate: '2023-01-20' },
  { firstName: 'Jennifer', lastName: 'Martinez', email: 'jennifer.martinez@fleet.com', phone: '555-0106', licenseNumber: 'DL1006', licenseClass: 'B', licenseExpiryDate: '2027-08-10', hireDate: '2022-09-15' },
  { firstName: 'Robert', lastName: 'Davis', email: 'robert.davis@fleet.com', phone: '555-0107', licenseNumber: 'DL1007', licenseClass: 'C', licenseExpiryDate: '2026-10-25', hireDate: '2023-03-12' },
  { firstName: 'Lisa', lastName: 'Rodriguez', email: 'lisa.rodriguez@fleet.com', phone: '555-0108', licenseNumber: 'DL1008', licenseClass: 'C', licenseExpiryDate: '2027-01-18', hireDate: '2023-05-08' },
  { firstName: 'James', lastName: 'Wilson', email: 'james.wilson@fleet.com', phone: '555-0109', licenseNumber: 'DL1009', licenseClass: 'A', licenseExpiryDate: '2026-07-22', hireDate: '2022-08-30' },
  { firstName: 'Emily', lastName: 'Anderson', email: 'emily.anderson@fleet.com', phone: '555-0110', licenseNumber: 'DL1010', licenseClass: 'C', licenseExpiryDate: '2027-04-14', hireDate: '2023-06-01' },
];

// 10 Test Jobs with real addresses in Los Angeles area
const jobs = [
  {
    customerName: 'Acme Corp',
    customerPhone: '213-555-0201',
    pickupAddress: '1201 S Figueroa St, Los Angeles, CA 90015',
    deliveryAddress: '350 S Grand Ave, Los Angeles, CA 90071',
    timeWindowStart: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    timeWindowEnd: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    weight: 150,
    priority: 'normal'
  },
  {
    customerName: 'TechStart Inc',
    customerPhone: '310-555-0202',
    pickupAddress: '11601 Wilshire Blvd, Los Angeles, CA 90025',
    deliveryAddress: '10250 Santa Monica Blvd, Los Angeles, CA 90067',
    timeWindowStart: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    timeWindowEnd: new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString(),
    weight: 200,
    priority: 'high'
  },
  {
    customerName: 'Global Logistics',
    customerPhone: '323-555-0203',
    pickupAddress: '800 W 1st St, Los Angeles, CA 90012',
    deliveryAddress: '135 N Grand Ave, Los Angeles, CA 90012',
    timeWindowStart: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
    timeWindowEnd: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
    weight: 120,
    priority: 'urgent'
  },
  {
    customerName: 'Pacific Supplies',
    customerPhone: '424-555-0204',
    pickupAddress: '1333 2nd St, Santa Monica, CA 90401',
    deliveryAddress: '395 Santa Monica Pier, Santa Monica, CA 90401',
    timeWindowStart: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    timeWindowEnd: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    weight: 180,
    priority: 'normal'
  },
  {
    customerName: 'Metro Distributors',
    customerPhone: '213-555-0205',
    pickupAddress: '801 S Grand Ave, Los Angeles, CA 90017',
    deliveryAddress: '700 W 5th St, Los Angeles, CA 90071',
    timeWindowStart: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    timeWindowEnd: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    weight: 220,
    priority: 'high'
  },
  {
    customerName: 'Coastal Merchants',
    customerPhone: '310-555-0206',
    pickupAddress: '2730 Wilshire Blvd, Santa Monica, CA 90403',
    deliveryAddress: '1437 4th St, Santa Monica, CA 90401',
    timeWindowStart: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    timeWindowEnd: new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString(),
    weight: 95,
    priority: 'normal'
  },
  {
    customerName: 'Downtown Wholesale',
    customerPhone: '213-555-0207',
    pickupAddress: '333 S Hope St, Los Angeles, CA 90071',
    deliveryAddress: '445 S Figueroa St, Los Angeles, CA 90071',
    timeWindowStart: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
    timeWindowEnd: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
    weight: 160,
    priority: 'urgent'
  },
  {
    customerName: 'Westside Goods',
    customerPhone: '310-555-0208',
    pickupAddress: '10880 Wilshire Blvd, Los Angeles, CA 90024',
    deliveryAddress: '2001 Wilshire Blvd, Santa Monica, CA 90403',
    timeWindowStart: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    timeWindowEnd: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    weight: 135,
    priority: 'normal'
  },
  {
    customerName: 'Express Freight Co',
    customerPhone: '323-555-0209',
    pickupAddress: '201 N Figueroa St, Los Angeles, CA 90012',
    deliveryAddress: '750 W 7th St, Los Angeles, CA 90017',
    timeWindowStart: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    timeWindowEnd: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    weight: 190,
    priority: 'high'
  },
  {
    customerName: 'Urban Delivery Hub',
    customerPhone: '424-555-0210',
    pickupAddress: '1200 Getty Center Dr, Los Angeles, CA 90049',
    deliveryAddress: '11777 San Vicente Blvd, Los Angeles, CA 90049',
    timeWindowStart: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    timeWindowEnd: new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString(),
    weight: 175,
    priority: 'normal'
  },
];

async function createVehicles() {
  console.log('\n🚐 Creating 10 test vehicles...');
  for (const vehicle of vehicles) {
    try {
      const response = await fetch(`${API_URL}/vehicles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vehicle),
      });
      const data = await response.json();
      console.log(`✅ Created: ${vehicle.make} ${vehicle.model} (${vehicle.licensePlate})`);
    } catch (error) {
      console.error(`❌ Failed to create ${vehicle.licensePlate}:`, error.message);
    }
  }
}

async function createDrivers() {
  console.log('\n👨‍✈️ Creating 10 test drivers...');
  for (const driver of drivers) {
    try {
      const response = await fetch(`${API_URL}/drivers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(driver),
      });
      const data = await response.json();
      console.log(`✅ Created: ${driver.firstName} ${driver.lastName} (${driver.email})`);
    } catch (error) {
      console.error(`❌ Failed to create ${driver.email}:`, error.message);
    }
  }
}

async function createJobs() {
  console.log('\n📦 Creating 10 test jobs...');
  for (const job of jobs) {
    try {
      const response = await fetch(`${API_URL}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(job),
      });
      const data = await response.json();
      const shortAddr = job.pickupAddress.substring(0, 30);
      console.log(`✅ Created: ${job.customerName} - ${shortAddr}...`);
    } catch (error) {
      console.error(`❌ Failed to create job for ${job.customerName}:`, error.message);
    }
  }
}

async function main() {
  console.log('🌱 Seeding test data to local database...\n');
  await createVehicles();
  await createDrivers();
  await createJobs();
  console.log('\n✅ Test data seeding complete!');
  console.log('\n📍 Visit http://localhost:5174 to see the data');
}

main().catch(console.error);
