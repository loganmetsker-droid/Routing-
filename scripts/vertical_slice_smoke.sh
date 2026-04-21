#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_HOME="${TROVAN_HOME:-$HOME/.trovan-routing}"
RUNTIME_DIR="$APP_HOME/runtime"
BACKEND_URL="${BACKEND_URL:-$(cat "$RUNTIME_DIR/backend.url" 2>/dev/null || echo "http://127.0.0.1:3001")}"
FRONTEND_URL="${FRONTEND_URL:-$(cat "$RUNTIME_DIR/frontend.url" 2>/dev/null || echo "http://127.0.0.1:5184")}"
export PATH="$HOME/.local/node-v20.20.1-linux-x64/bin:$PATH"

node - <<'NODE'
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const rootDir = process.env.ROOT_DIR || '/home/logan/Desktop/Routing/Routing-';
const backendEnvPath = path.join(rootDir, 'backend', '.env.local');
const backendEnv = fs.existsSync(backendEnvPath) ? dotenv.parse(fs.readFileSync(backendEnvPath)) : {};
const base = process.env.BACKEND_URL || 'http://127.0.0.1:3001';
const frontendBase = process.env.FRONTEND_URL || 'http://127.0.0.1:5184';
const email = process.env.SMOKE_AUTH_EMAIL || backendEnv.AUTH_ADMIN_EMAIL || 'admin@routing.local';
const password = process.env.SMOKE_AUTH_PASSWORD || backendEnv.AUTH_ADMIN_PASSWORD || 'LocalAdmin123!';
const rand = Math.random().toString(36).slice(2, 8);
let token = '';

const headers = () => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

async function expectOk(resp, label) {
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`${label} failed: ${resp.status} ${resp.statusText} ${text}`);
  }
  return resp.json().catch(() => ({}));
}

function unwrap(payload) {
  return payload?.data ?? payload;
}

function unwrapCollection(payload, key) {
  const data = unwrap(payload);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

async function run() {
  const loginPayload = unwrap(await expectOk(await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password }),
  }), 'login'));
  token = loginPayload.accessToken;
  if (!token) throw new Error('Missing access token from login');

  const mePayload = unwrap(await expectOk(await fetch(`${base}/api/auth/me`, { headers: headers() }), 'auth/me'));
  if (!mePayload.user?.organizationId) throw new Error('Authenticated user missing organizationId');

  const vehicles = unwrapCollection(await expectOk(await fetch(`${base}/api/vehicles`, { headers: headers() }), 'vehicles'), 'vehicles');
  const drivers = unwrapCollection(await expectOk(await fetch(`${base}/api/drivers`, { headers: headers() }), 'drivers'), 'drivers');
  if (!vehicles.length) throw new Error('Need at least one vehicle for vertical slice smoke');
  if (!drivers.length) throw new Error('Need at least one driver for vertical slice smoke');

  const serviceDate = new Date().toISOString().slice(0, 10);
  const createdJobs = [];
  for (const [index, priority] of ['urgent', 'high'].entries()) {
    const startHour = String(9 + index).padStart(2, '0');
    const endHour = String(11 + index).padStart(2, '0');
    const jobPayload = {
      customerName: `Vertical Slice ${rand}-${index + 1}`,
      customerPhone: '555-0300',
      deliveryAddress: `${200 + index} Slice Ave, Kansas City, MO`,
      pickupAddress: '100 Dispatch Way, Kansas City, MO',
      priority,
      status: 'pending',
      timeWindowStart: `${serviceDate}T${startHour}:00:00.000Z`,
      timeWindowEnd: `${serviceDate}T${endHour}:00:00.000Z`,
    };
    const created = unwrap(await expectOk(await fetch(`${base}/api/jobs`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(jobPayload),
    }), `create job ${index + 1}`));
    createdJobs.push(created.job || created);
  }

  const jobsList = unwrapCollection(await expectOk(await fetch(`${base}/api/jobs`, { headers: headers() }), 'jobs list'), 'jobs');
  const createdIds = new Set(createdJobs.map((job) => job.id));
  const visibleIds = new Set(jobsList.map((job) => job.id));
  for (const id of createdIds) {
    if (!visibleIds.has(id)) throw new Error(`Created job ${id} missing from org-scoped jobs list`);
  }

  const plannerDraft = unwrap(await expectOk(await fetch(`${base}/api/route-plans/generate-draft`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      serviceDate,
      objective: 'distance',
      jobIds: createdJobs.map((job) => job.id),
      vehicleIds: [vehicles[0].id],
    }),
  }), 'generate draft route plan'));

  const routePlan = plannerDraft.routePlan || plannerDraft.plan;
  if (!routePlan?.id) throw new Error('Draft route plan missing id');

  const routePlanDetail = unwrap(await expectOk(await fetch(`${base}/api/route-plans/${routePlan.id}`, { headers: headers() }), 'route plan detail'));
  if (!Array.isArray(routePlanDetail.stops) || routePlanDetail.stops.length === 0) {
    throw new Error('Route plan detail missing stops');
  }

  const published = unwrap(await expectOk(await fetch(`${base}/api/route-plans/${routePlan.id}/publish`, {
    method: 'POST',
    headers: headers(),
  }), 'publish route plan'));
  const publishedRouteRuns = Array.isArray(published.routeRuns)
    ? published.routeRuns
    : Array.isArray(published.items)
      ? published.items
      : [];
  const routeRun = publishedRouteRuns[0];
  if (!routeRun?.id) throw new Error('Publish did not create a route run');

  await expectOk(await fetch(`${base}/api/route-runs/${routeRun.id}/dispatch`, {
    method: 'POST',
    headers: headers(),
  }), 'dispatch route run');

  await expectOk(await fetch(`${base}/api/route-runs/${routeRun.id}/start`, {
    method: 'POST',
    headers: headers(),
  }), 'start route run');

  const routeRunDetail = unwrap(await expectOk(await fetch(`${base}/api/route-runs/${routeRun.id}`, { headers: headers() }), 'route run detail after start'));
  const routeRunStops = Array.isArray(routeRunDetail.stops)
    ? routeRunDetail.stops
    : Array.isArray(routeRunDetail.items)
      ? routeRunDetail.items
      : [];
  const firstStop = routeRunStops[0];
  if (!firstStop?.id) throw new Error('Route run detail missing stops');

  await expectOk(await fetch(`${base}/api/route-run-stops/${firstStop.id}/mark-arrived`, {
    method: 'POST',
    headers: headers(),
  }), 'mark arrived');

  await expectOk(await fetch(`${base}/api/route-run-stops/${firstStop.id}/note`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ note: `Arrived on site for ${rand}` }),
  }), 'add stop note');

  await expectOk(await fetch(`${base}/api/route-run-stops/${firstStop.id}/proof`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ type: 'PHOTO', uri: `https://example.test/proofs/${rand}.jpg` }),
  }), 'add stop proof');

  await expectOk(await fetch(`${base}/api/route-run-stops/${firstStop.id}/serviced`, {
    method: 'POST',
    headers: headers(),
  }), 'mark serviced');

  await expectOk(await fetch(`${base}/api/route-runs/${routeRun.id}/complete`, {
    method: 'POST',
    headers: headers(),
  }), 'complete route run');

  const finalDetail = unwrap(await expectOk(await fetch(`${base}/api/route-runs/${routeRun.id}`, { headers: headers() }), 'final route run detail'));
  const finalStops = Array.isArray(finalDetail.stops)
    ? finalDetail.stops
    : Array.isArray(finalDetail.items)
      ? finalDetail.items
      : [];
  if (String(finalDetail.routeRun?.status || '').toLowerCase() !== 'completed') {
    throw new Error(`Expected completed route run, got ${finalDetail.routeRun?.status}`);
  }
  if (!Array.isArray(finalDetail.stopEvents) || finalDetail.stopEvents.length < 3) {
    throw new Error('Expected stop events in route run detail history');
  }
  if (!Array.isArray(finalDetail.proofArtifacts) || finalDetail.proofArtifacts.length < 1) {
    throw new Error('Expected proof artifacts in route run detail');
  }
  if (finalStops.length < 1) {
    throw new Error('Expected completed route run to retain stops');
  }

  const stopTimeline = unwrap(await expectOk(await fetch(`${base}/api/route-run-stops/${firstStop.id}/timeline`, { headers: headers() }), 'stop timeline'));
  const stopProofs = unwrap(await expectOk(await fetch(`${base}/api/route-run-stops/${firstStop.id}/proofs`, { headers: headers() }), 'stop proofs'));
  const audit = unwrap(await expectOk(await fetch(`${base}/api/audit?limit=50`, { headers: headers() }), 'audit list'));
  const board = unwrap(await expectOk(await fetch(`${base}/api/dispatch/board`, { headers: headers() }), 'dispatch board'));

  const auditEntries = Array.isArray(audit.entries)
    ? audit.entries
    : Array.isArray(audit.items)
      ? audit.items
      : [];
  const auditActions = new Set(auditEntries.map((entry) => entry.action));
  for (const action of ['route-plan.published', 'route-run.started', 'route-run.completed', 'route-run-stop.serviced']) {
    if (!auditActions.has(action)) {
      throw new Error(`Missing audit action ${action}`);
    }
  }

  for (const frontendPath of ['/routing', '/dispatch', `/route-runs/${routeRun.id}`]) {
    const response = await fetch(`${frontendBase}${frontendPath}`);
    if (!response.ok) {
      throw new Error(`Frontend route ${frontendPath} failed with ${response.status}`);
    }
  }

  const timelineEvents = Array.isArray(stopTimeline.events)
    ? stopTimeline.events
    : Array.isArray(stopTimeline.items)
      ? stopTimeline.items
      : [];
  const proofItems = Array.isArray(stopProofs.proofs)
    ? stopProofs.proofs
    : Array.isArray(stopProofs.items)
      ? stopProofs.items
      : [];
  const boardRoutes = Array.isArray(board.routes)
    ? board.routes
    : Array.isArray(board.items)
      ? board.items
      : [];

  console.log(JSON.stringify({
    ok: true,
    serviceDate,
    organizationId: mePayload.user.organizationId,
    createdJobIds: createdJobs.map((job) => job.id),
    routePlanId: routePlan.id,
    routeRunId: routeRun.id,
    timelineEvents: timelineEvents.length,
    proofs: proofItems.length,
    dispatchBoardRoutes: boardRoutes.length,
    auditActions: Array.from(auditActions).filter((action) => action.startsWith('route-')).sort(),
  }, null, 2));
}

run().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
NODE
