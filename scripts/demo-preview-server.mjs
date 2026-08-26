#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const distDir = resolve(rootDir, 'frontend/dist');
const indexPath = join(distDir, 'index.html');

const port = parsePort(process.env.DEMO_PREVIEW_PORT || process.env.PORT || '5186');
const host = process.env.DEMO_PREVIEW_HOST || process.env.HOST || '127.0.0.1';
const allowNetworkBind = process.env.DEMO_PREVIEW_ALLOW_NETWORK === '1';
const requestedPreviewRole = process.env.DEMO_PREVIEW_ROLE?.trim().toLowerCase();
const forcedPreviewRole = ['dispatcher', 'driver'].includes(requestedPreviewRole)
  ? requestedPreviewRole
  : null;
const dispatcherPreviewUser = {
      id: 'preview-user',
      email: 'preview@trovan.local',
      role: 'dispatcher',
      roles: ['DISPATCHER'],
      authProvider: 'local-config',
      organizationId: 'preview-org',
      sessionId: 'preview-session',
    };
const driverPreviewUser = {
      id: 'preview-driver-user',
      email: 'anna.quinn@trovan.local',
      role: 'driver',
      roles: ['DRIVER'],
      authProvider: 'local-config',
      organizationId: 'preview-org',
      sessionId: 'preview-session',
    };
const forcedPreviewRoleLiteral = JSON.stringify(forcedPreviewRole);
const dispatcherPreviewUserLiteral = JSON.stringify(JSON.stringify(dispatcherPreviewUser));
const driverPreviewUserLiteral = JSON.stringify(JSON.stringify(driverPreviewUser));

if (!isLoopbackHost(host) && !allowNetworkBind) {
  console.error(
    `Refusing to bind demo preview server to "${host}". Use 127.0.0.1/localhost, or set DEMO_PREVIEW_ALLOW_NETWORK=1 intentionally.`,
  );
  process.exit(1);
}

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

const previewBootstrap = String.raw`
<script id="trovan-demo-preview-bootstrap">
  (function () {
    try {
      if (!window.localStorage.getItem('authToken')) {
        window.localStorage.setItem('authToken', 'preview-auth-bypass');
      }
      var driverRoute = window.location.pathname === '/driver' ||
        window.location.pathname.indexOf('/driver/') === 0;
      var forcedRole = ${forcedPreviewRoleLiteral};
      var previewUser = forcedRole === 'driver' || (!forcedRole && driverRoute)
        ? ${driverPreviewUserLiteral}
        : ${dispatcherPreviewUserLiteral};
      window.localStorage.setItem('trovan-preview-auth-user', previewUser);
      window.__TROVAN_LOCAL_DEMO_PREVIEW__ = true;
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations()
          .then(function (registrations) {
            return Promise.all(registrations.map(function (registration) {
              return registration.unregister();
            }));
          })
          .catch(function () {});
      }
      if ('caches' in window) {
        caches.keys()
          .then(function (keys) {
            return Promise.all(keys.map(function (key) {
              return caches.delete(key);
            }));
          })
          .catch(function () {});
      }
    } catch (error) {
      // Preview bootstrap is best-effort and must never block app loading.
    }
  })();
</script>`;

const demoJobs = [
  {
    id: 'job-jane-1',
    customerName: 'Jane & Sons Bakery',
    deliveryAddress: '1425 Market Ave, Denver, CO 80202',
    pickupAddress: 'Bakery Loading Dock',
    pickupLocation: { lat: 39.7489, lng: -105.0063 },
    deliveryLocation: { lat: 39.7508, lng: -105.0022 },
    status: 'pending',
    priority: 'high',
    assignedRouteId: 'route-alpha-001',
  },
  {
    id: 'job-omega-2',
    customerName: 'Omega Medical',
    deliveryAddress: '2100 Santa Fe Dr, Denver, CO 80204',
    pickupAddress: 'Medical Fulfillment Hub',
    pickupLocation: { lat: 39.7449, lng: -105.0126 },
    deliveryLocation: { lat: 39.7523, lng: -104.9892 },
    status: 'pending',
    priority: 'urgent',
    assignedRouteId: 'route-alpha-001',
  },
  {
    id: 'job-pioneer-3',
    customerName: 'Pioneer Logistics',
    deliveryAddress: '3300 Peña Blvd, Denver, CO 80216',
    pickupAddress: 'Distribution Center',
    pickupLocation: { lat: 39.7898, lng: -104.9725 },
    deliveryLocation: { lat: 39.7333, lng: -104.9875 },
    status: 'pending',
    priority: 'normal',
    assignedRouteId: 'route-beta-002',
  },
  {
    id: 'job-ridge-4',
    customerName: 'Ridgewood Labs',
    deliveryAddress: '4100 Irving St, Denver, CO 80217',
    pickupAddress: 'Regional Depot',
    pickupLocation: { lat: 39.7625, lng: -105.0214 },
    deliveryLocation: { lat: 39.7491, lng: -105.0011 },
    status: 'pending',
    priority: 'normal',
    assignedRouteId: 'route-gamma-003',
  },
  {
    id: 'job-river-5',
    customerName: 'Riverfront Catering',
    deliveryAddress: '870 W Evans Ave, Denver, CO 80223',
    pickupAddress: 'Kitchen Hub',
    pickupLocation: { lat: 39.7061, lng: -105.0015 },
    deliveryLocation: { lat: 39.6788, lng: -104.9981 },
    status: 'pending',
    priority: 'low',
    assignedRouteId: null,
  },
  {
    id: 'job-route-6',
    customerName: 'Route Ops QA',
    deliveryAddress: '1010 Platte St, Denver, CO 80204',
    pickupAddress: 'QA Staging',
    pickupLocation: { lat: 39.7588, lng: -105.0108 },
    deliveryLocation: { lat: 39.7544, lng: -105.0044 },
    status: 'pending',
    priority: 'low',
    assignedRouteId: null,
  },
];

const demoDrivers = [
  { id: 'driver-anna-2', firstName: 'Anna', lastName: 'Quinn', status: 'on_duty' },
  { id: 'driver-carl-3', firstName: 'Carl', lastName: 'Snyder', status: 'on_route' },
];

const demoVehicles = [
  { id: 'veh-van-1', make: 'Ford', model: 'Transit', licensePlate: 'DEN-112', vehicleType: 'cargo_van', status: 'available', capacity: 1500 },
  { id: 'veh-van-2', make: 'Chevy', model: 'Express', licensePlate: 'DEN-220', vehicleType: 'box_truck', status: 'available', capacity: 1200 },
  { id: 'veh-shuttle-3', make: 'Mercedes', model: 'Sprinter', licensePlate: 'DEN-331', vehicleType: 'sprinter_van', status: 'in_use', capacity: 1800 },
  { id: 'veh-semi-4', make: 'Freightliner', model: 'Cascadia', licensePlate: 'DEN-808', vehicleType: 'semi_truck', status: 'available', capacity: 18000 },
];

const demoRoutes = [
  {
    id: 'route-alpha-001',
    vehicleId: 'veh-van-1',
    driverId: null,
    status: 'planned',
    workflowStatus: 'planned',
    totalDistanceKm: 14.7,
    totalDurationMinutes: 35,
    jobIds: ['job-jane-1', 'job-omega-2'],
    routeData: {
      polyline: {
        coordinates: [
          [-105.0022, 39.7508],
          [-105.0056, 39.7497],
          [-104.9892, 39.7523],
        ],
      },
    },
    planningWarnings: ['Simulated planning path used'],
    createdAt: '2026-04-10T09:50:00.000Z',
  },
  {
    id: 'route-beta-002',
    vehicleId: 'veh-van-2',
    driverId: 'driver-anna-2',
    status: 'assigned',
    workflowStatus: 'ready_for_dispatch',
    totalDistanceKm: 9.8,
    totalDurationMinutes: 22,
    jobIds: ['job-pioneer-3'],
    routeData: {
      polyline: {
        coordinates: [
          [-104.9875, 39.7333],
          [-104.992, 39.741],
        ],
      },
    },
    createdAt: '2026-04-10T09:55:00.000Z',
  },
  {
    id: 'route-gamma-003',
    vehicleId: 'veh-shuttle-3',
    driverId: 'driver-carl-3',
    status: 'in_progress',
    workflowStatus: 'in_progress',
    totalDistanceKm: 21.9,
    totalDurationMinutes: 58,
    jobIds: ['job-ridge-4'],
    planningWarnings: ['One job deferred due route capacity'],
    routeData: {
      polyline: {
        coordinates: [
          [-105.0011, 39.7491],
          [-104.996, 39.742],
        ],
      },
    },
    createdAt: '2026-04-10T08:40:00.000Z',
    dispatchedAt: '2026-04-10T09:10:00.000Z',
  },
];

const demoExceptions = [
  {
    id: 'exception-route-alpha',
    routeId: 'route-alpha-001',
    routeRunStopId: null,
    code: 'CAPACITY',
    message: 'Simulated planning path used',
    status: 'ACKNOWLEDGED',
    details: {},
    createdAt: '2026-04-10T10:05:00.000Z',
  },
];

const server = createServer(async (req, res) => {
  try {
    const method = req.method || 'GET';
    if (!['GET', 'HEAD', 'OPTIONS', 'POST'].includes(method)) {
      sendText(res, 405, 'Method not allowed');
      return;
    }

    if (method === 'OPTIONS') {
      sendEmpty(res, 204);
      return;
    }

    const url = new URL(req.url || '/', `http://${host}:${port}`);

    if (url.pathname === '/healthz') {
      sendJson(res, 200, { ok: true, mode: 'demo-preview', distDir });
      return;
    }

    if (url.pathname.startsWith('/api/')) {
      await handleLocalApi(req, res, url);
      return;
    }

    const filePath = await resolveRequestPath(url.pathname);
    const body = method === 'HEAD' ? null : await readFile(filePath);
    const transformed = method === 'HEAD' ? null : transformResponse(filePath, body);
    sendBuffer(res, 200, transformed, contentTypeFor(filePath));
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
      sendText(res, 404, 'Not found');
      return;
    }
    console.error(error);
    sendText(res, 500, 'Demo preview server error');
  }
});

server.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use on ${host}. Set DEMO_PREVIEW_PORT to choose another local port.`);
    process.exit(1);
  }

  console.error(error);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`Trovan demo preview serving frontend/dist at http://${host}:${port}`);
  console.log(`Preview identity: ${forcedPreviewRole || 'automatic by route'}`);
  console.log(`SPA deep links are available, for example http://${host}:${port}/routing`);
});

async function resolveRequestPath(pathname) {
  const decodedPath = safeDecodePath(pathname);
  const normalizedPath = normalize(decodedPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const requestedPath = resolve(distDir, `.${sep}${normalizedPath}`);

  if (!isInsideDist(requestedPath)) {
    return indexPath;
  }

  const requestedStat = await stat(requestedPath).catch(() => null);
  if (requestedStat?.isFile()) {
    return requestedPath;
  }

  const indexCandidate = join(requestedPath, 'index.html');
  const indexStat = await stat(indexCandidate).catch(() => null);
  if (indexStat?.isFile() && isInsideDist(indexCandidate)) {
    return indexCandidate;
  }

  return indexPath;
}

function transformResponse(filePath, body) {
  const ext = extname(filePath);
  if (ext !== '.html' && ext !== '.js') {
    return body;
  }

  let text = body.toString('utf8');

  if (ext === '.html' && !text.includes('trovan-demo-preview-bootstrap')) {
    text = /<head[^>]*>/i.test(text)
      ? text.replace(/<head([^>]*)>/i, `<head$1>\n${previewBootstrap}`)
      : text.includes('</head>')
        ? text.replace('</head>', `${previewBootstrap}\n  </head>`)
      : `${previewBootstrap}\n${text}`;
  }

  if (ext === '.js') {
    text = text
      .replace(
        /"http:\/\/localhost:3000"\.replace\(\/\\\/\+\$\/,""\)\.replace\(\/\\\/api\$\/,""\)/g,
        '(typeof window<"u"?window.location.origin:"http://127.0.0.1:5186").replace(/\\/+$/,"").replace(/\\/api$/,"")',
      )
      .replace(
        'R=`https://routing-dispatch-backend.onrender.com`.replace(/\\/+$/,``).replace(/\\/api$/,``)',
        'R=(typeof window<`u`?window.location.origin:`http://127.0.0.1:5186`).replace(/\\/+$/,``).replace(/\\/api$/,``)',
      )
      .replace(
        'Be=()=>typeof window<`u`&&!1',
        'Be=()=>typeof window<`u`&&[`localhost`,`127.0.0.1`,`[::1]`,`::1`].includes(window.location.hostname)',
      )
      .replace(
        /=>typeof window<"u"&&!1/g,
        '=>typeof window<"u"&&[`localhost`,`127.0.0.1`,`[::1]`,`::1`].includes(window.location.hostname)',
      );
  }

  return Buffer.from(text);
}

async function handleLocalApi(req, res, url) {
  if (url.pathname === '/api/auth/config' && req.method === 'GET') {
    sendJson(res, 200, {
      auth: {
        enabled: false,
        configured: false,
        localLoginAllowed: true,
        preferredProvider: 'local-config',
        workos: {
          apiKeyConfigured: false,
          authkitDomain: null,
          clientIdConfigured: false,
          connectionIdConfigured: false,
          mfaManagedByProvider: false,
          redirectUri: null,
          ssoReady: false,
        },
      },
    });
    return;
  }

  if (url.pathname === '/api/auth/login' && req.method === 'POST') {
    sendJson(res, 200, {
      accessToken: 'preview-auth-bypass',
      expiresIn: 'preview-session',
      sessionId: 'preview-session',
      user: previewUser(),
    });
    return;
  }

  if (url.pathname === '/api/auth/me' && req.method === 'GET') {
    sendJson(res, 200, { user: previewUser() });
    return;
  }

  if (url.pathname === '/api/jobs' && req.method === 'GET') {
    sendJson(res, 200, { jobs: demoJobs });
    return;
  }

  if (url.pathname === '/api/vehicles' && req.method === 'GET') {
    sendJson(res, 200, { vehicles: demoVehicles });
    return;
  }

  if (url.pathname === '/api/drivers' && req.method === 'GET') {
    sendJson(res, 200, { drivers: demoDrivers });
    return;
  }

  if (url.pathname === '/api/planner' && req.method === 'GET') {
    sendJson(res, 200, buildDemoPlannerView(url.searchParams.get('serviceDate')));
    return;
  }

  if (url.pathname === '/api/route-plans/generate-draft' && req.method === 'POST') {
    sendJson(res, 200, buildDemoPlannerMutation(url.searchParams.get('serviceDate')));
    return;
  }

  if (/^\/api\/route-plans\/[^/]+$/.test(url.pathname) && req.method === 'GET') {
    sendJson(res, 200, buildDemoPlannerMutation(url.searchParams.get('serviceDate')));
    return;
  }

  if (/^\/api\/route-plans\/[^/]+\/(reoptimize|publish)$/.test(url.pathname) && req.method === 'POST') {
    sendJson(res, 200, buildDemoPlannerMutation(url.searchParams.get('serviceDate')));
    return;
  }

  if (/^\/api\/route-plans\/[^/]+\/(groups|stops)\/[^/]+$/.test(url.pathname) && ['PATCH', 'POST'].includes(req.method)) {
    sendJson(res, 200, buildDemoPlannerMutation(url.searchParams.get('serviceDate')));
    return;
  }

  if (url.pathname === '/api/dispatch/routes' && req.method === 'GET') {
    sendJson(res, 200, { routes: demoRoutes });
    return;
  }

  if (url.pathname === '/api/dispatch/board' && req.method === 'GET') {
    sendJson(res, 200, {
      routeRuns: buildDemoRouteRuns(),
      routeRunStops: buildDemoRouteRunStops(),
      exceptions: demoExceptions,
    });
    return;
  }

  if (url.pathname === '/api/route-runs' && req.method === 'GET') {
    sendJson(res, 200, { routeRuns: buildDemoRouteRuns() });
    return;
  }

  if (url.pathname === '/api/exceptions' && req.method === 'GET') {
    sendJson(res, 200, { exceptions: demoExceptions });
    return;
  }

  if (url.pathname === '/api/exceptions' && req.method === 'POST') {
    const created = {
      id: `exception-${Date.now()}`,
      routeId: demoRoutes[0]?.id || null,
      routeRunStopId: null,
      code: 'DELAY',
      message: 'Local demo exception',
      status: 'OPEN',
      details: { source: 'demo-preview-server' },
      createdAt: new Date().toISOString(),
    };
    demoExceptions.unshift(created);
    sendJson(res, 200, { exception: created });
    return;
  }

  if (/^\/api\/dispatch\/routes\/[^/]+\/(reorder|move-stop)$/.test(url.pathname) && ['PATCH', 'POST'].includes(req.method)) {
    sendJson(res, 200, { sourceRoute: demoRoutes[0], targetRoute: demoRoutes[1] || demoRoutes[0], optimizerHealth: { status: 'healthy' } });
    return;
  }

  if (/^\/api\/route-runs\/[^/]+\/(dispatch|start|complete|reassign|share-link)$/.test(url.pathname) && ['POST', 'PATCH'].includes(req.method)) {
    sendJson(res, 200, { routeRun: buildDemoRouteRuns()[0] });
    return;
  }

  sendJson(res, 404, {
    message:
      'Local demo preview server does not proxy production APIs. The built app should use local preview data on localhost.',
  });
}

function previewUser() {
  return {
    id: 'preview-driver-user',
    email: 'anna.quinn@trovan.local',
    role: 'driver',
    roles: ['DRIVER'],
    authProvider: 'local-config',
    organizationId: 'preview-org',
    sessionId: 'preview-session',
  };
}

function buildDemoPlannerView(serviceDate) {
  const groups = demoRoutes.map((route, index) => ({
    id: route.id,
    routePlanId: 'preview-plan-1',
    groupIndex: index + 1,
    label: `RT-${index + 1}`,
    driverId: route.driverId || undefined,
    vehicleId: route.vehicleId || undefined,
    totalDistanceKm: route.totalDistanceKm,
    totalDurationMinutes: route.totalDurationMinutes,
    serviceTimeMinutes: route.jobIds.length * 8,
    totalWeightKg: route.jobIds.length * 120,
    totalVolumeM3: Number((route.jobIds.length * 0.9).toFixed(1)),
    warnings: route.planningWarnings || [],
  }));
  const stops = demoRoutes.flatMap((route) =>
    route.jobIds.map((jobId, index) => {
      const job = demoJobs.find((item) => item.id === jobId);
      return {
        id: `${route.id}::${jobId}`,
        routePlanId: 'preview-plan-1',
        routePlanGroupId: route.id,
        jobId,
        jobStopId: `${jobId}-stop`,
        stopSequence: index + 1,
        isLocked: false,
        plannedArrival: null,
        plannedDeparture: null,
        metadata: {
          stopType: 'DELIVERY',
          address: job?.deliveryAddress || job?.pickupAddress || 'Address pending',
        },
      };
    }),
  );
  return {
    plan: {
      id: 'preview-plan-1',
      serviceDate: serviceDate || new Date().toISOString().slice(0, 10),
      status: 'draft',
      objective: 'balanced',
      metrics: {
        routeCount: groups.length,
        stopCount: stops.length,
        unassignedJobCount: demoJobs.filter((job) => !job.assignedRouteId).length,
      },
      warnings: ['Local demo preview data served without a backend.'],
    },
    groups,
    stops,
    unassignedJobs: demoJobs.filter((job) => !job.assignedRouteId),
  };
}

function buildDemoPlannerMutation(serviceDate) {
  const view = buildDemoPlannerView(serviceDate);
  return {
    routePlan: view.plan,
    plan: view.plan,
    groups: view.groups,
    stops: view.stops,
    unassignedJobs: view.unassignedJobs,
    warnings: view.plan.warnings,
  };
}

function buildDemoRouteRuns() {
  return demoRoutes.map((route) => ({
    id: route.id,
    organizationId: 'preview-org',
    vehicleId: route.vehicleId || null,
    driverId: route.driverId || null,
    status: route.status === 'planned' ? 'assigned' : route.status,
    workflowStatus: route.workflowStatus || route.status,
    totalDistanceKm: route.totalDistanceKm,
    totalDurationMinutes: route.totalDurationMinutes,
    plannedStart: route.createdAt || null,
    actualStart: route.dispatchedAt || null,
    jobCount: route.jobIds.length,
    routeData: route.routeData,
    createdAt: route.createdAt,
    updatedAt: route.createdAt,
  }));
}

function buildDemoRouteRunStops() {
  return demoRoutes.flatMap((route) =>
    route.jobIds.map((jobId, index) => ({
      id: `${route.id}-stop-${index + 1}`,
      organizationId: 'preview-org',
      routeId: route.id,
      jobId,
      jobStopId: `${jobId}-stop`,
      stopSequence: index + 1,
      status: route.status === 'in_progress' && index === 0 ? 'ARRIVED' : 'PENDING',
      plannedArrival: route.createdAt || null,
      actualArrival: route.status === 'in_progress' && index === 0 ? route.dispatchedAt || null : null,
      actualDeparture: null,
      proofRequired: index === route.jobIds.length - 1,
      notes: null,
    })),
  );
}

function contentTypeFor(filePath) {
  return mimeTypes.get(extname(filePath)) || 'application/octet-stream';
}

function commonHeaders(contentType) {
  return {
    'Cache-Control': 'no-store',
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
  };
}

function sendBuffer(res, statusCode, body, contentType) {
  res.writeHead(statusCode, commonHeaders(contentType));
  res.end(body);
}

function sendText(res, statusCode, message) {
  sendBuffer(res, statusCode, Buffer.from(`${message}\n`), 'text/plain; charset=utf-8');
}

function sendJson(res, statusCode, payload) {
  sendBuffer(res, statusCode, Buffer.from(JSON.stringify(payload)), 'application/json; charset=utf-8');
}

function sendEmpty(res, statusCode) {
  res.writeHead(statusCode, commonHeaders('text/plain; charset=utf-8'));
  res.end();
}

function safeDecodePath(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return '/';
  }
}

function isInsideDist(filePath) {
  const rel = relative(distDir, filePath);
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith(sep));
}

function isLoopbackHost(value) {
  return ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(value);
}

function parsePort(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    console.error(`Invalid DEMO_PREVIEW_PORT/PORT value: ${value}`);
    process.exit(1);
  }
  return parsed;
}
