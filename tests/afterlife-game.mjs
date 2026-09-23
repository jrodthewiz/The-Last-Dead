import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const base = process.env.DEAD_ARRIVAL_URL || 'http://127.0.0.1:5200/';
const output = new URL(process.env.AFTERLIFE_QA_OUTPUT || '../docs/afterlife-upgrade/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1 });
const errors = [], requests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) requests.push({ url: response.url(), status: response.status() }); });
const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const capture = name => page.screenshot({ path: fileURLToPath(new URL(name + '.png', output)) });
const report = { errors, requests, scenes: [], controls: {}, screenshots: [] };
try {
  await page.goto(base + '?debug=1&dungeon=2', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__?.renderer?._weaponsPrepared, null, { timeout: 60000 });
  await page.locator('[data-action="start"]').click();
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__.run.mode === 'play');
  if (process.env.AFTERLIFE_QA_AUDIO) {
    await page.waitForFunction(() => window.__DEAD_ARRIVAL__.audio.assetsLoaded);
    report.audio = await page.evaluate(() => window.__DEAD_ARRIVAL__.audio.debugInfo);
    assert.deepEqual(report.audio.errors, [], 'all audio assets decode');
  }
  const start = await page.evaluate(() => ({ x: window.__DEAD_ARRIVAL__.run.x, y: window.__DEAD_ARRIVAL__.run.y }));
  await page.keyboard.down('w'); await page.waitForTimeout(350); await page.keyboard.up('w');
  const moved = await page.evaluate(() => ({ x: window.__DEAD_ARRIVAL__.run.x, y: window.__DEAD_ARRIVAL__.run.y }));
  assert.ok(Math.hypot(moved.x - start.x, moved.y - start.y) > .05, 'WASD moves');
  report.controls.movement = { start, moved };
  for (let weapon = 0; weapon < 4; weapon++) {
    await page.keyboard.press(String(weapon + 1));
    await page.waitForFunction(i => window.__DEAD_ARRIVAL__.run.weapon === i, weapon);
    await page.evaluate(() => window.__DEAD_ARRIVAL__.run.cooldowns.fill(0));
    await page.mouse.down();
    await page.waitForFunction(() => window.__DEAD_ARRIVAL__.run.shot > .2);
    await page.mouse.up();
    if (process.env.AFTERLIFE_QA_WEAPONS) {
      await frame();
      await capture(`weapon-${weapon + 1}`);
      report.screenshots.push(`weapon-${weapon + 1}.png`);
    }
  }
  report.controls.weaponsFired = 4;
  if (process.env.AFTERLIFE_QA_AUDIO) {
    report.audio.mechanisms = await page.evaluate(() => {
      const a = window.__DEAD_ARRIVAL__.audio;
      const realShotLayers = [0,1,2,3].map(i => a._lastVariant.has(`mechanism:${i}`));
      for (let i=0; i<8; i++) a._playMechanism(0);
      return { realShotLayers, cappedVoices: a._voices.get('mechanism').size };
    });
    assert.ok(report.audio.mechanisms.realShotLayers.every(Boolean), 'each weapon triggers its mechanism sound');
    assert.equal(report.audio.mechanisms.cappedVoices, 4, 'extra mechanism voices stay capped');
  }
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__.screen === 'pause');
  if (process.env.AFTERLIFE_QA_AUDIO) {
    await page.waitForFunction(() => window.__DEAD_ARRIVAL__.audio.context.state === 'suspended');
    report.audio.pauseSuspendsContext = true;
  }
  await page.locator('[data-action="resume"]').click();
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__.screen === 'play');
  report.controls.pauseResume = true;
  if (process.env.AFTERLIFE_QA_AUDIO) {
    await page.evaluate(() => window.__DEAD_ARRIVAL__.audio.setMuted(true));
    await page.waitForTimeout(150);
    report.audio.mutedGain = await page.evaluate(() => window.__DEAD_ARRIVAL__.audio._master.gain.value);
    assert.ok(report.audio.mutedGain < .001, 'master mute silences the added layer');
    await page.evaluate(() => window.__DEAD_ARRIVAL__.audio.setMuted(false));
  }

  // Preserve the source gallery's fixed camera, using the actual wave director.
  await page.evaluate(async () => {
    const d = window.__DEAD_ARRIVAL__, { tick, newRun } = await import('./engine.js');
    const { makeDungeonCourse } = await import('./playground/map/dungeon-course.js');
    Object.assign(d.run, newRun(makeDungeonCourse(2)), { mode: 'play', x: 19.5, y: 24.2, angle: -Math.PI / 2, pitch: -.025 });
    for (let i = 0; i < 315; i++) tick(d.run, 1 / 60, {});
    d.run.mode = 'ready'; d.renderer._firstCameraFrame = true;
  });
  await frame();
  await page.evaluate(() => window.__DEAD_ARRIVAL__.renderer._warmupPromise);
  await frame();
  await capture('catacombs-afterlife');
  report.screenshots.push('catacombs-afterlife.png');
  report.comparison = await page.evaluate(() => window.__DEAD_ARRIVAL__.renderer.diagnostics());
  assert.ok(report.comparison.afterlifeEnemies >= 2, 'Natural small enemies use the human rig');
  if (process.env.AFTERLIFE_QA_ITERATION) {
    assert.equal(report.comparison.ashWitness.loaded, true, 'new Meshy/Blender asset loaded');
    assert.equal(report.comparison.ashWitness.error, null);
    assert.ok(report.comparison.ashWitness.instances >= 2, 'natural melee enemies use Ash Witness');
    assert.equal(report.comparison.ashWitness.clips.length, 3, 'three authored Blender clips shipped');
    assert.equal(report.comparison.afterlifeMapDesign.externalPropsAttached.length, 2);
    assert.deepEqual(report.comparison.afterlifeMapDesign.externalPropErrors, []);
    report.floorTexture = await page.evaluate(() => {
      const map = window.__DEAD_ARRIVAL__.renderer.materials.floor.map;
      return { width: map.image.width, height: map.image.height };
    });
    assert.equal(report.floorTexture.width, 1024, 'generated floor texture is active');
    for (const [kind, name, front] of [['wheelchair','wheelchair-in-game',1],['mourningCabinet','cabinet-in-game',-1]]) {
      await page.evaluate(async ({kind,front}) => {
        const d=window.__DEAD_ARRIVAL__,THREE=await import('./vendor/three.module.js');
        let prop;
        d.renderer.worldRoot.traverse(node=>{if(node.userData.afterlifeProp===kind)prop=node;});
        if(!prop)throw new Error('Missing integrated prop: '+kind);
        const target=prop.getWorldPosition(new THREE.Vector3());
        const approach=new THREE.Vector3(.8,0,front*3.3).applyQuaternion(prop.getWorldQuaternion(new THREE.Quaternion()));
        const position=target.clone().add(approach);
        Object.assign(d.run,{mode:'ready',x:position.x/4,y:position.z/4,angle:Math.atan2(-approach.z,-approach.x),pitch:kind==='wheelchair'?-.22:-.1});
        d.renderer._firstCameraFrame=true;
      }, {kind,front});
      await frame();await capture(name);report.screenshots.push(name+'.png');
    }
  }

  for (const [type, count] of [['dungeon', 5], ['campaign', 3]]) {
    for (let index = 0; index < count; index++) {
      await page.evaluate(async ({ type, index }) => {
        const d = window.__DEAD_ARRIVAL__, { newRun, makeCampaignCourse } = await import('./engine.js');
        const { makeDungeonCourse } = await import('./playground/map/dungeon-course.js');
        const course = type === 'dungeon' ? makeDungeonCourse(index) : makeCampaignCourse(index);
        Object.assign(d.run, newRun(course), { mode: 'ready' });
        d.renderer._firstCameraFrame = true;
      }, { type, index });
      await frame();
      await page.evaluate(() => window.__DEAD_ARRIVAL__.renderer._warmupPromise);
      await frame();
      const name = `${type}-${index + 1}`;
      await capture(name);
      const diagnostics = await page.evaluate(() => {
        const d = window.__DEAD_ARRIVAL__, r = d.renderer;
        r.render(d.run, performance.now());
        const gl = r.renderer.getContext(), pixels = new Uint8Array(32 * 32 * 4);
        gl.readPixels(Math.floor(gl.drawingBufferWidth * .45), Math.floor(gl.drawingBufferHeight * .45), 32, 32, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        const values = [...pixels].filter((_, i) => i % 4 !== 3);
        return { ...r._collectDiagnostics(d.run), cameraAspect: r.camera.aspect, pixelRange: [Math.min(...values), Math.max(...values)] };
      });
      assert.equal(diagnostics.error, null);
      assert.ok(diagnostics.pixelRange[1] > diagnostics.pixelRange[0], name + ' canvas is varied');
      assert.equal(diagnostics.afterlifeLighting.practicalPool, 6);
      report.scenes.push({ name, diagnostics });
      console.log('Verified ' + name + ': ' + diagnostics.calls + ' calls');
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await frame(); await capture('mobile');
  report.mobile = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, aspect: window.__DEAD_ARRIVAL__.renderer.camera.aspect }));
  assert.ok(Math.abs(report.mobile.aspect - 390 / 844) < .001);
  await page.setViewportSize({ width: 1536, height: 864 });
  await page.evaluate(() => { const d = window.__DEAD_ARRIVAL__; d.begin(); d.run.health = 100; });
  await frame();
  await page.evaluate(() => window.__DEAD_ARRIVAL__.renderer._warmupPromise);
  await page.waitForTimeout(1500);
  report.performance = await page.evaluate(() => new Promise(resolve => {
    const samples = []; let previous = performance.now();
    function measure(now) {
      window.__DEAD_ARRIVAL__.run.health = 100;
      samples.push(now - previous); previous = now;
      if (samples.length < 180) requestAnimationFrame(measure);
      else { samples.sort((a,b)=>a-b); resolve({ samples: samples.length, medianMs: samples[90], p95Ms: samples[171] }); }
    }
    requestAnimationFrame(measure);
  }));
  report.restart = await page.evaluate(() => window.__DEAD_ARRIVAL__.renderer.diagnostics());
  report.memory = await page.evaluate(() => performance.memory ? {
    usedHeapMB: Math.round(performance.memory.usedJSHeapSize / 1048576),
    totalHeapMB: Math.round(performance.memory.totalJSHeapSize / 1048576),
  } : null);
  await capture('active-play');
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  console.log('AFTERLIFE QA PASSED');
} finally {
  await writeFile(new URL('qa-results.json', output), JSON.stringify(report, null, 2));
  await browser.close();
}
