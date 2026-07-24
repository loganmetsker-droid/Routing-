import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const artifactDir =
  process.env.STAGING_SMOKE_DIR ||
  path.join(process.cwd(), '.tmp', 'launch-audit', 'staging-smoke');
const partialMode = process.env.STAGING_SMOKE_ALLOW_PARTIAL === 'true';
const requireProviderChecks =
  process.env.STAGING_REQUIRE_PROVIDER_CHECKS !== 'false';

const checks = [];

function normalizeUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function env(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function redact(value) {
  if (!value) return value;
  const text = String(value);
  if (text.length <= 8) return '[redacted]';
  return `${text.slice(0, 4)}...[redacted]...${text.slice(-4)}`;
}

function sanitize(value) {
  if (Array.isArray(value)) {
    return value.slice(0, 20).map(sanitize);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (/(secret|token|password|authorization|api[-_]?key|signature)/i.test(key)) {
        return [key, redact(item)];
      }
      return [key, sanitize(item)];
    }),
  );
}

function record(name, status, detail = {}) {
  checks.push({
    name,
    status,
    ...detail,
  });
}

function fail(name, error, detail = {}) {
  record(name, 'fail', {
    ...detail,
    error: error instanceof Error ? error.message : String(error),
  });
}

function requireEnv(name) {
  const value = env(name);
  if (!value) {
    record(`env:${name}`, partialMode ? 'skip' : 'fail', {
      reason: 'missing required staging smoke environment variable',
    });
  } else {
    record(`env:${name}`, 'pass', { value: redact(value) });
  }
  return value;
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchText(url, init = {}) {
  const response = await fetch(url, init);
  const body = await response.text();
  return { response, body };
}

async function fetchJson(url, init = {}) {
  const { response, body } = await fetchText(url, init);
  let json = null;
  try {
    json = body ? JSON.parse(body) : null;
  } catch {
    json = null;
  }
  return { response, body, json };
}

async function expectStatus(name, url, expected, init = {}) {
  try {
    const { response, body, json } = await fetchJson(url, init);
    const expectedStatuses = Array.isArray(expected) ? expected : [expected];
    if (!expectedStatuses.includes(response.status)) {
      throw new Error(
        `expected HTTP ${expectedStatuses.join('/')} but received ${response.status}: ${body.slice(0, 300)}`,
      );
    }
    record(name, 'pass', {
      url,
      status: response.status,
      body: json ? sanitize(json) : undefined,
    });
    return { response, body, json };
  } catch (error) {
    fail(name, error, { url });
    return null;
  }
}

async function probeFrontend(frontendUrl) {
  const result = await expectStatus('frontend:reachable', frontendUrl, 200);
  if (!result) return;
  const previewMarkers = [
    'preview-auth-bypass',
    'VITE_AUTH_BYPASS=true',
    'VITE_MOCK_PREVIEW=true',
    '__TROVAN_LOCAL_DEMO_PREVIEW__=true',
  ];
  const found = previewMarkers.filter((marker) => result.body.includes(marker));
  if (found.length) {
    record('frontend:no-preview-mode-markers', 'fail', {
      found,
      reason: 'staging frontend bundle/html exposes preview bypass markers',
    });
  } else {
    record('frontend:no-preview-mode-markers', 'pass');
  }

  const expectedReleaseSha = env('EXPECTED_RELEASE_SHA');
  if (!expectedReleaseSha) return;
  const releaseMeta = result.body.match(
    /<meta\s+name=["']trovan-release["']\s+content=["']([0-9a-f]{40})["']\s*\/?>/i,
  );
  const reportedReleaseSha = releaseMeta?.[1] || '';
  if (reportedReleaseSha !== expectedReleaseSha) {
    record('frontend:exact-release-sha', 'fail', {
      expectedReleaseSha,
      reportedReleaseSha: reportedReleaseSha || null,
    });
  } else {
    record('frontend:exact-release-sha', 'pass', { reportedReleaseSha });
  }
}

async function probeBackendHealth(backendUrl) {
  await expectStatus('backend:/health', `${backendUrl}/health`, 200);
  const runtime = await expectStatus(
    'backend:/health/runtime',
    `${backendUrl}/health/runtime`,
    200,
  );
  await expectStatus(
    'backend:/health/readiness',
    `${backendUrl}/health/readiness`,
    200,
  );

  const expectedReleaseSha = env('EXPECTED_RELEASE_SHA');
  if (!expectedReleaseSha || !runtime) return;
  const reportedReleaseSha = runtime.json?.runtime?.releaseSha || '';
  if (reportedReleaseSha !== expectedReleaseSha) {
    record('backend:exact-release-sha', 'fail', {
      expectedReleaseSha,
      reportedReleaseSha: reportedReleaseSha || null,
    });
  } else {
    record('backend:exact-release-sha', 'pass', { reportedReleaseSha });
  }
}

async function probeLeadIntake(backendUrl, authToken) {
  const workEmail = `staging-smoke-${Date.now()}@example.com`;
  const created = await expectStatus(
    'lead-intake:create-and-persist',
    `${backendUrl}/api/marketing-leads`,
    201,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Staging Smoke',
        workEmail,
        company: 'Trovan Staging Verification',
        fleetSize: '5–15',
        requestType: 'Book demo',
        notes: 'Automated staging lead-intake verification. Safe to close.',
        source: 'staging-smoke',
        pagePath: '/pricing',
      }),
    },
  );
  if (!created || !authToken) return;

  const leadId = created.json?.data?.id || created.json?.id;
  if (!leadId) {
    record('lead-intake:receipt-id', 'fail', {
      reason: 'lead creation response did not include a durable lead id',
    });
    return;
  }
  record('lead-intake:receipt-id', 'pass', { leadId });

  const listed = await expectStatus(
    'lead-intake:operator-queue',
    `${backendUrl}/api/marketing-leads?status=new`,
    200,
    { headers: authHeaders(authToken) },
  );
  const leads = listed?.json?.data?.leads || listed?.json?.leads || [];
  if (!Array.isArray(leads) || !leads.some((lead) => lead.id === leadId && lead.workEmail === workEmail)) {
    record('lead-intake:durable-readback', 'fail', {
      reason: 'created lead was not visible in the authenticated operator queue',
      leadId,
    });
    return;
  }
  record('lead-intake:durable-readback', 'pass', { leadId });

  await expectStatus(
    'lead-intake:close-smoke-record',
    `${backendUrl}/api/marketing-leads/${leadId}`,
    200,
    {
      method: 'PATCH',
      headers: {
        ...authHeaders(authToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'closed' }),
    },
  );
}

async function probeSecurityBasics(backendUrl, metricsToken) {
  await expectStatus(
    'security:protected-api-rejects-anonymous',
    `${backendUrl}/api/jobs`,
    [401, 403],
  );

  try {
    const { response } = await fetchText(`${backendUrl}/api/auth/config`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://evil.launch-probe.invalid',
        'Access-Control-Request-Method': 'GET',
      },
    });
    const allowedOrigin = response.headers.get('access-control-allow-origin');
    if (allowedOrigin === 'https://evil.launch-probe.invalid') {
      throw new Error('strict CORS echoed an untrusted origin');
    }
    record('security:cors-rejects-untrusted-origin', 'pass', {
      status: response.status,
      accessControlAllowOrigin: allowedOrigin,
    });
  } catch (error) {
    fail('security:cors-rejects-untrusted-origin', error);
  }

  if (metricsToken) {
    await expectStatus(
      'security:metrics-rejects-missing-token',
      `${backendUrl}/api/metrics`,
      [401, 403],
    );
    await expectStatus(
      'security:metrics-accepts-token',
      `${backendUrl}/api/metrics`,
      200,
      { headers: { 'x-metrics-token': metricsToken } },
    );
  }
}

async function probeAuthenticatedApi(backendUrl, authToken) {
  if (!authToken) {
    record('auth:jwt-probes', partialMode ? 'skip' : 'fail', {
      reason: 'STAGING_AUTH_TOKEN or LAUNCH_AUDIT_AUTH_TOKEN is required',
    });
    return null;
  }

  const me = await expectStatus('auth:me', `${backendUrl}/api/auth/me`, 200, {
    headers: authHeaders(authToken),
  });
  await expectStatus(
    'platform:overview',
    `${backendUrl}/api/platform/overview`,
    200,
    { headers: authHeaders(authToken) },
  );

  await probeWebhookSsrfRejection(backendUrl, authToken);
  await probeApiKeyLifecycle(backendUrl, authToken);
  await probeSocketNamespaces(backendUrl, authToken);
  return me;
}

async function probeWebhookSsrfRejection(backendUrl, authToken) {
  const result = await expectStatus(
    'webhooks:ssrf-private-ip-rejected',
    `${backendUrl}/api/platform/webhooks`,
    [400, 422],
    {
      method: 'POST',
      headers: {
        ...authHeaders(authToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Launch SSRF Probe ${Date.now()}`,
        url: 'http://127.0.0.1:9/trovan-webhook',
        subscribedEvents: ['jobs.created'],
      }),
    },
  );
  return result;
}

async function probeApiKeyLifecycle(backendUrl, authToken) {
  const create = await expectStatus(
    'api-keys:create',
    `${backendUrl}/api/platform/api-keys`,
    [200, 201],
    {
      method: 'POST',
      headers: {
        ...authHeaders(authToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Launch smoke ${Date.now()}`,
        scopes: ['jobs:read'],
      }),
    },
  );
  const apiKeyId = create?.json?.apiKey?.id || create?.json?.data?.apiKey?.id;
  const secret = create?.json?.secret || create?.json?.data?.secret;
  if (!apiKeyId || !secret) {
    record('api-keys:secret-returned-on-create', 'fail', {
      reason: 'API key create did not return id and one-time secret',
    });
    return;
  }

  await expectStatus('api-keys:public-api-accepts-created-key', `${backendUrl}/api/v1/jobs`, 200, {
    headers: { 'x-api-key': secret },
  });

  await expectStatus(
    'api-keys:revoke',
    `${backendUrl}/api/platform/api-keys/${apiKeyId}`,
    200,
    { method: 'DELETE', headers: authHeaders(authToken) },
  );

  await expectStatus(
    'api-keys:revoked-key-rejected',
    `${backendUrl}/api/v1/jobs`,
    [401, 403],
    { headers: { 'x-api-key': secret } },
  );
}

async function probeSocketNamespace(url, namespace, token, subscribeEvent) {
  let io;
  try {
    ({ io } = await import('socket.io-client'));
  } catch (error) {
    record(`socket:${namespace}:dependency`, partialMode ? 'skip' : 'fail', {
      reason: 'socket.io-client dependency could not be imported',
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  await new Promise((resolve) => {
    const socket = io(`${url}/${namespace}`, {
      auth: { token },
      transports: ['websocket'],
      timeout: 7000,
      reconnection: false,
    });
    const done = (status, detail = {}) => {
      socket.disconnect();
      record(`socket:${namespace}`, status, detail);
      resolve(undefined);
    };
    const timer = setTimeout(
      () => done('fail', { reason: 'socket connection timed out' }),
      9000,
    );
    socket.on('connect', () => {
      socket.timeout(5000).emit(subscribeEvent, (error, response) => {
        clearTimeout(timer);
        if (error) {
          done('fail', {
            reason: `subscribe ack failed: ${error.message || String(error)}`,
          });
          return;
        }
        done('pass', { response });
      });
    });
    socket.on('connect_error', (error) => {
      clearTimeout(timer);
      done('fail', { reason: error.message });
    });
    socket.on('error', (error) => {
      clearTimeout(timer);
      done('fail', {
        reason:
          typeof error === 'object' && error && 'message' in error
            ? String(error.message)
            : String(error),
      });
    });
  });
}

async function probeSocketNamespaces(backendUrl, authToken) {
  await probeSocketNamespace(backendUrl, 'dispatch', authToken, 'subscribe:routes');
  await probeSocketNamespace(backendUrl, 'tracking', authToken, 'subscribe:locations');
}

async function probeRoutingService(routingServiceUrl) {
  if (!routingServiceUrl) {
    record('routing-service:configured', partialMode ? 'skip' : 'fail', {
      reason: 'STAGING_ROUTING_SERVICE_URL or ROUTING_SERVICE_URL is required',
    });
    return;
  }

  const routingUrl = normalizeUrl(routingServiceUrl);
  const routingToken =
    env('STAGING_ROUTING_SERVICE_INTERNAL_TOKEN') ||
    env('ROUTING_SERVICE_INTERNAL_TOKEN');
  if (!routingToken) {
    record('routing-service:internal-token-configured', partialMode ? 'skip' : 'fail', {
      reason:
        'STAGING_ROUTING_SERVICE_INTERNAL_TOKEN or ROUTING_SERVICE_INTERNAL_TOKEN is required',
    });
  } else {
    record('routing-service:internal-token-configured', 'pass', {
      value: redact(routingToken),
    });
  }

  const health = await expectStatus(
    'routing-service:/health',
    `${routingUrl}/health`,
    200,
  );
  const expectedReleaseSha = env('EXPECTED_RELEASE_SHA');
  if (expectedReleaseSha && health) {
    const reportedReleaseSha = health.json?.release_sha || '';
    if (reportedReleaseSha !== expectedReleaseSha) {
      record('routing-service:exact-release-sha', 'fail', {
        expectedReleaseSha,
        reportedReleaseSha: reportedReleaseSha || null,
      });
    } else {
      record('routing-service:exact-release-sha', 'pass', {
        reportedReleaseSha,
      });
    }
  }
  await expectStatus(
    'routing-service:/optimize-rejects-anonymous',
    `${routingUrl}/optimize`,
    [401, 403],
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_date: new Date().toISOString(),
        vehicles: [],
        stops: [],
      }),
    },
  );
  if (!routingToken) return;

  const optimize = await expectStatus(
    'routing-service:/optimize-authenticated',
    `${routingUrl}/optimize`,
    200,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-routing-service-token': routingToken,
      },
      body: JSON.stringify({
        plan_date: new Date().toISOString(),
        objective: 'balanced',
        vehicles: [
          {
            id: 'staging-smoke-vehicle',
            start_lat: 39.0997,
            start_lng: -94.5786,
            capacity_weight: 5000,
            capacity_volume: 25,
            max_route_minutes: 480,
          },
        ],
        stops: [
          {
            id: 'staging-smoke-stop-a',
            lat: 39.1068,
            lng: -94.5704,
            service_minutes: 10,
            priority: 2,
            weight: 100,
            volume: 1,
          },
          {
            id: 'staging-smoke-stop-b',
            lat: 39.0839,
            lng: -94.5854,
            service_minutes: 10,
            priority: 3,
            weight: 100,
            volume: 1,
          },
        ],
      }),
    },
  );
  const route = optimize?.json?.routes?.[0];
  const orderedStops = route?.ordered_stops || [];
  if (
    optimize &&
    (optimize.json?.objective_used !== 'balanced' || orderedStops.length !== 2)
  ) {
    record('routing-service:optimized-output', 'fail', {
      reason: 'optimizer response did not preserve objective and all ordered stops',
      objectiveUsed: optimize.json?.objective_used,
      orderedStops,
    });
  } else if (optimize) {
    record('routing-service:optimized-output', 'pass', {
      objectiveUsed: optimize.json?.objective_used,
      orderedStops: orderedStops.map((stop) => stop.stop_id),
    });
  }
}

function probeProviderEnv() {
  if (!requireProviderChecks) {
    record('provider-env:required', 'skip', {
      reason: 'STAGING_REQUIRE_PROVIDER_CHECKS=false',
    });
    return;
  }

  [
    'WORKOS_TEST_EMAIL',
    'WORKOS_TEST_PASSWORD',
    'METRICS_TOKEN',
    'ROUTING_SERVICE_INTERNAL_TOKEN',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STAGING_WEBHOOK_RECEIVER_URL',
    'POSTMARK_SERVER_TOKEN',
    'POSTMARK_FROM_EMAIL',
    'LEAD_INTAKE_EMAIL',
    'LEAD_INTAKE_FROM_EMAIL',
    'R2_BUCKET',
  ].forEach(requireEnv);
}

function writeArtifacts(payload) {
  mkdirSync(artifactDir, { recursive: true });
  writeFileSync(
    path.join(artifactDir, 'staging-smoke-results.json'),
    JSON.stringify(payload, null, 2),
    'utf8',
  );
  writeFileSync(
    path.join(artifactDir, 'staging-smoke-result.json'),
    JSON.stringify(payload, null, 2),
    'utf8',
  );
}

async function main() {
  const frontendUrl = normalizeUrl(requireEnv('STAGING_FRONTEND_URL'));
  const backendUrl = normalizeUrl(requireEnv('STAGING_BACKEND_URL'));
  const routingServiceUrl =
    env('STAGING_ROUTING_SERVICE_URL') || env('ROUTING_SERVICE_URL');
  const authToken = env('STAGING_AUTH_TOKEN') || env('LAUNCH_AUDIT_AUTH_TOKEN');
  requireEnv('STAGING_DRIVER_AUTH_TOKEN');
  const metricsToken = env('METRICS_TOKEN');
  requireEnv('EXPECTED_RELEASE_SHA');

  probeProviderEnv();

  if (frontendUrl) await probeFrontend(frontendUrl);
  if (backendUrl) {
    await probeBackendHealth(backendUrl);
    await probeSecurityBasics(backendUrl, metricsToken);
    await probeLeadIntake(backendUrl, authToken);
    await probeAuthenticatedApi(backendUrl, authToken);
  }
  await probeRoutingService(routingServiceUrl);

  const payload = {
    ok: checks.every((check) => check.status !== 'fail'),
    generatedAt: new Date().toISOString(),
    artifactDir,
    partialMode,
    requireProviderChecks,
    checks,
  };
  writeArtifacts(payload);
  console.log(JSON.stringify(payload, null, 2));

  if (!payload.ok) {
    process.exitCode = 1;
  }
}

await main();
