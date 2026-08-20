import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildR2ObjectUrl,
  runR2RecoveryExercise,
  signR2Request,
} from './r2-recovery-smoke.mjs';

test('builds an encoded path-style R2 object URL', () => {
  assert.equal(
    buildR2ObjectUrl('https://account.r2.cloudflarestorage.com/', 'proof files', 'smoke/a b.txt'),
    'https://account.r2.cloudflarestorage.com/proof%20files/smoke/a%20b.txt',
  );
});

test('creates bounded SigV4 headers without exposing the secret', () => {
  const headers = signR2Request({
    accessKeyId: 'access-id',
    secretAccessKey: 'super-secret-value',
    method: 'PUT',
    url: 'https://account.r2.cloudflarestorage.com/bucket/key',
    body: Buffer.from('payload'),
    date: new Date('2026-08-06T12:00:00.000Z'),
  });
  assert.match(headers.Authorization, /^AWS4-HMAC-SHA256 Credential=access-id\//);
  assert.doesNotMatch(headers.Authorization, /super-secret-value/);
  assert.equal(headers['x-amz-date'], '20260806T120000Z');
});

test('byte-verifies an object delete and recovery, then cleans up', async () => {
  const payload = Buffer.from('byte-identical-r2-recovery');
  const stored = new Map();
  const methods = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method || 'GET';
    methods.push(method);
    if (method === 'PUT') {
      stored.set(String(url), Buffer.from(init.body));
      return new Response('', { status: 200 });
    }
    if (method === 'GET') {
      const body = stored.get(String(url));
      return body
        ? new Response(body, { status: 200 })
        : new Response('', { status: 404 });
    }
    stored.delete(String(url));
    return new Response(null, { status: 204 });
  };
  try {
    const result = await runR2RecoveryExercise(
      {
        endpoint: 'https://account.r2.cloudflarestorage.com',
        bucket: 'proofs',
        accessKeyId: 'access-id',
        secretAccessKey: 'secret',
      },
      { key: 'smoke/recovery.txt', payload },
    );
    assert.equal(result.restored, true);
    assert.equal(result.bytes, payload.length);
    assert.deepEqual(methods, ['PUT', 'GET', 'DELETE', 'PUT', 'GET', 'DELETE']);
    assert.equal(stored.size, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
