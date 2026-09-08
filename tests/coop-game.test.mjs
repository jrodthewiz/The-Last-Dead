import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
const BASE_URL = process.env.DEAD_ARRIVAL_BASE || 'http://127.0.0.1:5200';

function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_PATH,
    'playwright',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { return require(candidate); } catch { /* try the next known location */ }
  }
  throw new Error('Playwright was not found. Set PLAYWRIGHT_PATH to the installed package.');
}

function chromeExecutable() {
  return [
    process.env.CHROME_PATH,
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ].find(existsSync);
}

async function waitForSession(page) {
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__?.session?.connected === true, undefined, { timeout: 20_000 });
}

async function waitForRun(page, predicate, timeout = 10_000) {
  await page.waitForFunction(predicate, undefined, { timeout });
}

async function main() {
  const playwright = loadPlaywright();
  const executablePath = chromeExecutable();
  if (!executablePath) throw new Error('Chrome executable not found; set CHROME_PATH explicitly.');
  const browser = await playwright.chromium.launch({ headless: true, executablePath });
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const errors = [];
  for (const page of [host, guest]) {
    page.on('pageerror', error => errors.push(`${page === host ? 'host' : 'guest'} pageerror: ${error.message}\n${error.stack || ''}`));
    page.on('console', message => {
      if (message.type() === 'error' && !message.text().toLowerCase().includes('failed to load resource') && !message.text().toLowerCase().includes('favicon')) errors.push(`${page === host ? 'host' : 'guest'} console: ${message.text()}`);
    });
    page.on('response', response => {
      if (response.status() >= 400 && !response.url().toLowerCase().includes('favicon')) errors.push(`${page === host ? 'host' : 'guest'} ${response.status()} ${response.url()}`);
    });
  }
  try {
    await Promise.all([
      host.goto(`${BASE_URL}/?debug=1`, { waitUntil: 'networkidle' }),
      guest.goto(`${BASE_URL}/?debug=1`, { waitUntil: 'networkidle' }),
    ]);
    await Promise.all([host.click('[data-action="coop-toggle"]'),guest.click('[data-action="coop-toggle"]')]);
    try {
      await Promise.all([
        host.waitForSelector('[data-action="host"]'),
        guest.waitForSelector('[data-action="join"]'),
        host.waitForFunction(() => Boolean(window.__DEAD_ARRIVAL__), undefined, { timeout: 10_000 }),
        guest.waitForFunction(() => Boolean(window.__DEAD_ARRIVAL__), undefined, { timeout: 10_000 }),
      ]);
    } catch (error) {
      console.error('co-op readiness diagnostics', errors);
      throw error;
    }
    if (errors.length) throw new Error(errors.join('\n'));

    await host.click('[data-action="host"]');
    await host.waitForFunction(() => Boolean(document.querySelector('[name="offer"]')?.value), undefined, { timeout: 15_000 });
    const offer = await host.inputValue('[name="offer"]');
    assert.ok(offer.startsWith('{'), 'host offer should be a JSON signalling envelope');

    await guest.fill('[name="joinOffer"]', offer);
    await guest.click('[data-action="join"]');
    await guest.waitForFunction(() => Boolean(document.querySelector('[name="answer"]')?.value), undefined, { timeout: 15_000 });
    const answer = await guest.inputValue('[name="answer"]');
    assert.ok(answer.startsWith('{'), 'guest answer should be a JSON signalling envelope');    await guest.evaluate(() => {
      const session = window.__DEAD_ARRIVAL__.session;
      const receive = session._onMessage;
      window.__deadArrivalReceived = [];
      session._onMessage = (message, owner) => { window.__deadArrivalReceived.push(message); receive(message, owner); };
    });


    await host.fill('[name="acceptAnswer"]', answer);
    await host.click('[data-action="accept"]');
    await Promise.all([waitForSession(host), waitForSession(guest)]);
    await host.evaluate(() => { const session = window.__DEAD_ARRIVAL__.session; const receive = session._onMessage; window.__deadArrivalHostReceived = []; session._onMessage = (message, owner) => { window.__deadArrivalHostReceived.push(message); receive(message, owner); }; });

    await waitForRun(host, () => window.__DEAD_ARRIVAL__.run?.peer);
    try {
      await waitForRun(guest, () => window.__DEAD_ARRIVAL__.run?.mode === 'play');
    } catch (error) {
      const state = await guest.evaluate(() => ({ screen: window.__DEAD_ARRIVAL__.screen, mode: window.__DEAD_ARRIVAL__.run?.mode, health: window.__DEAD_ARRIVAL__.run?.health, peer: Boolean(window.__DEAD_ARRIVAL__.run?.peer), received: window.__deadArrivalReceived?.map(message => message.t) }));
      const hostState = await host.evaluate(() => ({ mode: window.__DEAD_ARRIVAL__.run?.mode, peer: Boolean(window.__DEAD_ARRIVAL__.run?.peer), kills: window.__DEAD_ARRIVAL__.run?.kills }));
      console.error('guest startup state', state, 'host state', hostState);
      throw error;
    }

    // Start both players from the same known point, then drive the guest with
    // a real keyboard event. The host's peer should move via its authoritative
    // input handler and the next snapshot should mirror that position.
    await host.evaluate(() => {
      const run = window.__DEAD_ARRIVAL__.run;
      run.x = 6; run.y = 6; run.angle = -Math.PI / 2; run.pitch = 0;
      if (run.peer) { run.peer.x = 6; run.peer.y = 6; run.peer.angle = -Math.PI / 2; run.peer.pitch = 0; }
    });
    await guest.evaluate(() => {
      const run = window.__DEAD_ARRIVAL__.run;
      run.x = 6; run.y = 6; run.angle = -Math.PI / 2; run.pitch = 0;
    });
    const before = await host.evaluate(() => ({ x: window.__DEAD_ARRIVAL__.run.peer.x, y: window.__DEAD_ARRIVAL__.run.peer.y }));
    await guest.bringToFront();
    await guest.evaluate(() => document.activeElement?.blur?.());
    await guest.keyboard.down('KeyW');
    await new Promise(resolve => setTimeout(resolve, 650));
    await guest.keyboard.up('KeyW');
    try {
      await host.waitForFunction(previous => Math.hypot(window.__DEAD_ARRIVAL__.run.peer.x - previous.x, window.__DEAD_ARRIVAL__.run.peer.y - previous.y) > 0.1, before, { timeout: 5_000 });
    } catch (error) {
      console.error('movement state', {
        before,
        host: await host.evaluate(() => ({ mode: window.__DEAD_ARRIVAL__.run?.mode, x: window.__DEAD_ARRIVAL__.run?.x, y: window.__DEAD_ARRIVAL__.run?.y, peer: window.__DEAD_ARRIVAL__.run?.peer && { x: window.__DEAD_ARRIVAL__.run.peer.x, y: window.__DEAD_ARRIVAL__.run.peer.y, mode: window.__DEAD_ARRIVAL__.run.peer.mode }, received: window.__deadArrivalHostReceived?.slice(-8).map(message => ({ t: message.t, i: message.i })) })),
        guest: await guest.evaluate(() => ({ mode: window.__DEAD_ARRIVAL__.run?.mode, x: window.__DEAD_ARRIVAL__.run?.x, y: window.__DEAD_ARRIVAL__.run?.y, session: window.__DEAD_ARRIVAL__.session && { connected: window.__DEAD_ARRIVAL__.session.connected, role: window.__DEAD_ARRIVAL__.session.role } })),
      });
      throw error;
    }
    const after = await host.evaluate(() => ({ x: window.__DEAD_ARRIVAL__.run.peer.x, y: window.__DEAD_ARRIVAL__.run.peer.y }));
    assert.ok(Math.hypot(after.x - before.x, after.y - before.y) > 0.1, 'guest WASD input should move the host-authoritative peer');

    // Place a deterministic target down the guest's view axis, then hold the
    // visible FIRE control so the actual UI input path produces a remote shot.
    await host.evaluate(() => {
      const run = window.__DEAD_ARRIVAL__.run;
      run.x = 6; run.y = 6; run.angle = -Math.PI / 2; run.pitch = 0; run.wave = 3; run.waveDelay = 999;
      run.course.enemies = [{ id: 9001, x: 6, y: 4.8, z: 0, hp: 2, kind: 1, dead: false, flash: 0, attack: 999, phase: 0 }];
      if (run.peer) { run.peer.x = 6; run.peer.y = 6; run.peer.angle = -Math.PI / 2; run.peer.pitch = 0; run.peer.weapon = 0; }
    });
    await guest.evaluate(() => {
      const run = window.__DEAD_ARRIVAL__.run;
      run.x = 6; run.y = 6; run.angle = -Math.PI / 2; run.pitch = 0; run.weapon = 0;
    });
    await guest.waitForFunction(() => window.__DEAD_ARRIVAL__.run.course.enemies.some(enemy => enemy.id === 9001), undefined, { timeout: 5_000 });
    const fire = guest.locator('[data-action="fire"]');
    await guest.evaluate(() => { const layer = document.querySelector('[data-action="fire"]')?.closest('.touch-layer'); if (layer) { layer.hidden = false; layer.style.display = 'block'; } });
    await fire.scrollIntoViewIfNeeded();
    const fireBox = await fire.boundingBox();
    assert.ok(fireBox && fireBox.width > 0 && fireBox.height > 0, 'fire control should be visible');
    await guest.mouse.move(fireBox.x + fireBox.width / 2, fireBox.y + fireBox.height / 2);
    // Moving a captured mouse also aims. Restore the deterministic target axis after positioning.
    await guest.evaluate(() => { const r=window.__DEAD_ARRIVAL__.run; r.angle=-Math.PI/2; r.pitch=0; });
    await guest.mouse.down();
    await new Promise(resolve => setTimeout(resolve, 650));
    await guest.mouse.up();
    try {
      await host.waitForFunction(() => window.__DEAD_ARRIVAL__.run.kills >= 1 || window.__DEAD_ARRIVAL__.run.course.enemies.every(enemy => enemy.dead), undefined, { timeout: 8_000 });
    } catch (error) {
      const state = await host.evaluate(() => ({ mode: window.__DEAD_ARRIVAL__.run.mode, kills: window.__DEAD_ARRIVAL__.run.kills, peer: { x: window.__DEAD_ARRIVAL__.run.peer?.x, y: window.__DEAD_ARRIVAL__.run.peer?.y, angle: window.__DEAD_ARRIVAL__.run.peer?.angle, mode: window.__DEAD_ARRIVAL__.run.peer?.mode }, enemies: window.__DEAD_ARRIVAL__.run.course.enemies.map(enemy => ({ id: enemy.id, hp: enemy.hp, dead: enemy.dead })), received: window.__deadArrivalHostReceived?.map(message => ({ t: message.t, fire: message.i?.fire })) }));
      console.error('host fire state', state);
      throw error;
    }
    assert.ok(await host.evaluate(() => window.__DEAD_ARRIVAL__.run.kills >= 1), 'guest fire should resolve through the host authority');
    try {
      await guest.waitForFunction(() => window.__DEAD_ARRIVAL__.run.course.enemies.every(enemy => enemy.dead), undefined, { timeout: 5_000 });
    } catch (error) {
      console.error('guest fire state', await guest.evaluate(() => ({ mode: window.__DEAD_ARRIVAL__.run?.mode, screen: window.__DEAD_ARRIVAL__.screen, kills: window.__DEAD_ARRIVAL__.run?.kills, enemies: window.__DEAD_ARRIVAL__.run?.course?.enemies?.map(enemy => ({ id: enemy.id, hp: enemy.hp, dead: enemy.dead })), session: window.__DEAD_ARRIVAL__.session && { connected: window.__DEAD_ARRIVAL__.session.connected, role: window.__DEAD_ARRIVAL__.session.role } })));
      throw error;
    }

    // Build 06: a guest rocket and the resulting blast cross the real data channel.
    await host.evaluate(() => {
      const r=window.__DEAD_ARRIVAL__.run;
      r.course.enemies=[{id:9002,x:6,y:4.8,z:0,hp:4,kind:2,dead:false,flash:0,attack:999,phase:0}];
      r.peer.x=6;r.peer.y=6;r.peer.angle=-Math.PI/2;r.peer.pitch=0;r.peer.cooldowns[3]=0;
    });
    await guest.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.course.enemies.some(e=>e.id===9002));
    await guest.bringToFront();
    await guest.keyboard.press('4');
    await guest.mouse.move(fireBox.x+fireBox.width/2,fireBox.y+fireBox.height/2);
    await guest.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;r.angle=-Math.PI/2;r.pitch=0;});
    await guest.mouse.down();
    await host.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.explosions.some(e=>e.weapon===3),undefined,{timeout:8000});
    await guest.mouse.up();
    await guest.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.explosions.some(e=>e.weapon===3),undefined,{timeout:5000});
    assert.ok(await host.evaluate(()=>window.__DEAD_ARRIVAL__.run.peer.kills>=2),'guest rocket kill is credited to guest');
    // Clearing the exit rebuilds both clients onto the next authored sector.
    await host.evaluate(()=>{
      const r=window.__DEAD_ARRIVAL__.run;
      r.course.enemies.forEach(e=>{e.hp=0;e.dead=true;});
      r.wave=r.waveCount;r.director.state='exit';r.director.queue=[];r.director.pending=0;
      r.x=r.course.exit.x;r.y=r.course.exit.y;
    });
    try {
      await guest.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.sectorIndex===1,undefined,{timeout:8000});
    } catch (error) {
      console.error('sector transition state', {
        host: await host.evaluate(() => ({ sectorIndex: window.__DEAD_ARRIVAL__.run?.sectorIndex, sectorId: window.__DEAD_ARRIVAL__.run?.sectorId, mode: window.__DEAD_ARRIVAL__.run?.mode, x: window.__DEAD_ARRIVAL__.run?.x, y: window.__DEAD_ARRIVAL__.run?.y, wave: window.__DEAD_ARRIVAL__.run?.wave, director: window.__DEAD_ARRIVAL__.run?.director, events: window.__DEAD_ARRIVAL__.run?.events?.slice(-8) })),
        guest: await guest.evaluate(() => ({ sectorIndex: window.__DEAD_ARRIVAL__.run?.sectorIndex, sectorId: window.__DEAD_ARRIVAL__.run?.sectorId, mode: window.__DEAD_ARRIVAL__.run?.mode, screen: window.__DEAD_ARRIVAL__.screen, lastSnapshot: window.__DEAD_ARRIVAL__.snapshot?.() })),
      });
      throw error;
    }
    assert.equal(await guest.evaluate(()=>window.__DEAD_ARRIVAL__.run.course.sectorId),'ossuary');

    // Lifecycle contract: a host terminal state reaches the guest UI as well.
    await host.evaluate(() => {
      const run = window.__DEAD_ARRIVAL__.run;
      run.health = 0;
      if (run.peer) run.peer.health = 0;
    });
    try {
      await host.waitForFunction(() => window.__DEAD_ARRIVAL__.run.mode === 'dead', undefined, { timeout: 5_000 });
    } catch (error) {
      console.error('host lifecycle state', { errors, state: await host.evaluate(() => ({ mode: window.__DEAD_ARRIVAL__.run?.mode, health: window.__DEAD_ARRIVAL__.run?.health, peerHealth: window.__DEAD_ARRIVAL__.run?.peer?.health, screen: window.__DEAD_ARRIVAL__.screen, network: window.__DEAD_ARRIVAL__.network, time: window.__DEAD_ARRIVAL__.run?.time })) });
      throw error;
    }
    try {
      await guest.waitForFunction(() => window.__DEAD_ARRIVAL__.screen === 'dead' || window.__DEAD_ARRIVAL__.run.mode === 'dead', undefined, { timeout: 5_000 });
    } catch (error) {
      console.error('guest lifecycle state', { errors, state: await guest.evaluate(() => ({ mode: window.__DEAD_ARRIVAL__.run?.mode, health: window.__DEAD_ARRIVAL__.run?.health, peerHealth: window.__DEAD_ARRIVAL__.run?.peer?.health, screen: window.__DEAD_ARRIVAL__.screen, network: window.__DEAD_ARRIVAL__.network, time: window.__DEAD_ARRIVAL__.run?.time })) });
      throw error;
    }

    await guest.evaluate(() => window.__DEAD_ARRIVAL__.session.close());
    await host.waitForFunction(() => window.__DEAD_ARRIVAL__.network === 'DISCONNECTED' || !window.__DEAD_ARRIVAL__.session?.connected, undefined, { timeout: 5_000 });
    console.log(`Co-op UI test passed against ${BASE_URL}.`);
  } finally {
    await Promise.allSettled([hostContext.close(), guestContext.close(), browser.close()]);
  }
}

main().catch(error => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
