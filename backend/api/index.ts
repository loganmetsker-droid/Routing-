// Standalone Express API for Vercel Serverless
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client } from 'pg';

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

    // Get all drivers
    if (url === '/api/drivers' && method === 'GET') {
      // Temporary mock data until database is fixed
      return res.status(200).json({ drivers: [] });

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
