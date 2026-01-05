// Standalone Express API for Vercel Serverless
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client } from 'pg';

// In-memory storage (persists during serverless function warm-up)
const driversStore: any[] = [];
const vehiclesStore: any[] = [];

// Database connection
const DATABASE_URL = process.env.DATABASE_URL || '';

async function getDbClient() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  return client;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.url || '/';
  const method = req.method || 'GET';

  try {
    // Health check
    if (url === '/health/ping' || url === '/health') {
      return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: DATABASE_URL ? 'configured' : 'not configured'
      });
    }

    // GraphQL endpoint
    if (url === '/graphql' && method === 'POST') {
      const { query, variables } = req.body as any;

      // Handle createDriver mutation
      if (query && query.includes('createDriver')) {
        const { input } = variables;
        const driver = {
          id: `driver-${Date.now()}`,
          ...input,
          status: input.status || 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        driversStore.push(driver);
        return res.status(200).json({
          data: { createDriver: driver }
        });
      }

      // Handle drivers query
      if (query && query.includes('query') && query.includes('drivers')) {
        return res.status(200).json({
          data: { drivers: driversStore }
        });
      }

      // Handle createVehicle mutation
      if (query && query.includes('createVehicle')) {
        const { input } = variables;
        const vehicle = {
          id: `vehicle-${Date.now()}`,
          ...input,
          status: input.status || 'AVAILABLE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        vehiclesStore.push(vehicle);
        return res.status(200).json({
          data: { createVehicle: vehicle }
        });
      }

      // Handle vehicles query
      if (query && query.includes('query') && query.includes('vehicles')) {
        return res.status(200).json({
          data: { vehicles: vehiclesStore }
        });
      }

      // Handle assignDriverToVehicle mutation
      if (query && query.includes('assignDriverToVehicle')) {
        const { driverId, vehicleId } = variables;
        const driver = driversStore.find(d => d.id === driverId);
        const vehicle = vehiclesStore.find(v => v.id === vehicleId);

        if (!driver || !vehicle) {
          return res.status(200).json({
            data: null,
            errors: [{ message: 'Driver or vehicle not found' }]
          });
        }

        // Update driver's current vehicle
        driver.currentVehicleId = vehicleId;
        driver.updatedAt = new Date().toISOString();

        return res.status(200).json({
          data: {
            assignDriverToVehicle: {
              driver,
              vehicle
            }
          }
        });
      }

      // Handle createRoute mutation
      if (query && query.includes('createRoute')) {
        const { input } = variables;
        const route = {
          id: `route-${Date.now()}`,
          vehicleId: input.vehicleId,
          driverId: input.driverId || null,
          jobIds: input.jobIds || [],
          status: 'planned',
          totalDistanceKm: 0,
          totalDurationMinutes: 0,
          jobCount: (input.jobIds || []).length,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          plannedStart: input.plannedStart || new Date().toISOString(),
          notes: input.notes || ''
        };

        // Store route (in-memory for now)
        if (!global.routesStore) global.routesStore = [];
        global.routesStore.push(route);

        return res.status(200).json({
          data: { createRoute: route }
        });
      }

      // Handle routes query
      if (query && query.includes('query') && query.includes('routes')) {
        return res.status(200).json({
          data: { routes: global.routesStore || [] }
        });
      }

      // Handle jobs query
      if (query && query.includes('query') && query.includes('jobs')) {
        return res.status(200).json({
          data: { jobs: global.jobsStore || [] }
        });
      }

      // Handle createJob mutation
      if (query && query.includes('createJob')) {
        const { input } = variables;
        const job = {
          id: `job-${Date.now()}`,
          ...input,
          status: input.status || 'pending',
          priority: input.priority || 'normal',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (!global.jobsStore) global.jobsStore = [];
        global.jobsStore.push(job);

        return res.status(200).json({
          data: { createJob: job }
        });
      }

      return res.status(200).json({
        data: null,
        errors: [{ message: 'Query not implemented' }]
      });
    }

    // Get all drivers
    if (url === '/api/drivers' && method === 'GET') {
      // Return in-memory drivers
      return res.status(200).json({ drivers: driversStore });

      /* TODO: Re-enable when database is working
      const client = await getDbClient();
      try {
        const result = await client.query('SELECT * FROM drivers ORDER BY created_at DESC');
        await client.end();
        return res.status(200).json({ drivers: result.rows });
      } catch (error: any) {
        await client.end();
        return res.status(500).json({ error: error.message });
      }
      */
    }

    // Create driver
    if (url === '/api/drivers' && method === 'POST') {
      // Temporary mock response until database is fixed
      const {firstName, lastName, email, phone, licenseNumber, status = 'ACTIVE'} = req.body as any;
      return res.status(201).json({
        id: `temp-${Date.now()}`,
        firstName,
        lastName,
        email,
        phone,
        licenseNumber,
        status,
        createdAt: new Date().toISOString()
      });

      /* TODO: Re-enable when database is working
      const client = await getDbClient();
      try {
        const {firstName, lastName, email, phone, licenseNumber, status = 'ACTIVE'} = req.body as any;

        const result = await client.query(
          `INSERT INTO drivers (first_name, last_name, email, phone, license_number, status, license_expiry_date, employment_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [firstName, lastName, email, phone, licenseNumber, status, '2027-12-31', 'active']
        );

        await client.end();
        return res.status(201).json(result.rows[0]);
      } catch (error: any) {
        await client.end();
        return res.status(500).json({ error: error.message, details: 'Database insert failed' });
      }
      */
    }

    // Get all vehicles
    if (url === '/api/vehicles' || url === '/vehicles') {
      const client = await getDbClient();
      try {
        const result = await client.query('SELECT * FROM vehicles ORDER BY created_at DESC');
        await client.end();
        return res.status(200).json({ vehicles: result.rows });
      } catch (error: any) {
        await client.end();
        return res.status(500).json({ error: error.message });
      }
    }

    // Create vehicle
    if ((url === '/api/vehicles' || url === '/vehicles') && method === 'POST') {
      const client = await getDbClient();
      try {
        const {make, model, year, licensePlate, vehicleType = 'TRUCK', status = 'AVAILABLE'} = req.body as any;

        const result = await client.query(
          `INSERT INTO vehicles (make, model, year, license_plate, vehicle_type, status)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [make, model, year, licensePlate, vehicleType, status]
        );

        await client.end();
        return res.status(201).json(result.rows[0]);
      } catch (error: any) {
        await client.end();
        return res.status(500).json({ error: error.message, details: 'Vehicle insert failed' });
      }
    }

    return res.status(404).json({
      error: 'Not Found',
      url: url,
      method: method
    });

  } catch (error: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
}
