import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const port = Number(process.env.MOCK_API_PORT || 3001);
const MOCK_ACCESS_TOKEN = 'mock-preview-token';
const MOCK_USER = {
  id: 'mock-user-1',
  email: 'demo@routing.local',
  name: 'Preview Dispatcher',
  role: 'dispatcher',
};

const now = Date.now();

const customers = [
  {
    id: randomUUID(),
    name: 'Northline Grocer',
    phone: '(555) 100-2000',
    email: 'ops@northline.example',
    businessName: 'Northline Grocer',
    notes: 'Dock door 3 after 8 AM',
    exceptions: 'Forklift unload required',
    defaultAddress: '1040 River Market St, Kansas City, MO 64106',
    defaultAddressStructured: {
      line1: '1040 River Market St',
      line2: null,
      city: 'Kansas City',
      state: 'MO',
      zip: '64106',
    },
  },
  {
    id: randomUUID(),
    name: 'Cedar Studio',
    phone: '(555) 300-4400',
    email: 'dispatch@cedar.example',
    businessName: 'Cedar Studio',
    notes: 'Call on arrival',
    exceptions: 'Rear entrance only',
    defaultAddress: '221 Cedar Ave, Kansas City, MO 64108',
    defaultAddressStructured: {
      line1: '221 Cedar Ave',
      line2: null,
      city: 'Kansas City',
      state: 'MO',
      zip: '64108',
    },
  },
  {
    id: randomUUID(),
    name: 'Union Medical Supply',
    phone: '(555) 770-1188',
    email: 'receiving@unionmed.example',
    businessName: 'Union Medical Supply',
    notes: 'Temperature-sensitive inventory',
    exceptions: '',
    defaultAddress: '500 Grand Blvd, Kansas City, MO 64106',
    defaultAddressStructured: {
      line1: '500 Grand Blvd',
      line2: 'Suite 210',
      city: 'Kansas City',
      state: 'MO',
      zip: '64106',
    },
  },
];

const vehicles = [
  {
    id: randomUUID(),
    make: 'Ford',
    model: 'Transit',
    year: 2024,
    licensePlate: 'OPS-241',
    vehicleType: 'VAN',
    type: 'van',
    status: 'available',
    fuelType: 'DIESEL',
    capacity: 1200,
  },
  {
    id: randomUUID(),
    make: 'Freightliner',
    model: 'M2',
    year: 2023,
    licensePlate: 'ROUTE-17',
    vehicleType: 'TRUCK',
    type: 'truck',
    status: 'available',
    fuelType: 'DIESEL',
    capacity: 5000,
  },
  {
    id: randomUUID(),
    make: 'Mercedes',
    model: 'Sprinter',
    year: 2025,
    licensePlate: 'READY-8',
    vehicleType: 'VAN',
    type: 'van',
    status: 'AVAILABLE',
    fuelType: 'DIESEL',
    capacity: 1800,
  },
];

const drivers = [
  {
    id: randomUUID(),
    firstName: 'Ariana',
    lastName: 'Cole',
    email: 'ariana.cole@example.com',
    phone: '(555) 401-9900',
    licenseNumber: 'DL-1001',
    licenseType: 'CLASS_C',
    assignedVehicleId: vehicles[0].id,
    notes: '',
    status: 'ACTIVE',
    currentHours: 3,
    maxHours: 10,
  },
  {
    id: randomUUID(),
    firstName: 'Malik',
    lastName: 'Hayes',
    email: 'malik.hayes@example.com',
    phone: '(555) 401-9901',
    licenseNumber: 'DL-1002',
    licenseType: 'CLASS_B',
    assignedVehicleId: vehicles[1].id,
    notes: '',
    status: 'active',
    currentHours: 5,
    maxHours: 10,
  },
  {
    id: randomUUID(),
    firstName: 'Tessa',
    lastName: 'Nguyen',
    email: 'tessa.nguyen@example.com',
    phone: '(555) 401-9902',
    licenseNumber: 'DL-1003',
    licenseType: 'CLASS_C',
    assignedVehicleId: '',
    notes: '',
    status: 'available',
    currentHours: 1,
    maxHours: 10,
  },
];

const jobs = [
  {
    id: randomUUID(),
    customerId: customers[0].id,
    customerName: customers[0].name,
    customerPhone: customers[0].phone,
    customerEmail: customers[0].email,
    deliveryAddress: customers[0].defaultAddress,
    pickupAddress: '2100 State Line Rd, Kansas City, MO 64108',
    deliveryAddressStructured: customers[0].defaultAddressStructured,
    status: 'pending',
    priority: 'high',
    assignedRouteId: null,
    stopSequence: null,
    createdAt: new Date(now - 1000 * 60 * 45).toISOString(),
  },
  {
    id: randomUUID(),
    customerId: customers[1].id,
    customerName: customers[1].name,
    customerPhone: customers[1].phone,
    customerEmail: customers[1].email,
    deliveryAddress: customers[1].defaultAddress,
    pickupAddress: '1930 Walnut St, Kansas City, MO 64108',
    deliveryAddressStructured: customers[1].defaultAddressStructured,
    status: 'pending',
    priority: 'urgent',
    assignedRouteId: null,
    stopSequence: null,
    createdAt: new Date(now - 1000 * 60 * 35).toISOString(),
  },
  {
    id: randomUUID(),
    customerId: customers[2].id,
    customerName: customers[2].name,
    customerPhone: customers[2].phone,
    customerEmail: customers[2].email,
    deliveryAddress: customers[2].defaultAddress,
    pickupAddress: '700 Broadway Blvd, Kansas City, MO 64105',
    deliveryAddressStructured: customers[2].defaultAddressStructured,
    status: 'pending',
    priority: 'normal',
    assignedRouteId: null,
    stopSequence: null,
    createdAt: new Date(now - 1000 * 60 * 20).toISOString(),
  },
];

const routes = [
  {
    id: randomUUID(),
    vehicleId: vehicles[2].id,
    driverId: drivers[0].id,
    jobIds: [],
    status: 'assigned',
    totalDistance: 18.4,
    totalDuration: 72,
    estimatedCapacity: 48,
    optimizedStops: [],
    optimizedAt: new Date(now - 1000 * 60 * 12).toISOString(),
    currentLocation: [39.0997, -94.5786],
    completedStops: 0,
    totalStops: 0,
    estimatedTimeRemaining: 72,
    path: [
      [39.0997, -94.5786],
      [39.1068, -94.5704],
    ],
  },
];

const sseClients = new Set();

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
  });
  res.end(JSON.stringify(payload));
}

function noContent(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
  });
  res.end();
}

function notFound(res) {
  json(res, 404, { error: 'Not found' });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function emit(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
}

function toVehicleShape(vehicle) {
  return {
    ...vehicle,
    name: `${vehicle.make} ${vehicle.model}`,
  };
}

function toDriverShape(driver) {
  return { ...driver };
}

function toCustomerShape(customer) {
  return { ...customer };
}

function buildOptimizedStops(jobIds) {
  return jobIds.map((jobId, index) => {
    const job = jobs.find((item) => item.id === jobId);
    return {
      jobId,
      sequence: index + 1,
      address: job?.deliveryAddress || 'Unknown address',
      estimatedArrival: new Date(now + (index + 1) * 1000 * 60 * 18).toISOString(),
      distanceFromPrevious: index === 0 ? 0 : 4.8 + index * 1.7,
    };
  });
}

function refreshRoute(route) {
  route.optimizedStops = buildOptimizedStops(route.jobIds);
  route.totalStops = route.jobIds.length;
  route.completedStops = route.completedStops || 0;
  route.totalDistance = Number((route.jobIds.length * 6.2 + 4.1).toFixed(1));
  route.totalDuration = route.jobIds.length * 22 + 18;
  route.estimatedCapacity = Math.min(100, route.jobIds.length * 18 + 12);
  route.estimatedTimeRemaining = route.status === 'in_progress'
    ? Math.max(0, route.totalDuration - route.completedStops * 18)
    : route.totalDuration;
  route.path = route.optimizedStops.map((stop, index) => [
    39.0997 + index * 0.015,
    -94.5786 + index * 0.01,
  ]);
  route.currentLocation = route.path[0] || [39.0997, -94.5786];
  return route;
}

function assignJobsToRoute(routeId, jobIds) {
  for (const job of jobs) {
    if (jobIds.includes(job.id)) {
      job.assignedRouteId = routeId;
      job.stopSequence = jobIds.indexOf(job.id) + 1;
    }
  }
}

function clearJobsFromRoute(routeId) {
  for (const job of jobs) {
    if (job.assignedRouteId === routeId) {
      job.assignedRouteId = null;
      job.stopSequence = null;
      if (job.status !== 'completed') {
        job.status = 'pending';
      }
    }
  }
}

function createRoute(vehicleId, jobIds) {
  const route = refreshRoute({
    id: randomUUID(),
    vehicleId,
    driverId: null,
    jobIds: [...jobIds],
    status: 'planned',
    totalDistance: 0,
    totalDuration: 0,
    estimatedCapacity: 0,
    optimizedStops: [],
    optimizedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    currentLocation: [39.0997, -94.5786],
    completedStops: 0,
    totalStops: 0,
    estimatedTimeRemaining: 0,
    path: [],
  });
  assignJobsToRoute(route.id, jobIds);
  routes.unshift(route);
  return route;
}

const demoRoute = createRoute(vehicles[1].id, [jobs[0].id, jobs[2].id]);
demoRoute.driverId = drivers[1].id;
demoRoute.status = 'in_progress';
demoRoute.completedStops = 1;
refreshRoute(demoRoute);
jobs[0].status = 'in_progress';
jobs[2].status = 'in_progress';

const readyRoute = routes[1];
readyRoute.jobIds = [jobs[1].id];
assignJobsToRoute(readyRoute.id, [jobs[1].id]);
readyRoute.totalStops = 1;
readyRoute.optimizedStops = buildOptimizedStops(readyRoute.jobIds);

const optimizerHealth = {
  status: 'degraded',
  source: 'mock-preview',
  details: 'Mock planner is active for UI preview',
  updatedAt: new Date().toISOString(),
  fallbackActive: true,
};

const rerouteRequests = [];
const dispatchTimelineEvents = [];

function pushTimelineEvent({
  routeId = null,
  action = 'system_event',
  source = 'system',
  reasonCode = 'MOCK_PREVIEW_EVENT',
  actor = 'mock-preview-api',
  packId = null,
  payload = {},
}) {
  const event = {
    id: randomUUID(),
    routeId,
    action,
    source,
    actor,
    reasonCode,
    packId,
    payload,
    createdAt: new Date().toISOString(),
  };
  dispatchTimelineEvents.unshift(event);
  if (dispatchTimelineEvents.length > 200) {
    dispatchTimelineEvents.pop();
  }
  return event;
}

function buildReroutePreview(route, action, payload = {}) {
  const stopCount = route?.jobIds?.length || 0;
  const dropped = action === 'remove_stop' && payload.jobId ? [payload.jobId] : [];
  const feasible = action !== 'split_route' || stopCount > 1;
  const reasonCodes = feasible ? ['PREVIEW_OK'] : ['ROUTE_SPLIT_NEEDS_TWO_STOPS'];
  return {
    action,
    impliedDataQuality: feasible ? 'degraded' : 'simulated',
    impliedWorkflowStatus: 'rerouting',
    dispatchBlocked: !feasible,
    impactSummary: {
      distanceDeltaKm: Number((Math.max(0.8, stopCount * 0.65)).toFixed(1)),
      durationDeltaMinutes: Math.max(5, stopCount * 4),
      droppedJobs: dropped,
      changedStopOrder: action === 'reorder_stops',
    },
    alternatives: [
      { id: 'keep_current_route', label: 'Keep Current Route', rank: 1, feasibilityScore: 96 },
      { id: action, label: `Apply ${action}`, rank: 2, feasibilityScore: feasible ? 84 : 58 },
    ],
    constraintDiagnostics: {
      feasible,
      feasibilityScore: feasible ? 84 : 58,
      reasonCodes,
      selectedPackId: payload.constraintPackId || 'generic',
      conflictSummary: {
        total: feasible ? 0 : 1,
        critical: feasible ? 0 : 1,
        major: 0,
        minor: feasible ? 0 : 1,
      },
      timeWindowViolations: [],
      capacityConflicts: [],
      skillMismatches: [],
    },
  };
}

function handleOptions(req, res) {
  noContent(res);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const { pathname } = url;

  if (req.method === 'OPTIONS') {
    handleOptions(req, res);
    return;
  }

  if (pathname === '/health') {
    json(res, 200, { status: 'ok', mode: 'mock-preview' });
    return;
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const body = await readBody(req);
    json(res, 200, {
      accessToken: MOCK_ACCESS_TOKEN,
      user: {
        ...MOCK_USER,
        email: body?.email || MOCK_USER.email,
      },
    });
    return;
  }

  if (pathname === '/api/auth/me' && req.method === 'GET') {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      json(res, 401, { message: 'Unauthorized' });
      return;
    }
    json(res, 200, { user: MOCK_USER });
    return;
  }

  if (pathname === '/stream-route') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(`data: ${JSON.stringify({ type: 'connected', at: new Date().toISOString() })}\n\n`);
    sseClients.add(res);
    const timer = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat', at: new Date().toISOString() })}\n\n`);
    }, 15000);
    req.on('close', () => {
      clearInterval(timer);
      sseClients.delete(res);
    });
    return;
  }

  if (pathname === '/api/drivers' && req.method === 'GET') {
    json(res, 200, { drivers: drivers.map(toDriverShape) });
    return;
  }

  if (pathname === '/api/drivers' && req.method === 'POST') {
    const body = await readBody(req);
    const driver = {
      id: randomUUID(),
      ...body,
      status: body.status || 'ACTIVE',
    };
    drivers.unshift(driver);
    emit({ type: 'driver-updated', driverId: driver.id });
    json(res, 201, { driver });
    return;
  }

  if (pathname.startsWith('/api/drivers/') && req.method === 'PATCH') {
    const driverId = pathname.split('/').pop();
    const driver = drivers.find((item) => item.id === driverId);
    if (!driver) {
      notFound(res);
      return;
    }
    Object.assign(driver, await readBody(req));
    emit({ type: 'driver-updated', driverId: driver.id });
    json(res, 200, { driver });
    return;
  }

  if (pathname === '/api/vehicles' && req.method === 'GET') {
    json(res, 200, { vehicles: vehicles.map(toVehicleShape) });
    return;
  }

  if (pathname === '/api/vehicles' && req.method === 'POST') {
    const body = await readBody(req);
    const vehicle = {
      id: randomUUID(),
      ...body,
      vehicleType: body.vehicleType || 'VAN',
      type: String(body.vehicleType || 'VAN').toLowerCase(),
      status: body.status || 'AVAILABLE',
    };
    vehicles.unshift(vehicle);
    emit({ type: 'vehicle-updated', vehicleId: vehicle.id });
    json(res, 201, { vehicle: toVehicleShape(vehicle) });
    return;
  }

  if (pathname.startsWith('/api/vehicles/') && req.method === 'PATCH') {
    const vehicleId = pathname.split('/').pop();
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    if (!vehicle) {
      notFound(res);
      return;
    }
    Object.assign(vehicle, await readBody(req));
    vehicle.type = String(vehicle.vehicleType || vehicle.type || 'VAN').toLowerCase();
    emit({ type: 'vehicle-updated', vehicleId: vehicle.id });
    json(res, 200, { vehicle: toVehicleShape(vehicle) });
    return;
  }

  if (pathname === '/api/customers' && req.method === 'GET') {
    json(res, 200, { customers: customers.map(toCustomerShape) });
    return;
  }

  if (pathname === '/api/customers' && req.method === 'POST') {
    const body = await readBody(req);
    const customer = {
      id: randomUUID(),
      ...body,
    };
    customers.unshift(customer);
    emit({ type: 'customer-updated', customerId: customer.id });
    json(res, 201, { customer });
    return;
  }

  if (pathname.startsWith('/api/customers/') && req.method === 'PATCH') {
    const customerId = pathname.split('/').pop();
    const customer = customers.find((item) => item.id === customerId);
    if (!customer) {
      notFound(res);
      return;
    }
    Object.assign(customer, await readBody(req));
    emit({ type: 'customer-updated', customerId: customer.id });
    json(res, 200, { customer });
    return;
  }

  if (pathname.startsWith('/api/customers/') && req.method === 'DELETE') {
    const customerId = pathname.split('/').pop();
    const index = customers.findIndex((item) => item.id === customerId);
    if (index === -1) {
      notFound(res);
      return;
    }
    customers.splice(index, 1);
    emit({ type: 'customer-updated', customerId });
    noContent(res);
    return;
  }

  if (pathname === '/api/jobs' && req.method === 'GET') {
    json(res, 200, { jobs });
    return;
  }

  if (pathname === '/api/jobs' && req.method === 'POST') {
    const body = await readBody(req);
    const job = {
      id: randomUUID(),
      status: body.status || 'pending',
      priority: body.priority || 'normal',
      assignedRouteId: null,
      stopSequence: null,
      createdAt: new Date().toISOString(),
      ...body,
    };
    jobs.unshift(job);
    emit({ type: 'job-updated', jobId: job.id });
    json(res, 201, { job });
    return;
  }

  if (pathname.startsWith('/api/jobs/') && req.method === 'PATCH') {
    const jobId = pathname.split('/').pop();
    const job = jobs.find((item) => item.id === jobId);
    if (!job) {
      notFound(res);
      return;
    }
    Object.assign(job, await readBody(req));
    if (job.status === 'completed' && !job.completedAt) {
      job.completedAt = new Date().toISOString();
    }
    emit({ type: 'job-updated', jobId: job.id });
    json(res, 200, { job });
    return;
  }

  if (pathname === '/api/dispatch/optimizer/health' && req.method === 'GET') {
    json(res, 200, optimizerHealth);
    return;
  }

  if (pathname === '/api/dispatch/timeline' && req.method === 'GET') {
    const routeId = url.searchParams.get('routeId');
    const source = url.searchParams.get('source');
    const action = url.searchParams.get('action');
    const reasonCode = url.searchParams.get('reasonCode');
    const actor = url.searchParams.get('actor');
    const packId = url.searchParams.get('packId');
    const limit = Number(url.searchParams.get('limit') || 20);

    let events = [...dispatchTimelineEvents];
    if (routeId) events = events.filter((event) => event.routeId === routeId);
    if (source) events = events.filter((event) => event.source === source);
    if (action) events = events.filter((event) => event.action === action);
    if (reasonCode) events = events.filter((event) => event.reasonCode === reasonCode);
    if (actor) events = events.filter((event) => event.actor === actor);
    if (packId) events = events.filter((event) => event.packId === packId);

    json(res, 200, { events: events.slice(0, Math.max(1, limit)) });
    return;
  }

  if (pathname === '/api/dispatch/routes' && req.method === 'GET') {
    json(res, 200, { routes, optimizerHealth });
    return;
  }

  if (pathname === '/api/dispatch/routes/global' && req.method === 'POST') {
    const body = await readBody(req);
    const vehicleIds = Array.isArray(body.vehicleIds) ? body.vehicleIds : [];
    const jobIds = Array.isArray(body.jobIds) ? body.jobIds : [];
    const chunkSize = Math.max(1, Math.ceil(jobIds.length / Math.max(vehicleIds.length, 1)));
    const created = vehicleIds.map((vehicleId, index) => createRoute(vehicleId, jobIds.slice(index * chunkSize, (index + 1) * chunkSize)));
    emit({ type: 'route-updated', routeIds: created.map((route) => route.id) });
    json(res, 200, { routes: created });
    return;
  }

  if (pathname === '/api/dispatch/routes' && req.method === 'POST') {
    const body = await readBody(req);
    const route = createRoute(body.vehicleId, Array.isArray(body.jobIds) ? body.jobIds : []);
    emit({ type: 'route-updated', routeId: route.id });
    emit({ type: 'job-updated', source: 'route-create' });
    json(res, 201, { route });
    return;
  }

  if (pathname.match(/^\/api\/dispatch\/routes\/[^/]+\/assign$/) && req.method === 'POST') {
    const routeId = pathname.split('/')[4];
    const route = routes.find((item) => item.id === routeId);
    if (!route) {
      notFound(res);
      return;
    }
    const body = await readBody(req);
    route.driverId = body.driverId || null;
    route.status = route.driverId ? 'assigned' : route.status;
    emit({ type: 'route-updated', routeId: route.id });
    json(res, 200, { route });
    return;
  }

  if (pathname.match(/^\/api\/dispatch\/routes\/[^/]+\/start$/) && req.method === 'PATCH') {
    const routeId = pathname.split('/')[4];
    const route = routes.find((item) => item.id === routeId);
    if (!route) {
      notFound(res);
      return;
    }
    route.status = 'in_progress';
    route.completedStops = 0;
    for (const job of jobs) {
      if (route.jobIds.includes(job.id)) {
        job.status = 'in_progress';
      }
    }
    emit({ type: 'route-updated', routeId: route.id });
    emit({ type: 'job-updated', source: 'route-start' });
    json(res, 200, { route });
    return;
  }

  if (pathname.match(/^\/api\/dispatch\/routes\/[^/]+\/complete$/) && req.method === 'PATCH') {
    const routeId = pathname.split('/')[4];
    const route = routes.find((item) => item.id === routeId);
    if (!route) {
      notFound(res);
      return;
    }
    route.status = 'completed';
    route.completedStops = route.jobIds.length;
    for (const job of jobs) {
      if (route.jobIds.includes(job.id)) {
        job.status = 'completed';
        job.completedAt = new Date().toISOString();
      }
    }
    emit({ type: 'route-updated', routeId: route.id });
    emit({ type: 'job-updated', source: 'route-complete' });
    json(res, 200, { route });
    return;
  }

  if (pathname.match(/^\/api\/dispatch\/routes\/[^/]+\/cancel$/) && req.method === 'PATCH') {
    const routeId = pathname.split('/')[4];
    const route = routes.find((item) => item.id === routeId);
    if (!route) {
      notFound(res);
      return;
    }
    route.status = 'cancelled';
    clearJobsFromRoute(route.id);
    emit({ type: 'route-updated', routeId: route.id });
    emit({ type: 'job-updated', source: 'route-cancel' });
    json(res, 200, { route });
    return;
  }

  if (pathname.match(/^\/api\/dispatch\/routes\/[^/]+\/reorder$/) && req.method === 'PATCH') {
    const routeId = pathname.split('/')[4];
    const route = routes.find((item) => item.id === routeId);
    if (!route) {
      notFound(res);
      return;
    }
    const body = await readBody(req);
    const nextJobOrder = Array.isArray(body.newJobOrder)
      ? body.newJobOrder
      : Array.isArray(body.jobIds)
        ? body.jobIds
        : route.jobIds;
    route.jobIds = nextJobOrder;
    refreshRoute(route);
    assignJobsToRoute(route.id, route.jobIds);
    emit({ type: 'route-updated', routeId: route.id });
    json(res, 200, { route });
    return;
  }

  if (pathname.match(/^\/api\/dispatch\/routes\/[^/]+$/) && (req.method === 'PATCH' || req.method === 'PUT')) {
    const routeId = pathname.split('/')[4];
    const route = routes.find((item) => item.id === routeId);
    if (!route) {
      notFound(res);
      return;
    }
    const body = await readBody(req);
    if (Object.prototype.hasOwnProperty.call(body, 'driverId')) {
      route.driverId = body.driverId;
    }
    Object.assign(route, body);
    refreshRoute(route);
    emit({ type: 'route-updated', routeId: route.id });
    json(res, 200, { route });
    return;
  }

  if (pathname.match(/^\/api\/dispatch\/routes\/[^/]+\/reroute\/history$/) && req.method === 'GET') {
    const routeId = pathname.split('/')[4];
    const history = rerouteRequests
      .filter((request) => request.routeId === routeId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    json(res, 200, { rerouteRequests: history });
    return;
  }

  if (pathname.match(/^\/api\/dispatch\/routes\/[^/]+\/reroute\/preview$/) && req.method === 'POST') {
    const routeId = pathname.split('/')[4];
    const route = routes.find((item) => item.id === routeId);
    if (!route) {
      notFound(res);
      return;
    }
    const body = await readBody(req);
    const action = body.action || 'reorder_stops';
    const payload = body.payload || {};
    const preview = buildReroutePreview(route, action, payload);
    pushTimelineEvent({
      routeId,
      action: 'reroute_preview',
      source: 'reroute',
      reasonCode: preview.constraintDiagnostics.feasible ? 'PREVIEW_OK' : 'PREVIEW_CONSTRAINT_CONFLICT',
      packId: preview.constraintDiagnostics.selectedPackId,
      payload: { action },
    });
    json(res, 200, { preview });
    return;
  }

  if (pathname.match(/^\/api\/dispatch\/routes\/[^/]+\/reroute\/request$/) && req.method === 'POST') {
    const routeId = pathname.split('/')[4];
    const route = routes.find((item) => item.id === routeId);
    if (!route) {
      notFound(res);
      return;
    }
    const body = await readBody(req);
    const rerouteRequest = {
      id: randomUUID(),
      routeId,
      status: 'requested',
      exceptionCategory: body.exceptionCategory || 'traffic_delay',
      action: body.action || 'reorder_stops',
      reason: body.reason || 'Operator requested reroute',
      requesterId: body.requesterId || 'dispatcher-ui',
      requestPayload: body.requestPayload || {},
      plannerDiagnostics: body.plannerDiagnostics || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    rerouteRequests.unshift(rerouteRequest);
    route.rerouteState = 'requested';
    route.workflowStatus = 'rerouting';
    route.exceptionCategory = rerouteRequest.exceptionCategory;
    route.constraintPackId = rerouteRequest.requestPayload?.constraintPackId || route.constraintPackId || 'generic';
    pushTimelineEvent({
      routeId,
      action: 'request_reroute',
      source: 'reroute',
      reasonCode: 'REROUTE_REQUESTED',
      actor: rerouteRequest.requesterId,
      packId: route.constraintPackId,
      payload: { action: rerouteRequest.action, category: rerouteRequest.exceptionCategory },
    });
    json(res, 200, { rerouteRequest, route });
    return;
  }

  if (pathname.match(/^\/api\/dispatch\/routes\/[^/]+\/reroute\/[^/]+\/approve$/) && req.method === 'POST') {
    const routeId = pathname.split('/')[4];
    const requestId = pathname.split('/')[6];
    const route = routes.find((item) => item.id === routeId);
    const rerouteRequest = rerouteRequests.find((item) => item.id === requestId && item.routeId === routeId);
    if (!route || !rerouteRequest) {
      notFound(res);
      return;
    }
    const body = await readBody(req);
    rerouteRequest.status = 'approved';
    rerouteRequest.reviewerId = body.reviewerId || 'dispatcher-ui';
    rerouteRequest.reviewNote = body.reviewNote || '';
    rerouteRequest.updatedAt = new Date().toISOString();
    route.rerouteState = 'approved';
    pushTimelineEvent({
      routeId,
      action: 'approve_reroute',
      source: 'reroute',
      reasonCode: 'REROUTE_APPROVED',
      actor: rerouteRequest.reviewerId,
      packId: route.constraintPackId || null,
    });
    json(res, 200, { rerouteRequest, route });
    return;
  }

  if (pathname.match(/^\/api\/dispatch\/routes\/[^/]+\/reroute\/[^/]+\/reject$/) && req.method === 'POST') {
    const routeId = pathname.split('/')[4];
    const requestId = pathname.split('/')[6];
    const route = routes.find((item) => item.id === routeId);
    const rerouteRequest = rerouteRequests.find((item) => item.id === requestId && item.routeId === routeId);
    if (!route || !rerouteRequest) {
      notFound(res);
      return;
    }
    const body = await readBody(req);
    rerouteRequest.status = 'rejected';
    rerouteRequest.reviewerId = body.reviewerId || 'dispatcher-ui';
    rerouteRequest.reviewNote = body.reviewNote || '';
    rerouteRequest.updatedAt = new Date().toISOString();
    route.rerouteState = null;
    pushTimelineEvent({
      routeId,
      action: 'reject_reroute',
      source: 'reroute',
      reasonCode: 'REROUTE_REJECTED',
      actor: rerouteRequest.reviewerId,
      packId: route.constraintPackId || null,
    });
    json(res, 200, { rerouteRequest, route });
    return;
  }

  if (pathname.match(/^\/api\/dispatch\/routes\/[^/]+\/reroute\/[^/]+\/apply$/) && req.method === 'POST') {
    const routeId = pathname.split('/')[4];
    const requestId = pathname.split('/')[6];
    const route = routes.find((item) => item.id === routeId);
    const rerouteRequest = rerouteRequests.find((item) => item.id === requestId && item.routeId === routeId);
    if (!route || !rerouteRequest) {
      notFound(res);
      return;
    }
    const body = await readBody(req);
    rerouteRequest.status = 'applied';
    rerouteRequest.appliedBy = body.appliedBy || 'dispatcher-ui';
    rerouteRequest.appliedPayload = body.appliedPayload || {};
    rerouteRequest.overrideRequested = Boolean(body.overrideRequested);
    rerouteRequest.overrideReason = body.overrideReason || '';
    rerouteRequest.overrideActor = body.overrideActor || null;
    rerouteRequest.overrideActorRole = body.overrideActorRole || null;
    rerouteRequest.updatedAt = new Date().toISOString();
    route.rerouteState = 'applied';
    route.workflowStatus = 'ready_for_dispatch';
    route.dataQuality = rerouteRequest.overrideRequested ? 'degraded' : 'live';
    route.optimizationStatus = rerouteRequest.overrideRequested ? 'degraded' : 'optimized';
    pushTimelineEvent({
      routeId,
      action: 'apply_reroute',
      source: 'reroute',
      reasonCode: rerouteRequest.overrideRequested ? 'REROUTE_APPLIED_WITH_OVERRIDE' : 'REROUTE_APPLIED',
      actor: rerouteRequest.appliedBy,
      packId: route.constraintPackId || null,
      payload: { overrideRequested: rerouteRequest.overrideRequested },
    });
    json(res, 200, { rerouteRequest, route });
    return;
  }

  notFound(res);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Mock preview API listening on http://127.0.0.1:${port}`);
});
