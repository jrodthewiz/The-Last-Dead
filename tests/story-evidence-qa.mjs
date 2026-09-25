import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const base = process.env.DEAD_ARRIVAL_URL || 'http://127.0.0.1:5200/';
const output = process.env.STORY_EVIDENCE_OUTPUT || 'docs/story-evidence-pass/review';
const floors = process.env.STORY_EVIDENCE_FLOORS
  ? process.env.STORY_EVIDENCE_FLOORS.split(',').map(Number).filter(index => [0, 1, 2, 3, 4].includes(index))
  : [0, 1, 2, 3, 4];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
// Headless screenshots must not release pointer lock and pause the game while
// the pickup waits for the next live frame.
await page.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = () => Promise.resolve(); });
const report = { url: base, errors: [], httpErrors: [], items: [], archive: null };
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
      const [{ newRun, canStand, castRay }, { makeDungeonCourse }] = await Promise.all([
        import('./engine.js'), import('./playground/map/dungeon-course.js'),
      ]);
      const oldRecords = [...app.run.storyRecords];
      const course = makeDungeonCourse(index);
      Object.assign(app.run, newRun(course), { mode: 'play', health: 1000, waveDelay: 999, storyRecords: oldRecords });
      // The synthetic F5 floor swap only inspects evidence. Let first-person
      // rendering compile the materials it uses without the separate weapon
      // shader prepass, which is covered by the normal Story transition.
      if (index === 4) app.renderer._warmupCourse = course;
      const item = course.evidence[0];
      const room = course.rooms.find(room => room.id === item.roomId);
      let view = null, score = Infinity;
      for (let z = room.bounds.minZ; z < room.bounds.maxZ; z++) for (let x = room.bounds.minX; x < room.bounds.maxX; x++) {
        const px = x + .5, py = z + .5, dist = Math.hypot(item.x - px, item.y - py);
        if (dist < 1.4 || dist > 4 || !canStand(course, px, py, .1)) continue;
        const angle = Math.atan2(item.y - py, item.x - px);
        if (castRay(course, px, py, angle, dist + .2).dist <= dist - .15) continue;
        const candidate = Math.abs(dist - 2.5);
        if (candidate < score) { score = candidate; view = { x: px, y: py, angle }; }
      }
      // The last cache is entered from its south vent. Review the document
      // from that approach rather than from behind the central relic.
      if (index === 4) {
        const x = 3.5, y = 6.5, angle = Math.atan2(item.y - y, item.x - x);
        if (canStand(course, x, y, .1) && castRay(course, x, y, angle, 1.5).dist > 1.2) view = { x, y, angle };
      }
      if (!view) throw new Error(`${item.id}: no clear document view`);
      Object.assign(app.run, view, { pitch: -.04 });
      app.renderer._firstCameraFrame = true;
      app.renderer.render(app.run, performance.now());
      await app.renderer._warmupPromise;
      app.renderer.render(app.run, performance.now() + 16);
      return { id: item.id, floor: index, view, item: { x: item.x, y: item.y },
        visible: app.renderer._storyEvidence?.find(candidate => candidate.id === item.id)?.root.visible,
        diagnostics: app.renderer._collectDiagnostics(app.run) };
    }, floor);
    assert.equal(result.visible, true, `${result.id} should render before discovery`);
    await page.screenshot({ path: `${output}/${result.id}-world.png` });
    const collected = await page.evaluate(async ({ id, item }) => {
      const app = window.__DEAD_ARRIVAL__;
      const { tick } = await import('./engine.js');
      app.run.x = item.x;app.run.y = item.y;
      app.run.mode = 'play';
      tick(app.run, 1 / 60, {});
      const event=app.run.events.find(candidate=>candidate.type==='dungeon-evidence'&&candidate.evidenceId===id);
      if(event)app.ui.lootDiscovery({weaponName:event.title,story:event.story,rarity:'record',kicker:'EVIDENCE / ARCHIVED'});
      app.renderer.render(app.run,performance.now()+32);
      return {
        records: app.run.storyRecords.length,
        id: app.run.storyRecords.find(record => record.id === id)?.id,
        event: event?.type,
        visible: app.renderer._storyEvidence.find(candidate=>candidate.id===id)?.root.visible,
        popup: document.querySelector('.loot-discovery')?.textContent,
      };
    }, result);
    assert.equal(collected.id, result.id);
    assert.equal(collected.event, 'dungeon-evidence');
    assert.equal(collected.visible, false);
    assert.match(collected.popup, /EVIDENCE \/ ARCHIVED/);
    await page.screenshot({ path: `${output}/${result.id}-collected.png` });
    report.items.push({ ...result, collected });
  }
  await page.evaluate(() => {
    const app=window.__DEAD_ARRIVAL__;
    if(app.screen==='play')app.pause();else app.ui.pause();
  });
  await page.locator('[data-action="records"]').click();
  report.archive = await page.evaluate(() => ({
    visible: !document.querySelector('.records-archive')?.hidden,
    entries: document.querySelectorAll('.record-entry').length,
    text: document.querySelector('.records-archive')?.textContent,
    width: document.querySelector('.records-archive')?.getBoundingClientRect().width,
  }));
  assert.equal(report.archive.visible, true);
  assert.equal(report.archive.entries, report.items.length);
  assert.ok(report.archive.width >= 300);
  await page.screenshot({ path: `${output}/archive-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/archive-mobile.png`, fullPage: true });
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.httpErrors, []);
  console.log(JSON.stringify({ ok: true, items: report.items.map(item => ({ id: item.id,
    calls: item.diagnostics.calls, triangles: item.diagnostics.gpuTriangles })),
  archiveEntries: report.archive.entries, errors: report.errors, httpErrors: report.httpErrors }));
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
