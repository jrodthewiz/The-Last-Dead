import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const playwrightPath = process.env.PLAYWRIGHT_PATH || 'playwright';
const chromePath = process.env.CHROME_PATH || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const { chromium } = require(playwrightPath);
let sharp = null;
try {
  sharp = require(process.env.SHARP_PATH || 'sharp');
} catch {
  // The browser run remains useful without PNG statistics; the result records
  // the decoder failure so the pixel claim is not overstated.
}

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, '..');
const docs = path.join(project, 'docs');
const url = process.env.DEAD_ARRIVAL_URL || 'http://127.0.0.1:5200/';
const activeJourneyMs = Number(process.env.SUSTAINED_MS || 120000);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

const result = {
  test: 'sustained-playtest',
  startedAt: new Date().toISOString(),
  url: `${url}?debug=1`,
  target: {
    browser: 'Chrome',
    executable: chromePath,
    viewport: { width: 1440, height: 900 },
    mode: 'headless browser, production dist served by local endpoint',
    assistedAim: 'target selection and mouse-look deltas derive from debug state; attacks and movement are real input',
  },
  journey: {
    requestedMs: activeJourneyMs,
    wallMs: 0,
    simulationSeconds: 0,
    screens: [],
    waves: [],
    kills: 0,
    bestCombo: 0,
    styleTotal: 0,
    styleLabels: [],
    bloodHealObserved: false,
    goreObserved: false,
    exitReached: false,
    deathObserved: false,
    restartObserved: false,
  },
  inputChecks: {},
  performance: {
    samples: [],
    fps: { min: null, max: null, median: null },
    diagnostics: null,
    pixel: null,
  },
  artifacts: [],
  console: { errors: [], pageErrors: [], failedRequests: [], badResponses: [] },
  issues: [],
  fatal: null,
};

const browser = await chromium.launch({
  headless: true,
  executablePath: chromePath,
  args: [
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ],
});

let context;
let page;
let mouseX = 720;
let mouseY = 450;
let screenshotCounter = 0;

async function state() {
  return page.evaluate(() => {
    const api = window.__DEAD_ARRIVAL__;
    if (!api?.run) return null;
    const r = api.run;
    return {
      x: r.x,
      y: r.y,
      z: r.z,
      angle: r.angle,
      pitch: r.pitch,
      speed: r.speed,
      time: r.time,
      mode: r.mode,
      health: r.health,
      energy: r.energy,
      weapon: r.weapon,
      shot: r.shot,
      damage: r.damage,
      heal: r.heal,
      aim: r.aim,
      slide: r.slide,
      dashTime: r.dashTime,
      punch: r.punch,
      hookTime: r.hookTime,
      hookCooldown: r.hookCooldown,
      parryTime: r.parryTime,
      slam: r.slam,
      wallJumps: r.wallJumps,
      style: r.style,
      styleTotal: r.styleTotal,
      styleLabel: r.styleLabel,
      rank: r.rank,
      kills: r.kills,
      combo: r.combo,
      bestCombo: r.bestCombo,
      wave: r.wave,
      waveDelay: r.waveDelay,
      projectiles: r.projectiles.length,
      coreProjectiles: r.projectiles.filter(p => p.core).length,
      coins: r.coins.length,
      coinCharges: r.coinCharges,
      gore: r.gore.length,
      blood: r.blood.length,
      tracers: r.tracers.length,
      enemies: r.course.enemies.map(e => ({
        id: e.id, x: e.x, y: e.y, z: e.z || 0, hp: e.hp, kind: e.kind, dead: !!e.dead,
      })),
      exit: { x: r.course.exit.x, y: r.course.exit.y },
      events: r.events.map(e => e.type),
    };
  });
}

async function screen() {
  return page.evaluate(() => window.__DEAD_ARRIVAL__?.screen || null);
}

async function diagnostics() {
  return page.evaluate(() => ({
    fps: window.__DEAD_ARRIVAL__?.fps ?? null,
    renderer: window.__DEAD_ARRIVAL__?.renderer?.diagnostics?.() || null,
  }));
}

function record(label, detail = {}) {
  result.journey.screens.push({
    atMs: Date.now() - journeyStartedAt,
    label,
    ...detail,
  });
}

async function captureScreenshot(name, label) {
  const file = path.join(docs, name);
  const buffer = await page.screenshot({ path: file });
  const artifact = { path: `docs/${name}`, label, bytes: buffer.byteLength };
  if (sharp) {
    try {
      const info = await sharp(buffer).stats();
      const channels = info.channels || [];
      artifact.pixel = {
        width: info.isOpaque ? undefined : undefined,
        min: channels.map(channel => channel.min),
        max: channels.map(channel => channel.max),
        mean: channels.map(channel => Number(channel.mean.toFixed(3))),
        variance: channels.map(channel => Number(channel.variance.toFixed(3))),
        nonFlat: channels.some(channel => channel.max - channel.min > 8 && channel.variance > 20),
      };
      if (!result.performance.pixel && label.includes('combat')) result.performance.pixel = artifact.pixel;
    } catch (error) {
      artifact.pixelError = String(error?.message || error);
    }
  } else {
    artifact.pixelError = 'sharp unavailable; screenshot captured without PNG statistics';
  }
  result.artifacts.push(artifact);
  return artifact;
}

async function waitForPlay() {
  await page.waitForSelector('[data-action="start"]', { state: 'visible' });
  await page.locator('[data-action="start"]').click();
  await page.waitForTimeout(350);
  if ((await screen()) !== 'play') throw new Error(`start did not enter play; screen=${await screen()}`);
  const canvas = page.locator('#world');
  if (!(await page.evaluate(() => document.pointerLockElement?.id === 'world'))) {
    await canvas.click({ position: { x: 700, y: 450 } });
    await page.waitForTimeout(80);
  }
  result.inputChecks.pointerLock = await page.evaluate(() => document.pointerLockElement?.id === 'world');
  record('start', { screen: await screen(), state: await state() });
}

async function ensurePlay() {
  const current = await screen();
  if (current === 'play') return true;
  if (current === 'pause') {
    const resume = page.locator('[data-action="resume"]');
    if (await resume.count()) await resume.click();
    await page.waitForTimeout(120);
    return (await screen()) === 'play';
  }
  if (current === 'dead' || current === 'win') {
    if (current === 'dead') result.journey.deathObserved = true;
    if (current === 'win') result.journey.exitReached = true;
    const restart = page.locator('[data-action="restart"]');
    if (await restart.count()) {
      await restart.click();
      await page.waitForTimeout(250);
      if ((await screen()) === 'play') {
        result.journey.restartObserved = true;
        record(current === 'dead' ? 'restart-after-death' : 'restart-after-win', { state: await state() });
        return true;
      }
    }
  }
  return false;
}

async function moveMouse(dx, dy) {
  const nextX = clamp(mouseX + dx, 12, 1428);
  const nextY = clamp(mouseY + dy, 12, 888);
  if (nextX === mouseX && nextY === mouseY) {
    mouseX = 720;
    mouseY = 450;
    await page.mouse.move(mouseX, mouseY);
    return;
  }
  mouseX = nextX;
  mouseY = nextY;
  await page.mouse.move(mouseX, mouseY);
}

async function aimAt(enemy, tolerance = 0.055) {
  if (!enemy) return null;
  let latest = null;
  for (let attempt = 0; attempt < 18; attempt += 1) {
    latest = await state();
    if (!latest || latest.mode !== 'play') return latest;
    const live = latest.enemies.find(e => e.id === enemy.id && !e.dead) || enemy;
    const desiredAngle = Math.atan2(live.y - latest.y, live.x - latest.x);
    const distance = Math.max(0.1, Math.hypot(live.x - latest.x, live.y - latest.y));
    const targetHeight = 0.36;
    const eye = 0.4 + latest.z - latest.slide * 0.18;
    const desiredPitch = Math.atan2(targetHeight - eye, distance);
    const deltaAngle = angleDiff(desiredAngle, latest.angle);
    const deltaPitch = desiredPitch - latest.pitch;
    if (Math.abs(deltaAngle) < tolerance && Math.abs(deltaPitch) < tolerance) return latest;
    // engine.look applies angle += movementX * .002 and pitch -= movementY * .002
    await moveMouse(clamp(deltaAngle / 0.002, -220, 220), clamp(-deltaPitch / 0.002, -160, 160));
    await page.waitForTimeout(18);
  }
  latest = await state();
  if (latest?.mode === 'play') {
    const remaining = angleDiff(Math.atan2(enemy.y - latest.y, enemy.x - latest.x), latest.angle);
    if (Math.abs(remaining) > 0.09) {
      const key = remaining > 0 ? 'ArrowRight' : 'ArrowLeft';
      await page.keyboard.down(key);
      await page.waitForTimeout(clamp(Math.abs(remaining) * 350, 30, 260));
      await page.keyboard.up(key);
    }
  }
  return state();
}

async function attackTarget(enemy, maxMs = 5500) {
  let current = enemy;
  const started = Date.now();
  let hitCount = 0;
  try {
    await page.keyboard.down('KeyW');
    await page.keyboard.down((enemy.id % 2) ? 'KeyD' : 'KeyA');
    await page.mouse.down({ button: 'left' });
    while (Date.now() - started < maxMs) {
      const before = await state();
      if (!before || before.mode !== 'play') break;
      current = before.enemies.find(e => e.id === enemy.id && !e.dead);
      if (!current) break;
      await aimAt(current);
      const after = await state();
      if (after?.gore > 0 || after?.blood > 0) {
        result.journey.goreObserved = true;
        if (!result.artifacts.some(a => a.path === 'docs/combat-gore.png')) {
          await captureScreenshot('combat-gore.png', 'combat gore and blood during active shotgun attack');
          record('combat-gore-screenshot', { state: after });
        }
      }
      if (after && after.kills > result.journey.kills) {
        result.journey.kills = after.kills;
        result.journey.bestCombo = Math.max(result.journey.bestCombo, after.bestCombo || 0);
        result.journey.styleTotal = Math.max(result.journey.styleTotal, after.styleTotal || 0);
        if (after.styleLabel && !result.journey.styleLabels.includes(after.styleLabel)) result.journey.styleLabels.push(after.styleLabel);
        if (after.heal > 0 || (after.health > before.health && before.health < 100)) result.journey.bloodHealObserved = true;
        hitCount += 1;
      }
      if (after?.heal > 0) result.journey.bloodHealObserved = true;
      await page.waitForTimeout(165);
    }
  } finally {
    await page.mouse.up({ button: 'left' }).catch(() => {});
    await page.keyboard.up('KeyW').catch(() => {});
    await page.keyboard.up((enemy.id % 2) ? 'KeyD' : 'KeyA').catch(() => {});
  }
  return { durationMs: Date.now() - started, hitCount, targetId: enemy.id };
}

async function exerciseWeaponsAndMovement() {
  if ((await screen()) !== 'play') return;
  const before = await state();
  await page.keyboard.press('1');
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(120);
  await page.mouse.up({ button: 'right' });
  const coinShot = await state();
  result.inputChecks.coinAlt = { before: before.coinCharges, after: coinShot.coinCharges, activeCoins: coinShot.coins };

  await page.keyboard.press('2');
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(120);
  await page.mouse.up({ button: 'right' });
  const coreShot = await state();
  result.inputChecks.shotgunCore = { weapon: coreShot.weapon, coreProjectiles: coreShot.coreProjectiles, projectiles: coreShot.projectiles };

  await page.keyboard.press('3');
  await page.mouse.down({ button: 'left' });
  await page.waitForTimeout(140);
  await page.mouse.up({ button: 'left' });
  const arc = await state();
  result.inputChecks.arcLance = { weapon: arc.weapon, tracers: arc.tracers, shot: arc.shot };

  await page.keyboard.press('f');
  await page.keyboard.press('e');
  const utility = await state();
  result.inputChecks.parryGrapple = { punch: utility.punch, hookTime: utility.hookTime, hookCooldown: utility.hookCooldown };

  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyD');
  await page.keyboard.down('Space');
  await page.waitForTimeout(110);
  await page.keyboard.up('Space');
  await page.keyboard.down('Shift');
  await page.waitForTimeout(70);
  await page.keyboard.up('Shift');
  await page.keyboard.down('Control');
  await page.waitForTimeout(210);
  await page.keyboard.up('Control');
  await page.keyboard.up('KeyW');
  await page.keyboard.up('KeyD');
  const movement = await state();
  result.inputChecks.movement = {
    speed: movement.speed,
    distance: movement.x !== before.x || movement.y !== before.y,
    z: movement.z,
    energy: movement.energy,
    dashTime: movement.dashTime,
    slide: movement.slide,
  };
}

async function monitorPerformance() {
  const sample = await diagnostics();
  result.performance.samples.push({ atMs: Date.now() - journeyStartedAt, ...sample });
  if (sample.fps != null) {
    result.performance._fpsValues = result.performance._fpsValues || [];
    result.performance._fpsValues.push(sample.fps);
  }
  if (sample.renderer) result.performance.diagnostics = sample.renderer;
}

let journeyStartedAt = Date.now();
try {
  await mkdir(docs, { recursive: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('console', message => {
    if (message.type() === 'error') result.console.errors.push(message.text());
  });
  page.on('pageerror', error => result.console.pageErrors.push(String(error?.message || error)));
  page.on('requestfailed', request => result.console.failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || 'failed'}`));
  page.on('response', response => {
    if (response.status() >= 400) result.console.badResponses.push(`${response.status()} ${response.url()}`);
  });

  await page.goto(`${url}?debug=1`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(docs, 'sustained-menu.png') });
  await waitForPlay();
  journeyStartedAt = Date.now();

  let lastWave = 0;
  let lastPerf = 0;
  let lastAction = 0;
  let secondRun = false;
  while (Date.now() - journeyStartedAt < activeJourneyMs) {
    const elapsed = Date.now() - journeyStartedAt;
    if (elapsed - lastPerf > 6500) {
      lastPerf = elapsed;
      await monitorPerformance();
    }
    if (!(await ensurePlay())) {
      await page.waitForTimeout(250);
      continue;
    }
    const current = await state();
    if (!current) break;
    if (current.wave !== lastWave) {
      lastWave = current.wave;
      result.journey.waves.push({ wave: current.wave, atMs: elapsed, remaining: current.enemies.filter(e => !e.dead).length });
      record('wave', { wave: current.wave, state: current });
    }
    if (current.health < 100 && current.damage > 0) record('damage-taken', { health: current.health, state: current });
    if (current.heal > 0) result.journey.bloodHealObserved = true;
    if (current.gore > 0 || current.blood > 0) result.journey.goreObserved = true;
    if (current.kills > result.journey.kills) {
      result.journey.kills = current.kills;
      result.journey.bestCombo = Math.max(result.journey.bestCombo, current.bestCombo || 0);
      result.journey.styleTotal = Math.max(result.journey.styleTotal, current.styleTotal || 0);
      if (current.styleLabel && !result.journey.styleLabels.includes(current.styleLabel)) result.journey.styleLabels.push(current.styleLabel);
    }

    const alive = current.enemies.filter(e => !e.dead);
    if (alive.length) {
      const target = alive.sort((a, b) => Math.hypot(a.x - current.x, a.y - current.y) - Math.hypot(b.x - current.x, b.y - current.y))[0];
      await page.keyboard.press('2');
      await attackTarget(target, 5200);
      if (Date.now() - lastAction > 9000) {
        lastAction = Date.now();
        await exerciseWeaponsAndMovement();
      }
    } else {
      // Real movement while wave delay and exit marker are active.
      await page.keyboard.down('KeyW');
      await page.keyboard.down('KeyD');
      await page.waitForTimeout(260);
      await page.keyboard.up('KeyW');
      await page.keyboard.up('KeyD');
      if (current.wave >= 3 && current.enemies.every(e => e.dead)) {
        await page.keyboard.down('KeyW');
        await page.waitForTimeout(1200);
        await page.keyboard.up('KeyW');
      }
      await page.waitForTimeout(220);
    }

    if (!secondRun && elapsed > activeJourneyMs * 0.58 && (await screen()) === 'play') {
      secondRun = true;
      await exerciseWeaponsAndMovement();
    }
  }

  // Keep the browser actively running until the requested wall-clock duration,
  // even if the first run reached win/dead early and needed a restart.
  while (Date.now() - journeyStartedAt < activeJourneyMs) {
    if (!(await ensurePlay())) {
      await page.waitForTimeout(250);
      continue;
    }
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyA');
    await page.mouse.down({ button: 'left' });
    await page.waitForTimeout(450);
    await page.mouse.up({ button: 'left' });
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyA');
  }

  const final = await state();
  result.journey.wallMs = Date.now() - journeyStartedAt;
  result.journey.simulationSeconds = Number(final?.time?.toFixed?.(2) || 0);
  result.journey.final = final;
  result.journey.finalScreen = await screen();
  await monitorPerformance();
  if (!result.artifacts.some(a => a.path === 'docs/combat-gore.png')) {
    await captureScreenshot('combat-gore.png', 'combat snapshot at end of sustained journey; gore may have decayed');
  }
  await captureScreenshot('sustained-active-final.png', 'active final sustained-play screenshot');
} catch (error) {
  result.fatal = String(error?.stack || error);
  try {
    if (page) await captureScreenshot('sustained-failure.png', 'failure-state screenshot');
  } catch {
    // Preserve the original failure in the JSON.
  }
} finally {
  result.finishedAt = new Date().toISOString();
  const fpsValues = result.performance._fpsValues || [];
  delete result.performance._fpsValues;
  if (fpsValues.length) {
    const sorted = [...fpsValues].sort((a, b) => a - b);
    result.performance.fps = {
      min: Math.min(...fpsValues),
      max: Math.max(...fpsValues),
      median: sorted[Math.floor(sorted.length / 2)],
    };
  }
  result.console.errors = [...new Set(result.console.errors)];
  result.console.pageErrors = [...new Set(result.console.pageErrors)];
  result.console.failedRequests = [...new Set(result.console.failedRequests)];
  result.console.badResponses = [...new Set(result.console.badResponses)];
  result.status = result.fatal ? 'error' : (result.console.pageErrors.length || result.console.failedRequests.length ? 'fail' : 'pass-with-findings');
  await writeFile(path.join(docs, 'qa-sustained.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await context?.close().catch(() => {});
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));
