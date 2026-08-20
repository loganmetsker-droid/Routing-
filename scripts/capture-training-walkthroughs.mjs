#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = process.env.TRAINING_CAPTURE_BASE_URL || 'http://127.0.0.1:5197';
const output = path.join(root, 'tmp/training-walkthroughs');
const raw = path.join(output, 'raw');
mkdirSync(raw, { recursive: true });

const desktop = { width: 1280, height: 720 };
const mobile = { width: 390, height: 720 };

const scenes = [
  {
    key: 'academy-overview', role: 'owner', route: '/academy', viewport: desktop,
    actions: [
      { type: 'scroll', y: 250 },
      { type: 'scroll', y: 680 },
      { type: 'scroll', y: 0 },
    ],
  },
  {
    key: 'settings', role: 'owner', route: '/settings', viewport: desktop,
    actions: [
      { type: 'click', role: 'button', name: /Team/ },
      { type: 'click', role: 'button', name: /Operations/ },
      { type: 'click', role: 'button', name: /Overview/ },
    ],
  },
  {
    key: 'drivers', role: 'owner', route: '/drivers', viewport: desktop,
    actions: [
      { type: 'click', role: 'button', name: 'Add Driver', exact: true },
      { type: 'wait', ms: 1_000 },
      { type: 'press', key: 'Escape' },
      { type: 'click', role: 'button', name: 'Filters', exact: true },
      { type: 'click', role: 'button', name: 'Available', exact: true },
      { type: 'click', role: 'button', name: 'All Statuses', exact: true },
    ],
  },
  {
    key: 'vehicles', role: 'owner', route: '/vehicles', viewport: desktop,
    actions: [
      { type: 'click', role: 'button', name: 'Add Vehicle', exact: true },
      { type: 'wait', ms: 1_000 },
      { type: 'press', key: 'Escape' },
      { type: 'click', role: 'button', name: /Cargo van/ },
      { type: 'click', role: 'button', name: /Box truck/ },
      { type: 'click', role: 'button', name: /All 5/ },
    ],
  },
  {
    key: 'customers', role: 'owner', route: '/customers', viewport: desktop,
    actions: [
      { type: 'click', role: 'button', name: 'Add Customer', exact: true },
      { type: 'wait', ms: 1_000 },
      { type: 'press', key: 'Escape' },
      { type: 'click', role: 'button', name: 'Distribution', exact: true },
      { type: 'click', role: 'button', name: 'More Filters', exact: true },
      { type: 'click', role: 'button', name: 'Clear', exact: true },
    ],
  },
  {
    key: 'jobs', role: 'owner', route: '/jobs', viewport: desktop,
    actions: [
      { type: 'click', role: 'button', name: 'Import CSV', exact: true },
      { type: 'wait', ms: 1_500 },
      { type: 'press', key: 'Escape' },
      { type: 'click', role: 'button', name: 'More Filters', exact: true },
    ],
  },
  {
    key: 'routing', role: 'owner', route: '/routing', viewport: desktop,
    actions: [
      { type: 'click', role: 'button', name: 'All routes', exact: true },
      { type: 'click', role: 'button', name: 'Route density', exact: true },
      { type: 'click', role: 'button', name: 'Exceptions only', exact: true },
      { type: 'click', role: 'button', name: 'Selected route', exact: true },
    ],
  },
  {
    key: 'dispatch', role: 'owner', route: '/dispatch', viewport: desktop,
    actions: [
      { type: 'click', role: 'button', name: /Needs attention/ },
      { type: 'click', role: 'button', name: /Delayed/ },
      { type: 'click', role: 'button', name: /All ·/ },
      { type: 'scroll', y: 420 },
    ],
  },
  {
    key: 'route-run', role: 'owner', route: '/route-runs/route-alpha-001', viewport: desktop,
    actions: [
      { type: 'click', role: 'button', name: 'New exception', exact: true },
      { type: 'wait', ms: 1_000 },
      { type: 'press', key: 'Escape' },
      { type: 'scroll', y: 430 },
      { type: 'click', role: 'button', name: 'Add proof', exact: true, index: 0 },
      { type: 'wait', ms: 1_300 },
      { type: 'press', key: 'Escape' },
      { type: 'click', role: 'button', name: 'Add note', exact: true, index: 0 },
    ],
  },
  {
    key: 'proof', role: 'owner', route: '/pod', viewport: desktop,
    actions: [
      { type: 'click', role: 'button', name: 'Filters', exact: true },
      { type: 'click', role: 'button', name: 'Apply Filters', exact: true },
      { type: 'scroll', y: 360 },
    ],
  },
  {
    key: 'tracking', role: 'owner', route: '/tracking', viewport: desktop,
    actions: [
      { type: 'click', role: 'button', name: 'Both', exact: true },
      { type: 'click', role: 'button', name: /Anna Quinn/ },
      { type: 'click', role: 'button', name: /Refresh signals/ },
    ],
  },
  {
    key: 'analytics', role: 'owner', route: '/analytics', viewport: desktop,
    actions: [
      { type: 'click', role: 'button', name: 'View', exact: true },
      { type: 'scroll', y: 420 },
      { type: 'click', role: 'button', name: 'Export', exact: true },
    ],
  },
  {
    key: 'support', role: 'owner', route: '/support', viewport: desktop,
    actions: [
      { type: 'scroll', y: 900 },
      { type: 'click', role: 'textbox', name: 'Search the Trovan knowledge base', exact: true },
      { type: 'wait', ms: 900 },
      { type: 'scroll', y: 1_400 },
    ],
  },
  {
    key: 'driver-workspace', role: 'driver', route: '/driver', viewport: mobile,
    actions: [
      { type: 'click', role: 'link', name: 'Start stop flow', exact: true },
      { type: 'wait', ms: 1_500 },
      { type: 'scroll', y: 360 },
    ],
  },
  {
    key: 'driver-route', role: 'driver', route: '/driver/route-runs/route-alpha-001', viewport: mobile,
    actions: [
      { type: 'click', role: 'button', name: 'Reveal', exact: true },
      { type: 'click', role: 'button', name: 'Location', exact: true },
      { type: 'click', role: 'button', name: 'Arrive', exact: true },
      { type: 'scroll', y: 420 },
    ],
  },
  {
    key: 'driver-help', role: 'driver', route: '/driver/help', viewport: mobile,
    actions: [
      { type: 'scroll', y: 420 },
      { type: 'scroll', y: 900 },
      { type: 'click', role: 'button', name: 'Complete Driver Quick Start', exact: true },
    ],
  },
];

const users = {
  owner: { id: 'preview-owner-user', email: 'owner@trovan.local', role: 'owner', roles: ['OWNER'] },
  driver: { id: 'preview-driver-user', email: 'anna.quinn@trovan.local', role: 'driver', roles: ['DRIVER'] },
};

const durationOf = (file) => Number(execFileSync('ffprobe', [
  '-v', 'error', '-show_entries', 'format=duration',
  '-of', 'default=noprint_wrappers=1:nokey=1', file,
], { encoding: 'utf8' }).trim());

async function preparePage(page, role) {
  await page.addInitScript(({ selectedUser }) => {
    localStorage.removeItem('trovan-preview-state-v2');
    localStorage.removeItem('trovan.shell.sidebarCollapsed');
    localStorage.setItem('trovan.theme.mode', 'light');
    localStorage.setItem('authToken', 'preview-auth-bypass');
    localStorage.setItem('trovan-preview-auth-user', JSON.stringify({
      ...selectedUser,
      authProvider: 'local-config',
      organizationId: 'preview-org',
      sessionId: 'preview-session',
    }));

    const installCursor = () => {
      if (document.querySelector('[data-training-cursor]')) return;
      const cursor = document.createElement('div');
      cursor.dataset.trainingCursor = 'true';
      Object.assign(cursor.style, {
        position: 'fixed', left: '0', top: '0', width: '26px', height: '26px',
        border: '3px solid #fff', borderRadius: '50%', background: '#b97129',
        boxShadow: '0 0 0 3px rgba(7,24,41,.72), 0 5px 18px rgba(0,0,0,.4)',
        transform: 'translate3d(42px,42px,0)', zIndex: '2147483647',
        pointerEvents: 'none', margin: '-13px 0 0 -13px',
      });
      document.documentElement.appendChild(cursor);
      document.addEventListener('pointermove', (event) => {
        cursor.style.transform = `translate3d(${event.clientX}px,${event.clientY}px,0)`;
      }, true);
      document.addEventListener('pointerdown', (event) => {
        const ripple = document.createElement('div');
        Object.assign(ripple.style, {
          position: 'fixed', left: `${event.clientX}px`, top: `${event.clientY}px`,
          width: '24px', height: '24px', margin: '-12px 0 0 -12px', borderRadius: '50%',
          border: '5px solid #f4ae70', background: 'rgba(185,113,41,.24)',
          zIndex: '2147483646', pointerEvents: 'none',
          transition: 'transform 650ms ease-out, opacity 650ms ease-out',
        });
        document.documentElement.appendChild(ripple);
        requestAnimationFrame(() => {
          ripple.style.transform = 'scale(3.8)';
          ripple.style.opacity = '0';
        });
        setTimeout(() => ripple.remove(), 700);
      }, true);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installCursor, { once: true });
    else installCursor();
  }, { selectedUser: users[role] });
}

async function visit(page, route) {
  await page.goto(new URL(route, baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.locator('#root').waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
  await page.waitForTimeout(1_400);
  if (await page.getByText('Workspace Failed To Render', { exact: false }).count()) {
    throw new Error(`Workspace failed to render at ${route}`);
  }
}

async function glideAndClick(page, action) {
  const locator = page.getByRole(action.role, { name: action.name, exact: action.exact }).nth(action.index || 0);
  await locator.waitFor({ state: 'visible', timeout: 10_000 });
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Could not locate ${String(action.name)}`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 36 });
  await page.waitForTimeout(650);
  await page.mouse.down();
  await page.waitForTimeout(140);
  await page.mouse.up();
  await page.waitForTimeout(1_350);
}

async function execute(page, actions) {
  for (const action of actions) {
    if (action.type === 'click') await glideAndClick(page, action);
    if (action.type === 'scroll') {
      await page.mouse.move(1_050, 620, { steps: 24 });
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), action.y);
      await page.waitForTimeout(1_500);
    }
    if (action.type === 'press') {
      await page.keyboard.press(action.key);
      await page.waitForTimeout(1_000);
    }
    if (action.type === 'wait') await page.waitForTimeout(action.ms);
  }
}

async function captureScene(browser, scene) {
  const context = await browser.newContext({
    viewport: scene.viewport,
    colorScheme: 'light',
    deviceScaleFactor: 1,
    recordVideo: { dir: raw, size: scene.viewport },
  });
  const page = await context.newPage();
  await preparePage(page, scene.role);
  const video = page.video();
  await visit(page, scene.route);
  await page.mouse.move(scene.viewport.width * 0.6, scene.viewport.height * 0.25, { steps: 30 });
  await execute(page, scene.actions);
  await page.waitForTimeout(1_500);
  await context.close();
  const recorded = await video.path();
  const target = path.join(output, `${scene.key}.mp4`);
  execFileSync('ffmpeg', [
    '-y', '-i', recorded,
    '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=#071829,fps=30',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', '-an', target,
  ], { stdio: 'ignore' });
  console.log(`${scene.key}: ${durationOf(target).toFixed(1)} seconds`);
}

async function main() {
  const health = await fetch(baseUrl, { signal: AbortSignal.timeout(10_000) });
  if (!health.ok) throw new Error(`Training capture server returned HTTP ${health.status}`);
  const resume = process.env.TRAINING_CAPTURE_RESUME === 'true';
  if (!resume) rmSync(output, { recursive: true, force: true });
  mkdirSync(raw, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
  try {
    for (const scene of scenes) {
      const target = path.join(output, `${scene.key}.mp4`);
      if (resume && existsSync(target) && statSync(target).size > 100_000) {
        console.log(`${scene.key}: reusing completed walkthrough`);
        continue;
      }
      await captureScene(browser, scene);
    }
  } finally {
    await browser.close();
    rmSync(raw, { recursive: true, force: true });
  }
  console.log(`Playwright walkthroughs written to ${output}`);
}

await main();
