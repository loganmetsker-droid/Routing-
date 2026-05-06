import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const host = process.env.PLAYWRIGHT_HOST || '127.0.0.1';
const frontendPort = process.env.PLAYWRIGHT_FRONTEND_PORT || '5185';
const mockApiPort = process.env.PLAYWRIGHT_MOCK_API_PORT || '3001';
const mockApiUrl = `http://${host}:${mockApiPort}`;
const frontendUrl = `http://${host}:${frontendPort}`;

const children = new Set();

function start(label, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd || rootDir,
    env: {
      ...process.env,
      ...options.env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.add(child);
  child.stdout.on('data', (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  child.on('exit', (code, signal) => {
    children.delete(child);
    if (code !== 0 && signal !== 'SIGTERM') {
      console.error(`${label} exited with code ${code ?? signal}`);
      stopAll();
      process.exit(code || 1);
    }
  });
  return child;
}

function stopAll() {
  for (const child of children) {
    child.kill('SIGTERM');
  }
}

async function waitFor(url, label) {
  const deadline = Date.now() + 120_000;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 750));
  }
  throw new Error(`${label} did not become reachable at ${url}: ${lastError}`);
}

async function isReachable(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

process.on('SIGINT', () => {
  stopAll();
  process.exit(130);
});
process.on('SIGTERM', () => {
  stopAll();
  process.exit(0);
});
process.on('exit', stopAll);

if (!(await isReachable(`${mockApiUrl}/health`))) {
  start('mock-api', process.execPath, ['scripts/mock-preview-api.mjs'], {
    env: {
      MOCK_API_PORT: mockApiPort,
      MOCK_CORS_ORIGIN: frontendUrl,
    },
  });

  await waitFor(`${mockApiUrl}/health`, 'Mock preview API');
}

if (!(await isReachable(frontendUrl))) {
  start(
    'vite',
    process.execPath,
    ['../node_modules/vite/bin/vite.js', '--host', host, '--port', frontendPort, '--strictPort'],
    {
      cwd: resolve(rootDir, 'frontend'),
      env: {
        VITE_MOCK_PREVIEW: 'true',
        VITE_AUTH_BYPASS: 'true',
        VITE_ENABLE_SOCKETS: 'false',
        FRONTEND_PORT: frontendPort,
        VITE_FRONTEND_PORT: frontendPort,
        VITE_API_URL: mockApiUrl,
        VITE_REST_API_URL: mockApiUrl,
        VITE_GRAPHQL_URL: `${mockApiUrl}/graphql`,
        VITE_WS_URL: `ws://${host}:${mockApiPort}`,
      },
    },
  );

  await waitFor(frontendUrl, 'Routing frontend preview');
}
console.log(`Playwright preview ready at ${frontendUrl}`);

await new Promise(() => {});
