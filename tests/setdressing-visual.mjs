import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from '../vendor/three.module.js';
import { makeCampaignCourse, newRun } from '../engine.js';
import { buildSetDressing, SETDRESSING_SPECS } from '../world-setdressing.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const url = process.env.DEAD_ARRIVAL_URL || 'http://127.0.0.1:5200/';
const output = resolve(process.env.SETDRESSING_QA_DIR || 'docs/setdressing-qa');
const sectors = process.env.SETDRESSING_QA_SECTORS ? process.env.SETDRESSING_QA_SECTORS.split(',').map(Number) : [0, 1, 2];
await mkdir(output, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const report = { url, views: [], sectorCounts: [], errors: [] };
try {
  for (const sector of sectors) {
    // The renderer batches static mesh groups away. Use the same live course
    // state as begin() before batching to recover every original prop pivot.
    const course = newRun(makeCampaignCourse(sector), { requireEntry: true }).course;
    const props = buildSetDressing(new THREE.Group(), {}, course);
    const candidates = [], counts = {};
    for (const prop of props.children) {
      const kind = prop.userData.setDressing;
      const instance = counts[kind] || 0;
      counts[kind] = instance + 1;
      const fx = Math.sin(prop.rotation.y), fz = Math.cos(prop.rotation.y);
      const sx = Math.cos(prop.rotation.y), sz = -Math.sin(prop.rotation.y);
      const bounds = new THREE.Box3().setFromObject(prop);
      const targetY = Math.min(1.8, Math.max(.65, bounds.max.y * .55));
      const room = course.rooms.find(item => prop.position.x / 4 >= item.bounds.minX && prop.position.x / 4 <= item.bounds.maxX && prop.position.z / 4 >= item.bounds.minZ && prop.position.z / 4 <= item.bounds.maxZ);
      const directions = SETDRESSING_SPECS[kind].wall
        ? [[fx, fz], [fx * .83 + sx * .56, fz * .83 + sz * .56], [fx * .83 - sx * .56, fz * .83 - sz * .56]]
        : [[1, 0], [0, 1], [-1, 0], [0, -1], [.7, .7], [.7, -.7], [-.7, .7], [-.7, -.7]];
      for (const [dx, dz] of directions) {
        const distance = kind === 'specimenVat' ? 5 : kind === 'fallenBell' ? 4.5 : 4;
        const px = prop.position.x + dx * distance, pz = prop.position.z + dz * distance;
        const x = px / 4, y = pz / 4;
        if (room && (x < room.bounds.minX + .25 || x > room.bounds.maxX - .25 || y < room.bounds.minZ + .25 || y > room.bounds.maxZ - .25)) continue;
        candidates.push({ kind, instance, x, y, angle: Math.atan2(prop.position.z - pz, prop.position.x - px), pitch: Math.atan2(targetY - 1.6, distance), target: [prop.position.x, targetY, prop.position.z], radius: SETDRESSING_SPECS[kind].radius, distance });
      }
    }
    report.sectorCounts.push({ sector, counts });
    const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(90_000);
    page.on('pageerror', error => report.errors.push({ sector, type: 'page', message: error.message }));
    page.on('requestfailed', request => {
      const message = request.failure()?.errorText;
      if (message === 'net::ERR_ABORTED') return; // cancelled by page close
      report.errors.push({ sector, type: 'request', url: request.url(), message });
    });
    await page.goto(`${url}?debug=1&sector=${sector}`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-action="start"]').click();
    await page.waitForFunction(() => window.__DEAD_ARRIVAL__?.screen === 'play');
    const ranked = await page.evaluate(async candidates => {
      const THREE = await import('/vendor/three.module.js');
      const world = window.__DEAD_ARRIVAL__.renderer.worldRoot;
      world.updateMatrixWorld(true);
      const ray = new THREE.Raycaster();
      return candidates.map(view => {
        const origin = new THREE.Vector3(view.x * 4, 1.6, view.y * 4);
        const target = new THREE.Vector3(...view.target);
        const distance = origin.distanceTo(target);
        ray.set(origin, target.sub(origin).normalize());
        ray.far = distance;
        const hit = ray.intersectObject(world, true)[0];
        const early = hit ? Math.max(0, distance - view.radius * 1.25 - hit.distance) : 0;
        return { ...view, firstHit: hit?.object.name || null, hitDistance: hit?.distance ?? null, score: -early * 5 + (view.distance <= 4 ? .1 : 0) };
      });
    }, candidates);
    const best = new Map();
    for (const view of ranked) if (!best.has(view.kind) || view.score > best.get(view.kind).score) best.set(view.kind, view);
    const views = [...best.values()];
    if (sector === 0) views.push({ kind: 'gate', x: 2, y: 10.3, angle: -Math.PI / 2, pitch: .05 });
    await page.addStyleTag({ content: '.toast-stack { visibility: hidden !important; }' });
    for (const view of views) {
      const state = await page.evaluate(({ x, y, angle, pitch }) => {
        const api = window.__DEAD_ARRIVAL__;
        const run = api.run;
        run.mode = 'pause';
        run.course.enemies = [];
        run.x = x; run.y = y; run.z = 0;
        run.angle = angle; run.pitch = pitch;
        api.renderer.weaponRig.visible = false;
        api.renderer.render(run, performance.now());
        const info = api.renderer.renderer.info;
        return { sector: run.sectorId, x, y, angle, pitch, fps: api.fps, calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures, canvas: [api.renderer.renderer.domElement.width, api.renderer.renderer.domElement.height] };
      }, view);
      const file = `${sector}-${view.kind}.png`;
      await page.screenshot({ path: resolve(output, file), timeout: 90_000 });
      report.views.push({ file, instance: view.instance, score: view.score, firstHit: view.firstHit, hitDistance: view.hitDistance, ...state });
      console.log(`shot ${file} ${state.calls} calls ${state.triangles} triangles`);
    }
    await page.close();
  }
} finally {
  await browser.close();
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
}
if (report.errors.length) process.exitCode = 1;
