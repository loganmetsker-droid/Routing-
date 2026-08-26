#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptRoot, '..');
const distRoot = path.join(repositoryRoot, 'frontend/dist');
const indexPath = path.join(distRoot, 'index.html');
const seoCatalogPath = path.join(
  repositoryRoot,
  'frontend/src/pages/public-site/publicSeo.json',
);
const siteOrigin = 'https://trytrovan.com';
const socialPreviewUrl = `${siteOrigin}/marketing/product-routing.webp`;

if (!existsSync(indexPath)) {
  throw new Error(
    `Missing frontend build at ${indexPath}. Build the frontend before prerendering public metadata.`,
  );
}

const baseHtml = readFileSync(indexPath, 'utf8');
const seoCatalog = JSON.parse(readFileSync(seoCatalogPath, 'utf8'));

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function replaceRequired(html, pattern, replacement, label) {
  if (!pattern.test(html)) {
    throw new Error(`Could not find ${label} while prerendering public metadata.`);
  }
  return html.replace(pattern, replacement);
}

function setMeta(html, selectorPattern, replacement, label) {
  return replaceRequired(
    html,
    selectorPattern,
    replacement,
    `<${label}>`,
  );
}

function addRoutePreload(html, route) {
  if (route !== '/' && route !== '/login') return html;
  const isLogin = route === '/login';
  const preload = [
    '    <link',
    '      rel="preload"',
    '      as="image"',
    '      href="/marketing/product-routing-768.webp"',
    '      type="image/webp"',
    ...(isLogin ? ['      media="(min-width: 1100px)"'] : []),
    '      imagesrcset="/marketing/product-routing-768.webp 768w, /marketing/product-routing.webp 1440w"',
    `      imagesizes="${isLogin ? '54vw' : '(max-width: 900px) 94vw, 980px'}"`,
    '      fetchpriority="high"',
    '    />',
  ].join('\n');
  return html.replace('</head>', `${preload}\n  </head>`);
}

function renderRouteHtml(route, metadata) {
  const canonicalUrl = new URL(route, siteOrigin).toString();
  const title = escapeHtml(metadata.title);
  const description = escapeHtml(metadata.description);
  const robots =
    route === '/login'
      ? 'noindex, nofollow'
      : 'index, follow, max-image-preview:large';

  let html = baseHtml;
  html = replaceRequired(
    html,
    /<title>[\s\S]*?<\/title>/i,
    `<title>${title}</title>`,
    'title',
  );
  html = setMeta(
    html,
    /<meta\s+name="description"[^>]*>/i,
    `<meta name="description" content="${description}" />`,
    'meta name="description"',
  );
  html = setMeta(
    html,
    /<meta\s+name="robots"[^>]*>/i,
    `<meta name="robots" content="${robots}" />`,
    'meta name="robots"',
  );
  html = replaceRequired(
    html,
    /<link\s+rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${canonicalUrl}" />`,
    'canonical link',
  );
  html = setMeta(
    html,
    /<meta\s+property="og:title"[^>]*>/i,
    `<meta property="og:title" content="${title}" />`,
    'meta property="og:title"',
  );
  html = setMeta(
    html,
    /<meta\s+property="og:description"[^>]*>/i,
    `<meta property="og:description" content="${description}" />`,
    'meta property="og:description"',
  );
  html = setMeta(
    html,
    /<meta\s+property="og:url"[^>]*>/i,
    `<meta property="og:url" content="${canonicalUrl}" />`,
    'meta property="og:url"',
  );
  html = setMeta(
    html,
    /<meta\s+property="og:image"[^>]*>/i,
    `<meta property="og:image" content="${socialPreviewUrl}" />`,
    'meta property="og:image"',
  );
  html = setMeta(
    html,
    /<meta\s+name="twitter:title"[^>]*>/i,
    `<meta name="twitter:title" content="${title}" />`,
    'meta name="twitter:title"',
  );
  html = setMeta(
    html,
    /<meta\s+name="twitter:description"[^>]*>/i,
    `<meta name="twitter:description" content="${description}" />`,
    'meta name="twitter:description"',
  );
  html = setMeta(
    html,
    /<meta\s+name="twitter:image"[^>]*>/i,
    `<meta name="twitter:image" content="${socialPreviewUrl}" />`,
    'meta name="twitter:image"',
  );
  return addRoutePreload(html, route);
}

for (const [route, metadata] of Object.entries(seoCatalog)) {
  const outputPath =
    route === '/'
      ? indexPath
      : path.join(distRoot, `${route.replace(/^\/+/, '')}.html`);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, renderRouteHtml(route, metadata), 'utf8');
}

console.log(
  `Prerendered ${Object.keys(seoCatalog).length} public route metadata shells in ${distRoot}.`,
);
