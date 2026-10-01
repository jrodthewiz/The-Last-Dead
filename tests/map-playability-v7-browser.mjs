import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { startServer } from '../server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const output = process.env.MAP_PLAYABILITY_OUTPUT || 'output/playwright/map-playability-v7';
await mkdir(output, { recursive: true });
const server = await startServer({ root: process.env.MAP_PLAYABILITY_ROOT || fileURLToPath(new URL('../dist/', import.meta.url)), port: 0, spaFallback: false });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
let page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(180000);
const report = { errors: [], floors: [], walks: [], views: [] };
page.on('pageerror', e => { report.errors.push(e.message); console.error(e.stack); });
page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
page.on('response', r => { if (r.status() >= 400) report.errors.push(`${r.status()} ${r.url()}`); });
page.on('requestfailed', r => report.errors.push(`${r.failure()?.errorText} ${r.url()}`));

async function shot(name) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${output}/${name}.png` });
  report.views.push({ name, ...await page.evaluate(() => {
    const d = window.__DEAD_ARRIVAL__, r = d.renderer.renderer;
    return { calls: r.info.render.calls, triangles: r.info.render.triangles, fps: d.fps,
      position: [d.run.x, d.run.y], diagnostics: d.renderer._collectDiagnostics(d.run) };
  }) });
}

async function floor(index) {
  return page.evaluate(async index => {
    const e = await import('./engine.js');
    const { makeDungeonCourse, setDungeonOpeningOpen } = await import('./playground/map/dungeon-course.js');
    const d = window.__DEAD_ARRIVAL__, r = e.newRun(makeDungeonCourse(index));
    const counts = Object.fromEntries(r.dungeonProgression.encounterPlan.map(n => [n.roomId, n.spawns.length]));
    const authored = Object.fromEntries(r.course.rooms.filter(room => room.encounter?.budget > 0).map(room => [room.id, room.encounter.budget]));
    // Static floor review; progression/gate safety is tested separately in the simulation.
    for (const opening of r.course.openings) setDungeonOpeningOpen(r.course, opening.id, true);
    r.mode = 'ready';
    Object.assign(d.run, r);
    return { index, name: r.course.name, counts, authored, supplies: r.course.supplies };
  }, index);
}

async function walk(name, index, points) {
  await floor(index);
  await page.evaluate(points => {
    const r = window.__DEAD_ARRIVAL__.run;
    // Remove combat pressure only for a controlled movement test of the new passage.
    r.dungeonProgression.encounterPlan.forEach(n => n.status = 'cleared');
    r.dungeonProgression.keysCollected = r.course.keys.map(k => k.id);
    Object.assign(r, { x: points[0][0], y: points[0][1], angle: 0, pitch: -.035, mode: 'play', health: 100 });
    window.__v7WalkPoints = points.slice(1);
  }, points);
  await page.locator('#world').click();
  const started = Date.now(), observations = [];
  await page.keyboard.down('w');
  try {
    while (Date.now() - started < 90000) {
      const state = await page.evaluate(() => {
        const r = window.__DEAD_ARRIVAL__.run, points = window.__v7WalkPoints;
        while (points.length && Math.hypot(points[0][0] - r.x, points[0][1] - r.y) < .24) points.shift();
        if (points.length) r.angle = Math.atan2(points[0][1] - r.y, points[0][0] - r.x);
        return { x: r.x, y: r.y, remaining: points.length, mode: r.mode, health: r.health };
      });
      if (observations.length === 0 || Date.now() - observations.at(-1).at > 1000) observations.push({ ...state, at: Date.now() });
      assert.equal(state.mode, 'play');
      if (!state.remaining) break;
      await page.waitForTimeout(60);
    }
  } finally { await page.keyboard.up('w'); }
  const end = await page.evaluate(() => ({ x: window.__DEAD_ARRIVAL__.run.x, y: window.__DEAD_ARRIVAL__.run.y, remaining: window.__v7WalkPoints.length }));
  assert.equal(end.remaining, 0, `${name}: ordinary forward input traverses every turn`);
  report.walks.push({ name, points, seconds: (Date.now() - started) / 1000, end, observations });
  await shot(name);
  console.log('Walked', name);
}

async function touchReadability(viewport, name) {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(300);
  const layout = await page.evaluate(() => {
    const rect = selector => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
    };
    return { overflow: document.documentElement.scrollWidth > innerWidth,
      health: rect('[data-hud="health"]'), status: rect('.hud-bottom'),
      controls: [...document.querySelectorAll('.touch-button')].filter(n => n.getClientRects().length).map(n => {
        const r = n.getBoundingClientRect(); return { action: n.dataset.action, x: r.x, y: r.y, bottom: r.bottom, width: r.width, height: r.height };
      }) };
  });
  report.views.push({ name, layout });
  assert.equal(layout.overflow, false);
  assert(layout.controls.length > 0, 'touch controls are visible');
  assert(layout.health.y >= 0 && layout.health.bottom < viewport.height);
  for (const button of layout.controls) {
    assert(layout.status.bottom + 4 <= button.y, `${name}: status row clears ${button.action}`);
    assert(button.width >= 44 && button.height >= 44, `${button.action}: touch target size`);
  }
  await shot(name);
}

try {
  console.log('Loading isolated map build');
  await page.goto(`http://127.0.0.1:${server.port}/?debug=1&dungeon=0`, { waitUntil: 'domcontentloaded' });
  await Promise.race([
    page.waitForFunction(() => window.__DEAD_ARRIVAL__?.renderer?._weaponsPrepared),
    new Promise((resolve, reject) => page.once('pageerror', reject)),
  ]);
  console.log('Assets ready');
  await page.locator('[data-action="start"]').click();
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__.screen === 'play');
  if (!process.env.MAP_TOUCH_ONLY) {
  for (let index = 0; index < 5; index++) {
    const result = await floor(index);
    for (const [id, count] of Object.entries(result.counts)) assert.equal(count, result.authored[id], `${id}: runtime matches designer budget`);
    report.floors.push(result);
    await shot(`floor-${index + 1}-arrival`);
    console.log('Reviewed floor', index + 1);
  }
  await walk('surgical-key-return', 1, [[27.5,4.5],[27.5,5.5],[24.5,5.5],[24.5,7.5],[22.5,7.5]]);
  await walk('bell-tower-return', 3, [[4.5,4.5],[4.5,9.5],[12.5,9.5]]);
  report.worldResult = 'PASS';
  } else {
    await floor(3);
    await page.evaluate(() => Object.assign(window.__DEAD_ARRIVAL__.run, { x: 12.5, y: 9.5, angle: 0, pitch: -.035 }));
  }
  await page.evaluate(() => window.__DEAD_ARRIVAL__.run.mode = 'ready');
  await touchReadability({ width: 390, height: 844 }, 'portrait-390');
  await page.evaluate(() => window.__DEAD_ARRIVAL__.run.health = 23);
  await touchReadability({ width: 350, height: 740 }, 'portrait-350');
  // Chromium uses this same emulation method for hasTouch contexts. Reuse the
  // loaded page so a second full asset preload cannot exhaust local sockets.
  const touch = await page.context().newCDPSession(page);
  await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  assert.equal(await page.evaluate(() => matchMedia('(pointer:coarse)').matches), true);
  await touchReadability({ width: 844, height: 390 }, 'touch-landscape');
  await touch.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await touch.detach();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => window.__DEAD_ARRIVAL__.pause());
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
