import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { makeCampaignCourse, canStand, castRay } from '../engine.js';

const require = createRequire(import.meta.url);
const playwrightModule = process.env.PLAYWRIGHT_PATH || 'playwright';
const { chromium } = require(playwrightModule);
const docsDir = path.resolve('docs');
const gameUrl = process.env.GAME_URL || 'http://127.0.0.1:5200/';
const debugUrl = `${gameUrl}${gameUrl.includes('?') ? '&' : '?'}debug=1&build06=game`;
const chromePath = process.env.CHROME_PATH;
const smokeStartedAt = new Date().toISOString();

await mkdir(docsDir, { recursive: true });

function deriveOpenLane(course) {
  const spawn = course.playerSpawn;
  const candidates = [];
  for (let distance = 2.5; distance <= 7; distance += 0.5) {
    const point = {
      x: spawn.x + Math.cos(spawn.angle) * distance,
      y: spawn.y + Math.sin(spawn.angle) * distance,
    };
    candidates.push(point);
    if (canStand(course, point.x, point.y, 0.16)
      && castRay(course, spawn.x, spawn.y, spawn.angle, distance + 0.25).dist >= distance + 0.25) {
      return { ...point, distance, angle: spawn.angle };
    }
  }
  throw new Error(`No open camera lane from ${JSON.stringify(spawn)}; candidates=${JSON.stringify(candidates)}`);
}

const referenceCourse = makeCampaignCourse(0);
const openLane = deriveOpenLane(referenceCourse);
const spawn = referenceCourse.playerSpawn;

function diagnosticsFor(page, label) {
  const state = { label, consoleErrors: [], consoleWarnings: [], pageErrors: [], requestFailures: [] };
  page.on('console', message => {
    const entry = { type: message.type(), text: message.text(), location: message.location() };
    if (message.type() === 'error') state.consoleErrors.push(entry);
    if (message.type() === 'warning') state.consoleWarnings.push(entry);
  });
  page.on('pageerror', error => state.pageErrors.push(String(error?.stack || error)));
  page.on('requestfailed', request => state.requestFailures.push({
    url: request.url(),
    method: request.method(),
    failure: request.failure()?.errorText || 'unknown',
  }));
  return state;
}

async function startGame(page) {
  await page.goto(debugUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForSelector('#world', { timeout: 20_000 });
  await page.waitForSelector('.start-button', { timeout: 20_000 });
  await page.bringToFront();
  await page.locator('.start-button').click();
  await page.waitForFunction(
    () => window.__DEAD_ARRIVAL__?.screen === 'play' && window.__DEAD_ARRIVAL__?.run?.mode === 'play',
    null,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(500);
}

async function setControlledCamera(page) {
  await page.evaluate(({ x, y, angle }) => {
    const api = window.__DEAD_ARRIVAL__;
    api.run.x = x;
    api.run.y = y;
    api.run.z = 0;
    api.run.angle = angle;
    api.run.pitch = 0;
  }, { x: spawn.x, y: spawn.y, angle: spawn.angle });
  return page.evaluate(() => ({
    x: window.__DEAD_ARRIVAL__.run.x,
    y: window.__DEAD_ARRIVAL__.run.y,
    angle: window.__DEAD_ARRIVAL__.run.angle,
    pitch: window.__DEAD_ARRIVAL__.run.pitch,
    sector: window.__DEAD_ARRIVAL__.run.sectorId,
  }));
}

async function selectBazooka(page) {
  await page.bringToFront();
  await page.keyboard.press('Digit4');
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__?.run?.weapon === 3, null, { timeout: 2_000 });
}

async function lockCanvas(page) {
  await page.bringToFront();
  const canvas = page.locator('#world');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('world canvas has no bounds');
  const position = { x: Math.round(box.width * 0.5), y: Math.round(box.height * 0.5) };
  await canvas.click({ position });
  try {
    await page.waitForFunction(() => document.pointerLockElement?.id === 'world', null, { timeout: 2_000 });
  } catch {
    await canvas.click({ position });
    await page.waitForFunction(() => document.pointerLockElement?.id === 'world', null, { timeout: 2_000 });
  }
  return { position, pointerLocked: await page.evaluate(() => document.pointerLockElement?.id === 'world') };
}

async function fireBazookaAndDetonate(page) {
  await page.bringToFront();
  const canvas = page.locator('#world');
  const box = await canvas.boundingBox();
  const position = { x: Math.round((box?.width || 1000) * 0.5), y: Math.round((box?.height || 800) * 0.5) };
  let fired = false;
  for (let attempt = 0; attempt < 3 && !fired; attempt += 1) {
    await page.mouse.down({ button: 'left' });
    await page.mouse.up({ button: 'left' });
    await page.waitForTimeout(40);
    fired = await page.evaluate(() => {
      const run = window.__DEAD_ARRIVAL__?.run;
      return Boolean(run?.weapon === 3 && (run.projectiles?.some(p => p.kind === 'rocket') || run.shot > 0));
    });
    if (!fired) await page.waitForTimeout(1_150);
  }
  if (!fired) throw new Error('Pointer-locked bazooka input did not create a live rocket');

  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  try {
    await page.waitForFunction(
      () => (window.__DEAD_ARRIVAL__?.run?.explosions?.length || 0) > 0,
      null,
      { timeout: 1_500 },
    );
  } catch {
    await page.waitForFunction(
      () => (window.__DEAD_ARRIVAL__?.run?.explosions?.length || 0) > 0,
      null,
      { timeout: 2_500 },
    );
  }
  await page.waitForTimeout(30);
  const explosion = await page.evaluate(() => {
    const api = window.__DEAD_ARRIVAL__;
    return {
      runExplosions: api.run.explosions.length,
      diagnostics: api.renderer.weaponFX?.explosions?.diagnostics?.() || null,
      weapon: api.run.weapon,
    };
  });
  return { fired, explosion, position };
}

async function injectBellwraithPreview(page) {
  const preview = await page.evaluate(({ x, y }) => {
    const api = window.__DEAD_ARRIVAL__;
    if (api.screen !== 'play' || api.run?.mode !== 'play') api.begin(false);
    const run = api.run;
    run.course.enemies.length = 0;
    run.spawnTelegraphs.length = 0;
    run.projectiles.length = 0;
    run.explosions.length = 0;
    if (run.director) {
      run.director.state = 'exit';
      run.director.queue = [];
      run.director.pending = 0;
      run.director.active = 0;
    }
    const id = 99001;
    run.nextId = Math.max(run.nextId, id + 1);
    run.course.enemies.push({
      id, x, y, z: 0, hp: 100, maxHp: 100, kind: 3, variant: 'bellwraithEcho',
      dead: false, flash: 0, attack: 999, phase: 0.45, moveSpeed: 0,
      attackCooldown: 999, windupTime: 999, contactDamage: 0, spawnedAt: run.time,
    });
    run.angle = -Math.PI / 2;
    run.pitch = 0;
    run.health = 100;
    run.mode = 'play';
    api.renderer._updateEnemies?.(run, performance.now());
    return { id, x, y, pitch: run.pitch, directorState: run.director?.state || null };
  }, { x: openLane.x, y: openLane.y });
  await page.evaluate(() => {
    const api = window.__DEAD_ARRIVAL__;
    api.run.mode = 'play';
    api.renderer._updateEnemies?.(api.run, performance.now());
  });
  await page.waitForTimeout(250);
  const visual = await page.evaluate(id => {
    const entry = window.__DEAD_ARRIVAL__.renderer._enemyVisuals.get(id);
    const root = entry?.root;
    return {
      exists: Boolean(entry),
      rootName: root?.name || null,
      bellwraithFlag: Boolean(root?.userData?.bellwraith),
      meshCount: root ? root.traverse ? (() => { let count = 0; root.traverse(() => { count += 1; }); return count; })() : 0 : 0,
    };
  }, preview.id);
  return { preview, visual };
}

async function samplePerformance(page, durationMs = 30_000) {
  await page.bringToFront();
  await page.evaluate(duration => {
    const state = { started: performance.now(), duration, frames: 0, samples: [], done: false };
    let last = state.started;
    let bucketFrames = 0;
    window.__BUILD06_PERF__ = state;
    const frame = now => {
      state.frames += 1;
      bucketFrames += 1;
      if (now - last >= 1_000) {
        state.samples.push({ elapsedMs: Math.round(now - state.started), fps: bucketFrames });
        bucketFrames = 0;
        last = now;
      }
      if (now - state.started >= duration) {
        state.elapsedMs = Math.round(now - state.started);
        state.done = true;
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, durationMs);
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.__BUILD06_PERF__?.done === true, null, { timeout: durationMs + 8_000 });
  await page.keyboard.up('KeyW');
  return page.evaluate(() => {
    const state = window.__BUILD06_PERF__;
    const totalSeconds = Math.max(0.001, state.elapsedMs / 1_000);
    const values = state.samples.map(sample => sample.fps).filter(Number.isFinite);
    return {
      elapsedMs: state.elapsedMs,
      frames: state.frames,
      avgFps: Number((state.frames / totalSeconds).toFixed(2)),
      minSampleFps: values.length ? Math.min(...values) : null,
      maxSampleFps: values.length ? Math.max(...values) : null,
      samples: state.samples,
    };
  });
}

async function waitForWarden(page) {
  await page.waitForFunction(
    () => ['ready', 'fallback'].includes(window.__DEAD_ARRIVAL__?.renderer?._wardenStatus),
    null,
    { timeout: 15_000 },
  );
  return page.evaluate(() => window.__DEAD_ARRIVAL__?.renderer?._wardenStatus || null);
}

async function rendererEvidence(page) {
  return page.evaluate(() => {
    const api = window.__DEAD_ARRIVAL__;
    const renderer = api?.renderer?.renderer;
    const gl = renderer?.getContext?.();
    let gpu = null;
    if (gl) {
      const extension = gl.getExtension('WEBGL_debug_renderer_info');
      gpu = extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    }
    const info = renderer?.info;
    const programs = Array.from(info?.programs || []).map(program => ({ name: program.name || null, runnable: program.diagnostics?.runnable ?? null }));
    return {
      gpu,
      calls: info?.render?.calls ?? null,
      triangles: info?.render?.triangles ?? null,
      points: info?.render?.points ?? null,
      lines: info?.render?.lines ?? null,
      geometries: info?.memory?.geometries ?? null,
      textures: info?.memory?.textures ?? null,
      programs,
      wardenStatus: api?.renderer?._wardenStatus || null,
    };
  });
}
const browser = await chromium.launch({
  headless: process.env.HEADFUL !== '1',
  ...(chromePath ? { executablePath: chromePath } : {}),
  args: [
    '--autoplay-policy=no-user-gesture-required',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
const evidence = {
  startedAt: smokeStartedAt,
  url: debugUrl,
  browser: { executablePath: chromePath || 'Playwright-managed Chromium', headless: process.env.HEADFUL !== '1' },
  reference: { spawn, openLane },
  desktop: null,
  mobile: null,
  errors: [],
};

try {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await desktop.newPage();
  const desktopDiag = diagnosticsFor(page, 'desktop');
  try {
    await startGame(page);
    const wardenStatus = await waitForWarden(page);
    const controlledCamera = await setControlledCamera(page);
    await selectBazooka(page);
    await page.waitForTimeout(2_800);
    const lock = await lockCanvas(page);
    const fire = await fireBazookaAndDetonate(page);
    const audioReady = await page.waitForFunction(
      () => window.__DEAD_ARRIVAL__?.audio?.debugInfo?.loaded === true,
      null,
      { timeout: 20_000 },
    ).then(() => true).catch(() => false);
    const audio = await page.evaluate(() => window.__DEAD_ARRIVAL__?.audio?.debugInfo || null);
    await page.screenshot({ path: path.join(docsDir, 'build06-game-desktop.png'), animations: 'disabled' });
    const bellwraith = await injectBellwraithPreview(page);
    await page.screenshot({ path: path.join(docsDir, 'build06-game-bellwraith.png'), animations: 'disabled' });
    const performance = await samplePerformance(page, 30_000);
    const finalState = await page.evaluate(() => ({
      screen: window.__DEAD_ARRIVAL__?.screen,
      mode: window.__DEAD_ARRIVAL__?.run?.mode,
      pitch: window.__DEAD_ARRIVAL__?.run?.pitch,
      weapon: window.__DEAD_ARRIVAL__?.run?.weapon,
    }));
    const rendererInfo = await rendererEvidence(page);
    evidence.desktop = { wardenStatus, controlledCamera, lock, fire, audioReady, audio, bellwraith, performance, rendererInfo, finalState, diagnostics: JSON.parse(JSON.stringify(desktopDiag)) };
  } catch (error) {
    evidence.errors.push({ label: 'desktop', error: String(error?.stack || error), diagnostics: desktopDiag });
  } finally {
    await desktop.close();
  }

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobile.newPage();
  const mobileDiag = diagnosticsFor(mobilePage, 'mobile');
  try {
    await startGame(mobilePage);
    const wardenStatus = await waitForWarden(mobilePage);
    const controlledCamera = await setControlledCamera(mobilePage);
    await mobilePage.evaluate(() => {
      const api = window.__DEAD_ARRIVAL__;
      api.run.weapon = 3;
      api.run.health = 100;
    });
    const touch = await mobilePage.evaluate(() => ({
      visible: !document.querySelector('.touch-layer')?.hidden,
      controls: [...document.querySelectorAll('.touch-button')].map(button => button.dataset.action),
      hudVisible: !document.querySelector('.hud')?.hidden,
    }));
    const bellwraith = await injectBellwraithPreview(mobilePage);
    await mobilePage.screenshot({ path: path.join(docsDir, 'build06-game-mobile.png'), animations: 'disabled' });
    const state = await mobilePage.evaluate(() => ({
      screen: window.__DEAD_ARRIVAL__?.screen,
      mode: window.__DEAD_ARRIVAL__?.run?.mode,
      pitch: window.__DEAD_ARRIVAL__?.run?.pitch,
      weapon: window.__DEAD_ARRIVAL__?.run?.weapon,
    }));
    const rendererInfo = await rendererEvidence(mobilePage);
    evidence.mobile = { wardenStatus, controlledCamera, touch, bellwraith, state, rendererInfo, diagnostics: JSON.parse(JSON.stringify(mobileDiag)) };
  } catch (error) {
    evidence.errors.push({ label: 'mobile', error: String(error?.stack || error), diagnostics: mobileDiag });
  } finally {
    await mobile.close();
  }
} finally {
  await browser.close();
}

const allDiagnostics = [evidence.desktop?.diagnostics, evidence.mobile?.diagnostics].filter(Boolean);
const runtimeErrors = [
  ...evidence.errors,
  ...allDiagnostics.flatMap(diagnostic => [
    ...diagnostic.consoleErrors.map(error => ({ label: `${diagnostic.label}:console`, error })),
    ...diagnostic.pageErrors.map(error => ({ label: `${diagnostic.label}:page`, error })),
    ...diagnostic.requestFailures.filter(error => !String(error.failure || "").includes("ERR_ABORTED")).map(error => ({ label: `${diagnostic.label}:request`, error })),
  ]),
];
evidence.errors = runtimeErrors;
await writeFile(path.join(docsDir, 'build06-game-results.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
if (runtimeErrors.length || !evidence.desktop?.fire?.explosion?.diagnostics?.active || !evidence.desktop?.audio?.loaded || evidence.desktop.audio.decoded < 35 || !evidence.mobile?.touch?.visible) process.exitCode = 1;