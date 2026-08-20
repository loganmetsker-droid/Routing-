import { createHash, createHmac, randomBytes } from 'node:crypto';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key, value, encoding) {
  return createHmac('sha256', key).update(value).digest(encoding);
}

function awsTimestamp(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function encodeKey(key) {
  return key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function buildR2ObjectUrl(endpoint, bucket, key) {
  const base = String(endpoint || '').trim().replace(/\/+$/, '');
  if (!/^https:\/\//i.test(base)) {
    throw new Error('R2_ENDPOINT must be an HTTPS URL');
  }
  if (!String(bucket || '').trim()) throw new Error('R2_BUCKET is required');
  if (!String(key || '').trim()) throw new Error('R2 object key is required');
  return `${base}/${encodeURIComponent(bucket.trim())}/${encodeKey(key)}`;
}

export function signR2Request({
  accessKeyId,
  secretAccessKey,
  method,
  url,
  body = Buffer.alloc(0),
  date = new Date(),
}) {
  const target = new URL(url);
  const timestamp = awsTimestamp(date);
  const dateStamp = timestamp.slice(0, 8);
  const payloadHash = sha256(body);
  const canonicalHeaders = [
    `host:${target.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${timestamp}`,
    '',
  ].join('\n');
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    method.toUpperCase(),
    target.pathname,
    target.searchParams.toString(),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    timestamp,
    scope,
    sha256(canonicalRequest),
  ].join('\n');
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, 'auto');
  const serviceKey = hmac(regionKey, 's3');
  const signingKey = hmac(serviceKey, 'aws4_request');
  const signature = hmac(signingKey, stringToSign, 'hex');

  return {
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': timestamp,
  };
}

async function signedFetch(config, method, key, body = Buffer.alloc(0)) {
  const url = buildR2ObjectUrl(config.endpoint, config.bucket, key);
  return fetch(url, {
    method,
    headers: signR2Request({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      method,
      url,
      body,
    }),
    body: ['PUT', 'POST'].includes(method) ? body : undefined,
    signal: AbortSignal.timeout(10_000),
  });
}

async function expectOk(response, action) {
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`${action} returned HTTP ${response.status}: ${detail.slice(0, 180)}`);
  }
}

export async function runR2RecoveryExercise(config, options = {}) {
  const key =
    options.key ||
    `trovan-launch-smoke/recovery-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;
  const payload = Buffer.from(
    options.payload || `trovan-r2-recovery-${Date.now()}-${randomBytes(8).toString('hex')}`,
  );
  const expectedHash = sha256(payload);
  let cleanupRequired = false;

  try {
    const initialPut = await signedFetch(config, 'PUT', key, payload);
    await expectOk(initialPut, 'initial R2 write');
    cleanupRequired = true;

    const initialGet = await signedFetch(config, 'GET', key);
    await expectOk(initialGet, 'initial R2 read');
    const initialBytes = Buffer.from(await initialGet.arrayBuffer());
    if (sha256(initialBytes) !== expectedHash) {
      throw new Error('initial R2 read did not match the uploaded bytes');
    }

    const simulatedLoss = await signedFetch(config, 'DELETE', key);
    await expectOk(simulatedLoss, 'simulated R2 object loss');
    cleanupRequired = false;

    const restorePut = await signedFetch(config, 'PUT', key, initialBytes);
    await expectOk(restorePut, 'R2 recovery write');
    cleanupRequired = true;

    const restoredGet = await signedFetch(config, 'GET', key);
    await expectOk(restoredGet, 'restored R2 read');
    const restoredBytes = Buffer.from(await restoredGet.arrayBuffer());
    if (sha256(restoredBytes) !== expectedHash) {
      throw new Error('restored R2 object did not match the recovery source bytes');
    }

    return {
      key,
      bytes: payload.length,
      sha256: expectedHash,
      restored: true,
    };
  } finally {
    if (cleanupRequired) {
      await signedFetch(config, 'DELETE', key).catch(() => undefined);
    }
  }
}
