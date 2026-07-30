#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const defaultJsonPath = path.resolve(process.cwd(), 'audit/marketing-audit.json');
const defaultMdPath = path.resolve(process.cwd(), 'audit/marketing-audit.md');
const expectedPrimaryCta = process.env.EXPECTED_MARKETING_PRIMARY_CTA || 'Book demo';
const currentHeroPng = '/marketing/product-routing.png';
const currentHeroWebpPattern =
  /^\/marketing\/product-routing(?:-(?:640|768))?\.webp$/;
const staleMedia = [
  '/marketing/hero-route-command-center.png',
  '/marketing/hero-route-command-center-v2.png',
  '/marketing/hero-route-command-center-v2.avif',
  '/marketing/jobs-queue.png',
  '/marketing/dispatch-exceptions.png',
  '/marketing/dispatch-board.png',
  '/marketing/routing-workspace.png',
  '/marketing/routing-workspace-dotted.png',
];

function readArg(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? path.resolve(process.argv[index + 1]) : fallback;
}

function normalizeAssetPath(src) {
  if (!src) return '';
  try {
    return new URL(src, 'http://127.0.0.1').pathname;
  } catch {
    return src;
  }
}

function fail(message, details = undefined) {
  failures.push({ message, details });
}

function findRoute(audit, route) {
  return audit.results?.find((item) => item.route === route);
}

function screenshotImages(routeResult) {
  return (routeResult?.screenshotImages || [])
    .filter((image) => !image.allowRepeat)
    .map((image) => ({
      ...image,
      src: normalizeAssetPath(image.src),
      currentSrc: normalizeAssetPath(image.currentSrc),
      alt: image.alt || '',
    }));
}

function repeatedSrcs(images) {
  const bySrc = new Map();
  for (const image of images) {
    if (!image.src) continue;
    bySrc.set(image.src, (bySrc.get(image.src) || 0) + 1);
  }
  return Array.from(bySrc.entries())
    .filter(([, count]) => count > 1)
    .map(([src, count]) => ({ src, count }));
}

function markdownSection(markdownText, heading) {
  const start = markdownText.indexOf(`## ${heading}`);
  if (start < 0) return '';
  const next = markdownText.indexOf('\n## ', start + 1);
  return markdownText.slice(start, next < 0 ? markdownText.length : next);
}

const failures = [];
const jsonPath = readArg('--json', process.env.MARKETING_AUDIT_JSON ? path.resolve(process.env.MARKETING_AUDIT_JSON) : defaultJsonPath);
const mdPath = readArg('--md', process.env.MARKETING_AUDIT_MD ? path.resolve(process.env.MARKETING_AUDIT_MD) : defaultMdPath);

if (!existsSync(jsonPath)) {
  fail(`Missing marketing audit JSON at ${jsonPath}`);
}
if (!existsSync(mdPath)) {
  fail(`Missing marketing audit markdown at ${mdPath}`);
}

let audit = null;
let jsonText = '';
let markdown = '';
if (!failures.length) {
  jsonText = readFileSync(jsonPath, 'utf8');
  markdown = readFileSync(mdPath, 'utf8');
  audit = JSON.parse(jsonText);
}

if (audit) {
  for (const staleSource of staleMedia) {
    if (jsonText.includes(staleSource)) {
      fail('Stale marketing screenshot path exists in marketing-audit.json', staleSource);
    }
  }

  const home = findRoute(audit, '/');
  const demo = findRoute(audit, '/demo');
  if (!home) fail('Homepage route result is missing from marketing-audit.json');
  if (!demo) fail('Demo route result is missing from marketing-audit.json');

  const homeImages = screenshotImages(home);
  const demoImages = screenshotImages(demo);
  const homeHero = homeImages.find((image) => image.src === currentHeroPng);
  if (!homeHero) {
    fail('Homepage is missing the canonical current hero PNG source', currentHeroPng);
  } else if (!currentHeroWebpPattern.test(homeHero.currentSrc)) {
    fail('Homepage hero currentSrc does not resolve to the responsive WebP family', {
      expected: String(currentHeroWebpPattern),
      actual: homeHero.currentSrc,
    });
  }

  for (const result of audit.results || []) {
    if (result.primaryCta !== expectedPrimaryCta) {
      fail('Primary CTA mismatch in route result', {
        route: result.route,
        expected: expectedPrimaryCta,
        actual: result.primaryCta,
      });
    }
    if (result.screenshotFindings?.length) {
      fail('Route has screenshot findings in marketing-audit.json', {
        route: result.route,
        findings: result.screenshotFindings,
      });
    }
  }

  const homeRepeats = repeatedSrcs(homeImages);
  if (homeRepeats.length) {
    fail('Homepage has repeated screenshot src values', homeRepeats);
  }
  const demoRepeats = repeatedSrcs(demoImages);
  if (demoRepeats.length) {
    fail('Demo page has repeated screenshot src values', demoRepeats);
  }

  const altBySrc = new Map();
  for (const result of audit.results || []) {
    for (const image of screenshotImages(result)) {
      if (!image.src || !image.alt) continue;
      if (!altBySrc.has(image.src)) altBySrc.set(image.src, new Set());
      altBySrc.get(image.src).add(image.alt);
    }
  }
  for (const [src, altTexts] of altBySrc.entries()) {
    if (altTexts.size > 1) {
      fail('Same screenshot src is used with conflicting alt text', {
        src,
        altTexts: Array.from(altTexts),
      });
    }
  }

  if (audit.crossSiteScreenshotFindings?.length) {
    fail('Cross-site screenshot findings are not empty', audit.crossSiteScreenshotFindings);
  }
}

if (markdown) {
  if (!markdown.includes('## Cross-Site Screenshot Findings') || !markdown.includes('- 0 findings')) {
    fail('marketing-audit.md does not show an explicit Cross-Site Screenshot Findings section with 0 findings');
  }
  const routeInventory = markdownSection(markdown, 'Route Inventory');
  const routeInventoryRows = routeInventory
    .split('\n')
    .filter((line) => line.startsWith('| /'));
  const nonBookDemoRows = routeInventoryRows.filter((line) => !line.includes(`| ${expectedPrimaryCta} |`));
  if (nonBookDemoRows.length) {
    fail('marketing-audit.md route inventory contains primary CTA rows that are not Book demo', nonBookDemoRows);
  }
}

if (failures.length) {
  console.error('Marketing artifact assertions failed:');
  for (const failure of failures) {
    console.error(`- ${failure.message}`);
    if (failure.details !== undefined) {
      console.error(JSON.stringify(failure.details, null, 2));
    }
  }
  process.exit(1);
}

console.log(`Marketing artifact assertions passed: current responsive hero present, stale media absent, ${expectedPrimaryCta} primary CTA verified, duplicate screenshot checks clean.`);
