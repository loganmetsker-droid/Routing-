import { spawn } from 'node:child_process';
import { access, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendDir, '..');
const nestCliPath = path.join(
  repoRoot,
  'node_modules',
  '@nestjs',
  'cli',
  'bin',
  'nest.js',
);
const entryPath = path.join(backendDir, 'dist', 'backend', 'src', 'main.js');

let appProcess = null;
let appRestarting = false;
let lastMtimeMs = 0;

const log = (message) => {
  process.stdout.write(`[backend:dev] ${message}\n`);
};

const stopApp = async () =>
  new Promise((resolve) => {
    if (!appProcess) {
      resolve();
      return;
    }

    const processToStop = appProcess;
    appProcess = null;
    processToStop.once('exit', () => resolve());
    processToStop.kill('SIGTERM');
  });

const startApp = () => {
  appProcess = spawn(process.execPath, [entryPath], {
    cwd: backendDir,
    stdio: 'inherit',
    env: process.env,
  });

  appProcess.on('exit', (code, signal) => {
    if (appRestarting) {
      return;
    }
    if (signal === 'SIGTERM' || signal === 'SIGINT') {
      return;
    }
    log(`Application exited unexpectedly (code=${code ?? 'null'}, signal=${signal ?? 'none'}).`);
  });
};

const restartApp = async (reason) => {
  appRestarting = true;
  log(reason);
  await stopApp();
  startApp();
  appRestarting = false;
};

const hasBuiltEntry = async () => {
  try {
    await access(entryPath);
    return true;
  } catch {
    return false;
  }
};

const watchBuiltEntry = async () => {
  if (!(await hasBuiltEntry())) {
    return;
  }

  const metadata = await stat(entryPath);
  if (!lastMtimeMs) {
    lastMtimeMs = metadata.mtimeMs;
    await restartApp('Compiled entry detected. Starting backend runtime.');
    return;
  }

  if (metadata.mtimeMs !== lastMtimeMs) {
    lastMtimeMs = metadata.mtimeMs;
    await restartApp('Compiled entry changed. Restarting backend runtime.');
  }
};

const builder = spawn(process.execPath, [nestCliPath, 'build', '--watch'], {
  cwd: backendDir,
  stdio: 'inherit',
  env: process.env,
});

const interval = setInterval(() => {
  void watchBuiltEntry();
}, 900);

const shutdown = async (code = 0) => {
  clearInterval(interval);
  builder.kill('SIGTERM');
  await stopApp();
  process.exit(code);
};

builder.on('exit', async (code) => {
  clearInterval(interval);
  await stopApp();
  process.exit(code ?? 1);
});

process.on('SIGINT', () => {
  void shutdown(0);
});

process.on('SIGTERM', () => {
  void shutdown(0);
});
