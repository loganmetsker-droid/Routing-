const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const APP_HOME = process.env.TROVAN_HOME || path.join(process.env.HOME || '.', '.trovan-routing');
const LOG_DIR = path.join(APP_HOME, 'logs');
const RUNTIME_DIR = path.join(APP_HOME, 'runtime');
const DEFAULT_FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:5184';
const DEFAULT_BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3001';
const QUEUE_REQUIRED = (process.env.QUEUE_REQUIRED || 'false') === 'true';

let splashWindow = null;
let mainWindow = null;
let startupProcess = null;
let shuttingDown = false;

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');

fs.mkdirSync(LOG_DIR, { recursive: true });
fs.mkdirSync(RUNTIME_DIR, { recursive: true });

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(path.join(LOG_DIR, 'desktop-wrapper.log'), line);
  // eslint-disable-next-line no-console
  console.log(message);
}

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 620,
    height: 360,
    frame: false,
    resizable: false,
    show: true,
    backgroundColor: '#F4F7FB',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
}

function createMainWindow(frontendUrl) {
  const frontendAppUrl = `${frontendUrl}${frontendUrl.includes('?') ? '&' : '?'}authBypass=1`;
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    title: 'Trovan Routing & Dispatch',
    backgroundColor: '#F4F7FB',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWindow.webContents.on('did-fail-load', (_event, code, description, validatedURL) => {
    log(`Main window failed to load (${code}): ${description} @ ${validatedURL}`);
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log(`Main window render process gone: ${JSON.stringify(details)}`);
  });
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      log(`Renderer console [${level}] ${sourceId}:${line} ${message}`);
    }
  });
  mainWindow.loadURL(frontendAppUrl);
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  });
}

function createFailureWindow(message) {
  const failWindow = new BrowserWindow({
    width: 760,
    height: 520,
    title: 'Trovan Startup Failed',
    backgroundColor: '#F4F7FB',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  failWindow.loadFile(path.join(__dirname, 'error.html'));
  failWindow.webContents.on('did-finish-load', () => {
    let classified = { code: 'startup_failed', message };
    const errorPath = path.join(RUNTIME_DIR, 'startup_error.json');
    if (fs.existsSync(errorPath)) {
      try {
        classified = JSON.parse(fs.readFileSync(errorPath, 'utf8'));
      } catch (_) {
        // fallback to default classified object
      }
    } else if (message.includes('runtime health endpoint unavailable')) {
      classified = {
        code: 'backend_health_unavailable',
        message,
      };
    } else if (message.includes('Queue or worker runtime health is unavailable')) {
      classified = {
        code: 'worker_queue_unavailable',
        message,
      };
    }
    failWindow.webContents.send('startup-error', {
      message: classified.message || message,
      code: classified.code || 'startup_failed',
      logPath: path.join(LOG_DIR, 'desktop-wrapper.log'),
    });
  });
}

function readRuntimeUrl(name, fallback) {
  const file = path.join(RUNTIME_DIR, `${name}.url`);
  if (!fs.existsSync(file)) return fallback;
  try {
    return fs.readFileSync(file, 'utf8').trim() || fallback;
  } catch (_) {
    return fallback;
  }
}

function waitForRuntimeUrl(name, fallback, timeoutMs = 120000, intervalMs = 1000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      const value = readRuntimeUrl(name, '');
      if (value) return resolve(value);
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Timed out waiting for ${name}.url`));
      }
      setTimeout(poll, intervalMs);
    };
    poll();
  }).catch(() => fallback);
}

function waitForHealth(url, timeoutMs = 120000, intervalMs = 1000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) return resolve();
      } catch (_) {
        // continue polling
      }
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Timed out waiting for ${url}`));
      }
      setTimeout(check, intervalMs);
    };
    check();
  });
}

function startServices() {
  const stableScript = path.join(ROOT_DIR, 'scripts', 'start_stable.sh');
  const out = fs.openSync(path.join(LOG_DIR, 'desktop-startup.log'), 'a');

  startupProcess = spawn('bash', [stableScript], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      TROVAN_HOME: APP_HOME,
      FRONTEND_PORT: process.env.FRONTEND_PORT || '5184',
      BACKEND_PORT: process.env.BACKEND_PORT || '3001',
      VITE_AUTH_BYPASS: process.env.VITE_AUTH_BYPASS || 'true',
    },
    detached: false,
    stdio: ['ignore', out, out],
  });

  startupProcess.on('exit', (code) => {
    log(`start_stable exited with code ${code}`);
  });
}

async function boot() {
  try {
    createSplash();
    log('Desktop wrapper boot initiated');
    startServices();
    const backendUrl = await waitForRuntimeUrl('backend', DEFAULT_BACKEND_URL);
    const frontendUrl = await waitForRuntimeUrl('frontend', DEFAULT_FRONTEND_URL);
    await waitForHealth(`${backendUrl}/api/health/runtime`);
    await waitForHealth(frontendUrl);
    const runtimeRes = await fetch(`${backendUrl}/api/health/runtime`);
    if (!runtimeRes.ok) {
      throw new Error('Backend runtime health endpoint unavailable');
    }
    const runtimePayload = await runtimeRes.json();
    const runtime = runtimePayload?.data || runtimePayload;
    if (QUEUE_REQUIRED && (runtime?.queue?.status === 'unavailable' || runtime?.worker?.status === 'missing')) {
      throw new Error('Queue or worker runtime health is unavailable');
    }
    log(`Runtime health summary: ${JSON.stringify({
      status: runtime?.status,
      queue: runtime?.queue?.status,
      worker: runtime?.worker?.status,
    })}`);
    log('Health checks passed, opening main window');
    createMainWindow(frontendUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`Startup failed: ${message}`);
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    createFailureWindow(message);
  }
}

function stopServices() {
  if (shuttingDown) return;
  shuttingDown = true;
  log('Stopping services...');
  const stopScript = path.join(ROOT_DIR, 'scripts', 'stop_all.sh');
  try {
    spawn('bash', [stopScript], {
      cwd: ROOT_DIR,
      env: { ...process.env, TROVAN_HOME: APP_HOME },
      stdio: 'ignore',
    });
  } catch (err) {
    log(`Failed to stop services cleanly: ${String(err)}`);
  }
}

app.whenReady().then(boot);

app.on('window-all-closed', () => {
  stopServices();
  app.quit();
});

app.on('before-quit', () => {
  stopServices();
});

process.on('SIGINT', () => {
  stopServices();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopServices();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  log(`Uncaught exception: ${err.stack || err.message}`);
  dialog.showErrorBox('Trovan Desktop Error', err.message);
  stopServices();
});
