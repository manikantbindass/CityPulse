// Local measurement only. Build the web app first; no production SLO is implied.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = spawn(
  process.execPath,
  [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '--port', '3200'],
  { cwd: path.join(root, 'apps/web'), windowsHide: true, stdio: 'ignore' },
);
let browser;
try {
  const origin = 'http://127.0.0.1:3200';
  let ready = false;
  for (let attempt = 0; attempt < 45; attempt++) {
    try {
      if ((await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1000) })).ok) {
        ready = true;
        break;
      }
    } catch {
      /* bounded readiness poll */
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error('Built web server did not become ready on the measurement port.');
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const session = await page.context().newCDPSession(page);
  await session.send('Network.enable');
  await session.send('Network.setCacheDisabled', { cacheDisabled: true });
  const measurements = [];
  for (const route of ['/', '/dashboard', '/explorer']) {
    await page.goto(origin + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('h1:visible').first().waitFor();
    await page.waitForTimeout(1500);
    const measured = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      const scripts = resources.filter(
        (resource) =>
          resource.name.includes('/_next/') && resource.name.split('?')[0].endsWith('.js'),
      );
      return {
        domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
        firstContentfulPaintMs: Math.round(
          performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0,
        ),
        loadEventMs: Math.round(navigation.loadEventEnd),
        javascriptTransferBytes: scripts.reduce((sum, resource) => sum + resource.transferSize, 0),
        javascriptDecodedBytes: scripts.reduce(
          (sum, resource) => sum + resource.decodedBodySize,
          0,
        ),
        javascriptRequests: scripts.length,
      };
    });
    measurements.push({ route, ...measured });
    if (route === '/dashboard')
      await page.screenshot({
        path: path.join(root, 'docs/assets/dashboard-desktop.png'),
        fullPage: true,
      });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + '/dashboard');
  await page.locator('main#main').waitFor();
  await page.screenshot({
    path: path.join(root, 'docs/assets/dashboard-mobile.png'),
    fullPage: true,
  });
  const result = {
    measuredAt: new Date().toISOString(),
    environment:
      'single local Chromium run against production build; synthetic data, browser cache disabled; 1.5-second observation window after heading; map tiles may be unavailable; no production performance claim',
    measurements,
  };
  await fs.writeFile(
    path.join(root, 'docs/reports/web-performance.json'),
    JSON.stringify(result, null, 2) + '\n',
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  server.kill();
}
