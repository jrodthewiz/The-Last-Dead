import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPAIGN_SECTORS,
  ENEMY_PROFILES,
} from '../campaign.js';
import {
  addPeer,
  canStand,
  makeCampaignCourse,
  newRun,
  shoot,
  switchWeapon,
  tick,
} from '../engine.js';

const DT = 1 / 120;
const PLAYER_FIELDS = [
  'x', 'y', 'z', 'angle', 'pitch', 'vx', 'vy', 'vz', 'speed', 'distance',
  'time', 'mode', 'health', 'energy', 'weapon', 'cooldowns', 'fireCooldown',
  'shot', 'damage', 'heal', 'aim', 'slide', 'dashTime', 'punch', 'hookTime',
  'hookCooldown', 'hookTarget', 'parryTime', 'parryCooldown', 'slam',
  'wallJumps', 'style', 'styleTotal', 'styleLabel', 'rank', 'kills', 'combo',
  'bestCombo', 'lastWeapon', 'repeat', 'coinCharges', 'coinRegen',
  'altCooldown', 'respawnTime',
];

function playerData(player) {
  return Object.fromEntries(PLAYER_FIELDS.map(key => [key, player[key]]));
}

// Keep this projection aligned with the authoritative shape in main.js. The
// test deliberately omits the director queue and the unbounded event log.
function networkSnapshot(run, seq = 1) {
  return {
    seq,
    host: playerData(run),
    guest: run.peer ? playerData(run.peer) : null,
    wave: run.wave,
    waveDelay: run.waveDelay,
    enemies: run.course.enemies,
    projectiles: run.projectiles,
    coins: run.coins,
    gore: run.gore.slice(-110),
    blood: run.blood,
    tracers: run.tracers,
    campaign: run.campaign,
    sectorIndex: run.sectorIndex,
    sectorCount: run.sectorCount,
    sectorId: run.sectorId,
    sectorName: run.sectorName,
    waveCount: run.waveCount,
    director: run.director
      ? Object.fromEntries([
        'state', 'budget', 'spent', 'remainingBudget', 'aliveCap',
        'active', 'pending', 'elapsed',
      ].map(key => [key, run.director[key]]))
      : null,
    spawnTelegraphs: run.spawnTelegraphs || [],
    explosions: run.explosions || [],
    audioEvents: [],
  };
}

function assertFiniteAndBounded(value, path = 'snapshot', seen = new WeakSet()) {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${path} contains a non-finite number`);
    return;
  }
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    assert.ok(value.length <= 250, `${path} exceeded 250 entries`);
    value.forEach((item, index) => assertFiniteAndBounded(item, `${path}[${index}]`, seen));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    assertFiniteAndBounded(child, `${path}.${key}`, seen);
  }
}

function playerList(run) {
  return [run, ...(run.peer ? [run.peer] : [])].filter(player => player && player.health > 0);
}

function eventKey(event) {
  return `${event.sectorIndex}:${event.wave}:${event.variant}`;
}

function observe(run, state) {
  const events = run.events.slice(state.eventCursor);
  state.eventCursor = run.events.length;

  for (const event of events) {
    if (event.type === 'wave') {
      state.waveEvents.push(`${event.sectorIndex}:${event.wave}`);
    }
    if (event.type === 'sector-transition') state.transitions.push(event.sectorIndex);

    if (event.type !== 'spawn-telegraph' && event.type !== 'spawn') continue;
    const players = playerList(run);
    assert.ok(canStand(run.course, event.x, event.y, .16), `${event.type} landed in a blocked cell`);
    for (const player of players) {
      assert.ok(
        Math.hypot(event.x - player.x, event.y - player.y) >= 3.5 - 1e-7,
        `${event.type} was too close to a living player`,
      );
    }
    const key = eventKey(event);
    if (event.type === 'spawn-telegraph') {
      state.telegraphCounts.set(key, (state.telegraphCounts.get(key) || 0) + 1);
    } else {
      const spawned = (state.spawnCounts.get(key) || 0) + 1;
      const telegraphed = state.telegraphCounts.get(key) || 0;
      assert.ok(spawned <= telegraphed, `spawned ${key} before a telegraph was emitted`);
      state.spawnCounts.set(key, spawned);
      state.spawnedVariants.add(event.variant);
    }
  }

  const director = run.director;
  if (director && director.aliveCap > 0) {
    const pressure = run.course.enemies.filter(enemy => !enemy.dead).length
      + run.spawnTelegraphs.length;
    assert.ok(pressure <= director.aliveCap, `alive cap exceeded: ${pressure}/${director.aliveCap}`);
  }
  for (const telegraph of run.spawnTelegraphs) {
    assert.ok(canStand(run.course, telegraph.x, telegraph.y, .16), 'live telegraph is blocked');
    for (const player of playerList(run)) {
      assert.ok(
        Math.hypot(telegraph.x - player.x, telegraph.y - player.y) >= 3.5 - 1e-7,
        'live telegraph is too close to a living player',
      );
    }
  }
}

function immobilizeForDeterministicClear(run, target) {
  const live = run.course.enemies.filter(enemy => !enemy.dead);
  for (const enemy of live) {
    enemy.moveSpeed = 0;
    enemy.attack = 999;
    enemy.attackCooldown = 999;
    enemy.attacking = false;
    enemy.stagger = 0;
    if (enemy === target) {
      enemy.x = 6.8;
      enemy.y = 6;
      enemy.z = 0;
    } else {
      // Keep other targets out of the Arc Lance line without deleting them.
      enemy.x = 6.8;
      enemy.y = 6.65;
      enemy.z = 0;
    }
  }
  run.x = 6;
  run.y = 6;
  run.z = 0;
  run.angle = 0;
  run.pitch = 0;
}

function defeatEnemyWithTicks(run, target, observeState) {
  switchWeapon(run, 2); // Arc Lance gives a short deterministic kill path.
  let guard = 0;
  while (!target.dead && guard++ < 1200) {
    immobilizeForDeterministicClear(run, target);
    if (run.cooldowns[2] <= 0) {
      assert.equal(shoot(run), true, 'Arc Lance should fire when its cooldown is clear');
    }
    tick(run, .05, {});
    observe(run, observeState);
  }
  assert.ok(target.dead, `enemy ${target.variant || target.kind} did not die through actual shots`);
}

function makeObserveState() {
  return {
    eventCursor: 0,
    telegraphCounts: new Map(),
    spawnCounts: new Map(),
    spawnedVariants: new Set(),
    waveEvents: [],
    transitions: [],
  };
}

test('Build 06 campaign clears all nine authored waves through actual ticks and shots', () => {
  assert.equal(CAMPAIGN_SECTORS.length, 3, 'campaign should have three sectors');
  assert.ok(CAMPAIGN_SECTORS.every(sector => sector.waves.length === 3), 'each sector should have three waves');
  assert.ok(ENEMY_PROFILES.mireSinger && ENEMY_PROFILES.bellwraithEcho, 'late variants should be authored');

  const run = newRun(makeCampaignCourse(0));
  run.mode = 'play';
  const observed = makeObserveState();
  let iterations = 0;

  while (run.mode !== 'win' && iterations++ < 50_000) {
    observe(run, observed);
    if (run.director?.state === 'exit') {
      assert.equal(run.course.enemies.filter(enemy => !enemy.dead).length, 0);
      run.x = run.course.exit.x;
      run.y = run.course.exit.y;
      tick(run, DT, {});
      observe(run, observed);
    } else {
      const live = run.course.enemies.filter(enemy => !enemy.dead);
      if (live.length) {
        defeatEnemyWithTicks(run, live[0], observed);
      } else {
        tick(run, DT, {});
        observe(run, observed);
      }
    }

    if (iterations % 97 === 0) {
      const snapshot = networkSnapshot(run, iterations);
      assertFiniteAndBounded(snapshot);
      assert.ok(snapshot.director && !('queue' in snapshot.director), 'network director must be a bounded summary');
    }
  }

  assert.equal(run.mode, 'win', 'campaign should reach the final victory state');
  assert.equal(run.campaignComplete, true);
  assert.equal(run.sectorIndex, 2);
  assert.deepEqual(observed.waveEvents, [
    '0:1', '0:2', '0:3',
    '1:1', '1:2', '1:3',
    '2:1', '2:2', '2:3',
  ]);
  assert.deepEqual(observed.transitions, [1, 2]);
  assert.ok(observed.spawnedVariants.has('warden'), 'warden should enter by sector two');
  assert.ok(observed.spawnedVariants.has('bellwraith'), 'bellwraith should enter by sector two');
  assert.ok(observed.spawnedVariants.has('mireSinger'), 'mire singer should enter by sector three');
  assert.equal(
    [...observed.telegraphCounts.values()].reduce((sum, count) => sum + count, 0),
    [...observed.spawnCounts.values()].reduce((sum, count) => sum + count, 0),
    'every authored spawn should have a telegraph',
  );

  const snapshot = networkSnapshot(run, iterations);
  assertFiniteAndBounded(snapshot);
  assert.equal(snapshot.sectorIndex, 2);
  assert.equal(snapshot.director.state, 'exit');
  assert.ok(!('queue' in snapshot.director), 'final snapshot should not serialize the director queue');
});

test('Build 06 P2P guest damage and style remain owner-visible in bounded snapshots', () => {
  const host = newRun(makeCampaignCourse(0));
  host.mode = 'play';
  const guest = addPeer(host);
  guest.mode = 'play';
  host.x = guest.x = 6;
  host.y = guest.y = 6;
  host.angle = guest.angle = 0;
  host.pitch = guest.pitch = 0;

  const enemy = {
    id: host.nextId++,
    x: 6.8,
    y: 6,
    z: 0,
    hp: 2,
    kind: 0,
    variant: 'stalker',
    dead: false,
    flash: 0,
    attack: 999,
    phase: 0,
    moveSpeed: 0,
  };
  host.course.enemies.push(enemy);

  switchWeapon(guest, 0);
  assert.equal(shoot(guest), true, 'guest should be able to fire into the authoritative world');
  assert.equal(enemy.dead, true, 'guest-owned damage should kill the authoritative target');
  assert.equal(host.kills, 1, 'host world should carry the authoritative kill count');
  assert.equal(guest.kills, 1, 'guest should retain its owner-visible kill count');
  assert.ok(guest.styleTotal > 0, 'guest should receive style for its own hit');

  const snapshot = networkSnapshot(host, 1);
  assertFiniteAndBounded(snapshot);
  assert.ok(snapshot.guest, 'co-op snapshot should include guest player data');
  assert.equal(snapshot.guest.kills, guest.kills);
  assert.equal(snapshot.guest.styleTotal, guest.styleTotal);
  assert.equal(snapshot.director.state, 'intermission');
  assert.ok(!('queue' in snapshot.director), 'co-op snapshot must omit the director queue');
});

test('Build 06 guest bazooka splash preserves guest ownership for style and kills', () => {
  const host = newRun(makeCampaignCourse(0));
  host.mode = 'play';
  const guest = addPeer(host);
  guest.mode = 'play';
  host.x = guest.x = 6;
  host.y = guest.y = 6;
  host.angle = guest.angle = 0;
  host.pitch = guest.pitch = 0;
  const enemy = {
    id: host.nextId++, x: 7, y: 6, z: 0, hp: 20, kind: 0,
    variant: 'stalker', dead: false, flash: 0, attack: 999, phase: 0, moveSpeed: 0,
  };
  host.course.enemies.push(enemy);

  switchWeapon(guest, 3);
  assert.equal(shoot(guest), true);
  for (let i = 0; i < 90 && !enemy.dead; i++) tick(host, DT, {});
  assert.equal(enemy.dead, true, 'guest rocket should resolve through the host simulation');
  assert.equal(guest.kills, 1, 'guest should own the rocket kill');
  assert.ok(guest.styleTotal > 0, 'guest should receive style for rocket splash');
});
