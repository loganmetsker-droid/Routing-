#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseUrl = process.env.MARKETING_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5185';
const auditRoot = path.resolve(process.cwd(), 'audit');
const screenshotRoot = path.join(auditRoot, 'screenshots');

const staticRoutes = [
  '/',
  '/platform',
  '/platform/plan',
  '/platform/dispatch',
  '/platform/drive',
  '/platform/track',
  '/platform/proof',
  '/demo',
  '/pricing',
  '/testimonials',
  '/security',
  '/resources',
  '/resources/downloads',
  '/support',
  '/company',
  '/mission',
  '/careers',
  '/legal/privacy',
  '/legal/terms',
  '/legal/cookies',
  '/legal/exercise-rights',
];

const viewportSpecs = [
  { label: 'desktop', width: 1440, height: 1000, deviceScaleFactor: 2 },
  { label: 'tablet', width: 768, height: 1024, deviceScaleFactor: 2 },
  { label: 'mobile', width: 390, height: 844, deviceScaleFactor: 3 },
];

const expectedPrimaryCta = 'Book demo';
const heroV2Sources = new Set([
  '/marketing/product-routing.png',
]);
const oldHeroSources = new Set([
  '/marketing/hero-route-command-center.png',
  '/marketing/hero-route-command-center-v2.png',
  '/marketing/hero-route-command-center-v2.avif',
]);
const planningScreenshotSources = new Set([
  '/marketing/product-routing.png',
  '/marketing/product-routing-all-routes.png',
  '/marketing/product-routing-density.png',
  '/marketing/routing-workspace.png',
  '/marketing/routing-workspace-dotted.png',
  '/marketing/routing-multistop-workspace.png',
  '/marketing/routing-multistop-workspace-dotted.png',
  '/marketing/hero-route-command-center.png',
  '/marketing/hero-route-command-center-v2.png',
  '/marketing/hero-route-command-center-v2.avif',
]);

function absoluteUrl(routePath) {
  return new URL(routePath, baseUrl).toString();
}

function routeSlug(routePath) {
  return routePath === '/' ? 'home' : routePath.replace(/^\/+/, '').replace(/[^\w]+/g, '-').replace(/-$/, '');
}

function normalizeAssetPath(src) {
  if (!src) return '';
  try {
    const parsed = new URL(src, baseUrl);
    return parsed.pathname;
  } catch {
    return src;
  }
}

function groupBy(items, getKey) {
  const groups = new Map();
  for (const item of items) {
    const key = getKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function getRouteScreenshotFindings(routePath, screenshotImages, data) {
  const auditImages = screenshotImages.filter((image) => !image.allowRepeat);
  const bySrc = groupBy(auditImages, (image) => image.src);
  const findings = [];

  for (const [src, images] of bySrc.entries()) {
    const altVariants = Array.from(new Set(images.map((image) => image.alt).filter(Boolean)));
    if (images.length > 1) {
      findings.push({
        type: 'repeated-screenshot-src',
        route: routePath,
        src,
        count: images.length,
        altVariants,
      });
    }
    if (images.length > 2) {
      findings.push({
        type: 'product-screenshot-overused-on-route',
        route: routePath,
        src,
        count: images.length,
        altVariants,
      });
    }
    if (routePath === '/' && images.length > 1 && planningScreenshotSources.has(src)) {
      findings.push({
        type: 'homepage-screenshot-repetition',
        route: routePath,
        src,
        count: images.length,
        altVariants,
      });
    }
    if (routePath === '/demo' && images.length > 1) {
      findings.push({
        type: 'demo-chapter-screenshot-repetition',
        route: routePath,
        src,
        count: images.length,
        altVariants,
      });
    }
  }

  const srcSet = new Set(auditImages.flatMap((image) => [image.src, image.currentSrc].filter(Boolean)));
  if (routePath === '/' && !Array.from(srcSet).some((src) => heroV2Sources.has(src))) {
    findings.push({
      type: 'homepage-missing-final-hero-v2',
      route: routePath,
      expected: Array.from(heroV2Sources),
      found: Array.from(srcSet),
    });
  }

  if (Array.from(srcSet).some((src) => oldHeroSources.has(src))) {
    findings.push({
      type: 'old-hero-screenshot-reference',
      route: routePath,
      src: Array.from(srcSet).filter((src) => oldHeroSources.has(src)),
    });
  }

  if (routePath === '/' && bySrc.get('/marketing/routing-workspace-dotted.png')?.length > 1) {
    findings.push({
      type: 'homepage-routing-workspace-dotted-repetition',
      route: routePath,
      src: '/marketing/routing-workspace-dotted.png',
      count: bySrc.get('/marketing/routing-workspace-dotted.png').length,
    });
  }

  if (routePath === '/demo' && bySrc.get('/marketing/routing-workspace-dotted.png')?.length > 1) {
    findings.push({
      type: 'demo-routing-workspace-dotted-repetition',
      route: routePath,
      src: '/marketing/routing-workspace-dotted.png',
      count: bySrc.get('/marketing/routing-workspace-dotted.png').length,
    });
  }

  if (data.primaryCta && data.primaryCta !== expectedPrimaryCta) {
    findings.push({
      type: 'primary-cta-mismatch',
      route: routePath,
      expected: expectedPrimaryCta,
      actual: data.primaryCta,
    });
  }

  return findings;
}

function buildCrossSiteScreenshotUsage(results) {
  const usage = new Map();
  for (const result of results) {
    for (const image of result.screenshotImages.filter((item) => !item.allowRepeat)) {
      if (!usage.has(image.src)) {
        usage.set(image.src, {
          src: image.src,
          count: 0,
          routes: new Set(),
          altTexts: new Set(),
        });
      }
      const entry = usage.get(image.src);
      entry.count += 1;
      entry.routes.add(result.route);
      if (image.alt) entry.altTexts.add(image.alt);
    }
  }

  const report = Array.from(usage.values()).map((entry) => ({
    src: entry.src,
    count: entry.count,
    routes: Array.from(entry.routes).sort(),
    altTexts: Array.from(entry.altTexts).sort(),
  })).sort((left, right) => right.count - left.count || left.src.localeCompare(right.src));

  const findings = report
    .filter((entry) => entry.altTexts.length > 1)
    .map((entry) => ({
      type: 'same-image-different-alt',
      src: entry.src,
      count: entry.count,
      routes: entry.routes,
      altVariants: entry.altTexts,
    }));

  return { report, findings };
}

async function installPageGuards(page, errors) {
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push({ type: 'console', text: message.text() });
  });
  page.on('pageerror', (error) => errors.push({ type: 'pageerror', text: error.message }));
  await page.addInitScript(() => {
    window.localStorage.setItem('trovan-cookie-preferences', JSON.stringify({ essential: true, analytics: false, marketing: false }));
  });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
        scroll-behavior: auto !important;
      }
      input, textarea { caret-color: transparent !important; }
    `,
  }).catch(() => {});
}

async function collectDiscoveredLinks(page) {
  await page.goto(absoluteUrl('/'), { waitUntil: 'networkidle' });
  for (const label of ['Product', 'Solutions', 'Resources', 'Company']) {
    const button = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') });
    if (await button.count()) {
      await button.first().click().catch(() => {});
      await page.waitForTimeout(100);
    }
  }

  const hrefs = await page.locator('a[href]').evaluateAll((links) =>
    links
      .map((link) => link.getAttribute('href') || '')
      .filter((href) => href.startsWith('/') && !href.startsWith('//')),
  );

  return Array.from(new Set([...staticRoutes, ...hrefs])).filter((href) => !href.startsWith('/login'));
}

async function loadLazyImages(page) {
  await page.evaluate(async () => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const maxScroll = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    for (let y = 0; y <= maxScroll; y += Math.max(window.innerHeight * 0.75, 480)) {
      window.scrollTo(0, y);
      await delay(60);
    }
    window.scrollTo(0, 0);
    await Promise.all(
      Array.from(document.images).map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
          setTimeout(resolve, 2000);
        });
      }),
    );
  });
}

async function inspectRoute(routePath) {
  const errors = [];
  const browserContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
  });
  const page = await browserContext.newPage();
  await installPageGuards(page, errors);
  const response = await page.goto(absoluteUrl(routePath), { waitUntil: 'networkidle' }).catch((error) => {
    errors.push({ type: 'navigation', text: error.message });
    return null;
  });
  await page.locator('#root').waitFor({ state: 'visible', timeout: 10_000 }).catch((error) => {
    errors.push({ type: 'root', text: error.message });
  });
  await loadLazyImages(page);

  const data = await page.evaluate(() => {
    const visibleText = (element) => {
      const htmlElement = element;
      const style = window.getComputedStyle(htmlElement);
      return style.display !== 'none' && style.visibility !== 'hidden' && htmlElement.getBoundingClientRect().width > 0;
    };
    const h1 = Array.from(document.querySelectorAll('h1')).map((node) => node.textContent?.trim()).find(Boolean) || '';
    const ctas = Array.from(document.querySelectorAll('a, button'))
      .filter((node) => visibleText(node))
      .map((node) => node.textContent?.trim().replace(/\s+/g, ' ') || node.getAttribute('aria-label') || '')
      .filter((text) => /Book demo|Get a free route audit|Watch product walkthrough|Request access|Cookie preferences/i.test(text));
    const brokenLinks = Array.from(document.querySelectorAll('a')).filter((link) => {
      const href = link.getAttribute('href');
      return href === '' || href === '#';
    }).map((link) => link.textContent?.trim() || link.getAttribute('aria-label') || 'unnamed link');
    const buttonsWithoutNames = Array.from(document.querySelectorAll('button')).filter((button) => {
      const label = button.textContent?.trim() || button.getAttribute('aria-label');
      return !label;
    }).length;
    const images = Array.from(document.querySelectorAll('img')).map((image) => ({
      src: image.getAttribute('src') || '',
      currentSrc: image.currentSrc || '',
      alt: image.getAttribute('alt') || '',
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      objectFit: window.getComputedStyle(image).objectFit,
      allowRepeat: Boolean(image.closest('[data-audit-allow-repeat="true"]')),
    }));
    const missingAlt = images.filter((image) => !image.alt && image.src.includes('/marketing/')).map((image) => image.src);
    const brokenImages = images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src);
    return {
      title: document.title,
      h1,
      primaryCta: ctas[0] || '',
      visibleCtas: ctas,
      imageCount: images.length,
      screenshotImages: images.filter((image) => image.src.includes('/marketing/')),
      missingAlt,
      brokenImages,
      brokenLinks,
      buttonsWithoutNames,
      layout: {
        scrollHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        screenfuls: Number(
          (document.documentElement.scrollHeight / window.innerHeight).toFixed(1),
        ),
        horizontalOverflow:
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth + 2,
      },
    };
  });

  data.screenshotImages = data.screenshotImages.map((image) => ({
    ...image,
    src: normalizeAssetPath(image.src),
    currentSrc: normalizeAssetPath(image.currentSrc),
  }));
  data.missingAlt = data.missingAlt.map(normalizeAssetPath);
  data.brokenImages = data.brokenImages.map(normalizeAssetPath);

  const screenshotFindings = getRouteScreenshotFindings(routePath, data.screenshotImages, data);

  await page.screenshot({ path: path.join(screenshotRoot, `${routeSlug(routePath)}-desktop.png`), fullPage: true });
  await browserContext.close();

  return {
    url: absoluteUrl(routePath),
    route: routePath,
    status: response?.status() ?? null,
    ...data,
    screenshotFindings,
    consoleErrors: errors,
  };
}

async function captureResponsiveScreenshots(routePath) {
  const captures = [];
  for (const spec of viewportSpecs.slice(1)) {
    const context = await browser.newContext({
      viewport: { width: spec.width, height: spec.height },
      deviceScaleFactor: spec.deviceScaleFactor,
    });
    const page = await context.newPage();
    const errors = [];
    await installPageGuards(page, errors);
    await page.goto(absoluteUrl(routePath), { waitUntil: 'networkidle' }).catch(() => {});
    await loadLazyImages(page);
    const layout = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      screenfuls: Number(
        (document.documentElement.scrollHeight / window.innerHeight).toFixed(1),
      ),
      horizontalOverflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 2,
    }));
    await page.screenshot({ path: path.join(screenshotRoot, `${routeSlug(routePath)}-${spec.label}.png`), fullPage: true });
    captures.push({ viewport: spec.label, ...layout, consoleErrors: errors });
    await context.close();
  }
  return captures;
}

function writeMarkdownReport(results, crossSiteScreenshotUsage, crossSiteScreenshotFindings) {
  const broken = results.filter((item) => item.status !== 200 || item.consoleErrors.length || item.brokenImages.length || item.brokenLinks.length || item.missingAlt.length || item.screenshotFindings.length || item.responsiveFindings.length);
  const lines = [
    '# TryTrovan Marketing Site Audit',
    '',
    `Base URL: ${baseUrl}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    `Routes checked: ${results.length}`,
    `Routes with findings: ${broken.length}`,
    `Cross-site screenshot findings: ${crossSiteScreenshotFindings.length}`,
    '',
    '## Route Inventory',
    '',
    '| Route | Status | H1 | Primary CTA | Images | Findings |',
    '|---|---:|---|---|---:|---|',
    ...results.map((item) => {
      const findings = [
        item.consoleErrors.length ? `${item.consoleErrors.length} console errors` : '',
        item.brokenImages.length ? `${item.brokenImages.length} broken images` : '',
        item.missingAlt.length ? `${item.missingAlt.length} missing screenshot alt` : '',
        item.brokenLinks.length ? `${item.brokenLinks.length} broken links` : '',
        item.buttonsWithoutNames ? `${item.buttonsWithoutNames} unnamed buttons` : '',
        item.screenshotFindings.length ? `${item.screenshotFindings.length} screenshot repetition findings` : '',
        item.responsiveFindings.length ? `${item.responsiveFindings.length} responsive findings` : '',
      ].filter(Boolean).join(', ') || 'none';
      return `| ${item.route} | ${item.status ?? 'n/a'} | ${item.h1.replace(/\|/g, '/')} | ${item.primaryCta.replace(/\|/g, '/')} | ${item.imageCount} | ${findings} |`;
    }),
    '',
    '## CTA Map',
    '',
    '- Primary global CTA: Book demo',
    '- Secondary global CTA: Get a free route audit',
    '- Demo CTA: Watch product walkthrough unless a real clickable guided tour is being used',
    '- Starter/Launch setup: reviewed before activation; no self-serve checkout is implied',
    '',
    '## Screenshot Usage',
    '',
    '| Image src | Uses | Routes | Alt text variants |',
    '|---|---:|---|---:|',
    ...crossSiteScreenshotUsage.map((item) =>
      `| ${item.src} | ${item.count} | ${item.routes.join(', ')} | ${item.altTexts.length} |`,
    ),
    '',
    '## Cross-Site Screenshot Findings',
    '',
    crossSiteScreenshotFindings.length ? '' : '- 0 findings',
    '',
  ];

  if (crossSiteScreenshotFindings.length) {
    lines.push(
      ...crossSiteScreenshotFindings.map((finding) =>
        `- ${finding.type}: ${finding.src} appears with ${finding.altVariants.length} alt variants across ${finding.routes.join(', ')}`,
      ),
      '',
    );
  }

  writeFileSync(path.join(auditRoot, 'marketing-audit.md'), `${lines.join('\n')}\n`, 'utf8');
}

mkdirSync(screenshotRoot, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const discoveryContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const discoveryPage = await discoveryContext.newPage();
  const discoveryErrors = [];
  await installPageGuards(discoveryPage, discoveryErrors);
  const routes = await collectDiscoveredLinks(discoveryPage);
  await discoveryContext.close();

  const results = [];
  for (const routePath of routes) {
    const result = await inspectRoute(routePath);
    result.responsive = await captureResponsiveScreenshots(routePath);
    result.responsiveFindings = [];
    const mobile = result.responsive.find((capture) => capture.viewport === 'mobile');
    if (routePath === '/' && mobile?.screenfuls > 12) {
      result.responsiveFindings.push({
        type: 'homepage-mobile-content-density',
        screenfuls: mobile.screenfuls,
        maximum: 12,
      });
    }
    if (result.layout.horizontalOverflow || result.responsive.some((capture) => capture.horizontalOverflow)) {
      result.responsiveFindings.push({
        type: 'horizontal-overflow',
      });
    }
    results.push(result);
  }

  const { report: crossSiteScreenshotUsage, findings: crossSiteScreenshotFindings } = buildCrossSiteScreenshotUsage(results);

  writeFileSync(path.join(auditRoot, 'marketing-audit.json'), JSON.stringify({
    baseUrl,
    routes,
    crossSiteScreenshotUsage,
    crossSiteScreenshotFindings,
    results,
  }, null, 2), 'utf8');
  writeMarkdownReport(results, crossSiteScreenshotUsage, crossSiteScreenshotFindings);

  const failureCount = results.filter((item) => item.status !== 200 || item.consoleErrors.length || item.brokenImages.length || item.brokenLinks.length || item.missingAlt.length || item.screenshotFindings.length || item.responsiveFindings.length).length;
  console.log(`Marketing audit complete: ${results.length} routes, ${failureCount} routes with findings, ${crossSiteScreenshotFindings.length} cross-site screenshot findings.`);
  if (failureCount || crossSiteScreenshotFindings.length) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
