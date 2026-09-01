const REQUEST_TYPES = new Set([
  'Route audit',
  'Book demo',
  'Implementation planning',
  'Support',
  'Security review',
  'Privacy Rights Request',
  'Careers',
]);

const FLEET_SIZES = new Set([
  '5–15',
  '16–35',
  '36–75',
  '76–150',
  '151–300',
  '300+ / Custom',
]);

const MAX_BODY_BYTES = 16_384;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;
const DUPLICATE_WINDOW_MS = 10 * 60_000;

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

function cleanString(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength + 1);
}

export function validateLeadPayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Request body must be a JSON object.' };
  }

  const lead = {
    name: cleanString(input.name, 120),
    workEmail: cleanString(input.workEmail, 254).toLowerCase(),
    company: cleanString(input.company, 160),
    fleetSize: cleanString(input.fleetSize, 40),
    requestType: cleanString(input.requestType, 80),
    notes: cleanString(input.notes, 2_000),
    source: cleanString(input.source, 80) || 'trytrovan.com',
    pagePath: cleanString(input.pagePath, 240),
    website: cleanString(input.website, 200),
    exactFleetSize: input.exactFleetSize === undefined || input.exactFleetSize === null || input.exactFleetSize === ''
      ? null
      : Number(input.exactFleetSize),
  };

  if (lead.name.length < 2 || lead.name.length > 120) {
    return { ok: false, error: 'Name must be between 2 and 120 characters.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.workEmail) || lead.workEmail.length > 254) {
    return { ok: false, error: 'Enter a valid work email.' };
  }
  if (lead.company.length < 2 || lead.company.length > 160) {
    return { ok: false, error: 'Company must be between 2 and 160 characters.' };
  }
  if (!FLEET_SIZES.has(lead.fleetSize)) {
    return { ok: false, error: 'Select a valid fleet size.' };
  }
  if (!REQUEST_TYPES.has(lead.requestType)) {
    return { ok: false, error: 'Select a valid request type.' };
  }
  if (lead.notes.length > 2_000 || lead.source.length > 80 || lead.pagePath.length > 240) {
    return { ok: false, error: 'One or more fields exceed the allowed length.' };
  }
  if (lead.exactFleetSize !== null && (!Number.isInteger(lead.exactFleetSize) || lead.exactFleetSize < 1 || lead.exactFleetSize > 100_000)) {
    return { ok: false, error: 'Exact fleet size must be a whole number between 1 and 100,000.' };
  }

  return { ok: true, lead };
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function formatLeadEmail(lead, id) {
  return [
    `Name: ${lead.name}`,
    `Email: ${lead.workEmail}`,
    `Company: ${lead.company}`,
    `Fleet: ${lead.exactFleetSize || lead.fleetSize}`,
    `Request: ${lead.requestType}`,
    lead.pagePath ? `Page: ${lead.pagePath}` : '',
    lead.notes ? `Notes: ${lead.notes}` : '',
    `Lead ID: ${id}`,
  ].filter(Boolean).join('\n');
}

async function notifyPostmark(env, lead, id) {
  if (!env.POSTMARK_SERVER_TOKEN || !env.LEAD_INTAKE_FROM_EMAIL || !env.LEAD_INTAKE_EMAIL) {
    return { status: 'skipped', error: 'Operator email is not configured', messageId: null };
  }

  try {
    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': env.POSTMARK_SERVER_TOKEN,
      },
      body: JSON.stringify({
        From: env.LEAD_INTAKE_FROM_EMAIL,
        To: env.LEAD_INTAKE_EMAIL,
        ReplyTo: lead.workEmail,
        Subject: `Trovan ${lead.requestType}: ${lead.company}`,
        Tag: 'trovan-lead-intake',
        Metadata: { trovanLeadId: id, source: lead.source },
        TextBody: formatLeadEmail(lead, id),
        MessageStream: 'outbound',
      }),
    });
    const receipt = await response.json().catch(() => null);
    if (!response.ok || receipt?.ErrorCode !== 0 || !receipt?.MessageID) {
      return { status: 'failed', error: 'Postmark rejected the operator notification', messageId: null };
    }
    return { status: 'sent', error: null, messageId: receipt.MessageID };
  } catch {
    return { status: 'failed', error: 'Postmark notification request failed', messageId: null };
  }
}

async function updateNotification(db, id, notification, now) {
  await db.prepare(`
    UPDATE marketing_leads
    SET notification_status = ?, notification_error = ?, notification_message_id = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    notification.status,
    notification.error,
    notification.messageId,
    now,
    id,
  ).run();
}

export async function handleLeadRequest(request, env) {
  if (!env.LEADS_DB) {
    return json({ error: 'Lead intake storage is unavailable.' }, 503);
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return json({ error: 'Content-Type must be application/json.' }, 415);
  }

  const contentLength = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json({ error: 'Request body is too large.' }, 413);
  }

  const bodyText = await request.text();
  if (new TextEncoder().encode(bodyText).byteLength > MAX_BODY_BYTES) {
    return json({ error: 'Request body is too large.' }, 413);
  }

  let input;
  try {
    input = JSON.parse(bodyText);
  } catch {
    return json({ error: 'Request body must contain valid JSON.' }, 400);
  }

  const validated = validateLeadPayload(input);
  if (!validated.ok) return json({ error: validated.error }, 400);
  const lead = validated.lead;

  // A filled hidden website field indicates an automated submission. Return a
  // normal-looking response without storing PII or sending mail.
  if (lead.website) {
    return json({ id: 'accepted', duplicate: false, notificationStatus: 'skipped' }, 202);
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const connectingIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await sha256(`${nowIso.slice(0, 10)}:${connectingIp}`);
  const rateCutoff = new Date(now.getTime() - RATE_WINDOW_MS).toISOString();
  const recent = await env.LEADS_DB.prepare(`
    SELECT COUNT(*) AS total
    FROM marketing_leads
    WHERE ip_hash = ? AND created_at > ?
  `).bind(ipHash, rateCutoff).first();
  if (Number(recent?.total || 0) >= RATE_LIMIT) {
    return json(
      { error: 'Too many requests. Please wait a minute and try again.' },
      429,
      { 'Retry-After': '60' },
    );
  }

  const duplicateCutoff = new Date(now.getTime() - DUPLICATE_WINDOW_MS).toISOString();
  const duplicate = await env.LEADS_DB.prepare(`
    SELECT id, notification_status AS notificationStatus
    FROM marketing_leads
    WHERE work_email = ? AND created_at > ?
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(lead.workEmail, duplicateCutoff).first();
  if (duplicate) {
    return json({
      id: duplicate.id,
      duplicate: true,
      notificationStatus: duplicate.notificationStatus,
    }, 200);
  }

  const id = crypto.randomUUID();
  await env.LEADS_DB.prepare(`
    INSERT INTO marketing_leads (
      id, name, work_email, company, fleet_size, exact_fleet_size,
      request_type, notes, source, page_path, status,
      notification_status, ip_hash, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', 'pending', ?, ?, ?)
  `).bind(
    id,
    lead.name,
    lead.workEmail,
    lead.company,
    lead.fleetSize,
    lead.exactFleetSize,
    lead.requestType,
    lead.notes || null,
    lead.source,
    lead.pagePath || null,
    ipHash,
    nowIso,
    nowIso,
  ).run();

  const notification = await notifyPostmark(env, lead, id);
  await updateNotification(env.LEADS_DB, id, notification, new Date().toISOString());

  return json({
    id,
    duplicate: false,
    notificationStatus: notification.status,
  }, 201);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/marketing-leads/health' && request.method === 'GET') {
      const ready = Boolean(
        env.LEADS_DB &&
        env.POSTMARK_SERVER_TOKEN &&
        env.LEAD_INTAKE_FROM_EMAIL &&
        env.LEAD_INTAKE_EMAIL,
      );
      return json({ status: ready ? 'ready' : 'degraded' }, ready ? 200 : 503);
    }

    if (url.pathname === '/api/marketing-leads') {
      if (request.method !== 'POST') {
        return json({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });
      }
      return handleLeadRequest(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
