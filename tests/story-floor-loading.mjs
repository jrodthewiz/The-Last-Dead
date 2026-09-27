import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.mjs';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const server = await startServer({ root: fileURLToPath(new URL('../dist/', import.meta.url)), port: 0 });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const report = { errors: [], floors: [], views: [] };
await mkdir('.logs/story-progression', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(`http://127.0.0.1:${server.port}/?debug=1&dungeon=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__DEAD_ARRIVAL__, null, { timeout: 180000 });
  console.log('Story application initialized');
  await page.locator('[data-action="start"]').click();
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__?.screen === 'play', null, { timeout: 180000 });
  console.log('Initial floor prepared');
  await page.evaluate(() => { window.__DEAD_ARRIVAL__.run.health = 10000; });
  const before = await page.evaluate(() => window.__DEAD_ARRIVAL__.run.y);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(500); await page.keyboard.up('KeyW');
  assert.notEqual(await page.evaluate(() => window.__DEAD_ARRIVAL__.run.y), before, 'keyboard movement works');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.__DEAD_ARRIVAL__.screen), 'pause');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__.screen === 'play');

  // Inject only the engine's completed-floor event contract. Engine tests cover
  // reaching the lift; this isolates lifecycle loading, simulation freeze and GPU prep.
  await page.evaluate(async () => {
    const app = window.__DEAD_ARRIVAL__;
    const [{ newRun }, { makeDungeonCourse }] = await Promise.all([import('./engine.js'), import('./playground/map/dungeon-course.js')]);
    const original = app.renderer._prepareWeaponResources.bind(app.renderer);
    window.originalFloorPreparation = original;
    app.renderer._prepareWeaponResources = async course => {
      await new Promise(resolve => { window.releaseFloorPreparation = resolve; });
      return original(course);
    };
    Object.assign(app.run, newRun(makeDungeonCourse(1)), { mode: 'play', health: 10000 });
    app.run.events.push({ type: 'sector-transition', dungeon: true, sectorIndex: 1, sectorName: app.run.course.name });
  });
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__.screen === 'loading' && !!window.releaseFloorPreparation);
  console.log('Next floor loading suspends simulation');
  const frozen = await page.evaluate(() => window.__DEAD_ARRIVAL__.run.time);
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.__DEAD_ARRIVAL__.run.time), frozen, 'simulation freezes during floor preparation');
  assert.equal(await page.locator('.descent-loading').count(), 1);
  await page.screenshot({ path: '.logs/story-progression/floor-loading.png' });
  await page.evaluate(() => window.releaseFloorPreparation());
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__.screen === 'play', null, { timeout: 180000 });
  console.log('Next floor prepared');
  report.floors.push(await page.evaluate(() => {
    const app = window.__DEAD_ARRIVAL__;
    return { floor: app.run.course.dungeonIndex, prepared: app.renderer._preparedCourse === app.run.course,
      actors: [...app.renderer._preparedEnemyVisuals.values()].reduce((sum, entries) => sum + entries.length, 0),
      contextLost: app.renderer.renderer.getContext().isContextLost() };
  }));
  assert.ok(report.floors[0].actors > 0, 'later-floor enemies are prepared before control resumes');
  assert.equal(report.floors[0].contextLost, false);
  assert.equal(report.floors[0].prepared, true);
  assert.equal(await page.locator('.descent-loading').count(), 0);
  assert.match(await page.locator('[data-hud="sector"]').textContent(), /Graft Galleries/, 'HUD changes floors before control resumes');
  for (const [name, width, height] of [['desktop',1280,720],['mobile',390,844]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(200);
    report.views.push(await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      objective: document.querySelector('[data-hud="objective"]')?.textContent })));
    assert.ok(report.views.at(-1).scrollWidth <= width, 'HUD does not overflow the viewport');
    await page.screenshot({ path: `.logs/story-progression/${name}.png` });
  }
  await page.evaluate(() => { window.__DEAD_ARRIVAL__.renderer._prepareWeaponResources = window.originalFloorPreparation; });
  await page.keyboard.press('KeyR');
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__.screen === 'play' && window.__DEAD_ARRIVAL__.run.course.dungeonIndex === 0, null, { timeout: 180000 });
  assert.equal(await page.locator('.descent-loading').count(), 0, 'restart completes preparation');
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await writeFile('.logs/story-progression/browser.json', JSON.stringify(report, null, 2));
  await browser.close(); await new Promise(resolve => server.server.close(resolve));
}
