import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { startServer } from '../server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const sharp = process.env.PLAYWRIGHT_PATH
  ? createRequire(`${process.env.PLAYWRIGHT_PATH}/package.json`)('sharp') : require('sharp');
const output = process.env.MAP_DESIGN_OUTPUT || 'output/playwright/map-design-v6';
await mkdir(output, { recursive: true });
const server = await startServer({ root: process.env.MAP_DESIGN_ROOT || fileURLToPath(new URL('../dist/', import.meta.url)), port: 0, spaFallback: false });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(180000);
const report = { errors: [], views: [] };
page.on('pageerror', error => { report.errors.push(error.message); console.error(error.message); });
page.on('console', message => { if (message.type() === 'error') { report.errors.push(message.text()); console.error(message.text()); } });
page.on('response', response => { if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`); });
page.on('requestfailed', request => report.errors.push(`${request.failure()?.errorText} ${request.url()}`));

async function shot(name) {
  await page.waitForTimeout(400);
  const png = await page.screenshot({ path: `${output}/${name}.png` });
  const { width, height } = page.viewportSize();
  const pixels = await sharp(png).extract({ left: Math.floor(width * .2), top: Math.floor(height * .25),
    width: Math.floor(width * .6), height: Math.floor(height * .5) }).resize(96, 64).removeAlpha().raw().toBuffer();
  const mean = pixels.reduce((a, b) => a + b, 0) / pixels.length;
  assert(mean > 6 && new Set(pixels).size > 16, `${name}: nonblank lit scene`);
  report.views.push({ name, scenePixelMean: mean, ...await page.evaluate(() => {
    const d = window.__DEAD_ARRIVAL__, a = d.renderer, r = a.renderer;
    const kit = a.worldRoot.getObjectByName('DungeonPlaceKit');
    return { position: [d.run.x, d.run.y, d.run.angle], calls: r.info.render.calls,
      triangles: r.info.render.triangles, memory: r.info.memory, programs: r.info.programs.length,
      kit: kit?.userData, diagnostics: a._collectDiagnostics(d.run) };
  }) });
  console.log('Captured', name);
}

try {
  const views = [
    [0, 'f1-hall', 8.5, 14.5, 0],
    [0, 'f1-pump', 27.5, 13.5, -Math.PI / 2],
    [1, 'f2-hub', 13.5, 16.5, 0],
    [1, 'f2-wardA', 7.5, 18.5, -Math.PI / 2],
    [2, 'f3-hub', 19.5, 17.5, -Math.PI / 2],
    [3, 'f4-nave', 17.5, 19.5, -Math.PI / 2],
    [3, 'f4-aisleW', 4.5, 16.5, -Math.PI / 2],
    [4, 'f5-hall1', 14.5, 25.5, -Math.PI / 2],
  ];
  let floor = -1;
  for (const [index, roomId, x, y, angle] of views) {
    if (index !== floor) {
      console.log('Loading floor', index + 1);
      await page.goto(`http://127.0.0.1:${server.port}/?debug=1&dungeon=${index}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__DEAD_ARRIVAL__?.renderer?._weaponsPrepared);
      await page.locator('[data-action="start"]').click();
      await page.waitForFunction(() => window.__DEAD_ARRIVAL__.screen === 'play');
      await page.evaluate(async () => {
        const d = window.__DEAD_ARRIVAL__;
        const { setDungeonOpeningOpen } = await import('./playground/map/dungeon-course.js');
        for (const opening of d.run.course.openings) setDungeonOpeningOpen(d.run.course, opening.id, true);
        d.run.mode = 'ready';
        const original = d.renderer.render;
        d.renderer.render = function (run) { this._lastNow = 123000 - 16; return original.call(this, run, 123000); };
      });
      floor = index;
    }
    await page.evaluate(({ roomId, x, y, angle }) => {
      const d = window.__DEAD_ARRIVAL__;
      Object.assign(d.run, { x, y, angle, pitch: -.035, mode: 'ready' });
      d.run.dungeonProgression.activeRoomId = roomId;
      d.renderer.settings.bodycam = true;
    }, { roomId, x, y, angle });
    await shot(roomId);
    if (['f1-hall', 'f3-hub', 'f4-nave'].includes(roomId)) {
      await page.evaluate(() => window.__DEAD_ARRIVAL__.renderer.settings.bodycam = false);
      await shot(`${roomId}-no-post`);
    }
    if (roomId === 'f4-nave') {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => window.__DEAD_ARRIVAL__.renderer.settings.bodycam = true);
      await shot('f4-nave-portrait');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.setViewportSize({ width: 1280, height: 720 });
    }
  }
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__.screen === 'pause');
  await page.locator('[data-action="resume"]').click();
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__.screen === 'play');
  await page.evaluate(() => window.__DEAD_ARRIVAL__.pause());
  await page.locator('[data-action="restart"]').click();
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__.screen === 'play');
  report.pauseResumeRestart = 'PASS';
  assert.deepEqual(report.errors, []);
  report.result = 'PASS';
} catch (error) {
  report.result = 'FAIL'; report.failure = error.stack;
  await page.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  throw error;
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close(); server.server.closeAllConnections?.();
  await new Promise(resolve => server.server.close(resolve));
}
