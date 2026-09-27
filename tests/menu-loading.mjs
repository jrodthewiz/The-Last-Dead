import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const report = { errors: [], views: [] };
await mkdir('.logs/menu-loading', { recursive: true });
let releaseAssets;
const assetsGate = new Promise(resolve => { releaseAssets = resolve; });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('loading-failure-fixture')) report.errors.push(message.text());
  });
  await page.route('**/assets/models/evil-warden.glb', async route => { await assetsGate; await route.continue(); });
  await page.goto('http://127.0.0.1:5200/?debug=1&dungeon=0', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__DEAD_ARRIVAL__, null, { timeout: 120000 });
  await page.screenshot({ path: '.logs/menu-loading/menu-before.png' });
  await page.evaluate(() => {
    const { renderer, ui } = window.__DEAD_ARRIVAL__;
    window.loadingStages = [];
    const progress = renderer.onPreparationProgress;
    renderer.onPreparationProgress = stage => { window.loadingStages.push(stage); progress(stage); };
    window.playTransitions = 0;
    const play = ui.play.bind(ui);
    ui.play = () => { window.playTransitions++; return play(); };
  });
  await page.locator('[data-action="start"]').click();
  await page.locator('.descent-loading').waitFor({ state: 'visible' });
  await page.evaluate(() => { window.__DEAD_ARRIVAL__.begin(); window.__DEAD_ARRIVAL__.begin(); });
  // The old toast expired after 2.1 seconds; the new state must persist.
  await page.waitForTimeout(2300);
  assert.equal(await page.locator('.descent-loading').count(), 1);
  assert.equal(await page.locator('.menu-screen').evaluate(node => node.inert), true);
  console.log('Delayed asset shows persistent loading and blocks duplicate starts');
  for (const [width, height] of [[1440,900], [1024,768], [390,844], [844,390]]) {
    await page.setViewportSize({ width, height });
    const fit = await page.locator('.descent-loading-copy').evaluate(node => {
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, overflow: node.scrollWidth > node.clientWidth };
    });
    assert.ok(fit.x >= 0 && fit.y >= 0 && fit.right <= width && fit.bottom <= height && !fit.overflow);
    report.views.push({ width, height, fit });
    await page.screenshot({ path: `.logs/menu-loading/loading-${width}x${height}.png` });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.loading-track span').evaluate(node => getComputedStyle(node).animationName), 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1280, height: 720 });
  releaseAssets();
  console.log('Assets released; checking automatic entry');
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__.screen === 'play', null, { timeout: 180000 });
  assert.equal(await page.locator('.descent-loading').count(), 0);
  assert.equal(await page.evaluate(() => window.playTransitions), 1);
  report.stages = await page.evaluate(() => window.loadingStages);
  assert.ok(report.stages.includes('Preparing the lighting'));
  assert.ok(report.stages.includes('Getting your equipment ready'));
  await page.screenshot({ path: '.logs/menu-loading/entered-game.png' });
  // Exercise the real rejection handler after returning to the menu.
  await page.evaluate(() => {
    const app = window.__DEAD_ARRIVAL__;
    app.ui._dispatch('menu');
    app.renderer._weaponsPrepared = false;
    app.renderer._warmupPromise = Promise.reject(new Error('loading-failure-fixture'));
    app.begin();
  });
  await page.locator('.descent-loading.is-failed').waitFor();
  assert.equal(await page.locator('[data-action="reload"]').isVisible(), true);
  assert.equal(await page.locator('.loading-track').isVisible(), false);
  await page.screenshot({ path: '.logs/menu-loading/loading-error.png' });
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify(report));
} finally {
  releaseAssets();
  await writeFile('.logs/menu-loading/report.json', JSON.stringify(report, null, 2));
  await browser.close();
}
