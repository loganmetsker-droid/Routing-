#!/usr/bin/env bash
set -euo pipefail

APP_HOME="${TROVAN_HOME:-$HOME/.trovan-routing}"
RUNTIME_DIR="$APP_HOME/runtime"
BACKEND_URL="${BACKEND_URL:-$(cat "$RUNTIME_DIR/backend.url" 2>/dev/null || echo "http://127.0.0.1:3001")}"
FRONTEND_URL="${FRONTEND_URL:-$(cat "$RUNTIME_DIR/frontend.url" 2>/dev/null || echo "http://127.0.0.1:5184")}"
SMOKE_AUTH_TOKEN="${SMOKE_AUTH_TOKEN:-}"
export PATH="$HOME/.local/node-v20.20.1-linux-x64/bin:$PATH"
mkdir -p "$RUNTIME_DIR"

node - <<'NODE'
const base = process.env.BACKEND_URL || 'http://127.0.0.1:3001';
const frontendBase = process.env.FRONTEND_URL || 'http://127.0.0.1:5184';
const fs = require('fs');
const path = require('path');
let token = process.env.SMOKE_AUTH_TOKEN || '';
const runtimeDir = process.env.RUNTIME_DIR || path.join(process.env.HOME || '.', '.trovan-routing', 'runtime');

const headers = () => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const unwrap = (payload) => payload?.data ?? payload;
const unwrapCollection = (payload, key) => {
  const data = unwrap(payload);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data?.items)) return data.items;
  return data;
};

const assertOk = async (resp, label) => {
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`${label} failed: ${resp.status} ${resp.statusText} ${body}`);
  }
  return resp.json().catch(() => ({}));
};

const rand = Math.random().toString(36).slice(2, 8);

const run = async () => {
  const health = await fetch(`${base}/api/health/ping`);
  if (!health.ok) throw new Error(`API health ping failed with ${health.status}`);
  const fullHealth = await fetch(`${base}/health`);
  if (!fullHealth.ok) throw new Error(`Health failed with ${fullHealth.status}`);
  const runtimeHealth = await fetch(`${base}/api/health/runtime`);
  if (!runtimeHealth.ok) throw new Error(`Runtime health failed with ${runtimeHealth.status}`);

  if (!token) {
    const loginResp = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        email: process.env.SMOKE_AUTH_EMAIL || 'admin@routing.local',
        password: process.env.SMOKE_AUTH_PASSWORD || 'LocalAdmin123!',
      }),
    });
  const loginData = unwrap(await assertOk(loginResp, 'Login'));
    token = loginData.accessToken || '';
    if (!token) throw new Error('Login did not return an access token');
  }

  const customerPayload = {
    name: `Smoke Customer ${rand}`,
    email: `smoke-${rand}@example.com`,
    phone: '555-0100',
    defaultAddress: '123 Stability Ave, Austin, TX 78701',
    defaultAddressStructured: {
      line1: '123 Stability Ave',
      line2: null,
      city: 'Austin',
      state: 'TX',
      zip: '78701',
    },
  };

  const customerResp = await fetch(`${base}/api/customers`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(customerPayload),
  });
  const customerResult = unwrap(await assertOk(customerResp, 'Create customer'));
  const customer = customerResult.customer || customerResult;

  const jobPayload = {
    customerName: customer.name || customerPayload.name,
    deliveryAddress: customer.defaultAddress || customerPayload.defaultAddress,
    priority: 'normal',
    status: 'pending',
  };
  const jobResp = await fetch(`${base}/api/jobs`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(jobPayload),
  });
  const jobResult = unwrap(await assertOk(jobResp, 'Create job'));
  const createdJob = jobResult.job || jobResult;

  const vehiclesResp = await fetch(`${base}/api/vehicles`, { headers: headers() });
  const vehicles = unwrapCollection(await assertOk(vehiclesResp, 'Fetch vehicles'), 'vehicles');
  if (!Array.isArray(vehicles) || vehicles.length === 0) throw new Error('Smoke test requires at least one vehicle');

  const customersListResp = await fetch(`${base}/api/customers`, { headers: headers() });
  await assertOk(customersListResp, 'Fetch customers list');

  const routeResp = await fetch(`${base}/api/dispatch/routes`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      vehicleId: vehicles[0].id,
      jobIds: [createdJob.id],
    }),
  });
  const routeData = unwrap(await assertOk(routeResp, 'Create route'));
  const route = routeData.route || routeData;

  const jobsListResp = await fetch(`${base}/api/jobs`, { headers: headers() });
  await assertOk(jobsListResp, 'Fetch jobs list');

  const driversResp = await fetch(`${base}/api/drivers`, { headers: headers() });
  const drivers = unwrapCollection(await assertOk(driversResp, 'Fetch drivers'), 'drivers');
  if (!Array.isArray(drivers) || drivers.length === 0) throw new Error('Smoke test requires at least one driver');

  await assertOk(
    await fetch(`${base}/api/dispatch/routes/${route.id}/assign`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ driverId: drivers[0].id }),
    }),
    'Assign driver',
  );

  const rerouteReq = unwrap(await assertOk(
    await fetch(`${base}/api/dispatch/routes/${route.id}/reroute/request`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        exceptionCategory: 'traffic_delay',
        action: 'reorder_stops',
        reason: 'smoke test exception path',
        requesterId: 'smoke-test',
        requestPayload: {
          newJobOrder: Array.isArray(route.jobIds) ? route.jobIds : [createdJob.id],
        },
      }),
    }),
    'Create exception/reroute request',
  ));

  const requestId = rerouteReq.request?.id || rerouteReq.id;
  if (requestId) {
    await assertOk(
      await fetch(`${base}/api/dispatch/routes/${route.id}/reroute/${requestId}/approve`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ reviewerId: 'smoke-test' }),
      }),
      'Approve exception/reroute',
    );
  }

  const timeline = unwrap(await assertOk(
    await fetch(`${base}/api/dispatch/timeline?routeId=${encodeURIComponent(route.id)}&limit=10`, { headers: headers() }),
    'Fetch audit/timeline events',
  ));

  const events = timeline.events || [];
  if (!Array.isArray(events)) throw new Error('Timeline response malformed');

  const optimizerJobsResp = await fetch(`${base}/api/dispatch/optimizer/jobs`, { headers: headers() });
  const optimizerJobs = unwrap(await assertOk(optimizerJobsResp, 'Fetch optimization job lifecycle'));
  if (!Array.isArray(optimizerJobs.jobs || optimizerJobs.items || optimizerJobs)) {
    throw new Error('Optimization lifecycle response malformed');
  }

  const frontendChecks = await Promise.all([
    fetch(frontendBase),
    fetch(`${frontendBase}/dispatch`),
    fetch(`${frontendBase}/tracking`),
  ]);
  frontendChecks.forEach((resp, idx) => {
    if (!resp.ok) {
      const labels = ['frontend root', 'dispatch route', 'tracking route'];
      throw new Error(`${labels[idx]} failed with ${resp.status}`);
    }
  });

  const result = {
    passed: true,
    timestamp: new Date().toISOString(),
    customerId: customer.id,
    jobId: createdJob.id,
    routeId: route.id,
    timelineEvents: events.length,
    optimizationJobs: Array.isArray(optimizerJobs.jobs)
      ? optimizerJobs.jobs.length
      : Array.isArray(optimizerJobs.items)
        ? optimizerJobs.items.length
        : optimizerJobs.length,
  };
  fs.writeFileSync(path.join(runtimeDir, 'smoke-test-result.json'), JSON.stringify(result, null, 2));
  console.log('Smoke test passed:', result);
};

run().catch((err) => {
  fs.writeFileSync(
    path.join(runtimeDir, 'smoke-test-result.json'),
    JSON.stringify(
      {
        passed: false,
        timestamp: new Date().toISOString(),
        error: String(err?.message || err),
      },
      null,
      2,
    ),
  );
  console.error(String(err?.message || err));
  process.exit(1);
});
NODE
