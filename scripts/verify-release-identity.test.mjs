import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateReleaseIdentity } from './verify-release-identity.mjs';

const sha = 'a'.repeat(40);

test('accepts the same immutable SHA from all three deployed surfaces', () => {
  assert.equal(
    evaluateReleaseIdentity({
      expectedSha: sha,
      backendRuntime: { runtime: { release: { sha } } },
      routingHealth: { releaseSha: sha },
      frontendHtml: `<meta name="trovan-release-sha" content="${sha}" />`,
    }).ok,
    true,
  );
});

test('rejects an old backend, routing, or frontend release', () => {
  const result = evaluateReleaseIdentity({
    expectedSha: sha,
    backendRuntime: { runtime: { release: { sha: 'b'.repeat(40) } } },
    routingHealth: { releaseSha: sha },
    frontendHtml: `<meta name="trovan-release-sha" content="${sha}" />`,
  });
  assert.equal(result.ok, false);
  assert.equal(result.observed.backend, 'b'.repeat(40));
});
