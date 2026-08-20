#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = process.env.TRAINING_CAPTURE_BASE_URL || 'http://127.0.0.1:5185';
const output = path.join(root, 'frontend/public/training/guides');
const temp = path.join(root, 'tmp/training-guide-screenshots');
const desktop = { width: 1280, height: 720 };
const mobile = { width: 390, height: 720 };

const shots = [
  { key: 'academy-readiness', role: 'owner', route: '/academy', viewport: desktop, target: { kind: 'text', name: 'Launch readiness' }, label: 'Follow the next readiness action' },
  { key: 'dashboard-navigation', role: 'owner', route: '/dashboard', viewport: desktop, target: { kind: 'role', role: 'link', name: 'Dashboard', exact: true }, label: 'Use the main navigation' },
  { key: 'settings-team', role: 'owner', route: '/settings', viewport: desktop, target: { kind: 'role', role: 'button', name: /Team/ }, label: 'Click Team' },
  { key: 'settings-operations', role: 'owner', route: '/settings', viewport: desktop, target: { kind: 'role', role: 'button', name: /Operations/ }, label: 'Click Operations' },
  { key: 'drivers-add', role: 'owner', route: '/drivers', viewport: desktop, target: { kind: 'role', role: 'button', name: 'Add Driver', exact: true }, label: 'Click Add Driver' },
  { key: 'vehicles-add', role: 'owner', route: '/vehicles', viewport: desktop, target: { kind: 'role', role: 'button', name: 'Add Vehicle', exact: true }, label: 'Click Add Vehicle' },
  { key: 'customers-add', role: 'owner', route: '/customers', viewport: desktop, target: { kind: 'role', role: 'button', name: 'Add Customer', exact: true }, label: 'Click Add Customer' },
  { key: 'jobs-import', role: 'owner', route: '/jobs', viewport: desktop, target: { kind: 'role', role: 'button', name: 'Import CSV', exact: true }, label: 'Click Import CSV' },
  { key: 'routing-exceptions', role: 'owner', route: '/routing', viewport: desktop, target: { kind: 'role', role: 'button', name: 'Exceptions only', exact: true }, label: 'Click Exceptions only' },
  { key: 'routing-selected', role: 'owner', route: '/routing', viewport: desktop, target: { kind: 'role', role: 'button', name: 'Selected route', exact: true }, label: 'Review the selected route' },
  { key: 'dispatch-attention', role: 'owner', route: '/dispatch', viewport: desktop, target: { kind: 'role', role: 'button', name: /Needs attention/ }, label: 'Review Needs attention' },
  { key: 'route-run-exception', role: 'owner', route: '/route-runs/route-alpha-001', viewport: desktop, target: { kind: 'role', role: 'button', name: 'New exception', exact: true }, label: 'Click New exception' },
  { key: 'proof-filters', role: 'owner', route: '/pod', viewport: desktop, target: { kind: 'role', role: 'button', name: 'Filters', exact: true }, label: 'Click Filters' },
  { key: 'driver-start', role: 'driver', route: '/driver', viewport: mobile, target: { kind: 'role', role: 'link', name: 'Start stop flow', exact: true }, label: 'Start the assigned route' },
  {
    key: 'driver-arrive', role: 'driver', route: '/driver/route-runs/route-alpha-001', viewport: mobile,
    before: [
      { role: 'button', name: 'Reveal', exact: true },
      { role: 'button', name: 'Location', exact: true },
    ],
    target: { kind: 'role', role: 'button', name: 'Arrive', exact: true }, label: 'Tap Arrive at the stop',
  },
  { key: 'tracking-view', role: 'owner', route: '/tracking', viewport: desktop, target: { kind: 'role', role: 'button', name: 'Both', exact: true }, label: 'Choose the tracking view' },
  { key: 'analytics-export', role: 'owner', route: '/analytics', viewport: desktop, target: { kind: 'role', role: 'button', name: 'Export', exact: true }, label: 'Export the KPI review' },
  { key: 'support-search', role: 'owner', route: '/support', viewport: desktop, target: { kind: 'role', role: 'textbox', name: 'Search the Trovan knowledge base', exact: true }, label: 'Search by the exact symptom' },
];

const users = {
  owner: { id: 'preview-owner-user', email: 'owner@trovan.local', role: 'owner', roles: ['OWNER'] },
  driver: { id: 'preview-driver-user', email: 'anna.quinn@trovan.local', role: 'driver', roles: ['DRIVER'] },
};

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
  }, { selectedUser: users[role] });
}

async function visit(page, route) {
  await page.goto(new URL(route, baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.locator('#root').waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
  await page.waitForTimeout(1_000);
  if (await page.getByText('Workspace Failed To Render', { exact: false }).count()) throw new Error(`Workspace failed to render at ${route}`);
}

const roleLocator = (page, target) => page.getByRole(target.role, { name: target.name, exact: target.exact }).first();

async function locateTarget(page, target) {
  if (target.kind === 'text') return page.getByText(target.name, { exact: true }).first();
  return roleLocator(page, target);
}

async function annotate(page, target, label) {
  await target.waitFor({ state: 'visible', timeout: 15_000 });
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error(`Could not locate screenshot target: ${label}`);
  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);
  await page.mouse.move(x, y, { steps: 24 });
  await page.evaluate(({ rect, text, pointer }) => {
    document.querySelectorAll('[data-guide-annotation]').forEach((node) => node.remove());
    const outline = document.createElement('div');
    outline.dataset.guideAnnotation = 'true';
    Object.assign(outline.style, {
      position: 'fixed', left: `${Math.max(4, rect.x - 6)}px`, top: `${Math.max(4, rect.y - 6)}px`,
      width: `${rect.width + 12}px`, height: `${rect.height + 12}px`, border: '4px solid #B97129',
      borderRadius: '10px', boxShadow: '0 0 0 3px rgba(255,255,255,.96), 0 8px 25px rgba(7,24,41,.35)',
      pointerEvents: 'none', zIndex: '2147483644', boxSizing: 'border-box',
    });
    const badge = document.createElement('div');
    badge.dataset.guideAnnotation = 'true';
    badge.textContent = `1  ${text}`;
    const below = rect.y < 74;
    Object.assign(badge.style, {
      position: 'fixed', left: `${Math.max(8, Math.min(window.innerWidth - 265, rect.x))}px`,
      top: `${below ? rect.y + rect.height + 16 : Math.max(8, rect.y - 52)}px`,
      maxWidth: '300px', padding: '9px 13px', borderRadius: '8px',
      background: '#071829', color: '#FFF8ED', border: '2px solid #B97129',
      boxShadow: '0 8px 25px rgba(7,24,41,.35)', font: '800 15px/1.25 Arial, sans-serif',
      pointerEvents: 'none', zIndex: '2147483646',
    });
    const cursor = document.createElement('div');
    cursor.dataset.guideAnnotation = 'true';
    Object.assign(cursor.style, {
      position: 'fixed', left: `${pointer.x}px`, top: `${pointer.y}px`, width: '24px', height: '24px',
      margin: '-12px 0 0 -12px', borderRadius: '50%', border: '3px solid #fff', background: '#B97129',
      boxShadow: '0 0 0 3px rgba(7,24,41,.78)', pointerEvents: 'none', zIndex: '2147483647',
    });
    document.documentElement.append(outline, badge, cursor);
  }, { rect: box, text: label, pointer: { x, y } });
  await page.waitForTimeout(300);
}

async function capture(browser, shot) {
  const context = await browser.newContext({ viewport: shot.viewport, colorScheme: 'light', deviceScaleFactor: 1 });
  const page = await context.newPage();
  await preparePage(page, shot.role);
  await visit(page, shot.route);
  for (const action of shot.before || []) {
    const locator = roleLocator(page, action);
    await locator.waitFor({ state: 'visible', timeout: 10_000 });
    await locator.click();
    await page.waitForTimeout(700);
  }
  const target = await locateTarget(page, shot.target);
  await annotate(page, target, shot.label);
  const raw = path.join(temp, `${shot.key}.png`);
  const final = path.join(output, `${shot.key}.png`);
  await page.screenshot({ path: raw, fullPage: false, animations: 'disabled' });
  if (shot.viewport.width === 1280 && shot.viewport.height === 720) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-vf', 'scale=1280:720', final]);
  } else {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-vf', 'scale=390:720,pad=1280:720:(ow-iw)/2:0:color=#071829', final]);
  }
  await context.close();
  console.log(`${shot.key}: ${shot.label}`);
}

async function main() {
  const health = await fetch(baseUrl, { signal: AbortSignal.timeout(10_000) });
  if (!health.ok) throw new Error(`Training capture server returned HTTP ${health.status}`);
  rmSync(output, { recursive: true, force: true });
  rmSync(temp, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  mkdirSync(temp, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
  try {
    for (const shot of shots) await capture(browser, shot);
  } finally {
    await browser.close();
    rmSync(temp, { recursive: true, force: true });
  }
  console.log(`Annotated guide screenshots written to ${output}`);
}

await main();
