import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const base = process.env.DEAD_ARRIVAL_URL || 'http://127.0.0.1:5200/';
const output = process.env.STORY_LOOT_OUTPUT || 'docs/story-loot-pass/review';
const floors = process.env.STORY_LOOT_FLOORS
  ? process.env.STORY_LOOT_FLOORS.split(',').map(Number).filter(index => [0, 1, 2, 3].includes(index))
  : [0, 1, 2, 3];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const report = { url: base, errors: [], httpErrors: [], items: [] };
page.on('pageerror', error => report.errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) report.httpErrors.push({ status: response.status(), url: response.url() }); });
try {
  await page.goto(`${base}?debug=1&dungeon=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__DEAD_ARRIVAL__, null, { timeout: 120000 });
  await page.evaluate(() => window.__DEAD_ARRIVAL__.begin(false));
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__?.screen === 'play', null, { timeout: 120000 });
  for (const floor of floors) {
    await page.evaluate(() => document.querySelector('.loot-discovery')?.remove());
    const result = await page.evaluate(async index => {
      const app = window.__DEAD_ARRIVAL__;
      const [{ newRun, canStand, castRay, tick }, { makeDungeonCourse }] = await Promise.all([
        import('./engine.js'), import('./playground/map/dungeon-course.js'),
      ]);
      const course = makeDungeonCourse(index);
      Object.assign(app.run, newRun(course), { mode: 'play', health: 1000, waveDelay: 999 });
      const item = course.loot[index === 0 ? 0 : index === 2 ? 1 : 0];
      const room = course.rooms.find(room => room.id === item.roomId);
      let view = null, score = Infinity;
      for (let z = room.bounds.minZ; z < room.bounds.maxZ; z++) for (let x = room.bounds.minX; x < room.bounds.maxX; x++) {
        const px = x + .5, py = z + .5, dist = Math.hypot(item.x - px, item.y - py);
        if (dist < 1.4 || dist > 4 || !canStand(course, px, py, .1)) continue;
        const angle = Math.atan2(item.y - py, item.x - px);
        if (castRay(course, px, py, angle, dist + .2).dist <= dist - .15) continue;
        const candidate = Math.abs(dist - 2.6);
        if (candidate < score) { score = candidate; view = { x: px, y: py, angle }; }
      }
      if (!view) throw new Error(`${item.id}: no clear pickup view`);
      Object.assign(app.run, view, { pitch: -.06 });
      app.renderer._firstCameraFrame = true;
      app.renderer.render(app.run, performance.now());
      await app.renderer._warmupPromise;
      app.renderer.render(app.run, performance.now() + 16);
      return { id: item.id, floor: index, view, item: { x: item.x, y: item.y },
        visible: app.renderer._storyWeaponLoot?.find(candidate => candidate.id === item.id)?.root.visible,
        diagnostics: app.renderer._collectDiagnostics(app.run) };
    }, floor);
    assert.equal(result.visible, true, `${result.id} should render before pickup`);
    await page.screenshot({ path: `${output}/${result.id}-world.png` });
    const collected = await page.evaluate(async ({ item, id }) => {
      const app = window.__DEAD_ARRIVAL__;
      const { tick } = await import('./engine.js');
      app.run.x = item.x; app.run.y = item.y;
      tick(app.run, 1 / 60, {});
      app.renderer.render(app.run, performance.now() + 32);
      return { owned: [...app.run.ownedWeapons], collected: [...app.run.dungeonProgression.lootCollected],
        selected: app.run.weapon, visible: app.renderer._storyWeaponLoot?.find(candidate => candidate.id === id)?.root.visible };
    }, result);
    assert.ok(collected.collected.includes(result.id));
    assert.equal(collected.visible, false, `${result.id} should vanish after collection`);
    await page.waitForTimeout(120);
    await page.screenshot({ path: `${output}/${result.id}-collected.png` });
    report.items.push({ ...result, collected });
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.httpErrors, []);
  console.log(JSON.stringify({ ok: true, items: report.items.map(item => ({ id: item.id,
    calls: item.diagnostics.calls, triangles: item.diagnostics.gpuTriangles,
    owned: item.collected.owned.length })), errors: report.errors, httpErrors: report.httpErrors }));
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
