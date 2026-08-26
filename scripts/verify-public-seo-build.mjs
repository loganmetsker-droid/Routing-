#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptRoot, '..');
const distRoot = path.join(repositoryRoot, 'frontend/dist');
const seoCatalogPath = path.join(
  repositoryRoot,
  'frontend/src/pages/public-site/publicSeo.json',
);
const seoCatalog = JSON.parse(readFileSync(seoCatalogPath, 'utf8'));
const failures = [];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function fail(message) {
  failures.push(message);
}

for (const [route, metadata] of Object.entries(seoCatalog)) {
  const outputPath =
    route === '/'
      ? path.join(distRoot, 'index.html')
      : path.join(distRoot, `${route.replace(/^\/+/, '')}.html`);
  if (!existsSync(outputPath)) {
    fail(`Missing prerendered HTML for ${route}: ${outputPath}`);
    continue;
  }

  const html = readFileSync(outputPath, 'utf8');
  const canonicalUrl = new URL(route, 'https://trytrovan.com').toString();
  const title = escapeHtml(metadata.title);
  const description = escapeHtml(metadata.description);
  for (const expected of [
    `<title>${title}</title>`,
    `content="${description}"`,
    `rel="canonical" href="${canonicalUrl}"`,
    `property="og:url" content="${canonicalUrl}"`,
  ]) {
    if (!html.includes(expected)) {
      fail(`${route} is missing expected raw HTML metadata: ${expected}`);
    }
  }

  const expectedRobots =
    route === '/login'
      ? 'noindex, nofollow'
      : 'index, follow, max-image-preview:large';
  if (!html.includes(`name="robots" content="${expectedRobots}"`)) {
    fail(`${route} has incorrect raw robots metadata.`);
  }
}

const rootHtmlPath = path.join(distRoot, 'index.html');
const loginHtmlPath = path.join(distRoot, 'login.html');
if (
  existsSync(rootHtmlPath) &&
  !readFileSync(rootHtmlPath, 'utf8').includes(
    'imagesizes="(max-width: 900px) 94vw, 980px"',
  )
) {
  fail('Homepage HTML preload does not match the rendered hero image sizes.');
}
if (
  existsSync(loginHtmlPath) &&
  !readFileSync(loginHtmlPath, 'utf8').includes('media="(min-width: 1100px)"')
) {
  fail('Login HTML is missing its desktop-only product image preload.');
}

if (failures.length) {
  console.error('Public SEO build verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Public SEO build verified: ${Object.keys(seoCatalog).length} route-specific HTML shells are crawler-ready.`,
);
