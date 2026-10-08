import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.mjs';

// Isolated production preview: never navigate an existing tab or restart 5200.
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const server = await startServer({ root: fileURLToPath(new URL('../dist/', import.meta.url)), port: 0 });
let browser;
const report = { label: process.argv[2] || 'latest', viewport: [1280, 720], dpr: 1, mode: 'production, synchronized GPU frames', errors: [], rows: [] };
const directory = 'output/playwright/performance';
await mkdir(directory, { recursive: true });
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH,
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(`http://127.0.0.1:${server.port}/?debug=1&dungeon=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => !!window.__DEAD_ARRIVAL__, null, { timeout: 180000 });
  console.log('Application initialized');
  await page.locator('[data-action="start"]').click();
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__.screen === 'play', null, { timeout: 180000 });
  await page.evaluate(() => { window.__DEAD_ARRIVAL__.pause(); });
  const floors = process.env.PERFORMANCE_INPUT_ONLY ? [] : process.env.PERFORMANCE_FLOORS ? process.env.PERFORMANCE_FLOORS.split(',').map(value => value === 'campaign' ? value : Number(value)) : [0, 1, 2, 3, 4, 'campaign'];
  for (const floor of floors) {
    await page.evaluate(async floor => {
      const app = window.__DEAD_ARRIVAL__;
      const engine = await import('./engine.js');
      const { makeDungeonCourse } = await import('./playground/map/dungeon-course.js');
      Object.assign(app.run, engine.newRun(floor === 'campaign' ? engine.makeCampaignCourse(0) : makeDungeonCourse(floor)), { mode: 'pause', health: 10000 });
      app.renderer.render(app.run, performance.now());
      if (app.renderer._warmupPromise) await app.renderer._warmupPromise;
    }, floor);
    console.log(`Prepared ${floor}`);
    for (const scenario of ['exploration', 'camera-turn', 'combat', 'corpses']) {
      const row = await page.evaluate(async ({ floor, scenario }) => {
        const { renderer: r, run } = window.__DEAD_ARRIVAL__;
        const engine = await import('./engine.js');
        const gl = r.renderer.getContext();
        if (scenario === 'combat') {
          run.mode = 'play'; engine.spawnWave(run);
          for (let i = 0; i < 360; i++) engine.tick(run, 1 / 120, {});
          run.mode = 'pause';
          if (!run.course.enemies.some(enemy => !enemy.dead)) throw new Error(`${floor}: combat fixture did not spawn enemies`);
          // Near and distant actor paths, without moving them through walls.
          if (run.course.enemies[0]) {
            run.x = run.course.enemies[0].x - .6; run.y = run.course.enemies[0].y;
            run.angle = 0;
          }
          run.ownedWeapons = engine.weapons.map((_, i) => i);
        }
        if (scenario === 'corpses') for (const enemy of run.course.enemies) { enemy.dead = true; enemy.hp = 0; }
        const stages = {}, originals = [];
        const wrap = (object, key, name = key) => {
          if (!object || typeof object[key] !== 'function') return;
          const original = object[key]; originals.push([object, key, original]);
          object[key] = function(...args) { const t = performance.now(); try { return original.apply(this, args); } finally { stages[name] = (stages[name] || 0) + performance.now() - t; } };
        };
        for (const key of ['_updateCamera','_updateEnemies','_updateCombat','_renderScene','_collectDiagnostics']) wrap(r, key);
        wrap(r.brutalCombatVisuals, 'update', 'brutal'); wrap(r.brutalCombatVisuals?.physics, 'update', 'physics');
        wrap(r.brutalCombatVisuals?.physics, 'sync', 'physics-sync');
        wrap(r.brutalCombatVisuals?.physics, 'ensureRagdoll', 'ragdoll-bind');
        wrap(r.verminVisuals, 'update', 'vermin');
        wrap(r.extractionVFX, 'update', 'extraction'); wrap(r.afterlifeAtmosphere, 'update', 'atmosphere');
        wrap(r.afterlifeLighting, 'update', 'lighting'); wrap(r._transmissionRegion, 'begin', 'transmission');
        wrap(r.renderer.shadowMap, 'render', 'shadows');
        const samples = [], cpu = [], uploads = { createProgram: 0, bufferData: 0, texImage2D: 0 };
        let now = performance.now();
        const step = i => {
          now += 1000 / 60;
          if (scenario === 'combat') {
            engine.switchWeapon(run, i % engine.weapons.length); run.cooldowns.fill(0);
            run.mode = 'play'; engine.shoot(run); run.mode = 'pause';
          }
          if (scenario === 'camera-turn') run.angle += .018;
          run.mode = 'play';
          const simulationStart = performance.now();
          engine.tick(run, 1 / 60, {});
          stages.simulation = (stages.simulation || 0) + performance.now() - simulationStart;
          run.events.length = 0; run.health = 10000;
          const t = performance.now(); r.render(run, now); const submitted = performance.now(); gl.finish(); run.mode = 'pause';
          return [performance.now() - t, submitted - t];
        };
        for (let i = 0; i < 16; i++) step(i);
        const before = { ...r.renderer.info.memory };
        const geometriesBefore = new Set(); r.scene.traverse(object => { if (object.geometry) geometriesBefore.add(object.geometry); });
        const shadowUpdatesBefore = r.afterlifeLighting.shadowUpdates;
        for (const key of Object.keys(stages)) stages[key] = 0;
        for (const key of Object.keys(uploads)) {
          const original = gl[key]; originals.push([gl, key, original]);
          gl[key] = function(...args) { uploads[key]++; return original.apply(this, args); };
        }
        try { for (let i = 0; i < 48; i++) { const [total, submit] = step(i); samples.push(total); cpu.push(submit); } }
        finally { for (const [object, key, original] of originals.reverse()) object[key] = original; }
        const newGeometry = []; r.scene.traverse(object => { if (object.geometry && !geometriesBefore.has(object.geometry)) newGeometry.push({ name: object.name, parent: object.parent?.name, type: object.geometry.type, vertices: object.geometry.attributes.position?.count }); });
        const stats = values => { values.sort((a,b) => a-b); return { median: values[Math.floor(values.length / 2)], p95: values[Math.floor(values.length * .95)], max: values.at(-1) }; };
        return { floor, scenario, frameMs: stats(samples), cpuMs: stats(cpu), stages: Object.fromEntries(Object.entries(stages).map(([key, total]) => [key, +(total / 48).toFixed(3)])),
          uploads, before, after: { ...r.renderer.info.memory }, newGeometry, shadowUpdates: r.afterlifeLighting.shadowUpdates - shadowUpdatesBefore, contextLost: gl.isContextLost(),
          calls: r.renderer.info.render.calls, triangles: r.renderer.info.render.triangles,
          actors: run.course.enemies.length, diagnostics: r.diagnostics(), heapBytes: performance.memory?.usedJSHeapSize };
      }, { floor, scenario });
      report.rows.push(row);
      await writeFile(`${directory}/${report.label}.json`, JSON.stringify(report, null, 2));
      console.log(JSON.stringify({ floor, scenario, frame: row.frameMs, cpu: row.cpuMs, stages: row.stages, uploads: row.uploads, before: row.before, after: row.after }));
      assert.equal(row.contextLost, false);
      assert.equal(row.uploads.createProgram, 0, `${floor}/${scenario}: no shader compilation after warmup`);
      if (floor === 0) await page.screenshot({ path: `${directory}/${report.label}-${scenario}.png` });
    }
  }
  if (report.label !== 'before') {
    // Real frame-loop/input check follows the controlled render fixtures.
    await page.evaluate(async () => { const app = window.__DEAD_ARRIVAL__, { newRun, weapons } = await import('./engine.js'); app.run.course.enemies.length = 0; Object.assign(app.run, newRun(app.run.course), { mode: 'pause', health: 10000, ownedWeapons: weapons.map((_,index) => index) }); app.resume(); });
    await page.locator('#world').click({ position: { x: 640, y: 360 } });
    const start = await page.evaluate(() => ({ time: window.__DEAD_ARRIVAL__.run.time, shots: window.__DEAD_ARRIVAL__.run.shotSequence || 0 }));
    await page.keyboard.down('KeyW'); await page.waitForTimeout(400); await page.keyboard.up('KeyW');
    // The rifle owns shotSequence; the first four weapons use tracer IDs.
    await page.keyboard.press('Digit5');
    await page.mouse.down(); await page.waitForTimeout(450); await page.mouse.up();
    report.input = await page.evaluate(() => ({ time: window.__DEAD_ARRIVAL__.run.time, shots: window.__DEAD_ARRIVAL__.run.shotSequence || 0, health: window.__DEAD_ARRIVAL__.run.health, contextLost: window.__DEAD_ARRIVAL__.renderer.renderer.getContext().isContextLost() }));
    assert.ok(report.input.time > start.time, 'real frame loop advances');
    assert.ok(report.input.shots > start.shots, 'real mouse input fires');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.__DEAD_ARRIVAL__.screen), 'pause');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.__DEAD_ARRIVAL__.screen), 'play');
    await page.screenshot({ path: `${directory}/${report.label}-input.png` });
    console.log(JSON.stringify({ input: report.input, pauseResume: true }));
  }
  assert.deepEqual(report.errors, []);
} finally {
  await writeFile(`${directory}/${report.label}.json`, JSON.stringify(report, null, 2));
  await browser?.close(); await new Promise(resolve => server.server.close(resolve));
}
