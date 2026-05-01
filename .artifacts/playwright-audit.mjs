import { chromium } from 'playwright';

const baseURL = 'http://127.0.0.1:5185';
const routes = [
  ['dashboard', '/dashboard'],
  ['jobs', '/jobs'],
  ['routing', '/routing'],
  ['dispatch', '/dispatch'],
  ['exceptions', '/exceptions'],
  ['tracking', '/tracking'],
  ['drivers', '/drivers'],
  ['vehicles', '/vehicles'],
  ['customers', '/customers'],
  ['analytics', '/analytics'],
  ['settings', '/settings'],
  ['driver', '/driver'],
  ['public-tracking', '/track/demo-token'],
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1728, height: 1117 } });
const results = [];

for (const [slug, route] of routes) {
  const consoleMessages = [];
  const handler = (msg) => consoleMessages.push({ type: msg.type(), text: msg.text().slice(0, 300) });
  page.on('console', handler);

  try {
    await page.goto(baseURL + route, { waitUntil: 'domcontentloaded' });
    await page.locator('#root').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(1200);

    const metrics = await page.evaluate(() => {
      const sidebar = document.querySelector('aside');
      const main = document.querySelector('main');
      const header = document.querySelector('main > div');
      const sidebarRect = sidebar?.getBoundingClientRect();
      const mainRect = main?.getBoundingClientRect();
      const headerRect = header?.getBoundingClientRect();

      const overflow = [...document.querySelectorAll('body *')]
        .filter((el) => el instanceof HTMLElement)
        .map((el) => {
          const node = el;
          const style = window.getComputedStyle(node);
          const text = (node.textContent || '').trim().replace(/\s+/g, ' ');
          return {
            tag: node.tagName,
            text,
            className: typeof node.className === 'string' ? node.className : '',
            visible: style.display !== 'none' && style.visibility !== 'hidden',
            scrollWidth: node.scrollWidth,
            clientWidth: node.clientWidth,
            scrollHeight: node.scrollHeight,
            clientHeight: node.clientHeight,
          };
        })
        .filter((node) => node.visible && node.text.length > 10)
        .filter((node) => node.scrollWidth > node.clientWidth + 8 || node.scrollHeight > node.clientHeight + 8)
        .slice(0, 12);

      const panelBackgrounds = [...document.querySelectorAll('.MuiPaper-root')]
        .slice(0, 24)
        .map((el) => window.getComputedStyle(el).backgroundColor)
        .reduce((acc, color) => {
          acc[color] = (acc[color] || 0) + 1;
          return acc;
        }, {});

      return {
        h1: document.querySelector('h1,h2,h3,h4,h5,h6')?.textContent?.trim() || null,
        sidebarWidth: sidebarRect ? Math.round(sidebarRect.width) : null,
        mainLeft: mainRect ? Math.round(mainRect.left) : null,
        mainWidth: mainRect ? Math.round(mainRect.width) : null,
        sidebarGap: sidebarRect && mainRect ? Math.round(mainRect.left - sidebarRect.right) : null,
        headerHeight: headerRect ? Math.round(headerRect.height) : null,
        mapCount: document.querySelectorAll('.leaflet-container').length,
        chipCount: document.querySelectorAll('.MuiChip-root').length,
        buttonCount: document.querySelectorAll('button').length,
        navLinkCount: document.querySelectorAll('aside a').length,
        overflow,
        panelBackgrounds,
      };
    });

    results.push({
      route: slug,
      metrics,
      console: consoleMessages.filter((msg) => !msg.text.includes('React Router Future Flag Warning')).slice(0, 10),
    });
  } catch (error) {
    results.push({ route: slug, error: String(error), console: consoleMessages.slice(0, 10) });
  } finally {
    page.off('console', handler);
  }
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
