// Standalone Express API for Vercel Serverless with MongoDB
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'routing-saas';

let cachedClient: MongoClient | null = null;

async function getDbClient() {
  if (cachedClient) {
    return cachedClient;
  }

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI not configured');
  }

  const client = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  await client.connect();
  cachedClient = client;

  // Create indexes
  const db = client.db(DB_NAME);
  await db.collection('jobs').createIndex({ id: 1 }, { unique: true });
  await db.collection('routes').createIndex({ id: 1 }, { unique: true });
  await db.collection('vehicles').createIndex({ id: 1 }, { unique: true });
  await db.collection('drivers').createIndex({ id: 1 }, { unique: true });

  // Initialize defaults
  const vehiclesCount = await db.collection('vehicles').countDocuments();
  if (vehiclesCount === 0) {
    await db.collection('vehicles').insertMany([
      { id: 'v1', name: 'Truck 1', type: 'box_truck', capacity: 1000, status: 'available' },
      { id: 'v2', name: 'Van 1', type: 'cargo_van', capacity: 500, status: 'available' },
      { id: 'v3', name: 'Truck 2', type: 'box_truck', capacity: 1000, status: 'available' }
    ]);
  }

  const driversCount = await db.collection('drivers').countDocuments();
  if (driversCount === 0) {
    await db.collection('drivers').insertMany([
      { id: 'd1', name: 'John Doe', status: 'available' },
      { id: 'd2', name: 'Jane Smith', status: 'available' },
      { id: 'd3', name: 'Bob Wilson', status: 'available' }
    ]);
  }

  return client;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.url || '/';
  const method = req.method || 'GET';

  try {
    const client = await getDbClient();
    const db = client.db(DB_NAME);

    // Health check
    if (url === '/health' || url === '/health/ping') {
      return res.status(200).json({
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    }

    // ============================================================================
    // JOBS API
    // ============================================================================

    // Get all jobs
    if (url === '/api/jobs' && method === 'GET') {
      const jobs = await db.collection('jobs').find({}).toArray();
      return res.status(200).json({ jobs });
    }

    // Create job
    if (url === '/api/jobs' && method === 'POST') {
      const { customerName, pickupAddress, deliveryAddress, timeWindow, priority } = req.body as any;

      if (!customerName || !deliveryAddress) {
        return res.status(400).json({ error: 'Missing required fields: customerName and deliveryAddress' });
      }

      const job = {
        id: generateId(),
        customerName,
        pickupAddress: pickupAddress || '',
        deliveryAddress,
        timeWindow: timeWindow || { start: new Date().toISOString(), end: new Date(Date.now() + 3600000).toISOString() },
        priority: priority || 'normal',
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      await db.collection('jobs').insertOne(job);
      return res.status(201).json({ job });
    }

    // Update job
    if (url.startsWith('/api/jobs/') && method === 'PATCH') {
      const id = url.split('/api/jobs/')[1];
      const { status, assignedRouteId, assignedVehicleId, stopSequence } = req.body as any;

      const updates: any = {};
      if (status !== undefined) updates.status = status;
      if (assignedRouteId !== undefined) updates.assignedRouteId = assignedRouteId;
      if (assignedVehicleId !== undefined) updates.assignedVehicleId = assignedVehicleId;
      if (stopSequence !== undefined) updates.stopSequence = stopSequence;

      const result = await db.collection('jobs').findOneAndUpdate(
        { id },
        { $set: updates },
        { returnDocument: 'after' }
      );

      if (!result) {
        return res.status(404).json({ error: 'Job not found' });
      }

      return res.status(200).json({ job: result });
    }

    // ============================================================================
    // ROUTES API
    // ============================================================================

    // Get all routes
    if (url === '/api/routes' && method === 'GET') {
      const routes = await db.collection('routes').find({}).toArray();
      return res.status(200).json({ routes });
    }

    // Create route
    if (url === '/api/routes' && method === 'POST') {
      const { vehicleId, jobIds, name, driverId, stops, status } = req.body as any;

      // Support both job-based routes and general routes
      if (jobIds && jobIds.length > 0) {
        // Job-based route creation
        if (!vehicleId) {
          return res.status(400).json({ error: 'vehicleId required for job-based routes' });
        }

        const vehicle = await db.collection('vehicles').findOne({ id: vehicleId });
        if (!vehicle) {
          return res.status(404).json({ error: 'Vehicle not found' });
        }

        const jobs = await db.collection('jobs').find({ id: { $in: jobIds } }).toArray();
        if (jobs.length === 0) {
          return res.status(400).json({ error: 'No valid jobs found' });
        }

        const route = {
          id: generateId(),
          name: name || `Route ${generateId().substring(0, 8)}`,
          vehicleId,
          driverId: driverId || null,
          jobIds,
          stops: stops || [],
          status: status || 'planned',
          totalDistance: Math.random() * 50 + 10,
          totalDuration: Math.random() * 120 + 30,
          createdAt: new Date().toISOString()
        };

        await db.collection('routes').insertOne(route);

        // Update jobs to assigned
        await db.collection('jobs').updateMany(
          { id: { $in: jobIds } },
          { $set: { status: 'assigned', assignedRouteId: route.id } }
        );

        return res.status(201).json({ route });
      } else {
        // General route creation (no jobs)
        if (!name) {
          return res.status(400).json({ error: 'name required for general routes' });
        }

        const route = {
          id: generateId(),
          name,
          vehicleId: vehicleId || null,
          driverId: driverId || null,
          jobIds: [],
          stops: stops || [],
          status: status || 'pending',
          totalDistance: 0,
          totalDuration: 0,
          createdAt: new Date().toISOString()
        };

        await db.collection('routes').insertOne(route);
        return res.status(201).json({ route });
      }
    }

    // Assign driver to route
    if (url.match(/^\/api\/routes\/[^\/]+\/assign$/) && method === 'POST') {
      const id = url.split('/api/routes/')[1].split('/assign')[0];
      const { driverId } = req.body as any;

      const route = await db.collection('routes').findOne({ id });
      if (!route) {
        return res.status(404).json({ error: 'Route not found' });
      }

      const driver = await db.collection('drivers').findOne({ id: driverId });
      if (!driver) {
        return res.status(404).json({ error: 'Driver not found' });
      }

      const updatedRoute = await db.collection('routes').findOneAndUpdate(
        { id },
        {
          $set: {
            driverId,
            status: 'dispatched',
            dispatchedAt: new Date().toISOString()
          }
        },
        { returnDocument: 'after' }
      );

      await db.collection('drivers').updateOne(
        { id: driverId },
        { $set: { status: 'on_route' } }
      );

      await db.collection('vehicles').updateOne(
        { id: route.vehicleId },
        { $set: { status: 'in_route' } }
      );

      const jobIds = route.jobIds || [];
      await db.collection('jobs').updateMany(
        { id: { $in: jobIds } },
        { $set: { status: 'in_progress' } }
      );

      return res.status(200).json({ route: updatedRoute });
    }

    // Update route
    if (url.match(/^\/api\/routes\/[^\/]+$/) && method === 'PATCH') {
      const id = url.split('/api/routes/')[1];
      const { status, name, vehicleId, driverId, stops, optimizedStops, totalDistance, totalDuration, estimatedCapacity } = req.body as any;

      const route = await db.collection('routes').findOne({ id });
      if (!route) {
        return res.status(404).json({ error: 'Route not found' });
      }

      const updates: any = {};
      if (status !== undefined) updates.status = status;
      if (name !== undefined) updates.name = name;
      if (vehicleId !== undefined) updates.vehicleId = vehicleId;
      if (driverId !== undefined) updates.driverId = driverId;
      if (stops !== undefined) updates.stops = stops;
      if (optimizedStops !== undefined) updates.optimizedStops = optimizedStops;
      if (totalDistance !== undefined) updates.totalDistance = totalDistance;
      if (totalDuration !== undefined) updates.totalDuration = totalDuration;
      if (estimatedCapacity !== undefined) updates.estimatedCapacity = estimatedCapacity;
      updates.updatedAt = new Date().toISOString();
      if (status === 'optimized') updates.optimizedAt = new Date().toISOString();
      if (status === 'completed') {
        updates.completedAt = new Date().toISOString();

        // Update vehicle and driver
        await db.collection('vehicles').updateOne(
          { id: route.vehicleId },
          { $set: { status: 'available' } }
        );

        if (route.driverId) {
          await db.collection('drivers').updateOne(
            { id: route.driverId },
            { $set: { status: 'available' } }
          );
        }

        // Update jobs
        const jobIds = route.jobIds || [];
        await db.collection('jobs').updateMany(
          { id: { $in: jobIds } },
          { $set: { status: 'completed' } }
        );
      }

      const updatedRoute = await db.collection('routes').findOneAndUpdate(
        { id },
        { $set: updates },
        { returnDocument: 'after' }
      );

      return res.status(200).json({ route: updatedRoute });
    }

    // ============================================================================
    // VEHICLES & DRIVERS API
    // ============================================================================

    // Get all vehicles
    if (url === '/api/vehicles' && method === 'GET') {
      const vehicles = await db.collection('vehicles').find({}).toArray();
      return res.status(200).json({ vehicles });
    }

    // Create vehicle
    if (url === '/api/vehicles' && method === 'POST') {
      const { make, model, year, licensePlate, vehicleType, status, vin, fuelType, capacity } = req.body as any;

      if (!make || !model || !licensePlate) {
        return res.status(400).json({ error: 'Missing required fields: make, model, licensePlate' });
      }

      const vehicle = {
        id: generateId(),
        make,
        model,
        year: year || new Date().getFullYear(),
        licensePlate,
        vehicleType: vehicleType || 'TRUCK',
        status: status || 'AVAILABLE',
        vin: vin || '',
        fuelType: fuelType || 'DIESEL',
        capacity: capacity || 1000,
        createdAt: new Date().toISOString()
      };

      await db.collection('vehicles').insertOne(vehicle);
      return res.status(201).json({ vehicle });
    }

    // Update vehicle
    if (url.startsWith('/api/vehicles/') && method === 'PATCH') {
      const id = url.split('/api/vehicles/')[1];
      const updates = req.body as any;

      const result = await db.collection('vehicles').findOneAndUpdate(
        { id },
        { $set: { ...updates, updatedAt: new Date().toISOString() } },
        { returnDocument: 'after' }
      );

      if (!result) {
        return res.status(404).json({ error: 'Vehicle not found' });
      }

      return res.status(200).json({ vehicle: result });
    }

    // Get all drivers
    if (url === '/api/drivers' && method === 'GET') {
      const drivers = await db.collection('drivers').find({}).toArray();
      return res.status(200).json({ drivers });
    }

    // Create driver
    if (url === '/api/drivers' && method === 'POST') {
      const { firstName, lastName, email, phone, licenseNumber, licenseType, assignedVehicleId, notes, status } = req.body as any;

      if (!firstName || !lastName || !email) {
        return res.status(400).json({ error: 'Missing required fields: firstName, lastName, email' });
      }

      const driver = {
        id: generateId(),
        firstName,
        lastName,
        email,
        phone: phone || '',
        licenseNumber: licenseNumber || '',
        licenseType: licenseType || 'CLASS_C',
        assignedVehicleId: assignedVehicleId || null,
        notes: notes || '',
        status: status || 'ACTIVE',
        createdAt: new Date().toISOString()
      };

      await db.collection('drivers').insertOne(driver);
      return res.status(201).json({ driver });
    }

    // Update driver
    if (url.startsWith('/api/drivers/') && method === 'PATCH') {
      const id = url.split('/api/drivers/')[1];
      const updates = req.body as any;

      const result = await db.collection('drivers').findOneAndUpdate(
        { id },
        { $set: { ...updates, updatedAt: new Date().toISOString() } },
        { returnDocument: 'after' }
      );

      if (!result) {
        return res.status(404).json({ error: 'Driver not found' });
      }

      return res.status(200).json({ driver: result });
    }

    // ============================================================================
    // CUSTOMERS API
    // ============================================================================

    // Get all customers
    if (url === '/api/customers' && method === 'GET') {
      const customers = await db.collection('customers').find({}).toArray();
      return res.status(200).json({ customers });
    }

    // Create customer
    if (url === '/api/customers' && method === 'POST') {
      const { name, address, businessName, notes, exceptions, defaultAddressStructured } = req.body as any;

      if (!name || !address) {
        return res.status(400).json({ error: 'Missing required fields: name, address' });
      }

      const customer = {
        id: generateId(),
        name,
        address,
        businessName: businessName || '',
        notes: notes || '',
        exceptions: exceptions || '',
        defaultAddressStructured: defaultAddressStructured || null,
        createdAt: new Date().toISOString()
      };

      await db.collection('customers').insertOne(customer);
      return res.status(201).json({ customer });
    }

    // Update customer
    if (url.startsWith('/api/customers/') && method === 'PATCH') {
      const id = url.split('/api/customers/')[1];
      const updates = req.body as any;

      const result = await db.collection('customers').findOneAndUpdate(
        { id },
        { $set: { ...updates, updatedAt: new Date().toISOString() } },
        { returnDocument: 'after' }
      );

      if (!result) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      return res.status(200).json({ customer: result });
    }

    // Delete customer
    if (url.startsWith('/api/customers/') && method === 'DELETE') {
      const id = url.split('/api/customers/')[1];

      const result = await db.collection('customers').deleteOne({ id });

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      return res.status(200).json({ success: true, message: 'Customer deleted' });
    }

    // ============================================================================
    // SSE ENDPOINT
    // ============================================================================

    if (url === '/stream-route' && method === 'GET') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const clientId = `${Date.now()}-${Math.random()}`;
      res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

      // Keep connection alive with heartbeat
      const heartbeat = setInterval(() => {
        res.write(`:heartbeat\n\n`);
      }, 30000);

      req.on('close', () => {
        clearInterval(heartbeat);
      });

      return;
    }

    // Default 404
    return res.status(404).json({
      error: 'Not Found',
      url: url,
      method: method
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
}
