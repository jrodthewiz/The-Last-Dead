import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const output = fileURLToPath(new URL('../docs/cinematic-menu/', import.meta.url));
const server = await startServer({ root, port: 0, spaFallback: false });
const browser = await chromium.launch({ headless: true, executablePath: [process.env.CHROME_PATH,
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(Boolean).find(existsSync) });
const errors = [], report = { errors, viewports: [], controls: {}, screenshots: [] };
await mkdir(output, { recursive: true });
const page = await browser.newPage({ viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1 });
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
const capture = async name => { await page.screenshot({ path: `${output}/${name}.png` }); report.screenshots.push(`${name}.png`); };
const menuState = () => page.evaluate(() => {
  const menu = window.__DEAD_ARRIVAL__.renderer.menuCinematic;
  return { ...window.__DEAD_ARRIVAL__.renderer.diagnostics().menu,
    head: menu.actors[0].head.quaternion.toArray(),
    geometryCount: window.__DEAD_ARRIVAL__.renderer.renderer.info.memory.geometries };
});
try {
  await page.goto(`http://127.0.0.1:${server.port}/?debug=1`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__?.renderer._weaponsPrepared && window.__DEAD_ARRIVAL__.renderer.menuCinematic?.actors.length === 3, null, { timeout: 90000 });
  console.log('Title scene and gameplay resources ready.');
  await page.waitForTimeout(700);
  // Pointer motion should change the head pose while maintaining direct gaze.
  await page.mouse.move(50, 700); await page.waitForTimeout(1200);
  const left = await menuState();
  await page.mouse.move(1460, 100); await page.waitForTimeout(1800);
  const right = await menuState();
  assert.ok(right.gazeAlignment.every(value => value > .99), 'all three figures look toward the viewer');
  assert.ok(right.head.some((value, i) => Math.abs(value - left.head[i]) > .005), 'head follows pointer');
  assert.ok(right.calls < 200 && right.triangles < 110000, 'menu stays within the draw budget');
  report.gaze = { left, right };
  await capture('gaze-right');
  await page.mouse.move(768, 432); await page.waitForTimeout(1000);
  for (const [name, width, height] of [['desktop',1536,864],['laptop',1366,768],['tablet',768,1024],['mobile',390,844],['small-phone',320,640],['landscape',844,390]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(350);
    const fit = await page.evaluate(() => {
      const screen = document.querySelector('.menu-screen');
      const title = document.querySelector('.brand-title').getBoundingClientRect();
      const controls = [...document.querySelectorAll('.menu-actions > button,.coop-toggle')].map(node => {
        const bounds = node.getBoundingClientRect(); return { action: node.dataset.action, x: bounds.x, width: bounds.width, height: bounds.height };
      });
      return { viewportWidth: innerWidth, scrollWidth: screen.scrollWidth, scrollHeight: screen.scrollHeight, titleRight: title.right, controls };
    });
    assert.ok(fit.scrollWidth <= width + 1, `${name}: no horizontal scroll`);
    assert.ok(fit.titleRight <= width, `${name}: title fits`);
    assert.ok(fit.controls.every(control => control.x >= 0 && control.x + control.width <= width + 1 && control.height >= 44), `${name}: usable controls`);
    report.viewports.push({ name, width, height, ...fit });
    await capture(name);
  }
  await page.setViewportSize({ width: 1536, height: 864 });
  await page.locator('[data-action="coop-toggle"]').click();
  assert.equal(await page.locator('[data-coop-panel]').isVisible(), true);
  await page.locator('[data-action="coop-toggle"]').click();
  await page.locator('[data-action="guide"]').click();
  assert.equal(await page.locator('.field-guide').isVisible(), true);
  await page.locator('[data-action="guide"]').click();
  await page.locator('[data-action="settings"]').click();
  await page.locator('.setting-row:has([data-setting="reducedMotion"]) .toggle-track').click();
  assert.equal(await page.locator('[data-setting="reducedMotion"]').isChecked(), true);
  await page.locator('[data-action="close-settings"]').click();
  await page.waitForTimeout(300);
  const reducedA = await menuState();
  await page.mouse.move(10, 10); await page.waitForTimeout(450);
  const reducedB = await menuState();
  assert.deepEqual(reducedA.camera, reducedB.camera, 'reduced motion freezes camera');
  assert.deepEqual(reducedA.head, reducedB.head, 'reduced motion freezes head');
  report.reducedMotion = { cameraStable: true, headStable: true };
  await page.locator('[data-action="settings"]').click();
  await page.locator('.setting-row:has([data-setting="reducedMotion"]) .toggle-track').click();
  assert.equal(await page.locator('[data-setting="reducedMotion"]').isChecked(), false);
  await page.locator('[data-action="close-settings"]').click();
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(200);
  const systemA = await menuState(); await page.waitForTimeout(200); const systemB = await menuState();
  assert.deepEqual(systemA.camera, systemB.camera, 'OS motion preference is respected');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  report.controls = { coopPanel: true, controlsPanel: true, settings: true, systemReducedMotion: true };
  report.pixels = await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => {
    const sample = document.createElement('canvas'); sample.width = 96; sample.height = 54;
    const context = sample.getContext('2d'); context.drawImage(document.querySelector('#world'), 0, 0, 96, 54);
    const pixels = context.getImageData(0, 0, 96, 54).data;
    let low = 255, high = 0, sum = 0;
    for (let i = 0; i < pixels.length; i += 4) { const light = (pixels[i] + pixels[i+1] + pixels[i+2]) / 3; low = Math.min(low, light); high = Math.max(high, light); sum += light; }
    resolve({ low, high, mean: sum / (96 * 54) });
  })));
  assert.ok(report.pixels.high - report.pixels.low > 80 && report.pixels.mean > 3, 'live canvas has visible tonal range');
  await page.locator('[data-action="start"]').click();
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__.screen === 'play');
  await page.waitForTimeout(1000);
  report.gameStart = await page.evaluate(() => { const d=window.__DEAD_ARRIVAL__; return {x:d.run.x,y:d.run.y,angle:d.run.angle,pitch:d.run.pitch,mode:d.run.mode,camera:d.renderer.camera.position.toArray()}; });
  await capture('game-start');
  assert.equal((await menuState()).active, false, 'menu rendering stops during gameplay');
  const start = await page.evaluate(() => ({ x: window.__DEAD_ARRIVAL__.run.x, y: window.__DEAD_ARRIVAL__.run.y }));
  await page.keyboard.down('w'); await page.waitForTimeout(450); await page.keyboard.up('w');
  const moved = await page.evaluate(() => ({ x: window.__DEAD_ARRIVAL__.run.x, y: window.__DEAD_ARRIVAL__.run.y }));
  assert.ok(Math.hypot(start.x - moved.x, start.y - moved.y) > .05, 'gameplay controls still work');
  await page.mouse.down(); await page.waitForTimeout(250); await page.mouse.up();
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(300); await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(500);
  const sustainedSeconds = Math.max(0, Number(process.env.MENU_SUSTAINED_SECONDS) || 0);
  if (sustainedSeconds) {
    const end = Date.now() + sustainedSeconds * 1000;
    let steps = 0;
    while (Date.now() < end) {
      if (await page.locator('[data-action="restart"]').isVisible()) await page.locator('[data-action="restart"]').click();
      await page.keyboard.down(steps % 2 ? 's' : 'd');
      await page.keyboard.down('ArrowRight'); await page.waitForTimeout(350); await page.keyboard.up('ArrowRight');
      await page.waitForTimeout(250); await page.keyboard.up(steps % 2 ? 's' : 'd');
      await page.mouse.down(); await page.waitForTimeout(200); await page.mouse.up();
      await page.waitForTimeout(Math.min(14000, Math.max(0, end - Date.now())));
      steps++;
      console.log(`Sustained play: ${steps} input cycles.`);
    }
    report.sustained = { seconds: sustainedSeconds, inputCycles: steps };
    if (await page.locator('[data-action="restart"]').isVisible()) await page.locator('[data-action="restart"]').click();
  }
  await capture('gameplay');
  await page.evaluate(() => window.__DEAD_ARRIVAL__.pause());
  await page.locator('[data-action="menu"]').click();
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__.renderer.menuCinematic?.active);
  const returned = await menuState();
  assert.equal(returned.figures, 3, 'returning to title reuses its figures');
  report.controls.startMoveFireReturn = true;
  report.returned = returned;
  assert.deepEqual(errors, [], 'no browser or asset errors');
  report.result = 'PASS';
  await writeFile(`${output}/qa-results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({result:report.result,viewports:report.viewports.length,controls:report.controls,pixels:report.pixels,menu:returned,errors}, null, 2));
} catch (error) {
  report.result = 'FAIL'; report.failure = error.stack;
  await writeFile(`${output}/qa-results.json`, JSON.stringify(report, null, 2));
  await page.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  throw error;
} finally {
  await browser.close();
  server.server.closeIdleConnections?.(); server.server.closeAllConnections?.();
  await new Promise(resolve => server.server.close(resolve));
}
