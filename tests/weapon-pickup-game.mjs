import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const report = { errors: [], httpErrors: [], pickups: [] };
await mkdir('.logs', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) report.httpErrors.push(response.url()); });
  await page.goto('http://127.0.0.1:5200/?debug=1&dungeon=0', { waitUntil: 'domcontentloaded' });
  console.log('Waiting for arena resource warmup');
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__?.renderer._weaponsPrepared, null, { timeout: 180000 });
  await page.locator('[data-action="start"]').click();
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__.screen === 'play');
  console.log('Gameplay started');
  const loot = await page.evaluate(() => {
    const app = window.__DEAD_ARRIVAL__;
    app.run.health = 10000;
    app.run.waveDelay = 999;
    const gl = app.renderer.renderer.getContext();
    window.__pickupPrograms = 0;
    const createProgram = gl.createProgram.bind(gl);
    gl.createProgram = (...args) => { window.__pickupPrograms++; return createProgram(...args); };
    return app.run.course.loot;
  });
  assert.ok(loot.length > 0);
  for (const item of loot) {
    // Let the normal animation loop collect it and process UI/audio events.
    const before = await page.evaluate(item => {
      const { run } = window.__DEAD_ARRIVAL__;
      run.x = item.x; run.y = item.y;
      return { time: run.time, programs: window.__pickupPrograms };
    }, item);
    await page.waitForFunction(id => window.__DEAD_ARRIVAL__.run.dungeonProgression.lootCollected.includes(id), item.id);
    await page.waitForFunction(time => window.__DEAD_ARRIVAL__.run.time > time + .3, before.time);
    const result = await page.evaluate(({ item, before }) => {
      const app = window.__DEAD_ARRIVAL__, display = app.renderer._storyWeaponLoot.find(find => find.id === item.id);
      return { id: item.id, owned: app.run.ownedWeapons.includes(item.weaponIndex), weapon: app.run.weapon,
        programs: window.__pickupPrograms - before.programs, time: app.run.time,
        visible: display.root.visible, lightIntensity: display.light.intensity,
        notification: document.querySelector('.loot-discovery strong')?.textContent,
        contextLost: app.renderer.renderer.getContext().isContextLost(),
        calls: app.renderer.renderer.info.render.calls };
    }, { item, before });
    report.pickups.push(result);
    console.log(JSON.stringify(result));
    assert.equal(result.owned, true);
    assert.equal(result.weapon, item.weaponIndex);
    assert.equal(result.visible, false);
    assert.equal(result.lightIntensity, 0);
    assert.equal(result.programs, 0, 'pickup must retain warmed scene shaders');
    assert.equal(result.contextLost, false);
    assert.ok(result.notification);
    await page.screenshot({ path: `.logs/${item.id}-pickup-fixed.png` });
  }
  const otherPickups = await page.evaluate(() => {
    const { course } = window.__DEAD_ARRIVAL__.run;
    return [...course.evidence.map(item => ({ ...item, pickupType: 'evidence' })),
      ...course.keys.map(item => ({ ...item, pickupType: 'key' }))];
  });
  for (const item of otherPickups) {
    const before = await page.evaluate(item => {
      const app = window.__DEAD_ARRIVAL__;
      app.run.x = item.x; app.run.y = item.y;
      window.__pickupWorld = app.renderer.worldRoot;
      return { time: app.run.time, programs: window.__pickupPrograms };
    }, item);
    await page.waitForFunction(item => {
      const { run } = window.__DEAD_ARRIVAL__;
      return item.pickupType === 'key' ? run.dungeonProgression.keysCollected.includes(item.id) : run.storyRecords.some(record => record.id === item.id);
    }, item);
    await page.waitForFunction(time => window.__DEAD_ARRIVAL__.run.time > time + .3, before.time);
    const result = await page.evaluate(({ item, before }) => {
      const app = window.__DEAD_ARRIVAL__;
      const display = (item.pickupType === 'key' ? app.renderer._dungeonPickups : app.renderer._storyEvidence).find(candidate => candidate.id === item.id);
      return { id: item.id, programs: window.__pickupPrograms - before.programs,
        sameWorld: window.__pickupWorld === app.renderer.worldRoot, visible: display.root.visible,
        intensity: (display.glow || display.light).intensity,
        notification: document.querySelector('.loot-discovery strong')?.textContent };
    }, { item, before });
    report.pickups.push(result); console.log(JSON.stringify(result));
    assert.equal(result.programs, 0);
    assert.equal(result.sameWorld, true);
    assert.equal(result.visible, false);
    assert.equal(result.intensity, 0);
    assert.ok(result.notification);
    await page.screenshot({ path: `.logs/${item.id}-pickup-fixed.png` });
  }
  await page.mouse.down();
  await page.waitForTimeout(400);
  await page.mouse.up();
  const time = await page.evaluate(() => window.__DEAD_ARRIVAL__.run.time);
  await page.waitForFunction(time => window.__DEAD_ARRIVAL__.run.time > time + .2, time);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.httpErrors, []);
} finally {
  await writeFile('.logs/weapon-pickup-game.json', JSON.stringify(report, null, 2));
  await browser.close();
}
