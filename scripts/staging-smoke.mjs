import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  validateRoutingProvenance,
  validateTenantIdentities,
} from './staging-smoke-contracts.mjs';
import { runR2RecoveryExercise } from './r2-recovery-smoke.mjs';
import { createStripeClientAndRun } from './stripe-assisted-pilot-smoke.mjs';

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

function requireEnvValue(name, expected) {
  const value = requireEnv(name);
  if (value && value.toLowerCase() !== expected.toLowerCase()) {
    record(`env:${name}:expected-value`, 'fail', {
      reason: `expected ${expected} for the assisted-pilot staging profile`,
      actual: value,
    });
  } else if (value) {
    record(`env:${name}:expected-value`, 'pass', { expected });
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
}

async function probeBackendHealth(backendUrl) {
  await expectStatus('backend:/health', `${backendUrl}/health`, 200);
  await expectStatus('backend:/health/runtime', `${backendUrl}/health/runtime`, 200);
  await expectStatus(
    'backend:/health/readiness',
    `${backendUrl}/health/readiness`,
    200,
  );
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
  const persistedLead = Array.isArray(leads)
    ? leads.find((lead) => lead.id === leadId && lead.workEmail === workEmail)
    : null;
  if (!persistedLead) {
    record('lead-intake:durable-readback', 'fail', {
      reason: 'created lead was not visible in the authenticated operator queue',
      leadId,
    });
    return;
  }
  record('lead-intake:durable-readback', 'pass', { leadId });
  if (persistedLead.notificationStatus !== 'sent') {
    record('lead-intake:postmark-api-accepted', 'fail', {
      reason: 'persisted lead does not prove Postmark accepted the operator email',
      leadId,
      notificationStatus: persistedLead.notificationStatus,
    });
  } else {
    record('lead-intake:postmark-api-accepted', 'pass', { leadId });
  }
  const postmarkMessageId = persistedLead.notificationMessageId;
  if (!postmarkMessageId) {
    record('lead-intake:postmark-message-id', 'fail', {
      reason: 'lead notification did not persist the Postmark message id',
      leadId,
    });
  } else {
    record('lead-intake:postmark-message-id', 'pass', {
      leadId,
      messageId: postmarkMessageId,
    });
    await probePostmarkDelivery(postmarkMessageId);
  }

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

function postmarkHeaders() {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Postmark-Server-Token': env('POSTMARK_SERVER_TOKEN'),
  };
}

async function probePostmarkDelivery(messageId) {
  let delivered = false;
  let lastStatus = 'unknown';
  for (let attempt = 0; attempt < 20 && !delivered; attempt += 1) {
    try {
      const result = await fetchJson(
        `https://api.postmarkapp.com/messages/outbound/${encodeURIComponent(messageId)}/details`,
        { headers: postmarkHeaders() },
      );
      lastStatus = result.json?.Status || lastStatus;
      delivered = Array.isArray(result.json?.MessageEvents) &&
        result.json.MessageEvents.some((event) => event?.Type === 'Delivered');
    } catch {
      // Delivery activity is eventually consistent.
    }
    if (!delivered) await sleep(1_000);
  }
  if (delivered) {
    record('lead-intake:postmark-delivered', 'pass', { messageId });
  } else {
    record('lead-intake:postmark-delivered', 'fail', {
      reason: 'Postmark did not report a Delivered event within the bounded window',
      messageId,
      lastStatus,
    });
  }
}

function webhookIdentity(value) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname}`.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

async function probePostmarkBounce(backendUrl, authToken) {
  const token = env('POSTMARK_SERVER_TOKEN');
  const from = env('POSTMARK_FROM_EMAIL') || env('LEAD_INTAKE_FROM_EMAIL');
  const bounceHookUrl = env('POSTMARK_BOUNCE_WEBHOOK_URL');
  if (!token || !from || !bounceHookUrl || !authToken) return;
  if (token === 'POSTMARK_API_TEST') {
    record('postmark:bounce-live-test-server', 'fail', {
      reason: 'POSTMARK_API_TEST cannot prove delivery or bounce webhooks',
    });
    return;
  }

  await expectStatus(
    'postmark:bounce-webhook-rejects-anonymous',
    `${backendUrl}/api/marketing-leads/postmark/bounces`,
    [401, 403],
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        RecordType: 'Bounce',
        ID: Date.now(),
        Type: 'SoftBounce',
        TypeCode: 409,
        Name: 'Synthetic unauthorized probe',
        MessageID: `unauthorized-${Date.now()}`,
        MessageStream: 'outbound',
        Email: 'SoftBounce@bounce-testing.postmarkapp.com',
        BouncedAt: new Date().toISOString(),
        Inactive: false,
      }),
    },
  );

  try {
    const server = await fetchJson('https://api.postmarkapp.com/server', {
      headers: postmarkHeaders(),
    });
    if (!server.response.ok) {
      throw new Error(`Postmark server lookup returned HTTP ${server.response.status}`);
    }
    if (
      !server.json?.BounceHookUrl ||
      webhookIdentity(server.json.BounceHookUrl) !== webhookIdentity(bounceHookUrl)
    ) {
      throw new Error('configured Postmark BounceHookUrl does not match staging');
    }
    record('postmark:bounce-webhook-configured', 'pass');
  } catch (error) {
    fail('postmark:bounce-webhook-configured', error);
    return;
  }

  const marker = `trovan-bounce-${Date.now()}`;
  const sent = await expectStatus(
    'postmark:soft-bounce-sent',
    'https://api.postmarkapp.com/email',
    200,
    {
      method: 'POST',
      headers: postmarkHeaders(),
      body: JSON.stringify({
        From: from,
        To: 'SoftBounce@bounce-testing.postmarkapp.com',
        Subject: `Trovan staging bounce ${marker}`,
        TextBody: 'Synthetic staging bounce verification; no customer data.',
        Tag: 'trovan-staging-bounce',
        Metadata: { trovanSmokeId: marker },
        MessageStream: 'outbound',
      }),
    },
  );
  const messageId = sent?.json?.MessageID;
  if (!messageId || sent?.json?.ErrorCode !== 0) {
    record('postmark:soft-bounce-message-id', 'fail', {
      reason: 'Postmark did not accept the synthetic bounce message',
    });
    return;
  }
  record('postmark:soft-bounce-message-id', 'pass', { messageId });

  let bounce = null;
  for (let attempt = 0; attempt < 30 && !bounce; attempt += 1) {
    try {
      const readback = await fetchJson(
        `${backendUrl}/api/marketing-leads/postmark/bounces?messageId=${encodeURIComponent(messageId)}`,
        { headers: authHeaders(authToken) },
      );
      const bounces =
        readback.json?.data?.items ||
        readback.json?.data?.bounces ||
        readback.json?.bounces ||
        [];
      if (readback.response.ok && Array.isArray(bounces)) {
        bounce = bounces.find(
          (item) => item?.messageId === messageId && /bounce/i.test(item?.bounceType || ''),
        );
      }
    } catch {
      // Postmark bounce webhooks are eventually consistent.
    }
    if (!bounce) await sleep(1_000);
  }
  if (!bounce) {
    record('postmark:bounce-webhook-persisted', 'fail', {
      reason: 'backend did not persist the correlated Postmark bounce webhook',
      messageId,
    });
  } else {
    record('postmark:bounce-webhook-persisted', 'pass', {
      messageId,
      bounceType: bounce.bounceType,
    });
  }
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

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function findMonitoringEvent(value, eventId) {
  if (!value || typeof value !== 'object') return null;
  if (value.eventId === eventId) return value;
  for (const key of ['data', 'event', 'events', 'items', 'results']) {
    const nested = value[key];
    if (Array.isArray(nested)) {
      const match = nested.find((item) => item?.eventId === eventId);
      if (match) return match;
    } else if (nested && typeof nested === 'object') {
      const match = findMonitoringEvent(nested, eventId);
      if (match) return match;
    }
  }
  return null;
}

async function probeErrorMonitoring(backendUrl, authToken) {
  const readbackUrl = env('ERROR_MONITORING_TEST_READBACK_URL');
  const acknowledgementUrl = env('ERROR_MONITORING_TEST_ACK_URL');
  const receiverToken = env('ERROR_MONITORING_WEBHOOK_TOKEN');
  if (!authToken || !readbackUrl || !acknowledgementUrl) return;

  const marker = `staging-monitor-${Date.now()}`;
  const accepted = await expectStatus(
    'monitoring:authenticated-client-error-accepted',
    `${backendUrl}/api/monitoring/client-errors`,
    201,
    {
      method: 'POST',
      headers: {
        ...authHeaders(authToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'StagingMonitoringProbe',
        message: marker,
        componentStack: 'Synthetic launch gate; no customer data.',
        path: '/launch-monitoring-probe',
      }),
    },
  );
  const eventId = accepted?.json?.data?.eventId || accepted?.json?.eventId;
  if (!eventId) {
    record('monitoring:correlation-id', 'fail', {
      reason: 'client-error receipt did not return a monitoring event id',
    });
    return;
  }
  record('monitoring:correlation-id', 'pass', { eventId });

  let deliveredEvent = null;
  const separator = readbackUrl.includes('?') ? '&' : '?';
  for (let attempt = 0; attempt < 12 && !deliveredEvent; attempt += 1) {
    try {
      const result = await fetchJson(
        `${readbackUrl}${separator}eventId=${encodeURIComponent(eventId)}`,
        { headers: receiverToken ? authHeaders(receiverToken) : {} },
      );
      if (result.response.ok) {
        const candidate = findMonitoringEvent(result.json, eventId);
        if (candidate && JSON.stringify(candidate).includes(marker)) {
          deliveredEvent = candidate;
        }
      }
    } catch {
      // Receiver may be eventually consistent; retry within the bounded window.
    }
    if (!deliveredEvent) await sleep(1_000);
  }
  if (!deliveredEvent) {
    record('monitoring:external-delivery-readback', 'fail', {
      reason: 'monitoring receiver did not return the correlated redacted event',
      eventId,
    });
    return;
  }
  record('monitoring:external-delivery-readback', 'pass', { eventId });

  const resolvedAckUrl = acknowledgementUrl.includes('{eventId}')
    ? acknowledgementUrl.replace('{eventId}', encodeURIComponent(eventId))
    : acknowledgementUrl;
  const acknowledgement = await expectStatus(
    'monitoring:owner-acknowledgement',
    resolvedAckUrl,
    [200, 201],
    {
      method: 'POST',
      headers: {
        ...(receiverToken ? authHeaders(receiverToken) : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventId,
        acknowledgedBy: 'trovan-launch-smoke',
        note: 'Automated staging launch alert acknowledgement.',
      }),
    },
  );
  const acknowledgementBody = acknowledgement?.json?.data || acknowledgement?.json;
  if (
    acknowledgement &&
    acknowledgementBody?.eventId !== eventId &&
    acknowledgementBody?.acknowledged !== true
  ) {
    record('monitoring:acknowledgement-correlation', 'fail', {
      reason: 'receiver acknowledgement was not correlated to the test event',
      eventId,
      body: sanitize(acknowledgementBody),
    });
  } else if (acknowledgement) {
    record('monitoring:acknowledgement-correlation', 'pass', { eventId });
  }
}

async function probeR2Recovery() {
  const endpoint = env('R2_ENDPOINT');
  const bucket = env('R2_BUCKET');
  const accessKeyId = env('R2_ACCESS_KEY_ID');
  const secretAccessKey = env('R2_SECRET_ACCESS_KEY');
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return;

  try {
    const result = await runR2RecoveryExercise({
      endpoint,
      bucket,
      accessKeyId,
      secretAccessKey,
    });
    record('storage:r2-byte-verified-recovery', 'pass', result);
  } catch (error) {
    fail('storage:r2-byte-verified-recovery', error);
  }
}

async function probeStripeAssistedPilot() {
  const secretKey = env('STRIPE_SECRET_KEY');
  const launchPriceId = env('STRIPE_PRICE_LAUNCH');
  const scalePriceId = env('STRIPE_PRICE_SCALE');
  const allowExercise = env('STRIPE_ALLOW_TEST_EXERCISE') === 'true';
  if (!secretKey || !launchPriceId || !scalePriceId) return;

  try {
    const result = await createStripeClientAndRun({
      secretKey,
      launchPriceId,
      scalePriceId,
      allowExercise,
    });
    record('billing:stripe-assisted-pilot-lifecycle', 'pass', result);
  } catch (error) {
    fail('billing:stripe-assisted-pilot-lifecycle', error);
  }
}

async function probeAuthenticatedApi(backendUrl, authToken, secondOrgAuthToken) {
  if (!authToken) {
    record('auth:jwt-probes', partialMode ? 'skip' : 'fail', {
      reason: 'STAGING_AUTH_TOKEN or LAUNCH_AUDIT_AUTH_TOKEN is required',
    });
    return null;
  }

  const me = await expectStatus('auth:me', `${backendUrl}/api/auth/me`, 200, {
    headers: authHeaders(authToken),
  });
  const secondMe = await expectStatus(
    'auth:second-organization-me',
    `${backendUrl}/api/auth/me`,
    200,
    { headers: authHeaders(secondOrgAuthToken) },
  );
  const tenantIssues = validateTenantIdentities(
    me?.json?.data?.user || me?.json?.user,
    secondMe?.json?.data?.user || secondMe?.json?.user,
  );
  if (tenantIssues.length) {
    record('tenancy:distinct-organization-identities', 'fail', {
      issues: tenantIssues,
    });
  } else {
    record('tenancy:distinct-organization-identities', 'pass');
  }
  await expectStatus(
    'platform:overview',
    `${backendUrl}/api/platform/overview`,
    200,
    { headers: authHeaders(authToken) },
  );

  await probeWebhookSsrfRejection(backendUrl, authToken);
  await probeApiKeyLifecycle(backendUrl, authToken, secondOrgAuthToken);
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

async function probeApiKeyLifecycle(backendUrl, authToken, secondOrgAuthToken) {
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

  if (secondOrgAuthToken) {
    const secondaryList = await expectStatus(
      'tenancy:secondary-api-key-list',
      `${backendUrl}/api/platform/api-keys`,
      200,
      { headers: authHeaders(secondOrgAuthToken) },
    );
    const secondaryKeys =
      secondaryList?.json?.data?.apiKeys || secondaryList?.json?.apiKeys || [];
    if (Array.isArray(secondaryKeys) && secondaryKeys.some((key) => key?.id === apiKeyId)) {
      record('tenancy:cross-organization-list-denied', 'fail', {
        reason: 'secondary organization could list the primary organization API key',
      });
    } else {
      record('tenancy:cross-organization-list-denied', 'pass');
    }
    await expectStatus(
      'tenancy:cross-organization-revoke-denied',
      `${backendUrl}/api/platform/api-keys/${apiKeyId}`,
      404,
      { method: 'DELETE', headers: authHeaders(secondOrgAuthToken) },
    );
    await expectStatus(
      'tenancy:primary-key-survives-cross-organization-attempt',
      `${backendUrl}/api/v1/jobs`,
      200,
      { headers: { 'x-api-key': secret } },
    );
  }

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

  await expectStatus('routing-service:/health', `${routingUrl}/health`, 200);
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
  const provenance = optimize?.json?.provenance;
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
  const provenanceIssues = validateRoutingProvenance(provenance);
  if (optimize && provenanceIssues.length) {
    record('routing-service:production-provenance', 'fail', {
      reason:
        'hosted optimizer must prove its solver version and non-fallback road-network matrix',
      issues: provenanceIssues,
      provenance: sanitize(provenance),
    });
  } else if (optimize) {
    record('routing-service:production-provenance', 'pass', {
      provenance: sanitize(provenance),
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
    'STAGING_EXPIRED_AUTH_TOKEN',
    'WORKOS_CLIENT_ID',
    'WORKOS_API_KEY',
    'WORKOS_REDIRECT_URI',
    'WORKOS_LOGOUT_REDIRECT_URI',
    'METRICS_TOKEN',
    'ROUTING_SERVICE_INTERNAL_TOKEN',
    'ROUTING_MATRIX_BASE_URL',
    'ROUTING_MATRIX_PROVIDER_LABEL',
    'ROUTING_MATRIX_TOKEN',
    'TROVAN_SOLVER_VERSION',
    'GEOCODING_API_KEY',
    'ERROR_MONITORING_WEBHOOK_URL',
    'ERROR_MONITORING_WEBHOOK_TOKEN',
    'ERROR_MONITORING_TEST_READBACK_URL',
    'ERROR_MONITORING_TEST_ACK_URL',
    'ACCESS_CODE_ENCRYPTION_KEY',
    'ACCESS_CODE_KEY_VERSION',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_ALLOW_TEST_EXERCISE',
    'STAGING_WEBHOOK_RECEIVER_URL',
    'STAGING_SECOND_ORG_AUTH_TOKEN',
    'POSTMARK_SERVER_TOKEN',
    'POSTMARK_FROM_EMAIL',
    'POSTMARK_BOUNCE_WEBHOOK_URL',
    'POSTMARK_WEBHOOK_USERNAME',
    'POSTMARK_WEBHOOK_PASSWORD',
    'POSTMARK_BOUNCE_HASH_KEY',
    'LEAD_INTAKE_EMAIL',
    'LEAD_INTAKE_FROM_EMAIL',
    'R2_BUCKET',
  ].forEach(requireEnv);
  requireEnvValue('ROUTING_MATRIX_PROVIDER', 'osrm');
  requireEnvValue('ROUTING_MATRIX_ALLOW_FALLBACK', 'false');
  requireEnvValue('GEOCODING_PROVIDER', 'mapbox');
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
  const secondOrgAuthToken = env('STAGING_SECOND_ORG_AUTH_TOKEN');
  requireEnv('STAGING_DRIVER_AUTH_TOKEN');
  const metricsToken = env('METRICS_TOKEN');

  probeProviderEnv();

  if (frontendUrl) await probeFrontend(frontendUrl);
  if (backendUrl) {
    await probeBackendHealth(backendUrl);
    await probeSecurityBasics(backendUrl, metricsToken);
    await probeLeadIntake(backendUrl, authToken);
    await probeAuthenticatedApi(backendUrl, authToken, secondOrgAuthToken);
    await probeErrorMonitoring(backendUrl, authToken);
    await probePostmarkBounce(backendUrl, authToken);
  }
  await probeRoutingService(routingServiceUrl);
  await probeR2Recovery();
  await probeStripeAssistedPilot();

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
