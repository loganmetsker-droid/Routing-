import { pathToFileURL } from 'node:url';

export function evaluateReleaseIdentity({
  expectedSha,
  backendRuntime,
  routingHealth,
  frontendHtml,
}) {
  const frontendMatch = String(frontendHtml || '').match(
    /<meta\s+name=["']trovan-release-sha["']\s+content=["']([0-9a-f]{40})["']/i,
  );
  const observed = {
    backend: backendRuntime?.runtime?.release?.sha || 'unknown',
    routing: routingHealth?.releaseSha || 'unknown',
    frontend: frontendMatch?.[1] || 'unknown',
  };
  return {
    ok: Object.values(observed).every((sha) => sha === expectedSha),
    expectedSha,
    observed,
  };
}

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.text();
}

async function main() {
  const expectedSha = String(process.env.RELEASE_SHA || '').trim();
  const backendUrl = String(process.env.BACKEND_URL || '').trim().replace(/\/+$/, '');
  const routingUrl = String(process.env.ROUTING_SERVICE_URL || '').trim().replace(/\/+$/, '');
  const frontendUrl = String(process.env.FRONTEND_URL || '').trim().replace(/\/+$/, '');
  if (!/^[0-9a-f]{40}$/.test(expectedSha)) {
    throw new Error('RELEASE_SHA must be a full lowercase 40-character commit SHA');
  }
  if (!backendUrl || !routingUrl || !frontendUrl) {
    throw new Error('BACKEND_URL, ROUTING_SERVICE_URL, and FRONTEND_URL are required');
  }

  const timeoutMs = Math.max(
    10_000,
    Math.min(Number(process.env.RELEASE_IDENTITY_TIMEOUT_MS || 300_000), 900_000),
  );
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    try {
      const [backendRuntime, routingHealth, frontendHtml] = await Promise.all([
        fetchJson(`${backendUrl}/health/runtime`),
        fetchJson(`${routingUrl}/health`),
        fetchText(frontendUrl),
      ]);
      last = evaluateReleaseIdentity({
        expectedSha,
        backendRuntime,
        routingHealth,
        frontendHtml,
      });
      if (last.ok) {
        console.log(JSON.stringify(last, null, 2));
        return;
      }
    } catch (error) {
      last = { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  throw new Error(
    `Release identity did not converge before timeout: ${JSON.stringify(last)}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
