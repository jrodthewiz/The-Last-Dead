// Authored campaign data and deterministic spawn recipes for The Last Dead.
// Gameplay owns the simulation; this module only describes sectors, enemy roles,
// spawn anchors, and the order in which the pressure is introduced.

const freezeDeep = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freezeDeep);
  }
  return value;
};

const entry = (kind, variant, spawn, delay, cost, role = variant) => ({
  kind,
  variant,
  spawn,
  delay,
  cost,
  role,
});

// `kind` is the renderer/network-stable identity. Variants only change the
// combat profile, which means old snapshots that only contain kind still load.
export const ENEMY_PROFILES = freezeDeep({
  stalker: { kind: 0, hp: 5, speed: .72, attack: .8, windup: .28, contactDamage: 12, cost: 1, role: 'rush' },
  skitter: { kind: 0, hp: 4, speed: 1.04, attack: .72, windup: .2, contactDamage: 10, cost: 1, role: 'rush' },
  bloodhound: { kind: 0, hp: 8, speed: .9, attack: .9, windup: .24, contactDamage: 17, cost: 2, role: 'hunter' },
  caster: { kind: 1, hp: 7, speed: .3, attack: 1.9, windup: .48, projectileSpeed: 1.05, contactDamage: 15, cost: 2, role: 'ranged' },
  hexer: { kind: 1, hp: 10, speed: .34, attack: 2.25, windup: .72, projectileSpeed: 1.28, contactDamage: 19, cost: 3, role: 'ranged' },
  mireSinger: { kind: 1, hp: 13, speed: .25, attack: 2.6, windup: .9, projectileSpeed: 1.45, contactDamage: 23, cost: 4, role: 'ranged' },
  brute: { kind: 2, hp: 10, speed: .3, attack: 2.6, windup: .65, projectileSpeed: 1.4, contactDamage: 18, cost: 3, role: 'anchor' },
  warden: { kind: 2, hp: 17, speed: .24, attack: 3, windup: .8, projectileSpeed: 1.2, contactDamage: 24, cost: 5, role: 'anchor' },
  bellwraith: { kind: 3, hp: 14, speed: .62, attack: 2.2, windup: .52, projectileSpeed: 1.65, contactDamage: 20, cost: 4, role: 'teleport' },
  bellwraithEcho: { kind: 3, hp: 9, speed: .86, attack: 1.55, windup: .34, projectileSpeed: 1.8, contactDamage: 15, cost: 3, role: 'teleport' },
});

const wave = (budget, aliveCap, entries, intermission = 2.2) => ({
  budget,
  aliveCap,
  intermission,
  entries,
});

// Three sectors, each with three authored waves. Spawn delays are part of the
// design: a wave should read as a procession of threats instead of a single
// unfair pop-in. The budget/cap let the director degrade gracefully on co-op.
export const CAMPAIGN_SECTORS = freezeDeep([
  {
    id: 'bloodworks',
    name: 'The Bloodworks',
    tag: 'FOUNDATION // FIRST SIGNAL',
    blurb: 'A condemned medical foundry where the machines still remember your pulse.',
    color: '#ff735e',
    blocks: [[3, 3], [8, 3], [3, 8], [8, 8]],
    spawnPoints: [[2, 2], [10, 2], [6, 3], [2, 6], [10, 6], [6, 1.8], [1.5, 4], [10.5, 4]],
    playerSpawn: { x: 6, y: 10.5, angle: -Math.PI / 2 },
    exit: { x: 6, y: 1 },
    waves: [
      wave(5, 4, [
        entry(0, 'stalker', 0, .35, 1), entry(0, 'stalker', 1, .78, 1),
        entry(1, 'caster', 5, 1.3, 2), entry(0, 'stalker', 3, 1.86, 1),
      ]),
      wave(9, 5, [
        entry(0, 'skitter', 6, .25, 1), entry(0, 'skitter', 7, .65, 1),
        entry(1, 'caster', 1, 1.1, 2), entry(0, 'bloodhound', 4, 1.62, 2),
        entry(1, 'caster', 2, 2.2, 2),
      ]),
      wave(14, 6, [
        entry(2, 'brute', 2, .2, 3), entry(0, 'bloodhound', 6, .76, 2),
        entry(1, 'hexer', 1, 1.3, 3), entry(0, 'skitter', 7, 1.82, 1),
        entry(2, 'brute', 4, 2.42, 3), entry(1, 'caster', 5, 3.05, 2),
      ]),
    ],
  },
  {
    id: 'ossuary',
    name: 'The Ossuary',
    tag: 'DESCENT // BONES REMEMBER',
    blurb: 'The dead were stacked into the walls. Something underneath learned to ring them.',
    color: '#c98cff',
    blocks: [[2, 3], [9, 3], [5, 5], [2, 8], [9, 8]],
    spawnPoints: [[1.5, 1.7], [10.5, 1.7], [6, 2], [1.5, 5.8], [10.5, 5.8], [4, 10.2], [8, 10.2], [6, 7]],
    playerSpawn: { x: 6, y: 10.5, angle: -Math.PI / 2 },
    exit: { x: 6, y: 1 },
    waves: [
      wave(9, 5, [
        entry(0, 'bloodhound', 0, .25, 2), entry(0, 'skitter', 1, .62, 1),
        entry(1, 'caster', 2, 1.05, 2), entry(0, 'bloodhound', 3, 1.58, 2),
        entry(1, 'hexer', 4, 2.15, 3),
      ]),
      wave(13, 6, [
        entry(2, 'brute', 5, .2, 3), entry(0, 'skitter', 7, .57, 1),
        entry(1, 'hexer', 0, .96, 3), entry(0, 'bloodhound', 6, 1.46, 2),
        entry(2, 'brute', 1, 2.02, 3), entry(1, 'caster', 3, 2.62, 2),
      ]),
      wave(18, 6, [
        entry(3, 'bellwraith', 2, .25, 4), entry(2, 'warden', 0, .8, 5),
        entry(0, 'bloodhound', 5, 1.35, 2), entry(1, 'hexer', 7, 1.88, 3),
        entry(3, 'bellwraithEcho', 4, 2.5, 3), entry(2, 'brute', 1, 3.1, 3),
      ]),
    ],
  },
  {
    id: 'choir',
    name: 'The Choir of Teeth',
    tag: 'THRESHOLD // NO EXIT SIGNAL',
    blurb: 'Every bell is a mouth. Every mouth has been waiting for the last dead thing to arrive.',
    color: '#ffb15e',
    blocks: [[3, 2], [8, 2], [6, 4], [3, 7], [8, 7], [6, 9]],
    spawnPoints: [[1.5, 1.5], [10.5, 1.5], [2, 5], [10, 5], [1.5, 9.8], [10.5, 9.8], [4.5, 6], [7.5, 6]],
    playerSpawn: { x: 6, y: 10.5, angle: -Math.PI / 2 },
    exit: { x: 6, y: 1 },
    waves: [
      wave(12, 6, [
        entry(0, 'bloodhound', 0, .2, 2), entry(3, 'bellwraithEcho', 1, .7, 3),
        entry(1, 'hexer', 2, 1.15, 3), entry(0, 'skitter', 3, 1.62, 1),
        entry(2, 'brute', 4, 2.1, 3),
      ]),
      wave(18, 7, [
        entry(3, 'bellwraith', 5, .2, 4), entry(2, 'warden', 0, .72, 5),
        entry(0, 'bloodhound', 7, 1.24, 2), entry(1, 'mireSinger', 1, 1.78, 4),
        entry(3, 'bellwraithEcho', 6, 2.35, 3), entry(0, 'skitter', 2, 2.9, 1),
      ]),
      wave(27, 8, [
        entry(3, 'bellwraith', 0, .2, 4), entry(3, 'bellwraith', 1, .66, 4),
        entry(2, 'warden', 3, 1.14, 5), entry(1, 'mireSinger', 4, 1.68, 4),
        entry(0, 'bloodhound', 6, 2.25, 2), entry(3, 'bellwraithEcho', 7, 2.8, 3),
        entry(2, 'warden', 5, 3.4, 5),
      ]),
    ],
  },
]);

export const CAMPAIGN_WAVE_COUNT = CAMPAIGN_SECTORS[0].waves.length;
export const CAMPAIGN_SECTOR_COUNT = CAMPAIGN_SECTORS.length;

export function getSector(index = 0) {
  return CAMPAIGN_SECTORS[Math.max(0, Math.min(CAMPAIGN_SECTORS.length - 1, Math.floor(index)))] || CAMPAIGN_SECTORS[0];
}

export function getWavePlan(sectorIndex = 0, waveIndex = 0) {
  const sector = getSector(sectorIndex);
  return sector.waves[Math.max(0, Math.min(sector.waves.length - 1, Math.floor(waveIndex)))] || sector.waves[0];
}

export function makeWaveQueue(sectorIndex = 0, waveIndex = 0) {
  const plan = getWavePlan(sectorIndex, waveIndex);
  return plan.entries.map((item, index) => ({
    ...item,
    order: index,
    // Keep authored delays deterministic, while adding a tiny role-based cue
    // that gives same-time spawns enough separation to read in the arena.
    due: item.delay + index * .035,
    status: 'queued',
  }));
}

export function createCells(width = 12, height = 12, blocks = []) {
  const cells = Array.from({ length: width * height }, (_, i) => [
    i < width ? 1 : 0,
    i % width === width - 1 ? 1 : 0,
    i >= width * (height - 1) ? 1 : 0,
    i % width === 0 ? 1 : 0,
  ]);
  for (const [x, y] of blocks) {
    const index = y * width + x;
    if (index < 0 || index >= cells.length) continue;
    cells[index] = [1, 1, 1, 1];
    if (cells[index - width]) cells[index - width][2] = 1;
    if (cells[index + 1]) cells[index + 1][3] = 1;
    if (cells[index + width]) cells[index + width][0] = 1;
    if (cells[index - 1]) cells[index - 1][1] = 1;
  }
  return cells;
}

export function createCampaignCourse(index = 0) {
  const sectorIndex = Math.max(0, Math.min(CAMPAIGN_SECTORS.length - 1, Math.floor(index)));
  const sector = getSector(sectorIndex);
  return {
    name: sector.name,
    color: sector.color,
    tag: sector.tag,
    blurb: sector.blurb,
    id: sector.id,
    index: sectorIndex,
    sectorIndex,
    sectorId: sector.id,
    campaign: true,
    w: 12,
    h: 12,
    cells: createCells(12, 12, sector.blocks),
    blocks: sector.blocks.map(block => [...block]),
    spawnPoints: sector.spawnPoints.map(point => ({ x: point[0], y: point[1] })),
    points: [{ ...sector.playerSpawn }, { ...sector.exit }],
    playerSpawn: { ...sector.playerSpawn },
    exit: { ...sector.exit },
    turns: [],
    enemies: [],
  };
}

export function describeCampaign() {
  return CAMPAIGN_SECTORS.map((sector, sectorIndex) => ({
    index: sectorIndex,
    id: sector.id,
    name: sector.name,
    waves: sector.waves.length,
    budgets: sector.waves.map(item => item.budget),
    aliveCaps: sector.waves.map(item => item.aliveCap),
    introduces: [...new Set(sector.waves.flatMap(item => item.entries.map(spawn => spawn.variant)))],
  }));
}

