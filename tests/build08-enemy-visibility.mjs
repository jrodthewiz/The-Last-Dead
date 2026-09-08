import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as THREE from '../vendor/three.module.js';
import { createBellwraith } from '../npc-bellwraith.js';
import { makeCampaignCourse, canStand, castRay } from '../engine.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const docsDir = path.resolve('docs');
const gameUrl = process.env.GAME_URL || 'http://127.0.0.1:5200/';
const debugUrl = `${gameUrl}${gameUrl.includes('?') ? '&' : '?'}debug=1&build08=enemy-visibility`;
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
await mkdir(docsDir, { recursive: true });

function deriveOpenLane(course) {
  const spawn = course.playerSpawn;
  for (let distance = 2.5; distance <= 7; distance += .5) {
    const x = spawn.x + Math.cos(spawn.angle) * distance;
    const y = spawn.y + Math.sin(spawn.angle) * distance;
    if (canStand(course, x, y, .16) && castRay(course, spawn.x, spawn.y, spawn.angle, distance + .25).dist >= distance + .25) {
      return { x, y, distance, angle: spawn.angle };
    }
  }
  throw new Error('No valid open lane from the authored player spawn');
}

function attachDiagnostics(page) {
  const state = { consoleErrors: [], pageErrors: [], requestFailures: [], warnings: [] };
  page.on('console', message => {
    const entry = { text: message.text(), location: message.location() };
    if (message.type() === 'error') state.consoleErrors.push(entry);
    if (message.type() === 'warning') state.warnings.push(entry);
  });
  page.on('pageerror', error => state.pageErrors.push(String(error?.stack || error)));
  page.on('requestfailed', request => state.requestFailures.push({ url: request.url(), failure: request.failure()?.errorText || 'unknown' }));
  return state;
}

async function readRenderer(page) {
  return page.evaluate(() => {
    const api = window.__DEAD_ARRIVAL__;
    const renderer = api?.renderer?.renderer;
    const gl = renderer?.getContext?.();
    const ext = gl?.getExtension?.('WEBGL_debug_renderer_info');
    const info = renderer?.info;
    return {
      gpu: gl ? (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : null,
      calls: info?.render?.calls ?? null,
      triangles: info?.render?.triangles ?? null,
      geometries: info?.memory?.geometries ?? null,
      textures: info?.memory?.textures ?? null,
      programs: Array.from(info?.programs || []).map(program => ({ name: program.name || null, runnable: program.diagnostics?.runnable ?? null })),
      wardenStatus: api?.renderer?._wardenStatus || null,
    };
  });
}

const referenceCourse = makeCampaignCourse(0);
const referenceLane = deriveOpenLane(referenceCourse);
const bell = createBellwraith({ variant: 'visibility-contract' });
const bellContract = bell.userData.bellwraith;
bell.traverse(object => { if (object.isMesh) object.geometry?.dispose?.(); });
const browser = await chromium.launch({
  headless: process.env.HEADFUL !== '1',
  executablePath: chromePath,
  args: [
    '--use-angle=d3d11',
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-dev-shm-usage',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const diagnostics = attachDiagnostics(page);
const evidence = {
  url: debugUrl,
  browser: { executablePath: chromePath, headless: process.env.HEADFUL !== '1', angle: 'd3d11' },
  reference: { spawn: referenceCourse.playerSpawn, openLane: referenceLane },
  actualSpawn: null,
  naturalWardenKinds: [],
  bellwraithContract: { floorOffset: bellContract.floorOffset, visualSize: bellContract.visualSize, visualBounds: bellContract.visualBounds },
  renderer: null,
  diagnostics: null,
  errors: [],
};

try {
  await page.goto(debugUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForSelector('#world', { timeout: 20_000 });
  await page.waitForSelector('.start-button', { timeout: 20_000 });
  await page.bringToFront();
  await page.locator('.start-button').click();
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__?.screen === 'play' && window.__DEAD_ARRIVAL__?.run?.mode === 'play', null, { timeout: 10_000 });
  await page.waitForFunction(() => (window.__DEAD_ARRIVAL__?.run?.course?.enemies || []).some(enemy => !enemy.dead), null, { timeout: 12_000 });
  await page.waitForFunction(() => (window.__DEAD_ARRIVAL__?.renderer?._enemyVisuals?.size || 0) > 0, null, { timeout: 5_000 });

  await page.evaluate(() => { window.__DEAD_ARRIVAL__.run.health = 10_000; });
  const readNaturalVisibility = async kind => {
    const actual = await page.evaluate(kind => {
      const api = window.__DEAD_ARRIVAL__;
      const run = api.run;
      const enemy = run.course.enemies.find(candidate => !candidate.dead && candidate.kind === kind);
      if (!enemy) return null;
      run.angle = Math.atan2(enemy.y - run.y, enemy.x - run.x);
      run.pitch = 0;
      run.z = 0;
      return {
        enemy: { id: enemy.id, kind: enemy.kind, variant: enemy.variant, x: enemy.x, y: enemy.y, z: enemy.z, spawnedAt: enemy.spawnedAt },
        player: { x: run.x, y: run.y, angle: run.angle, pitch: run.pitch },
        injected: false,
      };
    }, kind);
    if (!actual) return null;
    await page.waitForTimeout(260);
    const visibility = await page.evaluate(id => {
      const api = window.__DEAD_ARRIVAL__;
      const entry = api.renderer._enemyVisuals.get(id);
      const root = entry?.root;
      let meshCount = 0;
      let visibleMeshCount = 0;
      let frustumCulledCount = 0;
      root?.updateMatrixWorld?.(true);
      root?.traverse?.(object => {
        if (!object.isMesh) return;
        meshCount += 1;
        if (object.visible && object.material) visibleMeshCount += 1;
        if (object.frustumCulled) frustumCulledCount += 1;
      });
      const enemy = api.run.course.enemies.find(candidate => candidate.id === id);
      const worldX = enemy?.x * 4;
      const worldZ = enemy?.y * 4;
      return {
        entry: Boolean(entry),
        rootName: root?.name || null,
        rootVisible: Boolean(root?.visible),
        rootPosition: root?.position?.toArray?.() || null,
        rootScale: root?.scale?.toArray?.() || null,
        expectedPosition: [worldX, 0, worldZ],
        positionError: root ? Math.hypot(root.position.x - worldX, root.position.z - worldZ) : null,
        meshCount,
        visibleMeshCount,
        frustumCulledCount,
        authoredWarden: Boolean(root?.userData?.warden),
        camera: { x: api.run.x, y: api.run.y, angle: api.run.angle, pitch: api.run.pitch },
      };
    }, actual.enemy.id);
    return { ...actual, visibility };
  };

  // Wave one naturally introduces the agile and caster silhouettes. Let the
  // director finish its queue, then release the live wave to reach wave three.
  await page.waitForFunction(() => {
    const run = window.__DEAD_ARRIVAL__?.run;
    return run?.wave === 1 && run?.director?.pending === 0 && (run.course.enemies || []).some(enemy => !enemy.dead && enemy.kind === 1);
  }, null, { timeout: 15_000 });
  for (const kind of [0, 1]) {
    const sample = await readNaturalVisibility(kind);
    if (sample) evidence.naturalWardenKinds.push(sample);
  }
  await page.evaluate(() => {
    const run = window.__DEAD_ARRIVAL__.run;
    for (const enemy of run.course.enemies) if (!enemy.dead) enemy.dead = true;
  });
  await page.waitForFunction(() => {
    const run = window.__DEAD_ARRIVAL__?.run;
    return run?.wave === 2 && run?.director?.pending === 0 && (run.course.enemies || []).some(enemy => !enemy.dead && enemy.kind === 1);
  }, null, { timeout: 15_000 });
  await page.evaluate(() => {
    const run = window.__DEAD_ARRIVAL__.run;
    for (const enemy of run.course.enemies) if (!enemy.dead) enemy.dead = true;
  });
  await page.waitForFunction(() => {
    const run = window.__DEAD_ARRIVAL__?.run;
    return run?.wave === 3 && run?.director?.pending === 0 && (run.course.enemies || []).some(enemy => !enemy.dead && enemy.kind === 2);
  }, null, { timeout: 15_000 });
  const heavy = await readNaturalVisibility(2);
  if (heavy) evidence.naturalWardenKinds.push(heavy);
  evidence.actualSpawn = evidence.naturalWardenKinds[0] || null;
  // Move the live, naturally spawned heavy into a close, centered read for the
  // evidence still. The entity remains campaign-owned; this only changes the
  // debug camera anchor after the visibility measurements are complete.
  const closeTarget = evidence.naturalWardenKinds.find(sample => sample.enemy?.kind === 2) || heavy;
  if (closeTarget) {
    await page.evaluate(({ id }) => {
      const api = window.__DEAD_ARRIVAL__;
      const run = api.run;
      const enemy = run.course.enemies.find(candidate => candidate.id === id);
      if (!enemy) return;
      let dx = run.x - enemy.x;
      let dy = run.y - enemy.y;
      const length = Math.hypot(dx, dy) || 1;
      dx /= length; dy /= length;
      const distance = 1.55;
      run.x = enemy.x + dx * distance;
      run.y = enemy.y + dy * distance;
      run.angle = Math.atan2(enemy.y - run.y, enemy.x - run.x);
      run.pitch = 0;
      run.z = 0;
      run.health = 10_000;
    }, { id: closeTarget.enemy.id });
    await page.waitForTimeout(320);
  }
  evidence.renderer = await readRenderer(page);
  await page.screenshot({ path: path.join(docsDir, 'build08-enemy-visibility-actual.png'), animations: 'disabled' });
} catch (error) {
  evidence.errors.push(String(error?.stack || error));
} finally {
  evidence.diagnostics = JSON.parse(JSON.stringify(diagnostics));
  await page.close();
  await browser.close();
}

const nonAbortedRequestFailures = evidence.diagnostics.requestFailures.filter(entry => !String(entry.failure).includes('ERR_ABORTED'));
const fatal = [
  ...evidence.errors,
  ...evidence.diagnostics.consoleErrors,
  ...evidence.diagnostics.pageErrors,
  ...nonAbortedRequestFailures,
];
evidence.errors = fatal;
await writeFile(path.join(docsDir, 'build08-enemy-visibility-results.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
const naturalFailure = evidence.naturalWardenKinds.some(sample => sample.injected !== false || !sample.visibility?.rootVisible || !sample.visibility?.visibleMeshCount || sample.visibility.positionError > .01 || !sample.visibility.authoredWarden);
if (fatal.length || !evidence.naturalWardenKinds.length || naturalFailure) process.exitCode = 1;