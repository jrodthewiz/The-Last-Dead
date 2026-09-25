import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const base = process.env.DEAD_ARRIVAL_URL || 'http://127.0.0.1:5200/';
const output = process.env.POLISH_LOOK_OUTPUT || 'docs/polish-iteration/final';
const floors = process.env.POLISH_FLOORS
  ? process.env.POLISH_FLOORS.split(',').map(Number).filter(index => Number.isInteger(index) && index >= 0 && index < 5)
  : [0, 4];
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const report = { errors: [], httpErrors: [], floors: [] };
page.on('pageerror', error => report.errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
page.on('response', response => {
  if (response.status() >= 400) report.httpErrors.push({ url: response.url(), status: response.status() });
});

try {
  await page.goto(`${base}?debug=1&dungeon=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__DEAD_ARRIVAL__, null, { timeout: 120000 });
  await page.evaluate(() => window.__DEAD_ARRIVAL__.begin(false));
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__?.screen === 'play', null, { timeout: 120000 });
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__?.renderer?._weaponsPrepared, null, { timeout: 60000 });
  report.bodycam = await page.evaluate(() => {
    const ui = document.querySelector('#ui');
    const previous = ui.dataset.reducedMotion;
    ui.dataset.reducedMotion = 'true';
    const reduced = getComputedStyle(ui, '::before').animationName;
    ui.dataset.reducedMotion = 'false';
    const normal = getComputedStyle(ui, '::before').animationName;
    ui.dataset.reducedMotion = previous;
    return { reduced, normal };
  });
  assert.equal(report.bodycam.reduced, 'none');
  assert.equal(report.bodycam.normal, 'bodycam-roll');

  for (const floor of floors) {
    const detail = await page.evaluate(async index => {
      const app = window.__DEAD_ARRIVAL__;
      const [{ newRun, canStand }, { makeDungeonCourse }] = await Promise.all([
        import('./engine.js'), import('./playground/map/dungeon-course.js'),
      ]);
      const course = makeDungeonCourse(index);
      Object.assign(app.run, newRun(course), { mode: 'ready', health: 1000, kills: 7 });
      const source = course.lights.find(light => light.role === (index === 0 ? 'hall' : 'entry')) || course.lights[0];
      const [x, z] = source.anchor;
      const offsets = [[0, -2], [0, 2], [-2, 0], [2, 0], [0, -3], [0, 3]];
      const [dx, dz] = offsets.find(([ox, oz]) => canStand(course, x + .5 + ox, z + .5 + oz, .1)) || [0, 0];
      app.run.x = x + .5 + dx;
      app.run.y = z + .5 + dz;
      app.run.angle = Math.atan2(z - app.run.y, x - app.run.x);
      app.run.pitch = index === 4 ? .08 : -.24;
      app.ui.hud(app.run);
      app.renderer._firstCameraFrame = true;
      app.renderer.render(app.run, performance.now());
      await app.renderer._warmupPromise;
      app.renderer.render(app.run, performance.now() + 16);
      return {
        course: course.id,
        source: source.role,
        position: [app.run.x, app.run.y],
        kills: document.querySelector('[data-hud="kills"]')?.textContent,
        diagnostics: app.renderer._collectDiagnostics(app.run),
      };
    }, floor);
    await page.screenshot({ path: `${output}/floor-${floor + 1}-fixture.png` });
    report.floors.push(detail);
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.httpErrors, []);
  assert.ok(report.floors.every(floor => floor.kills === 'KILLS 07'));
  console.log(JSON.stringify({ ok: true, floors: report.floors.map(floor => ({
    course: floor.course, calls: floor.diagnostics.calls,
    triangles: floor.diagnostics.gpuTriangles, kills: floor.kills,
  })) }));
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
