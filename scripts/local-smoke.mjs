import net from 'node:net';
import process from 'node:process';

const backendUrl = process.env.BACKEND_SMOKE_URL || 'http://127.0.0.1:3000/health/ping';
const frontendUrl = process.env.FRONTEND_SMOKE_URL || 'http://127.0.0.1:5184/';
const readinessUrl =
  process.env.READINESS_SMOKE_URL || 'http://127.0.0.1:3000/health/readiness';
const dbHost = process.env.DATABASE_HOST || '127.0.0.1';
const dbPort = Number(process.env.DATABASE_PORT || '5432');
const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = Number(process.env.REDIS_PORT || '6379');
const queueRequired =
  ['1', 'true', 'yes', 'on'].includes(
    String(process.env.QUEUE_REQUIRED || '').toLowerCase(),
  );

const checkPort = (host, port) =>
  new Promise((resolve) => {
    const socket = net.connect({ host, port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      resolve(false);
    });
    socket.setTimeout(1500, () => {
      socket.destroy();
      resolve(false);
    });
  });

const checkHttp = async (label, url) => {
  try {
    const response = await fetch(url);
    console.log(`${label}: ${response.status} ${url}`);
    return response.ok;
  } catch (error) {
    console.log(`${label}: unreachable ${url} (${error instanceof Error ? error.message : String(error)})`);
    return false;
  }
};

const readJson = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return response.json();
  } catch {
    return null;
  }
};

const dbReady = await checkPort(dbHost, dbPort);
console.log(`database: ${dbReady ? 'open' : 'closed'} ${dbHost}:${dbPort}`);

const redisReady = await checkPort(redisHost, redisPort);
console.log(`redis: ${redisReady ? 'open' : 'closed'} ${redisHost}:${redisPort}`);

const backendReady = await checkHttp('backend', backendUrl);
const frontendReady = await checkHttp('frontend', frontendUrl);
const readinessOk = await checkHttp('readiness', readinessUrl);
const readinessPayload = await readJson(readinessUrl);

if (readinessPayload?.dependencies) {
  console.log('provider-readiness:');
  Object.entries(readinessPayload.dependencies).forEach(([name, state]) => {
    const record =
      state && typeof state === 'object' && !Array.isArray(state) ? state : {};
    const configured =
      typeof record.configured === 'boolean' ? record.configured : false;
    const required =
      typeof record.required === 'boolean' ? record.required : false;
    console.log(
      `  - ${name}: ${configured ? 'configured' : 'missing'}${
        required ? ' (required)' : ''
      }`,
    );
  });
}

if (!dbReady || !backendReady || !frontendReady || !readinessOk || (queueRequired && !redisReady)) {
  process.exit(1);
}
