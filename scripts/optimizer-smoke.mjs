const baseUrl = (process.env.ROUTING_SERVICE_URL || 'http://127.0.0.1:8000')
  .replace(/\/+$/, '');
const routingToken =
  process.env.STAGING_ROUTING_SERVICE_INTERNAL_TOKEN ||
  process.env.ROUTING_SERVICE_INTERNAL_TOKEN ||
  '';

function routingHeaders(extra = {}) {
  return {
    ...extra,
    ...(routingToken ? { 'x-routing-service-token': routingToken } : {}),
  };
}

async function fetchJson(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.text();
  let payload;
  try {
    payload = body ? JSON.parse(body) : null;
  } catch {
    payload = body;
  }
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}: ${body}`);
  }
  return payload;
}

const request = {
  plan_date: new Date().toISOString(),
  objective: 'balanced',
  vehicles: [
    {
      id: 'vehicle-a',
      start_lat: 39.0997,
      start_lng: -94.5786,
      capacity_weight: 5000,
      capacity_volume: 25,
      max_route_minutes: 480,
    },
  ],
  stops: [
    {
      id: 'stop-a',
      lat: 39.1068,
      lng: -94.5704,
      service_minutes: 10,
      priority: 2,
      weight: 100,
      volume: 1,
    },
    {
      id: 'stop-b',
      lat: 39.0839,
      lng: -94.5854,
      service_minutes: 10,
      priority: 3,
      weight: 100,
      volume: 1,
    },
  ],
};

const health = await fetchJson('/health');
if (health.status !== 'healthy') {
  throw new Error(`routing-service health is not healthy: ${JSON.stringify(health)}`);
}

if (routingToken) {
  const anonymous = await fetch(`${baseUrl}/optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...request, stops: [] }),
  });
  if (![401, 403].includes(anonymous.status)) {
    const body = await anonymous.text();
    throw new Error(
      `/optimize should reject anonymous hosted requests when ROUTING_SERVICE_INTERNAL_TOKEN is configured; received HTTP ${anonymous.status}: ${body}`,
    );
  }
}

const result = await fetchJson('/optimize', {
  method: 'POST',
  headers: routingHeaders({ 'Content-Type': 'application/json' }),
  body: JSON.stringify(request),
});

const route = result.routes?.[0];
if (!route || route.vehicle_id !== 'vehicle-a') {
  throw new Error(`optimizer returned no route for vehicle-a: ${JSON.stringify(result)}`);
}
if ((route.ordered_stops || []).length !== request.stops.length) {
  throw new Error(`optimizer dropped stops unexpectedly: ${JSON.stringify(result)}`);
}
if (result.objective_used !== 'balanced') {
  throw new Error(`optimizer objective mismatch: ${JSON.stringify(result)}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      baseUrl,
      status: health.status,
      authenticated: Boolean(routingToken),
      objectiveUsed: result.objective_used,
      orderedStops: route.ordered_stops.map((stop) => stop.stop_id),
      totalDistanceM: route.total_distance_m,
      totalDurationS: route.total_duration_s,
      warnings: result.warnings || [],
    },
    null,
    2,
  ),
);
