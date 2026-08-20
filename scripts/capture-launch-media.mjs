#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const baseUrl = process.env.LAUNCH_MEDIA_BASE_URL || 'http://127.0.0.1:5197';
const outputRoot = path.resolve(process.cwd(), 'frontend/public/marketing');
const videoTempRoot = mkdtempSync(path.join(tmpdir(), 'trovan-launch-media-'));

const desktopCaptures = [
  { route: '/dashboard', filename: 'product-dashboard.png' },
  { route: '/routing', filename: 'product-routing.png' },
  { route: '/dispatch', filename: 'product-dispatch.png' },
  { route: '/route-runs/route-alpha-001', filename: 'product-route-run.png' },
  { route: '/tracking', filename: 'product-tracking.png' },
  { route: '/pod', filename: 'product-proof.png' },
];

const mobileCaptures = [
  { route: '/driver/route-runs/route-alpha-001', filename: 'product-driver-mobile.png' },
  { route: '/track/demo-token', filename: 'product-customer-tracking-mobile.png' },
];

const responsiveScreenshotFiles = [
  ...desktopCaptures.map((capture) => capture.filename),
  ...mobileCaptures.map((capture) => capture.filename),
  'product-routing-all-routes.png',
  'product-routing-density.png',
  'product-routing-exceptions.png',
  'trovan-product-tour-poster.png',
];

const tourChapters = [
  { route: '/dashboard', eyebrow: 'Route-day overview', title: 'See the operating day at a glance' },
  { route: '/routing', eyebrow: 'Plan routes', title: 'Balance lanes before publish' },
  { route: '/dispatch', eyebrow: 'Dispatch live', title: 'Assign drivers and run active routes' },
  { route: '/route-runs/route-alpha-001', eyebrow: 'Route execution', title: 'Keep stop actions and proof together' },
  { route: '/tracking', eyebrow: 'Fleet tracking', title: 'Watch route progress without chasing updates' },
  { route: '/pod', eyebrow: 'Proof of delivery', title: 'Review completion evidence in context' },
  { route: '/track/demo-token', eyebrow: 'Customer visibility', title: 'Share a clear delivery status page' },
];

function absoluteUrl(route) {
  return new URL(route, baseUrl).toString();
}

async function primePage(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('trovan.theme.mode', 'light');
    window.localStorage.setItem('trovan.map.baseStyle', 'streets');
    window.localStorage.removeItem('trovan.shell.sidebarCollapsed');
  });
}

async function visit(page, route) {
  await page.goto(absoluteUrl(route), { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.locator('#root').waitFor({ state: 'visible', timeout: 10_000 });
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
  await page.waitForTimeout(900);
  const failed = await page.getByText('Workspace Failed To Render', { exact: false }).count();
  if (failed > 0) {
    throw new Error(`Workspace failed to render at ${route}`);
  }
}

async function captureScreenshots(browser) {
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
  });
  const desktopPage = await desktopContext.newPage();
  await primePage(desktopPage);
  for (const capture of desktopCaptures) {
    await visit(desktopPage, capture.route);
    await desktopPage.screenshot({ path: path.join(outputRoot, capture.filename) });
  }

  await visit(desktopPage, '/routing');
  const allRoutesButton = desktopPage.getByRole('button', { name: 'All routes', exact: true });
  if (await allRoutesButton.count() === 1) {
    await allRoutesButton.click();
    await desktopPage.waitForTimeout(700);
  }
  await desktopPage.screenshot({ path: path.join(outputRoot, 'product-routing-all-routes.png') });

  await visit(desktopPage, '/routing');
  const densityButton = desktopPage.getByRole('button', { name: 'Route density', exact: true });
  if (await densityButton.count() === 1) {
    await densityButton.click();
    await desktopPage.waitForTimeout(1200);
  }
  await desktopPage.screenshot({ path: path.join(outputRoot, 'product-routing-density.png') });

  await visit(desktopPage, '/routing');
  const exceptionsButton = desktopPage.getByRole('button', { name: 'Exceptions only', exact: true });
  if (await exceptionsButton.count() === 1) {
    await exceptionsButton.click();
    await desktopPage.waitForTimeout(1200);
  }
  await desktopPage.screenshot({ path: path.join(outputRoot, 'product-routing-exceptions.png') });
  await desktopContext.close();

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
  });
  const mobilePage = await mobileContext.newPage();
  await primePage(mobilePage);
  for (const capture of mobileCaptures) {
    await visit(mobilePage, capture.route);
    await mobilePage.screenshot({ path: path.join(outputRoot, capture.filename) });
  }
  await mobileContext.close();
}

async function addChapterOverlay(page, chapter, index) {
  await page.evaluate(
    ({ eyebrow, title, chapterNumber }) => {
      document.querySelector('[data-launch-media-overlay]')?.remove();
      const overlay = document.createElement('section');
      overlay.dataset.launchMediaOverlay = 'true';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.innerHTML = `
        <span>${chapterNumber}</span>
        <div>
          <small>${eyebrow}</small>
          <strong>${title}</strong>
        </div>
      `;
      Object.assign(overlay.style, {
        position: 'fixed',
        left: '28px',
        bottom: '26px',
        zIndex: '2147483647',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        maxWidth: '620px',
        padding: '14px 18px',
        border: '1px solid rgba(244, 174, 112, 0.45)',
        borderRadius: '14px',
        background: 'rgba(12, 9, 7, 0.92)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.34)',
        color: '#fff8ed',
        fontFamily: 'Inter, system-ui, sans-serif',
        backdropFilter: 'blur(14px)',
      });
      const number = overlay.querySelector('span');
      Object.assign(number.style, {
        display: 'grid',
        placeItems: 'center',
        width: '38px',
        height: '38px',
        borderRadius: '50%',
        background: '#a95823',
        fontWeight: '900',
      });
      const small = overlay.querySelector('small');
      Object.assign(small.style, {
        display: 'block',
        color: '#f4ae70',
        fontSize: '11px',
        fontWeight: '900',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      });
      const strong = overlay.querySelector('strong');
      Object.assign(strong.style, {
        display: 'block',
        marginTop: '2px',
        fontSize: '20px',
        lineHeight: '1.2',
      });
      document.body.appendChild(overlay);
    },
    {
      eyebrow: chapter.eyebrow,
      title: chapter.title,
      chapterNumber: String(index + 1).padStart(2, '0'),
    },
  );
}

async function captureTour(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    recordVideo: {
      dir: videoTempRoot,
      size: { width: 1440, height: 900 },
    },
  });
  const page = await context.newPage();
  await primePage(page);
  const video = page.video();

  for (const [index, chapter] of tourChapters.entries()) {
    await visit(page, chapter.route);
    await addChapterOverlay(page, chapter, index);
    await page.waitForTimeout(2_400);
    await page.evaluate(() => window.scrollTo({ top: Math.min(240, document.body.scrollHeight / 5), behavior: 'smooth' }));
    await page.waitForTimeout(900);
  }

  await page.close();
  await context.close();
  const recordedPath = await video.path();
  const outputVideo = path.join(outputRoot, 'trovan-product-tour.mp4');
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      recordedPath,
      '-vf',
      'scale=1280:800:flags=lanczos',
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '24',
      '-pix_fmt',
      'yuv420p',
      '-r',
      '24',
      '-movflags',
      '+faststart',
      '-an',
      outputVideo,
    ],
    { stdio: 'inherit' },
  );
  copyFileSync(
    path.join(outputRoot, 'product-dashboard.png'),
    path.join(outputRoot, 'trovan-product-tour-poster.png'),
  );
  writeFileSync(
    path.join(outputRoot, 'trovan-product-tour.vtt'),
    `WEBVTT\n\n00:00.000 --> 00:05.000\nRoute-day overview: see the operating day at a glance.\n\n00:05.000 --> 00:10.000\nPlan routes: balance lanes before publish.\n\n00:10.000 --> 00:15.000\nDispatch live: assign drivers and run active routes.\n\n00:15.000 --> 00:20.000\nRoute execution: keep stop actions and proof together.\n\n00:20.000 --> 00:25.000\nFleet tracking: watch route progress without chasing updates.\n\n00:25.000 --> 00:30.000\nProof of delivery: review completion evidence in context.\n\n00:30.000 --> 00:36.000\nCustomer visibility: share a clear delivery status page.\n`,
    'utf8',
  );
}

async function optimizeScreenshots() {
  for (const filename of responsiveScreenshotFiles) {
    const inputPath = path.join(outputRoot, filename);
    const stem = filename.replace(/\.png$/, '');
    for (const [suffix, maxWidth] of [['', 1440], ['-640', 640], ['-768', 768]]) {
      await sharp(inputPath)
        .resize({ width: maxWidth, withoutEnlargement: true })
        .webp({ quality: 82, smartSubsample: true, effort: 6 })
        .toFile(path.join(outputRoot, `${stem}${suffix}.webp`));
    }
  }
}

async function main() {
  mkdirSync(outputRoot, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    await captureScreenshots(browser);
    await captureTour(browser);
    await optimizeScreenshots();
  } finally {
    await browser.close();
    rmSync(videoTempRoot, { recursive: true, force: true });
  }
  console.log(`Launch media captured from ${baseUrl} into ${outputRoot}`);
}

await main();
