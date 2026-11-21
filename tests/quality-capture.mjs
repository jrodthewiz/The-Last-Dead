import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.mjs';

// Matched quality capture for human/agent judging. Always uses the same camera
// poses, viewport, time of day and build output, so a baseline and a candidate
// can be compared side by side without re-negotiating the scene.
//
//   node build.mjs
//   PLAYWRIGHT_PATH=playwright-core CHROME_PATH="...chrome.exe" \
//     node tests/quality-capture.mjs <label>
//
// Output: output/playwright/quality/<label>/{00-spawn..13-interior}.png plus
// metrics.json (draw calls, triangles, geometry/texture counts).
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright-core');
const label = process.argv[2] || 'candidate';
const out = `output/playwright/quality/${label}`;
await mkdir(out, { recursive: true });

const server = await startServer({ root: fileURLToPath(new URL('../dist/', import.meta.url)), port: 0 });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--disable-background-timer-throttling'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(`http://127.0.0.1:${server.port}/?debug=1&world=island`, { waitUntil: 'load', timeout: 90000 });
await page.waitForSelector('#begin:not([disabled])', { timeout: 120000 });
await page.click('#begin');
await page.waitForFunction(() => window.__BLACKWATER__?.renderer, undefined, { timeout: 120000 });
await page.evaluate(() => window.__BLACKWATER__.setTime?.(48));
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/00-spawn.png` });

const poses = [
  ['02-oldtown', [590, 16, 7, 635, 16.5, -2]],
  ['03-civic', [672, 16, 8, 742, 27, 0]],
  ['04-waterfront', [1174, 16, 235, 1188, 22, 178]],
  ['05-bridge-approach', [-20, 17.7, 2, 190, 24, 0]],
  ['06-keeper-house', [-799, 39, -260, -795, 39, -280]],
  ['07-signal-stairs', [-440, 81, -277, -407, 85, -286]],
  ['08-island', [-900, 210, 520, -170, 20, -50]],
  ['09-generator', [1005, 16, -289, 1000, 16, -302]],
  ['10-forest', [-870, 20, 170, -870, 28, 60]],
  ['11-wall-close', [-590, 22.4, 111, -596, 22.2, 114]],
  ['12-road-close', [-80, 17.2, 3, -70, 17.0, 12]],
  ['13-interior', [-795, 39.2, -272, -790, 39.0, -266]],
];

for (const [name, pose] of poses) {
  await page.evaluate((p) => window.__BLACKWATER__.setPhoto(...p), pose);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${name}.png` });
}

const metrics = await page.evaluate(() => {
  try {
    return window.__BLACKWATER__.metrics();
  } catch {
    return null;
  }
});
await writeFile(`${out}/metrics.json`, JSON.stringify({ label, metrics, errors: [...new Set(errors)].slice(0, 8), capturedAt: new Date().toISOString() }, null, 2));
console.log(JSON.stringify({ label, out, shots: poses.length + 1, metrics, errors: [...new Set(errors)].slice(0, 5) }, null, 1));
await browser.close();
server.close?.();
process.exit(0);
