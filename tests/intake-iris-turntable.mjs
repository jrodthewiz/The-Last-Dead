import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { startServer } from '../server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve('.');
const docs = path.resolve('docs/intake-iris');
await mkdir(docs, { recursive: true });
const preview = await startServer({ root, host: '127.0.0.1', port: 0 });
const browser = await chromium.launch({
  headless: process.env.HEADFUL !== '1',
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  args: ['--disable-dev-shm-usage', '--use-angle=d3d11', '--enable-gpu'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(String(error?.stack || error)));
const base = `http://127.0.0.1:${preview.port}/intake-iris-review.html`;
for (const view of ['front', 'angled', 'side']) {
  await page.goto(`${base}?view=${view}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(750);
  await page.screenshot({ path: path.join(docs, `iris-${view}.png`), animations: 'disabled' });
}
await page.goto(`${base}?view=front`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);
const evidence = await page.evaluate(() => {
  const review = window.__IRIS_REVIEW__;
  const info = review?.renderer?.info;
  return { names: review?.names || [], meshCount: review?.names?.length || 0, triangles: info?.render?.triangles || null, calls: info?.render?.calls || null };
});
await writeFile(path.join(docs, 'iris-turntable-evidence.json'), JSON.stringify({ errors, ...evidence }, null, 2) + '\n');
await browser.close();
await preview.close?.();
if (errors.length) process.exitCode = 1;
