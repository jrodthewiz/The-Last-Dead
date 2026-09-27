import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const report = { errors: [], rows: [] };
await mkdir('.logs', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto('http://127.0.0.1:5200/?debug=1&dungeon=0', { waitUntil: 'domcontentloaded' });
  console.log('Waiting for warmup');
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__?.renderer._weaponsPrepared, null, { timeout: 180000 });
  await page.evaluate(() => { const app = window.__DEAD_ARRIVAL__; app.begin(); app.run.mode = 'pause'; });
  const scenarios = process.env.EVENT_BASELINE ? ['evidence', 'key', 'door'] : ['evidence', 'key', 'door', 'door-close', 'fire', 'scare', 'wave', 'telegraph', 'wave-2', 'wave-3', 'wave-4'];
  for (const scenario of scenarios) {
    const row = await page.evaluate(async scenario => {
      const app = window.__DEAD_ARRIVAL__, r = app.renderer, run = app.run;
      const engine = await import('./engine.js');
      const { setDungeonOpeningOpen } = await import('./playground/map/dungeon-course.js');
      run.mode = 'pause'; run.health = 10000; run.waveDelay = 999;
      const gl = r.renderer.getContext();
      r.render(run, performance.now()); gl.finish();
      const beforeRoot = r.worldRoot;
      const preparedBefore = [...(r._preparedEnemyVisuals?.values() || [])].reduce((sum, entries) => sum + entries.length, 0);
      const counts = { createProgram: 0, bufferData: 0, texImage2D: 0 };
      const originals = {};
      for (const key of Object.keys(counts)) {
        originals[key] = gl[key];
        gl[key] = function(...args) { counts[key]++; return originals[key].apply(this, args); };
      }
      const started = performance.now();
      let collected = null;
      let spawnRingCount = null;
      let telegraphEnemy = null;
      if (scenario === 'evidence' || scenario === 'key') {
        const item = scenario === 'evidence' ? run.course.evidence[0] : run.course.keys[0];
        run.x = item.x; run.y = item.y; run.mode = 'play';
        engine.tick(run, 1 / 60, {}); run.mode = 'pause';
        collected = scenario === 'evidence' ? run.storyRecords.some(record => record.id === item.id) : run.dungeonProgression.keysCollected.includes(item.id);
      } else if (scenario.startsWith('door')) {
        const opening = run.course.openings.find(item => item.kind === 'door');
        if (!opening) throw new Error('Missing room-clear fixture');
        setDungeonOpeningOpen(run.course, opening.id, scenario === 'door');
      } else if (scenario === 'fire') {
        run.ownedWeapons = engine.weapons.map((_, index) => index);
        for (let weapon = 0; weapon < engine.weapons.length; weapon++) {
          engine.switchWeapon(run, weapon); run.mode = 'play';
          engine.shoot(run); engine.tick(run, .016, {}); run.mode = 'pause';
          r.render(run, performance.now());
        }
      } else if (scenario === 'scare') r.queueHorrorScare('drop', run);
      else if (scenario === 'telegraph') {
        // Exercise the warning ring on the first authored actor after a wave
        // arrives. The ring is part of the prebuilt actor and must not trigger
        // a first-use shader or buffer upload during the live event.
        const enemy = run.course.enemies.find(candidate => !candidate.dead);
        if (!enemy) throw new Error('Missing authored actor for telegraph fixture');
        enemy.attacking = true; enemy.strike = .25;
        telegraphEnemy = enemy;
        run.spawnTelegraphs = [{ id: 9001, x: enemy.x, y: enemy.y, z: 0, kind: enemy.kind, phase: 0, order: 0, life: .65 }];
      } else if (scenario.startsWith('wave')) {
        // Finish the previous forced encounter before requesting the next one;
        // this keeps each wave row on the authored spawn path instead of
        // measuring a no-op while a dungeon encounter is still active.
        if (run.course.enemies.some(candidate => !candidate.dead)) {
          for (const enemy of run.course.enemies) enemy.dead = true;
          run.mode = 'play'; engine.tick(run, .016, {}); run.mode = 'pause';
        }
        run.mode = 'play'; engine.spawnWave(run); run.mode = 'pause';
      }
      r.render(run, performance.now()); gl.finish();
      if (scenario === 'telegraph') {
        spawnRingCount = r.spawnTelegraphRings?.count || 0;
        run.spawnTelegraphs = [];
        if (telegraphEnemy) { telegraphEnemy.attacking = false; telegraphEnemy.strike = 0; }
      }
      const ms = performance.now() - started;
      for (const [key, original] of Object.entries(originals)) gl[key] = original;
      return { scenario, ms, ...counts, rebuiltWorld: beforeRoot !== r.worldRoot, collected,
        preparedActorsUsed: preparedBefore - [...(r._preparedEnemyVisuals?.values() || [])].reduce((sum, entries) => sum + entries.length, 0),
        spawnRingCount, contextLost: gl.isContextLost(), calls: r.renderer.info.render.calls };
    }, scenario);
    report.rows.push(row); console.log(JSON.stringify(row));
  }
  await page.screenshot({ path: '.logs/event-performance.png' });
  assert.deepEqual(report.errors, []);
  if (!process.env.EVENT_BASELINE) for (const row of report.rows) {
    assert.equal(row.contextLost, false);
    assert.equal(row.createProgram, 0, `${row.scenario}: reuse warmed shaders`);
    assert.equal(row.bufferData, 0, `${row.scenario}: reuse uploaded buffers`);
    assert.equal(row.texImage2D, 0, `${row.scenario}: reuse uploaded textures`);
    if (row.scenario.startsWith('wave')) assert.ok(row.preparedActorsUsed > 0, 'authored waves use prebuilt actors');
    if (['evidence', 'key', 'door', 'door-close'].includes(row.scenario)) {
      assert.equal(row.rebuiltWorld, false, `${row.scenario}: preserve the world`);
    }
    if (row.collected !== null) assert.equal(row.collected, true);
    if (row.scenario === 'telegraph') assert.equal(row.spawnRingCount, 1, 'spawn telegraph uses the preallocated ring pool');
  }
} finally {
  await writeFile(`.logs/event-performance-${process.env.EVENT_BASELINE ? 'before' : 'after'}.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
