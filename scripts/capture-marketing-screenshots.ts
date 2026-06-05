#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from '@playwright/test';

const baseUrl = process.env.CAPTURE_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5185';
const outputRoot = path.resolve(process.cwd(), 'audit', 'marketing-captures');
const pngRoot = path.join(outputRoot, 'png');
const webpRoot = path.join(outputRoot, 'webp');
const avifRoot = path.join(outputRoot, 'avif');

type CaptureTarget = {
  filename: string;
  route: string;
  selector: string;
  altText: string;
  placement: string;
  viewport?: { width: number; height: number; deviceScaleFactor: number };
};

const desktop = { width: 1440, height: 1000, deviceScaleFactor: 2 };
const mobile = { width: 390, height: 844, deviceScaleFactor: 3 };

const targets: CaptureTarget[] = [
  {
    filename: 'plan-workspace.png',
    route: '/platform/plan',
    selector: '[data-testid="product-app-frame"]',
    altText: 'Trovan planning workspace with imported stops, route lanes, constraints, and connected map paths',
    placement: 'Product Plan page hero and homepage route-day command center',
  },
  {
    filename: 'dispatch-board.png',
    route: '/platform/dispatch',
    selector: '[data-testid="product-app-frame"]',
    altText: 'Trovan dispatch board with live route progress, driver status, and exception flags',
    placement: 'Product Dispatch page hero',
  },
  {
    filename: 'route-rebalance.png',
    route: '/demo',
    selector: '[data-testid="route-rebalance-staged-animation"]',
    altText: 'Trovan route rebalance staged overlay showing planned route, exception, and rebalanced route states',
    placement: 'Homepage and demo route rebalance section',
  },
  {
    filename: 'driver-app-next-stop.png',
    route: '/platform/drive',
    selector: '[aria-label="Trovan Driver mobile app preview"]',
    altText: 'Trovan Driver mobile app showing next stop details, route notes, and completion actions',
    placement: 'Driver app workflow page',
    viewport: mobile,
  },
  {
    filename: 'driver-proof.png',
    route: '/platform/drive',
    selector: '[aria-label="Trovan Driver mobile app preview"]',
    altText: 'Trovan Driver mobile proof workflow for notes, signatures, photos, documents, and completion state',
    placement: 'Proof and driver-app sections',
    viewport: mobile,
  },
  {
    filename: 'customer-tracking.png',
    route: '/platform/track',
    selector: '[data-testid="product-app-frame"]',
    altText: 'Trovan customer tracking page with ETA, delivery status timeline, and support context',
    placement: 'Customer tracking workflow page',
  },
  {
    filename: 'proof-summary.png',
    route: '/platform/proof',
    selector: '[data-testid="product-app-frame"]',
    altText: 'Trovan proof summary with completed route timestamps, notes, exceptions, and delivery records',
    placement: 'Proof and analytics workflow page',
  },
  {
    filename: 'fleet-manager-overview.png',
    route: '/platform',
    selector: '[data-testid="product-app-frame"]',
    altText: 'Trovan fleet manager overview with route-day progress, utilization, exceptions, and proof visibility',
    placement: 'Fleet manager solution and platform overview',
  },
];

function urlFor(route: string) {
  return new URL(route, baseUrl).toString();
}

async function preparePage(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('trovan-cookie-preferences', JSON.stringify({ essential: true, analytics: false, marketing: false }));
    const style = document.createElement('style');
    style.setAttribute('data-capture-style', 'true');
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
        scroll-behavior: auto !important;
      }
      input, textarea { caret-color: transparent !important; }
    `;
    document.documentElement.appendChild(style);
  });
}

function convertToOptimized(pngPath: string, webpPath: string, avifPath: string) {
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', pngPath, '-c:v', 'libwebp', '-quality', '92', webpPath], { stdio: 'ignore' });
    return { webp: existsSync(webpPath) ? webpPath : null, avif: null };
  } catch {
    try {
      execFileSync('sips', ['-s', 'format', 'avif', pngPath, '--out', avifPath], { stdio: 'ignore' });
      return { webp: null, avif: existsSync(avifPath) ? avifPath : null };
    } catch {
      return { webp: null, avif: null };
    }
  }
}

mkdirSync(pngRoot, { recursive: true });
mkdirSync(webpRoot, { recursive: true });
mkdirSync(avifRoot, { recursive: true });

const manifest: Array<Record<string, unknown>> = [];
const browser = await chromium.launch({ headless: true });

try {
  for (const target of targets) {
    const viewport = target.viewport ?? desktop;
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.deviceScaleFactor,
      colorScheme: 'light',
    });
    const page = await context.newPage();
    await preparePage(page);
    await page.goto(urlFor(target.route), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts?.ready);
    await page.locator(target.selector).first().waitFor({ state: 'visible', timeout: 15_000 });
    const locator = page.locator(target.selector).first();
    await locator.scrollIntoViewIfNeeded();
    const pngPath = path.join(pngRoot, target.filename);
    await locator.screenshot({ path: pngPath });

    const imageMeta = await locator.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { width: Math.round(box.width), height: Math.round(box.height) };
    });

    const webpFilename = target.filename.replace(/\.png$/, '.webp');
    const webpPath = path.join(webpRoot, webpFilename);
    const avifFilename = target.filename.replace(/\.png$/, '.avif');
    const avifPath = path.join(avifRoot, avifFilename);
    const optimized = convertToOptimized(pngPath, webpPath, avifPath);

    manifest.push({
      ...target,
      routeUrl: urlFor(target.route),
      png: pngPath,
      webp: optimized.webp,
      avif: optimized.avif,
      renderedWidth: imageMeta.width,
      renderedHeight: imageMeta.height,
      deviceScaleFactor: viewport.deviceScaleFactor,
    });

    await context.close();
  }

  writeFileSync(path.join(outputRoot, 'manifest.json'), JSON.stringify({ baseUrl, generatedAt: new Date().toISOString(), captures: manifest }, null, 2), 'utf8');
  console.log(`Captured ${manifest.length} marketing screenshot states to ${outputRoot}`);
} finally {
  await browser.close();
}
