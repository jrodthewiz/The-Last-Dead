// Run with local Playwright or PLAYWRIGHT_PATH and optional CHROME_PATH.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const output = 'output/playwright/bodycam';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH, args: ['--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(180000);
const report = { errors: [], captures: [], timings: {} };
page.on('pageerror', e => report.errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
page.on('response', r => { if (r.status() >= 400) report.errors.push(`${r.status()} ${r.url()}`); });
await page.addInitScript(() => {
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(t => { if (!window.__bodycamQAFreeze) cb(t); });
});
const base = process.env.DEAD_ARRIVAL_URL || 'http://127.0.0.1:5200/';
try {
  await page.goto(`${base}?debug=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__, null, { timeout: 180000 });
  await page.locator('[data-action="settings"]').click();
  await page.getByText('Body-cam lens', { exact: true }).click();
  assert.equal(await page.evaluate(() => window.__DEAD_ARRIVAL__.renderer.settings.bodycam), false);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__?.renderer._weaponsPrepared, null, { timeout: 180000 });
  assert.equal(await page.evaluate(() => window.__DEAD_ARRIVAL__.renderer.settings.bodycam), false, 'preference persists');
  console.log('Bodycam: preference persisted');
  await page.locator('[data-action="settings"]').click();
  await page.getByText('Body-cam lens', { exact: true }).click();
  await page.locator('[data-action="close-settings"]').click();
  await page.locator('[data-action="start"]').click();
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__.screen === 'play');
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('#bodycam-hud').isVisible(), true);
  const before = await page.evaluate(() => { const r = window.__DEAD_ARRIVAL__.run; return [r.x, r.y]; });
  await page.keyboard.down('w');
  await page.waitForTimeout(300);
  await page.keyboard.up('w');
  const after = await page.evaluate(() => { const r = window.__DEAD_ARRIVAL__.run; return [r.x, r.y]; });
  assert.ok(Math.hypot(after[0] - before[0], after[1] - before[1]) > .01, 'movement');
  report.movingMount = await page.evaluate(() => ({ ...window.__DEAD_ARRIVAL__.renderer.bodycamMotion.pose }));
  assert.ok(report.movingMount.y < -.1, 'bodycam uses the lower chest mount');
  await page.keyboard.press('5');
  await page.mouse.down();
  await page.waitForTimeout(250);
  await page.mouse.up();
  assert.equal(await page.evaluate(() => window.__DEAD_ARRIVAL__.run.weapon), 4);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#bodycam-hud').isVisible(), false, 'REC hidden while paused');
  await page.locator('[data-action="settings"]').click();
  await page.getByText('Reduced motion', { exact: true }).click();
  await page.locator('[data-action="close-settings"]').click();
  await page.locator('[data-action="resume"]').click();
  await page.waitForTimeout(150);
  assert.deepEqual(await page.evaluate(() => window.__DEAD_ARRIVAL__.renderer.bodycam.material.uniforms.uBlur.value.toArray()), [0, 0]);
  assert.deepEqual(await page.evaluate(() => ({ ...window.__DEAD_ARRIVAL__.renderer.bodycamMotion.pose })), { x: 0, y: 0, pitch: 0, roll: 0 });
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.bc-rec i')).animationName), 'none');
  console.log('Bodycam: gameplay and reduced motion passed');

  await page.evaluate(() => { window.__bodycamQAFreeze = true; });
  await page.waitForTimeout(100);
  report.manifest = await page.evaluate(() => {
    const { renderer: r, run } = window.__DEAD_ARRIVAL__;
    r.bodycam.fixedTime = 12;
    r.bodycam.reset();
    r.settings.reducedMotion = false;
    r.render(run, 12000);
    r.camera.updateWorldMatrix(true, false);
    return { course: run.course.id, seed: r.afterlifeAtmosphere?.diagnostics().seed, viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, fixedTime: 12, camera: r.camera.matrixWorld.toArray(), projection: r.camera.projectionMatrix.toArray() };
  });
  for (const [name, mode] of [['final', 0], ['no-post', 1], ['lens-field', 2], ['contribution', 3], ['sensor-noise', 4]]) {
    await page.evaluate(mode => { const r = window.__DEAD_ARRIVAL__.renderer; r.bodycam.debugMode = mode; r._renderScene(12000); }, mode);
    await page.screenshot({ path: `${output}/${name}.png` });
    report.captures.push(name);
  }
  report.diagnostics = await page.evaluate(() => { const a = window.__DEAD_ARRIVAL__; return a.renderer._collectDiagnostics(a.run); });
  assert.ok(report.diagnostics.calls > 2, 'whole scene draw counts survive the resolve');
  for (const enabled of [false, true]) {
    report.timings[enabled ? 'bodycam' : 'direct'] = await page.evaluate(async enabled => {
      const r = window.__DEAD_ARRIVAL__.renderer;
      r.settings.bodycam = enabled;
      r.bodycam.debugMode = 0;
      const times = [];
      for (let i = 0; i < 45; i++) {
        const start = performance.now();
        r._renderScene(12000 + i * 16.667);
        // Explicitly include GPU completion; these are wall times, not GPU timer queries.
        r.renderer.getContext().finish();
        if (i >= 15) times.push(performance.now() - start);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      times.sort((a, b) => a - b);
      return { medianWallMs: times[15], p95WallMs: times[28], calls: r.renderer.info.render.calls };
    }, enabled);
  }
  // All weapon materials, including transmission and depth-boundary hooks.
  for (let weapon = 0; weapon < 8; weapon++) {
    await page.evaluate(weapon => {
      const a = window.__DEAD_ARRIVAL__;
      a.run.weapon = weapon; a.run.shot = .8;
      a.renderer.render(a.run, 13000 + weapon * 100);
    }, weapon);
  }
  await page.screenshot({ path: `${output}/weapon.png` });
  for (const [width, height] of [[390, 844], [1920, 810], [1280, 720]]) {
    await page.setViewportSize({ width, height });
    const sizes = await page.evaluate(() => {
      const a = window.__DEAD_ARRIVAL__; a.renderer.resize(); a.renderer.render(a.run, 14000);
      const t = a.renderer.bodycam.target, c = a.renderer.canvas;
      return [t.width, t.height, c.width, c.height];
    });
    assert.deepEqual(sizes.slice(0, 2), sizes.slice(2));
    await page.screenshot({ path: `${output}/resize-${width}.png` });
  }
  report.pipeline = await page.evaluate(async () => {
    const THREE = await import('./vendor/three.module.js');
    const { BodycamPass } = await import('./bodycam-pass.js');
    const r = new THREE.WebGLRenderer({ antialias: true });
    r.setSize(320, 180); r.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    // Use shaded geometry: Three deliberately does not tone-map clear colors.
    const geometry = new THREE.SphereGeometry(10, 16, 12);
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(.18, .18, .18), side: THREE.BackSide });
    scene.add(new THREE.Mesh(geometry, material));
    const camera = new THREE.PerspectiveCamera(92, 320 / 180, .1, 100);
    const pass = new BodycamPass(r); pass.reducedMotion = true; pass.fixedTime = 12;
    const pixel = (x, y) => { const p = new Uint8Array(4); r.getContext().readPixels(x, y, 1, 1, r.getContext().RGBA, r.getContext().UNSIGNED_BYTE, p); return [...p]; };
    r.render(scene, camera); const direct = pixel(160, 90);
    pass.debugMode = 1; pass.render(scene, camera, 1000); const resolved = pixel(160, 90);
    pass.debugMode = 0; pass.render(scene, camera, 1016);
    const corners = [[1, 1], [318, 1], [1, 178], [318, 178]].map(([x, y]) => pixel(x, y));
    pass.fixedTime = null; pass.reducedMotion = false;
    const motion = [];
    for (let i = 0; i < 30; i++) {
      camera.rotation.y += i < 15 ? .02 : 0;
      pass.render(scene, camera, 1032 + i * 16);
      motion.push(pass.material.uniforms.uBlur.value.toArray());
    }
    const gain = [];
    const noiseVariance = [];
    // Fast-turn readout must still fill portrait and wide corners.
    const lensCorners = [];
    pass.fixedTime = 12;
    for (const [width, height] of [[180, 390], [320, 180], [480, 180]]) {
      r.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix();
      pass.reset(); pass.render(scene, camera, 1600);
      camera.rotation.y += .18; camera.rotation.x += .1;
      pass.render(scene, camera, 1616);
      lensCorners.push([[1, 1], [width - 2, 1], [1, height - 2], [width - 2, height - 2]].map(([x, y]) => pixel(x, y)));
    }
    pass.fixedTime = null;
    for (const brightness of [.005, 4]) {
      material.color.setRGB(brightness, brightness, brightness);
      for (let i = 0; i < 60; i++) pass.render(scene, camera, 2000 + gain.length * 7000 + i * 100);
      const pixels = new Uint16Array(4);
      r.readRenderTargetPixels(pass.exposureTargets[pass.exposureIndex], 0, 0, 1, 1, pixels);
      gain.push(THREE.DataUtils.fromHalfFloat(pixels[0]));
      pass.debugMode = 4;
      pass.render(scene, camera, 2000 + (gain.length-1) * 7000 + 5916);
      const encoded = new Uint8Array(480*180*4);
      r.getContext().readPixels(0,0,480,180,r.getContext().RGBA,r.getContext().UNSIGNED_BYTE,encoded);
      let sum=0, squared=0, count=0;
      for(let i=0;i<encoded.length;i+=16){const v=encoded[i]-127.5;sum+=v;squared+=v*v;count++;}
      noiseVariance.push(squared/count-(sum/count)**2);
      pass.debugMode = 0;
    }
    const texturesBefore = r.info.memory.textures;
    pass.dispose(); const texturesAfter = r.info.memory.textures;
    geometry.dispose(); material.dispose();
    r.dispose();
    return { direct, resolved, corners, lensCorners, motion, gain, noiseVariance, texturesBefore, texturesAfter };
  });
  const p = report.pipeline;
  assert.ok(p.direct.slice(0, 3).every((v, i) => Math.abs(v - p.resolved[i]) <= 2), 'one tone map/output conversion');
  assert.ok(p.corners.every(p => p.slice(0, 3).every(v => v > 20)), 'no black lens wedges');
  assert.ok(p.lensCorners.flat().every(p => p.slice(0, 3).every(v => v > 20)), 'fast-turn corners stay filled at every aspect');
  assert.ok(p.motion.slice(0, 15).some(v => Math.abs(v[0]) > .001), 'turn motion response');
  assert.ok(p.motion.at(-1).every(value => value === 0), 'blur settles when turning stops');
  assert.ok(p.gain[0] > 1.5 && p.gain[1] < 1, 'exposure adapts to darkness and bright light');
  assert.ok(p.noiseVariance[0] > p.noiseVariance[1]*4, 'sensor noise rises with dark gain, rather than coating all light levels equally');
  assert.ok(p.texturesAfter < p.texturesBefore, 'targets released on disposal');
  assert.deepEqual(report.errors, []);
  report.ok = true;
  console.log(JSON.stringify({ ok: true, timings: report.timings, pipeline: report.pipeline, output }));
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
