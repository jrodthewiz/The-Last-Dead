import { getRoomSequence, ROOM_PROGRESSION_VERSION } from './room-progression.js';
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
    playerSpawn: { x: 6, y: 10.5, angle: Math.atan2(-1.5, -4) },
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
    playerSpawn: { x: 6, y: 10.5, angle: Math.atan2(-1.5, -4) },
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
    playerSpawn: { x: 6, y: 10.5, angle: Math.atan2(-1.5, -4) },
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


// Build 08 authored world contract. Coordinates stay in gameplay cells so the
// network/collision proxy can remain small while the renderer gets real zones,
// routes and landmark anchors to build around.
const authoredLayout = (identity, focal, zones, routes, landmarks, machinery, lights) => ({
  version: 8,
  unit: 'cell',
  scale: 4,
  identity,
  focal,
  zones,
  routes,
  landmarks,
  machinery,
  lights,
});
const authoredMap = (blocks, walls, spawnPoints) => ({ blocks, walls, spawnPoints });

export const CAMPAIGN_LAYOUTS = freezeDeep([
  authoredLayout(
    'industrial-organic',
    'pulse-court',
    [
      { id: 'south-gate', role: 'spawn', rect: [1, 9, 10, 2], anchor: [6, 10], landmark: 'intake-gate', cue: 'warm-red', entry: 'wide' },
      { id: 'west-graft-gallery', role: 'side-flank', rect: [1, 3, 3, 5], anchor: [2, 5], landmark: 'graft-gallery-west', cue: 'scarlet' },
      { id: 'pulse-court', role: 'focal-encounter', rect: [4, 4, 4, 4], anchor: [6, 6], landmark: 'pulse-engine', cue: 'heart-red', arena: true },
      { id: 'east-graft-gallery', role: 'side-flank', rect: [8, 3, 3, 5], anchor: [10, 5], landmark: 'graft-gallery-east', cue: 'scarlet' },
      { id: 'furnace-spine', role: 'objective', rect: [4, 1, 4, 3], anchor: [6, 2], landmark: 'furnace-spine', cue: 'amber', exitApproach: true },
    ],
    [
      { id: 'central-aisle', role: 'primary', width: 2.4, points: [[6, 10.5], [6, 8.5], [6, 6], [6, 3.6], [6, 1.2]], cue: 'blood-red', combatLane: true },
      { id: 'west-arc', role: 'flank', width: 2.1, points: [[6, 8.3], [4.4, 8.3], [3.2, 6.5], [3.2, 4.2], [4.2, 3.1]], cue: 'rust' },
      { id: 'east-arc', role: 'flank', width: 2.1, points: [[6, 8.3], [7.6, 8.3], [8.8, 6.5], [8.8, 4.2], [7.8, 3.1]], cue: 'rust' },
      { id: 'crossfire', role: 'cross-court', width: 2.2, points: [[2.3, 6], [4.4, 6], [6, 6], [7.6, 6], [9.7, 6]], cue: 'white-hot', encounter: 'open' },
    ],
    [
      { id: 'intake-gate', type: 'gate-organ', anchor: [6, 10.4], size: [4.6, 2.4, 1.4], material: 'iron-blood', animated: 'breath', playerFacing: true },
      { id: 'pulse-engine', type: 'organ-pump', anchor: [6, 6], size: [3.4, 4.6, 3.4], material: 'flesh-steel', animated: 'pulse', hero: true },
      { id: 'furnace-spine', type: 'boiler-stack', anchor: [6, 2.1], size: [3.2, 3.5, 2.4], material: 'iron-amber', animated: 'steam', hero: true },
      { id: 'graft-gallery-west', type: 'flesh-conduit', anchor: [2, 5], size: [2.2, 4.1, 1.8], material: 'flesh-rust', animated: 'drip' },
      { id: 'graft-gallery-east', type: 'flesh-conduit', anchor: [10, 5], size: [2.2, 4.1, 1.8], material: 'flesh-rust', animated: 'drip' },
    ],
    [
      { id: 'intake-crane', type: 'gantry', anchor: [6, 2.8], span: [7.2, 3.2], motion: 'sway', cables: 4, hazard: 'amber' },
      { id: 'west-pump-bank', type: 'pump-bank', anchor: [2.3, 5.8], span: [1.6, 3.1], motion: 'throb', pipes: 3 },
      { id: 'east-pump-bank', type: 'pump-bank', anchor: [9.7, 5.8], span: [1.6, 3.1], motion: 'throb', pipes: 3 },
      { id: 'court-hoist', type: 'hanging-hoist', anchor: [6, 6.2], span: [2.4, 2.4], motion: 'pendulum', payload: 'heart' },
    ],
    [
      { anchor: [6, 10], color: '#ff3d36', intensity: 3.2, phase: .1, role: 'spawn' },
      { anchor: [3, 6], color: '#cc2c37', intensity: 2.1, phase: 1.7, role: 'flank' },
      { anchor: [6, 6], color: '#ff6b40', intensity: 3.6, phase: .4, role: 'focal' },
      { anchor: [9, 6], color: '#cc2c37', intensity: 2.1, phase: 2.8, role: 'flank' },
      { anchor: [6, 2], color: '#ffad55', intensity: 2.9, phase: 1.2, role: 'objective' },
    ],
  ),
  authoredLayout(
    'bone-crypt',
    'reliquary-court',
    [
      { id: 'south-descent', role: 'spawn', rect: [1, 9, 10, 2], anchor: [6, 10], landmark: 'bone-threshold', cue: 'violet', entry: 'wide' },
      { id: 'west-colonnade', role: 'side-flank', rect: [1, 3, 3, 5], anchor: [2, 5], landmark: 'rib-colonnade-west', cue: 'cold-violet' },
      { id: 'reliquary-court', role: 'focal-encounter', rect: [3, 4, 6, 4], anchor: [6, 6], landmark: 'bone-reliquary', cue: 'violet-white', arena: true },
      { id: 'east-colonnade', role: 'side-flank', rect: [8, 3, 3, 5], anchor: [10, 5], landmark: 'rib-colonnade-east', cue: 'cold-violet' },
      { id: 'bell-apse', role: 'objective', rect: [4, 1, 4, 3], anchor: [6, 2], landmark: 'bell-apse', cue: 'lilac', exitApproach: true },
    ],
    [
      { id: 'reliquary-descent', role: 'primary', width: 2.5, points: [[6, 10.5], [6, 8.4], [6, 6], [6, 3.5], [6, 1.2]], cue: 'bone-white', combatLane: true },
      { id: 'west-ossuary-arc', role: 'flank', width: 2.1, points: [[5.4, 8.1], [3.8, 8.1], [3, 6.4], [3, 4.2], [4.2, 3]], cue: 'violet' },
      { id: 'east-ossuary-arc', role: 'flank', width: 2.1, points: [[6.6, 8.1], [8.2, 8.1], [9, 6.4], [9, 4.2], [7.8, 3]], cue: 'violet' },
      { id: 'crypt-crossing', role: 'cross-court', width: 2.2, points: [[2.2, 6], [4.3, 6], [6, 6], [7.7, 6], [9.8, 6]], cue: 'bone-blue', encounter: 'open' },
    ],
    [
      { id: 'bone-threshold', type: 'rib-gate', anchor: [6, 10.2], size: [4.8, 2.6, 1.3], material: 'bone-iron', animated: 'rattle', playerFacing: true },
      { id: 'bone-reliquary', type: 'bone-throne', anchor: [6, 6], size: [3.8, 4.2, 3.2], material: 'bone-violet', animated: 'resonate', hero: true },
      { id: 'bell-apse', type: 'bell-array', anchor: [6, 2.1], size: [4.1, 4.2, 2.6], material: 'bone-brass', animated: 'ring', hero: true },
      { id: 'rib-colonnade-west', type: 'rib-stack', anchor: [2, 5], size: [2, 4.4, 2], material: 'bone-violet', animated: 'settle' },
      { id: 'rib-colonnade-east', type: 'rib-stack', anchor: [10, 5], size: [2, 4.4, 2], material: 'bone-violet', animated: 'settle' },
    ],
    [
      { id: 'crypt-lift-west', type: 'chain-lift', anchor: [2.4, 3.3], span: [2.2, 5], motion: 'ratchet', cables: 3, hazard: 'violet' },
      { id: 'crypt-lift-east', type: 'chain-lift', anchor: [9.6, 3.3], span: [2.2, 5], motion: 'ratchet', cables: 3, hazard: 'violet' },
      { id: 'reliquary-winches', type: 'winch-bank', anchor: [6, 6.5], span: [3.4, 2.2], motion: 'counterweight', cables: 5 },
      { id: 'apse-chandelier', type: 'bone-chandelier', anchor: [6, 2.4], span: [2.8, 2.8], motion: 'sway', payload: 'skulls' },
    ],
    [
      { anchor: [6, 10], color: '#6d4dff', intensity: 2.8, phase: .2, role: 'spawn' },
      { anchor: [3, 6], color: '#7e5dff', intensity: 2, phase: 1.9, role: 'flank' },
      { anchor: [6, 6], color: '#d5b7ff', intensity: 3.8, phase: .6, role: 'focal' },
      { anchor: [9, 6], color: '#7e5dff', intensity: 2, phase: 2.6, role: 'flank' },
      { anchor: [6, 2], color: '#c98cff', intensity: 3.4, phase: 1.4, role: 'objective' },
    ],
  ),
  authoredLayout(
    'resonant-flesh',
    'resonance-court',
    [
      { id: 'south-throat', role: 'spawn', rect: [1, 9, 10, 2], anchor: [6, 10], landmark: 'throat-gate', cue: 'orange', entry: 'wide' },
      { id: 'west-teeth-gallery', role: 'side-flank', rect: [1, 3, 3, 5], anchor: [2, 5], landmark: 'teeth-gallery-west', cue: 'hot-orange' },
      { id: 'resonance-court', role: 'focal-encounter', rect: [3, 4, 6, 4], anchor: [6, 6], landmark: 'mouth-altar', cue: 'gold-red', arena: true },
      { id: 'east-teeth-gallery', role: 'side-flank', rect: [8, 3, 3, 5], anchor: [10, 5], landmark: 'teeth-gallery-east', cue: 'hot-orange' },
      { id: 'bell-nave', role: 'objective', rect: [4, 1, 4, 3], anchor: [6, 2], landmark: 'bell-nave', cue: 'amber', exitApproach: true },
    ],
    [
      { id: 'throat-nave', role: 'primary', width: 2.5, points: [[6, 10.5], [6, 8.4], [6, 6], [6, 3.5], [6, 1.2]], cue: 'gold', combatLane: true },
      { id: 'west-teeth-arc', role: 'flank', width: 2.1, points: [[5.2, 8.1], [3.7, 8.1], [3, 6.4], [3, 4.2], [4.3, 3]], cue: 'orange' },
      { id: 'east-teeth-arc', role: 'flank', width: 2.1, points: [[6.8, 8.1], [8.3, 8.1], [9, 6.4], [9, 4.2], [7.7, 3]], cue: 'orange' },
      { id: 'resonance-crossing', role: 'cross-court', width: 2.2, points: [[2.2, 6], [4.3, 6], [6, 6], [7.7, 6], [9.8, 6]], cue: 'white-gold', encounter: 'open' },
    ],
    [
      { id: 'throat-gate', type: 'mouth-gate', anchor: [6, 10.2], size: [4.7, 2.4, 1.5], material: 'flesh-brass', animated: 'breathe', playerFacing: true },
      { id: 'mouth-altar', type: 'mouth-altar', anchor: [6, 6], size: [4.2, 4.3, 3.5], material: 'flesh-gold', animated: 'sing', hero: true },
      { id: 'bell-nave', type: 'bell-array', anchor: [6, 2.1], size: [4.4, 4.1, 2.8], material: 'brass-flesh', animated: 'ring', hero: true },
      { id: 'teeth-gallery-west', type: 'tooth-rack', anchor: [2, 5], size: [2.1, 4.4, 1.9], material: 'bone-orange', animated: 'chatter' },
      { id: 'teeth-gallery-east', type: 'tooth-rack', anchor: [10, 5], size: [2.1, 4.4, 1.9], material: 'bone-orange', animated: 'chatter' },
    ],
    [
      { id: 'choir-organ-west', type: 'pipe-organ', anchor: [2.5, 3.2], span: [2.3, 4.7], motion: 'breath', pipes: 7, hazard: 'orange' },
      { id: 'choir-organ-east', type: 'pipe-organ', anchor: [9.5, 3.2], span: [2.3, 4.7], motion: 'breath', pipes: 7, hazard: 'orange' },
      { id: 'resonance-winches', type: 'bell-winches', anchor: [6, 6.6], span: [3.7, 2.4], motion: 'counterweight', cables: 6 },
      { id: 'nave-chandelier', type: 'bell-chandelier', anchor: [6, 2.5], span: [3.4, 3], motion: 'sway', payload: 'bells' },
    ],
    [
      { anchor: [6, 10], color: '#e35b2b', intensity: 3, phase: .1, role: 'spawn' },
      { anchor: [3, 6], color: '#d2452b', intensity: 2.2, phase: 1.5, role: 'flank' },
      { anchor: [6, 6], color: '#ffd06b', intensity: 4, phase: .7, role: 'focal' },
      { anchor: [9, 6], color: '#d2452b', intensity: 2.2, phase: 2.7, role: 'flank' },
      { anchor: [6, 2], color: '#ffb15e', intensity: 3.5, phase: 1.1, role: 'objective' },
    ],
  ),
]);

export const CAMPAIGN_MAPS = freezeDeep([
  authoredMap(
    [[2, 3], [9, 3], [3, 7], [8, 7], [5, 5]],
    [
      [2, 4, 1], [2, 5, 1], [2, 6, 1],
      [9, 4, 3], [9, 5, 3], [9, 6, 3],
      [4, 2, 2], [5, 2, 2], [7, 2, 2], [8, 2, 2],
      [3, 9, 0], [4, 9, 0], [7, 9, 0], [8, 9, 0],
    ],
    [[1.5, 2], [10.5, 2], [6, 3.2], [1.5, 6], [10.5, 6], [6, 1.7], [1.5, 9.2], [10.5, 9.2]],
  ),
  authoredMap(
    [[2, 2], [9, 2], [4, 5], [7, 5], [2, 8], [9, 8]],
    [
      [3, 3, 2], [4, 3, 2], [7, 3, 2], [8, 3, 2],
      [2, 4, 1], [2, 5, 1], [9, 4, 3], [9, 5, 3],
      [3, 9, 0], [4, 9, 0], [7, 9, 0], [8, 9, 0],
    ],
    [[1.5, 1.7], [10.5, 1.7], [6, 2], [1.5, 5.8], [10.5, 5.8], [4, 10.2], [8, 10.2], [6, 7]],
  ),
  authoredMap(
    [[2, 2], [9, 2], [5, 4], [6, 4], [2, 8], [9, 8]],
    [
      [3, 3, 2], [4, 3, 2], [7, 3, 2], [8, 3, 2],
      [1, 4, 1], [1, 5, 1], [1, 6, 1], [10, 4, 3], [10, 5, 3], [10, 6, 3],
      [3, 7, 0], [4, 7, 0], [7, 7, 0], [8, 7, 0],
    ],
    [[1.5, 1.5], [10.5, 1.5], [2, 5], [10, 5], [1.5, 9.8], [10.5, 9.8], [4.5, 6], [7.5, 6]],
  ),
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

const opposite = [2, 3, 0, 1];
const deltas = [[0, -1], [1, 0], [0, 1], [-1, 0]];

function markWall(cells, width, height, x, y, direction) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(direction) || direction < 0 || direction > 3) return;
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const index = y * width + x;
  cells[index][direction] = 1;
  const nx = x + deltas[direction][0];
  const ny = y + deltas[direction][1];
  if (nx >= 0 && ny >= 0 && nx < width && ny < height) cells[ny * width + nx][opposite[direction]] = 1;
}

export function createCells(width = 12, height = 12, blocks = [], walls = []) {
  const cells = Array.from({ length: width * height }, (_, i) => [
    i < width ? 1 : 0,
    i % width === width - 1 ? 1 : 0,
    i >= width * (height - 1) ? 1 : 0,
    i % width === 0 ? 1 : 0,
  ]);
  for (const block of blocks) {
    const [x, y] = block;
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
    const index = y * width + x;
    if (index < 0 || index >= cells.length) continue;
    cells[index] = [1, 1, 1, 1];
    for (let direction = 0; direction < 4; direction += 1) markWall(cells, width, height, x, y, direction);
  }
  for (const wall of walls || []) {
    if (Array.isArray(wall)) markWall(cells, width, height, wall[0], wall[1], wall[2]);
    else if (wall && typeof wall === 'object') markWall(cells, width, height, wall.x, wall.y, wall.direction ?? wall.d);
  }
  return cells;
}

function isBlocked(cells, width, height, x, y) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= width || cy >= height) return true;
  return cells[cy * width + cx]?.every(Boolean) ?? true;
}

function canTraverse(cells, width, height, x, y, nx, ny) {
  if (nx < 0 || ny < 0 || nx >= width || ny >= height) return false;
  if (isBlocked(cells, width, height, x + .5, y + .5) || isBlocked(cells, width, height, nx + .5, ny + .5)) return false;
  const direction = nx === x + 1 ? 1 : nx === x - 1 ? 3 : ny === y + 1 ? 2 : 0;
  return !cells[y * width + x][direction] && !cells[ny * width + nx][opposite[direction]];
}

function reachableCells(cells, width, height, origin) {
  const startX = Math.floor(origin.x);
  const startY = Math.floor(origin.y);
  if (isBlocked(cells, width, height, origin.x, origin.y)) return new Set();
  const seen = new Set([startX + ',' + startY]);
  const queue = [[startX, startY]];
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of deltas) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const key = nx + ',' + ny;
      if (seen.has(key) || !canTraverse(cells, width, height, x, y, nx, ny)) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

function validateAuthoredMap(map, layout, sectorId) {
  const cells = createCells(12, 12, map.blocks, map.walls);
  const reachable = reachableCells(cells, 12, 12, { x: 6, y: 10.5 });
  const exitKey = Math.floor(6) + ',' + Math.floor(1);
  if (!reachable.has(exitKey)) throw new Error(sectorId + ' authored layout disconnects player from exit');
  for (const point of map.spawnPoints) {
    const key = Math.floor(point[0]) + ',' + Math.floor(point[1]);
    if (!reachable.has(key)) throw new Error(sectorId + ' authored layout strands spawn point ' + key);
  }
  for (const item of layout.landmarks) {
    const key = Math.floor(item.anchor[0]) + ',' + Math.floor(item.anchor[1]);
    if (!reachable.has(key)) throw new Error(sectorId + ' landmark is outside playable route: ' + item.id);
  }
  return true;
}

for (let i = 0; i < CAMPAIGN_MAPS.length; i += 1) validateAuthoredMap(CAMPAIGN_MAPS[i], CAMPAIGN_LAYOUTS[i], CAMPAIGN_SECTORS[i].id);


// Reserve a paired Manhattan route through each combat band before applying
// dynamic gate planes. Retained cover and rendered wall proxies use the same
// carved recipe, so old arena partitions cannot strand a new room encounter.
function carveRoomRoutes(map) {
  const route=new Set();
  for(let y=1;y<=10;y++)for(const x of [1,2,9,10])route.add(x+','+y);
  for(const y of [2,4,7,10])for(let x=1;x<=10;x++)route.add(x+','+y);
  const blocks=map.blocks.filter(([x,y])=>!route.has(x+','+y)).map(b=>[...b]);
  const walls=map.walls.filter(([x,y,d])=>{
    const nx=x+(d===1?1:d===3?-1:0),ny=y+(d===2?1:d===0?-1:0);
    return !(route.has(x+','+y)&&route.has(nx+','+ny));
  }).map(w=>[...w]);
  return {...map,blocks,walls};
}

export function createCampaignCourse(index = 0) {
  const sectorIndex = Math.max(0, Math.min(CAMPAIGN_SECTORS.length - 1, Math.floor(index)))
  const sector = getSector(sectorIndex)
  const map = carveRoomRoutes(CAMPAIGN_MAPS[sectorIndex])
  const layout = CAMPAIGN_LAYOUTS[sectorIndex]
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
    cells: createCells(12, 12, map.blocks, map.walls),
    blocks: map.blocks.map(block => [...block]),
    walls: map.walls.map(wall => [...wall]),
    layout,
    world: layout,
    zones: layout.zones,
    routes: layout.routes,
    landmarks: layout.landmarks,
    machinery: layout.machinery,
    lights: layout.lights,
    spawnPoints: map.spawnPoints.map(point => ({ x: point[0], y: point[1] })),
    points: [{ ...sector.playerSpawn }, { ...sector.exit }],
    playerSpawn: { ...sector.playerSpawn },
    exit: { ...sector.exit },
    turns: [],
    enemies: [],
    rooms: getRoomSequence(sector.id),
    roomProgressionVersion: ROOM_PROGRESSION_VERSION,
  }
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

