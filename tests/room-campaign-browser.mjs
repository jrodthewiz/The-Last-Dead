import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// This check attaches to the existing local game server. It never opens or
// changes the user's game tab; Playwright uses a disposable headless Edge.
const require = createRequire(import.meta.url);
const playwrightPath = process.env.PLAYWRIGHT_PATH || 'C:/Users/wolfk/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core';
const chromePath = process.env.CHROME_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const { chromium } = require(playwrightPath);

const baseUrl = process.env.GAME_URL || 'http://127.0.0.1:5200/';
const gameUrl = baseUrl.includes('?') ? `${baseUrl}&debug=1` : `${baseUrl}?debug=1`;
const artifactDir = process.env.ROOM_QA_DIR || 'docs/room-progression-qa';
await mkdir(artifactDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: chromePath,
  args: ['--use-angle=d3d11'],
});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const consoleEntries = [];
const pageErrors = [];
const requestFailures = [];
page.on('console', message => {
  if (message.type() === 'warning' || message.type() === 'error') {
    consoleEntries.push({ type: message.type(), text: message.text(), location: message.location() });
  }
});
page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));
page.on('requestfailed', request => requestFailures.push({ url: request.url(), error: request.failure()?.errorText || 'request failed' }));

const capture = async label => {
  await page.waitForTimeout(240);
  const state = await page.evaluate(() => {
    const arrival = window.__DEAD_ARRIVAL__;
    const canvas = document.querySelector('#world');
    const info = arrival?.renderer?.renderer?.info;
    const dataUrl = canvas?.toDataURL?.('image/png') || '';
    const run = arrival?.run;
    return {
      mode: run?.mode,
      sectorIndex: run?.sectorIndex,
      sectorName: run?.sectorName,
      wave: run?.wave,
      waveCount: run?.waveCount,
      directorState: run?.director?.state,
      pending: run?.director?.pending,
      active: run?.director?.active,
      health: run?.health,
      canvas: canvas ? { width: canvas.width, height: canvas.height, clientWidth: canvas.clientWidth, clientHeight: canvas.clientHeight } : null,
      pngBytes: dataUrl.length,
      render: info ? { calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures } : null,
      hud: {
        sector: document.querySelector('[data-hud="sector"]')?.textContent || '',
        room: document.querySelector('[data-hud="room-name"]')?.textContent || '',
        objective: document.querySelector('[data-hud="objective"]')?.textContent || '',
        route: document.querySelector('[data-hud="room-route"]')?.getAttribute('aria-valuenow') || '',
      },
    };
  });
  assert.ok(state.canvas?.width > 0 && state.canvas?.height > 0, `${label}: canvas has no drawable size`);
  assert.ok(state.pngBytes > 1200, `${label}: canvas PNG is unexpectedly blank`);
  await page.screenshot({ path: path.join(artifactDir, `${label}.png`), animations: 'disabled' });
  return state;
};

try {
  await page.goto(gameUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => Boolean(window.__DEAD_ARRIVAL__?.renderer), undefined, { timeout: 180000 });
  await page.waitForFunction(() => Boolean(window.__DEAD_ARRIVAL__?.renderer?._weaponsPrepared), undefined, { timeout: 180000 });

  const campaign = await page.evaluate(async () => {
    const module = await import('./campaign.js');
    return module.describeCampaign();
  });
  assert.equal(campaign.length, 3, 'campaign should contain three rooms/sectors');
  assert.ok(campaign.every(sector => sector.waves === 3), JSON.stringify(campaign));
  assert.ok(campaign[0].budgets[0] < campaign[1].budgets[0] && campaign[1].budgets[0] <= campaign[2].budgets[0], JSON.stringify(campaign));
  assert.ok(campaign[2].introduces.includes('mireSinger') && campaign[2].introduces.includes('bellwraith'), JSON.stringify(campaign));

  await page.locator('[data-action="start"]').click({ timeout: 120000 });
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__?.run?.mode === 'play', undefined, { timeout: 120000 });
  const initial = await capture('desktop-room-01-start');

  // Exercise a real player input path before using the deterministic fixture.
  const yBefore = await page.evaluate(() => window.__DEAD_ARRIVAL__.run.y);
  await page.keyboard.down('w');
  await page.waitForTimeout(320);
  await page.keyboard.up('w');
  const input = await page.evaluate(y => ({ yBefore: y, yAfter: window.__DEAD_ARRIVAL__.run.y, weapon: window.__DEAD_ARRIVAL__.run.weapon }), yBefore);
  assert.ok(input.yAfter < input.yBefore - 0.03, JSON.stringify(input));
  await page.keyboard.press('Digit2');
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__.run.weapon === 1, undefined, { timeout: 5000 });

  // Run the real director and physical room gates with a bounded fixture. The
  // fixture marks spawned threats defeated after each authored encounter so
  // browser QA can cover every room quickly. It never changes roomIndex: the
  // only way a room can advance below is by moving through an opened doorway.
  const progression = await page.evaluate(async () => {
    const { tick, canStand } = await import('./engine.js');
    const { getRoomSequence, canTraverseRoomGates } = await import('./room-progression.js');
    const arrival = window.__DEAD_ARRIVAL__;
    const run = arrival.run;
    // Keep the deterministic navigation fixture alive while AI remains active;
    // the real fail/restart path is exercised below with a normal health pool.
    run.health = 100000;
    const roomRecords = [];
    const exitRecords = [];
    const tickMove = (input, count) => {
      run.mode = 'play';
      for (let i = 0; i < count; i += 1) tick(run, 0.05, input);
    };
    const findDoorRoute = (progression, room, doors) => {
      const step = .25;
      const minX = .2, maxX = 11.8;
      const minY = Math.max(.2, room.bounds.minZ + .12), maxY = Math.min(11.8, room.bounds.maxZ - .12);
      const key = (x, y) => `${x},${y}`;
      const walkable = (x, y, fromX = x, fromY = y) => x >= minX && x <= maxX && y >= minY && y <= maxY
        && canStand(run.course, x, y, .1)
        && canTraverseRoomGates(run.course, progression, fromX, fromY, x, y);
      const startX = Math.round(run.x / step) * step, startY = Math.round(run.y / step) * step;
      const candidates = doors.flatMap(portal => [portal.span[0] + step, (portal.span[0] + portal.span[1]) * .5, portal.span[1] - step]
        .map(x => ({ portal, x: Math.round(x / step) * step, y: Math.round((portal.at + .2) / step) * step })));
      let best = null;
      for (const candidate of candidates) {
        if (!walkable(candidate.x, candidate.y)) continue;
        const start = { x: startX, y: startY };
        const queue = [start], previous = new Map([[key(start.x, start.y), null]]);
        for (let cursor = 0; cursor < queue.length; cursor += 1) {
          const node = queue[cursor];
          if (Math.abs(node.x - candidate.x) < .001 && Math.abs(node.y - candidate.y) < .001) break;
          for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
            const nx = Math.round((node.x + dx) / step) * step, ny = Math.round((node.y + dy) / step) * step;
            const nextKey = key(nx, ny);
            if (previous.has(nextKey) || !walkable(nx, ny, node.x, node.y)) continue;
            previous.set(nextKey, key(node.x, node.y));
            queue.push({ x: nx, y: ny });
          }
        }
        const goalKey = key(candidate.x, candidate.y);
        if (!previous.has(goalKey)) continue;
        const points = [];
        for (let cursor = goalKey; cursor; cursor = previous.get(cursor)) {
          const [x, y] = cursor.split(',').map(Number);
          points.push({ x, y });
        }
        points.reverse();
        if (!best || points.length < best.points.length) best = { portal: candidate.portal, points };
      }
      return best;
    };
    const followRoute = route => {
      for (const point of route.points) {
        for (let guard = 0; guard < 80 && Math.hypot(run.x - point.x, run.y - point.y) > .08; guard += 1) {
          const dx = point.x - run.x, dy = point.y - run.y;
          run.angle = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : Math.PI) : (dy > 0 ? Math.PI / 2 : -Math.PI / 2);
          tickMove({ forward: 1 }, 1);
        }
      }
    };
    const fixtureClearWave = targetWave => {
      let guard = 0;
      while (guard++ < 80) {
        const state = run.director?.state;
        if (state === 'intermission' && run.wave < targetWave) {
          run.waveDelay = 0;
          tick(run, 0.05, {});
        } else if ((state === 'spawning' || state === 'combat') && run.wave <= targetWave) {
          for (const enemy of run.course.enemies) {
            enemy.dead = true;
            enemy.hp = 0;
          }
          for (const item of run.director.queue || []) {
            item.status = 'spawned';
            item.telegraph = null;
          }
          run.director.pending = 0;
          run.spawnTelegraphs = [];
          tick(run, 0.05, {});
        } else if (run.wave >= targetWave && (state === 'intermission' || state === 'exit')) {
          break;
        } else {
          throw new Error(`unexpected director state while clearing wave ${targetWave}: ${state}`);
        }
      }
      if (run.wave < targetWave) throw new Error(`wave ${targetWave} did not start`);
    };
    const forwardProbe = (progression, room) => (room.portals || [])
      .filter(portal => portal.to !== portal.from && portal.kind !== 'flank')
      .map(portal => {
        const x = (portal.span[0] + portal.span[1]) * 0.5;
        return {
          id: portal.id,
          span: portal.span,
          x,
          at: portal.at,
          open: progression.gates[portal.id]?.open === true,
          traversable: canTraverseRoomGates(run.course, progression, x, portal.at + .12, x, portal.at - .12),
        };
      });

    for (let sector = 0; sector < 3; sector += 1) {
      run.events.length = 0;
      const progression = run.roomProgression;
      const sequence = getRoomSequence(run.sectorId);
      if (!progression || progression.currentIndex !== 0 || progression.activeRoomId !== sequence[0].id) {
        throw new Error(`sector ${sector} did not start in room 0`);
      }

      for (let roomIndex = 0; roomIndex < sequence.length - 1; roomIndex += 1) {
        const room = sequence[roomIndex];
        if (progression.currentIndex !== roomIndex || progression.activeRoomId !== room.id) {
          throw new Error(`entered room ${roomIndex} without crossing its door`);
        }
        const doors = forwardProbe(progression, room);
        if (!doors.length) throw new Error(`${room.id} has no forward door`);
        const lockedBefore = doors.every(door => !door.open && !door.traversable);
        const route = findDoorRoute(progression, room, doors);
        if (!route) throw new Error(`${room.id} has no walkable route to a forward doorway`);
        const door = route.portal;

        // Walk to one authored door and try the forward path while combat is
        // still active. The collision gate must stop the player at the wall.
        followRoute(route);
        const atDoorX = Math.abs(run.x - route.points.at(-1).x) < .3;
        run.angle = -Math.PI / 2;
        for (let guard = 0; guard < 160; guard += 1) {
          tickMove({ forward: 1 }, 1);
          if (run.y <= door.at + .18) break;
        }
        const blockedPosition = run.y > door.at - .04 && run.y < door.at + .28;

        const targetWave = (room.encounter?.waves?.[0] ?? roomIndex) + 1;
        fixtureClearWave(targetWave);
        const clearedStayed = progression.currentIndex === roomIndex && progression.activeRoomId === room.id;
        const unlocked = forwardProbe(progression, room).every(door => door.open && door.traversable);

        // The same movement input now has to cross the physical door. This is
        // the room transition assertion; state mutation alone cannot satisfy it.
        run.angle = -Math.PI / 2;
        for (let guard = 0; guard < 120 && progression.currentIndex === roomIndex; guard += 1) tickMove({ forward: 1 }, 1);
        const entered = progression.currentIndex === roomIndex + 1 && progression.activeRoomId === sequence[roomIndex + 1].id && run.y < door.at - .04;
        roomRecords.push({ sector, roomIndex, roomId: room.id, doorId: door.id, routeNodes: route.points.length, doorCount: doors.length, lockedBefore, atDoorX, blockedPosition, targetWave, clearedStayed, unlocked, entered, yAfterDoor: run.y });
        if (!lockedBefore || !atDoorX || !blockedPosition || !clearedStayed || !unlocked || !entered) {
          throw new Error(`physical room gate failed: ${JSON.stringify(roomRecords.at(-1))}`);
        }
      }

      const current = run.roomProgression;
      const finalRoom = getRoomSequence(run.sectorId).at(-1);
      if (current.currentIndex !== 3 || current.activeRoomId !== finalRoom.id || current.phase !== 'exit' || run.director.state !== 'exit') {
        throw new Error(`sector ${sector} did not expose the physical final exit: ${JSON.stringify({ currentIndex: current.currentIndex, activeRoomId: current.activeRoomId, phase: current.phase, director: run.director.state })}`);
      }
      const sectorBefore = run.sectorIndex;
      // Move from the right lift to the center lift, then through the opened
      // objective-room threshold. The engine's sector exit check must not fire
      // until physical movement reaches the exit coordinate.
      for (let guard = 0; guard < 240 && Math.abs(run.x - run.course.exit.x) > .08; guard += 1) {
        run.angle = run.course.exit.x > run.x ? 0 : Math.PI;
        tickMove({ forward: 1 }, 1);
      }
      const beforeExit = run.sectorIndex === sectorBefore;
      for (let guard = 0; guard < 240 && run.sectorIndex === sectorBefore; guard += 1) {
        const dx = run.course.exit.x - run.x;
        const dy = run.course.exit.y - run.y;
        run.angle = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : Math.PI) : (dy > 0 ? Math.PI / 2 : -Math.PI / 2);
        tickMove({ forward: 1 }, 1);
      }
      const transition = run.events.some(event => event.type === 'sector-transition');
      exitRecords.push({ sector, beforeExit, afterSector: run.sectorIndex, mode: run.mode, transition, y: run.y });
      const advanced = sector < 2 ? run.sectorIndex === sectorBefore + 1 && transition : run.mode === 'win' && run.campaignComplete && run.sectorIndex === sectorBefore;
      if (!beforeExit || !advanced) {
        throw new Error(`physical sector exit failed: ${JSON.stringify(exitRecords.at(-1))}`);
      }
    }
    return { roomRecords, exitRecords, final: { sectorIndex: run.sectorIndex, mode: run.mode, complete: run.campaignComplete } };
  });

  assert.equal(progression.roomRecords.length, 9, JSON.stringify(progression));
  assert.ok(progression.roomRecords.every(record => record.lockedBefore && record.atDoorX && record.blockedPosition), JSON.stringify(progression));
  assert.ok(progression.roomRecords.every(record => record.clearedStayed && record.unlocked && record.entered), JSON.stringify(progression));
  assert.equal(progression.exitRecords.length, 3, JSON.stringify(progression));
  assert.ok(progression.exitRecords.every(record => record.beforeExit && (record.sector < 2 ? record.afterSector === record.sector + 1 && record.transition : record.mode === 'win' && record.transition === false)), JSON.stringify(progression));
  assert.equal(progression.final.mode, 'win', JSON.stringify(progression));
  assert.equal(progression.final.complete, true, JSON.stringify(progression));

  // The director has just reached the final win screen. Reuse the same live
  // renderer for room showcases so each capture is a real authored room view,
  // then let the restart/death checks below reset the run normally.
  const roomCaptures = [];
  for (let sector = 0; sector < 3; sector += 1) {
    await page.evaluate(async index => {
      const { newRun, makeCampaignCourse } = await import('./engine.js');
      const arrival = window.__DEAD_ARRIVAL__;
      if (index === 0 && arrival.run.mode === 'win') arrival.begin(false);
      const next = newRun(makeCampaignCourse(index), { requireEntry: true });
      next.mode = 'play';
      Object.assign(arrival.run, next);
      arrival.ui.hud(arrival.run, { network: 'SOLO', fps: arrival.fps || null });
    }, sector);
    roomCaptures.push(await capture(`desktop-room-0${sector + 1}-showcase`));
  }

  // Fail/retry path: force the actual engine into its dead state and use the
  // actual finish-screen restart button, then prove the first room is restored.
  await page.evaluate(() => {
    const run = window.__DEAD_ARRIVAL__.run;
    run.mode = 'play';
    run.health = 0;
  });
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__?.run?.mode === 'dead' && Boolean(document.querySelector('.finish-screen')), undefined, { timeout: 10000 });
  const dead = await capture('desktop-dead');
  await page.locator('.finish-screen [data-action="restart"]').click({ timeout: 10000 });
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__?.run?.mode === 'play' && window.__DEAD_ARRIVAL__.run.sectorIndex === 0, undefined, { timeout: 120000 });
  const restarted = await capture('desktop-restarted-room-01');
  assert.equal(restarted.sectorIndex, 0);
  assert.equal(restarted.health, 100);

  // Mobile framing and touch surface smoke check. The pointer/touch controls
  // are part of UI input; this verifies they are present and reachable.
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await capture('mobile-room-01');
  const touch = await page.evaluate(() => ({
    layerVisible: !document.querySelector('.touch-layer')?.hidden,
    buttons: document.querySelectorAll('.touch-layer [data-action]').length,
    canvas: { width: document.querySelector('#world')?.clientWidth, height: document.querySelector('#world')?.clientHeight },
  }));
  assert.equal(touch.layerVisible, true);
  assert.ok(touch.buttons >= 10, JSON.stringify(touch));

  const report = {
    passed: true,
    url: gameUrl,
    campaign,
    initial,
    input,
    progression,
    roomCaptures,
    dead,
    restarted,
    mobile,
    touch,
    consoleEntries,
    pageErrors,
    requestFailures,
  };
  assert.deepEqual(pageErrors, [], JSON.stringify(pageErrors));
  assert.deepEqual(requestFailures, [], JSON.stringify(requestFailures));
  await writeFile(path.join(artifactDir, 'room-campaign-browser.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
