const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());

// Client management for SSE
const clients = new Map();
const MESSAGE_BUFFER_SIZE = 100;
const CLIENT_TIMEOUT_MS = 5 * 60 * 1000;

// Initialize database
let dbReady = false;
db.connect().then(() => {
  dbReady = true;
  console.log('✅ Database ready');
}).catch(err => {
  console.error('❌ Database connection failed:', err);
  console.log('⚠️  Running without persistence');
});

// Cleanup disconnected clients periodically
setInterval(() => {
  const now = Date.now();
  for (const [clientId, client] of clients.entries()) {
    if (now - client.lastSeen.getTime() > CLIENT_TIMEOUT_MS) {
      console.log(`[CLEANUP] Removing stale client ${clientId}`);
      clients.delete(clientId);
    }
  }
}, 60000);

/**
 * SSE endpoint - establishes a persistent connection for streaming route updates
 */
app.get('/stream-route', (req, res) => {
  const clientId = req.query.clientId || uuidv4();

  console.log(`[SSE] Client connecting: ${clientId}`);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.flushHeaders();

  const existingClient = clients.get(clientId);
  const buffer = existingClient ? existingClient.buffer : [];

  clients.set(clientId, {
    res,
    buffer,
    lastSeen: new Date()
  });

  const connectMsg = `data: ${JSON.stringify({ type: 'connected', clientId, bufferedMessages: buffer.length })}\n\n`;
  res.write(connectMsg);

  if (buffer.length > 0) {
    console.log(`[SSE] Replaying ${buffer.length} buffered messages to ${clientId}`);
    buffer.forEach(msg => res.write(msg));
  }

  console.log(`[SSE] Client connected: ${clientId} (total clients: ${clients.size})`);

  const heartbeat = setInterval(() => {
    res.write(`:heartbeat\n\n`);
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    const client = clients.get(clientId);
    if (client) {
      client.lastSeen = new Date();
      console.log(`[SSE] Client disconnected: ${clientId}`);
    }
  });
});

/**
 * Broadcast message to all connected clients
 */
function broadcastToClients(message) {
  const formattedMsg = `data: ${JSON.stringify(message)}\n\n`;
  let successCount = 0;
  let bufferCount = 0;

  for (const [clientId, client] of clients.entries()) {
    try {
      if (client.res && !client.res.writableEnded) {
        client.res.write(formattedMsg);
        client.lastSeen = new Date();
        successCount++;
      } else {
        client.buffer.push(formattedMsg);
        if (client.buffer.length > MESSAGE_BUFFER_SIZE) {
          client.buffer.shift();
        }
        bufferCount++;
      }
    } catch (err) {
      console.error(`[BROADCAST] Error sending to client ${clientId}:`, err.message);
      client.buffer.push(formattedMsg);
      if (client.buffer.length > MESSAGE_BUFFER_SIZE) {
        client.buffer.shift();
      }
      bufferCount++;
    }
  }

  console.log(`[BROADCAST] Message sent to ${successCount} clients, buffered for ${bufferCount} clients`);
}

// ============================================================================
// JOBS API
// ============================================================================

/**
 * Get all jobs
 */
app.get('/api/jobs', async (req, res) => {
  try {
    const jobs = await db.jobs.getAll();
    res.json({ jobs });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

/**
 * Create a new job
 */
app.post('/api/jobs', async (req, res) => {
  const { customerName, pickupAddress, deliveryAddress, timeWindow, priority } = req.body;

  if (!customerName || !pickupAddress || !deliveryAddress) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const job = {
    id: uuidv4(),
    customerName,
    pickupAddress,
    deliveryAddress,
    timeWindow: timeWindow || { start: new Date().toISOString(), end: new Date(Date.now() + 3600000).toISOString() },
    priority: priority || 'normal',
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  try {
    await db.jobs.create(job);
    console.log(`[JOB] Created: ${job.id} - ${customerName}`);

    broadcastToClients({ type: 'job-created', job });
    res.json({ job });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

/**
 * Update job status
 */
app.patch('/api/jobs/:id', async (req, res) => {
  const { id } = req.params;
  const { status, assignedRouteId } = req.body;

  try {
    const job = await db.jobs.findById(id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const updates = {};
    if (status) updates.status = status;
    if (assignedRouteId) updates.assignedRouteId = assignedRouteId;

    const updatedJob = await db.jobs.update(id, updates);

    console.log(`[JOB] Updated: ${id} - status: ${status}`);
    broadcastToClients({ type: 'job-updated', job: updatedJob });
    res.json({ job: updatedJob });
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

// ============================================================================
// ROUTES API
// ============================================================================

/**
 * Get all routes
 */
app.get('/api/routes', async (req, res) => {
  try {
    const routes = await db.routes.getAll();
    res.json({ routes });
  } catch (error) {
    console.error('Error fetching routes:', error);
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
});

/**
 * Create route with optimization
 */
app.post('/api/routes', async (req, res) => {
  const { vehicleId, jobIds } = req.body;

  if (!vehicleId || !jobIds || jobIds.length === 0) {
    return res.status(400).json({ error: 'vehicleId and jobIds required' });
  }

  try {
    const vehicle = await db.vehicles.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const allJobs = await db.jobs.getAll();
    const routeJobs = allJobs.filter(j => jobIds.includes(j.id));
    if (routeJobs.length === 0) {
      return res.status(400).json({ error: 'No valid jobs found' });
    }

    const route = {
      id: uuidv4(),
      vehicleId,
      jobIds,
      status: 'planned',
      totalDistance: Math.random() * 50 + 10,
      totalDuration: Math.random() * 120 + 30,
      createdAt: new Date().toISOString()
    };

    await db.routes.create(route);

    // Update jobs to assigned
    for (const job of routeJobs) {
      await db.jobs.update(job.id, { status: 'assigned', assignedRouteId: route.id });
    }

    console.log(`[ROUTE] Created: ${route.id} with ${jobIds.length} jobs`);
    broadcastToClients({ type: 'route-created', route });
    res.json({ route });
  } catch (error) {
    console.error('Error creating route:', error);
    res.status(500).json({ error: 'Failed to create route' });
  }
});

/**
 * Assign driver to route (dispatch)
 */
app.post('/api/routes/:id/assign', async (req, res) => {
  const { id } = req.params;
  const { driverId } = req.body;

  try {
    const route = await db.routes.findById(id);
    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    const driver = await db.drivers.findById(driverId);
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const updatedRoute = await db.routes.update(id, {
      driverId,
      status: 'dispatched',
      dispatchedAt: new Date().toISOString()
    });

    await db.drivers.update(driverId, { status: 'on_route' });

    const vehicle = await db.vehicles.findById(route.vehicleId);
    if (vehicle) {
      await db.vehicles.update(route.vehicleId, { status: 'in_route' });
    }

    // Update jobs
    const allJobs = await db.jobs.getAll();
    const routeJobs = allJobs.filter(j => route.jobIds.includes(j.id));
    for (const job of routeJobs) {
      await db.jobs.update(job.id, { status: 'in_progress' });
    }

    console.log(`[DISPATCH] Route ${id} assigned to driver ${driverId}`);
    broadcastToClients({ type: 'route-dispatched', route: updatedRoute, driver });
    res.json({ route: updatedRoute });
  } catch (error) {
    console.error('Error assigning driver:', error);
    res.status(500).json({ error: 'Failed to assign driver' });
  }
});

/**
 * Update route status
 */
app.patch('/api/routes/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const route = await db.routes.findById(id);
    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    const updates = { status };
    if (status === 'completed') {
      updates.completedAt = new Date().toISOString();

      // Update vehicle and driver
      const vehicle = await db.vehicles.findById(route.vehicleId);
      if (vehicle) {
        await db.vehicles.update(route.vehicleId, { status: 'available' });
      }

      if (route.driverId) {
        const driver = await db.drivers.findById(route.driverId);
        if (driver) {
          await db.drivers.update(route.driverId, { status: 'available' });
        }
      }

      // Update jobs
      const allJobs = await db.jobs.getAll();
      const routeJobs = allJobs.filter(j => route.jobIds.includes(j.id));
      for (const job of routeJobs) {
        await db.jobs.update(job.id, { status: 'completed' });
      }
    }

    const updatedRoute = await db.routes.update(id, updates);

    console.log(`[ROUTE] Updated: ${id} - status: ${status}`);
    broadcastToClients({ type: 'route-updated', route: updatedRoute });
    res.json({ route: updatedRoute });
  } catch (error) {
    console.error('Error updating route:', error);
    res.status(500).json({ error: 'Failed to update route' });
  }
});

// ============================================================================
// VEHICLES & DRIVERS API
// ============================================================================

app.get('/api/vehicles', async (req, res) => {
  try {
    const vehicles = await db.vehicles.getAll();
    res.json({ vehicles });
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

app.get('/api/drivers', async (req, res) => {
  try {
    const drivers = await db.drivers.getAll();
    res.json({ drivers });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  const clientsInfo = Array.from(clients.entries()).map(([id, client]) => ({
    clientId: id,
    connected: client.res && !client.res.writableEnded,
    bufferedMessages: client.buffer.length,
    lastSeen: client.lastSeen
  }));

  res.json({
    status: 'healthy',
    database: dbReady ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    clients: {
      total: clients.size,
      active: clientsInfo.filter(c => c.connected).length,
      details: clientsInfo
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Routing SaaS Backend',
    version: '1.0.0',
    database: dbReady ? 'connected' : 'disconnected',
    endpoints: {
      sse: 'GET /stream-route',
      jobs: 'GET/POST /api/jobs',
      routes: 'GET/POST /api/routes',
      vehicles: 'GET /api/vehicles',
      drivers: 'GET /api/drivers',
      health: 'GET /health'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Routing SaaS Backend running on port ${PORT}`);
  console.log(`📡 SSE endpoint: http://localhost:${PORT}/stream-route`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health\n`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n[SHUTDOWN] Received SIGTERM, closing connections...');

  broadcastToClients({
    type: 'server-shutdown',
    message: 'Server is shutting down',
    timestamp: new Date().toISOString()
  });

  for (const [clientId, client] of clients.entries()) {
    if (client.res && !client.res.writableEnded) {
      client.res.end();
    }
  }

  await db.disconnect();
  process.exit(0);
});

module.exports = app;
