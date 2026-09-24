import * as THREE from './vendor/three.module.js';

// A deliberately small, reversible reaction layer. The imported survivor
// animation remains the pose authority; this module only adds a short local
// quaternion offset after the mixer has evaluated a frame. Keeping the
// overlay separate means a renderer can remove it before the next mixer tick
// without restoring a copied pose or fighting PropertyMixer.

export const MELEE_REACTION_VERSION = 'melee-reaction-v1';

const TAU = Math.PI * 2;
const MAX_DT = .2;
const MAX_SUBSTEPS = 4;
const EPSILON = 1e-5;
const GROUPS = Object.freeze([
  ['Hips', 'hips', 1],
  ['Spine01', 'spine01', .9],
  ['Spine02', 'spine02', 1],
  ['Neck', 'neck', .76],
  ['Head', 'head', 1],
  ['LeftArm', 'armL', .8],
  ['RightArm', 'armR', .8],
  ['LeftForeArm', 'foreL', .68],
  ['RightForeArm', 'foreR', .68],
  ['LeftUpLeg', 'legL', .46],
  ['RightUpLeg', 'legR', .46],
  ['LeftLeg', 'shinL', .32],
  ['RightLeg', 'shinR', .32],
 ]);

const GROUP_ALIASES = Object.freeze({
  hips: ['hips', 'pelvis'],
  spine01: ['spine01', 'spine1', 'spine'],
  spine02: ['spine02', 'spine2', 'spine'],
  neck: ['neck'],
  head: ['head'],
  armL: ['leftarm', 'leftupperarm', 'larm', 'upperarml'],
  armR: ['rightarm', 'rightupperarm', 'rarm', 'upperarmr'],
  foreL: ['leftforearm', 'leftlowerarm', 'lforearm', 'forearml'],
  foreR: ['rightforearm', 'rightlowerarm', 'rforearm', 'forearmr'],
  legL: ['leftupleg', 'leftthigh', 'lthigh', 'uplegl'],
  legR: ['rightupleg', 'rightthigh', 'rthigh', 'uplegr'],
  shinL: ['leftleg', 'leftlowerleg', 'lshin', 'shinl'],
  shinR: ['rightleg', 'rightlowerleg', 'rshin', 'shinr'],
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function wrapAngle(value) {
  let angle = finite(value);
  while (angle > Math.PI) angle -= TAU;
  while (angle < -Math.PI) angle += TAU;
  return angle;
}

function hashUnit(seed) {
  let value = (Math.floor(Math.abs(finite(seed))) + 1) | 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967295;
}

function findBone(model, aliases) {
  if (!model) return null;
  const wanted = new Set(aliases.map(normalizeName));
  let result = null;
  model.traverse?.(object => {
    if (result || !object?.isBone) return;
    const name = normalizeName(object.name);
    if (wanted.has(name)) result = object;
  });
  if (result) return result;
  for (const alias of aliases) {
    const exact = model.getObjectByName?.(alias);
    if (exact?.isBone) return exact;
  }
  return null;
}

function createEntry(bone, group, weight, index) {
  return {
    bone, group, weight, index,
    x: 0, y: 0, z: 0,
    vx: 0, vy: 0, vz: 0,
    targetX: 0, targetY: 0, targetZ: 0,
    overlay: new THREE.Quaternion(),
    inverse: new THREE.Quaternion(),
    euler: new THREE.Euler(0, 0, 0, 'XYZ'),
    applied: false,
  };
}

function setTarget(entry, x, y, z) {
  entry.targetX = x;
  entry.targetY = y;
  entry.targetZ = z;
}

function addVelocity(entry, x, y, z) {
  entry.vx += x;
  entry.vy += y;
  entry.vz += z;
}

function clearEntry(entry, preserveOffset = false) {
  entry.vx = entry.vy = entry.vz = 0;
  if (!preserveOffset) entry.x = entry.y = entry.z = 0;
  setTarget(entry, 0, 0, 0);
}

function isChainsaw(kind) {
  return String(kind || '').toLowerCase() === 'chainsaw' || String(kind || '').toLowerCase() === 'saw';
}

function kindTuning(out, kind, power) {
  const key = String(kind || 'bat').toLowerCase();
  const chainsaw = isChainsaw(key);
  const heavy = key === 'heavy' || key === 'maul' || key === 'sledge';
  const basePower = clamp(finite(power, key === 'chainsaw' ? .25 : key === 'heavy' ? 1.5 : 1), .1, 1.75);
  out.key = chainsaw ? 'chainsaw' : heavy ? 'heavy' : 'bat';
  out.power = basePower;
  out.impact = chainsaw ? clamp(.62 + basePower * .30, .55, .9) : clamp(.72 + basePower * .42, .7, 1.45);
  // A single contact should read as a physical hit, not a barely visible
  // one-frame nudge. The spring and angle clamps below still bound the pose.
  out.velocityScale = chainsaw ? 2 : heavy ? 9 : 8;
  out.chainsaw = chainsaw;
  out.heavy = heavy;
  return out;
}

function setDeathPose(state, seed) {
  const lean = hashUnit(seed * 1.13 + 4) > .5 ? 1 : -1;
  const twist = (hashUnit(seed * 2.17 + 9) * 2 - 1) * .16;
  for (const entry of state.entries) {
    let x = 0, y = 0, z = 0;
    switch (entry.group) {
      case 'hips': x = .11 * lean; z = twist * .55; break;
      case 'spine01': x = .16 * lean; y = twist; z = -.13 * lean; break;
      case 'spine02': x = .18 * lean; y = twist * 1.15; z = -.15 * lean; break;
      case 'neck': x = -.12 * lean; y = twist * 1.4; z = .16 * lean; break;
      case 'head': x = -.26 * lean; y = twist * 2.0; z = .22 * lean; break;
      case 'armL': x = -.18 + hashUnit(seed + 2) * .15; z = -.20 * lean; break;
      case 'armR': x = -.18 + hashUnit(seed + 3) * .15; z = .20 * lean; break;
      case 'foreL': x = -.23 + hashUnit(seed + 5) * .18; z = -.14 * lean; break;
      case 'foreR': x = -.23 + hashUnit(seed + 7) * .18; z = .14 * lean; break;
      case 'legL': x = .12 + hashUnit(seed + 11) * .10; z = -.08 * lean; break;
      case 'legR': x = .12 + hashUnit(seed + 13) * .10; z = .08 * lean; break;
      case 'shinL': x = -.12 + hashUnit(seed + 17) * .10; break;
      case 'shinR': x = -.12 + hashUnit(seed + 19) * .10; break;
      default: break;
    }
    setTarget(entry, clamp(x, -.42, .42), clamp(y, -.42, .42), clamp(z, -.42, .42));
  }
  state.deathPoseSeed = seed;
}

function impactEntry(entry, side, front, impulse, tuning, seed) {
  const weight = entry.weight;
  const jitter = (hashUnit(seed + entry.index * 17.7) * 2 - 1);
  let x = 0, y = 0, z = 0;
  switch (entry.group) {
    case 'hips':
      x = -front * .06 * impulse;
      y = side * .08 * impulse;
      z = -side * .08 * impulse;
      break;
    case 'spine01':
    case 'spine02':
      x = -front * .22 * impulse;
      y = side * .19 * impulse;
      z = -side * .14 * impulse;
      break;
    case 'neck':
      x = front * .18 * impulse;
      y = -side * .15 * impulse;
      z = side * .16 * impulse;
      break;
    case 'head':
      x = front * .32 * impulse;
      y = -side * .24 * impulse;
      z = side * .24 * impulse;
      break;
    case 'armL':
      x = -.18 * impulse;
      y = side * .07 * impulse;
      z = -.14 * impulse - side * .10 * impulse;
      break;
    case 'armR':
      x = -.18 * impulse;
      y = side * .07 * impulse;
      z = .14 * impulse - side * .10 * impulse;
      break;
    case 'foreL':
      x = -.22 * impulse;
      z = -.12 * impulse - side * .08 * impulse;
      break;
    case 'foreR':
      x = -.22 * impulse;
      z = .12 * impulse - side * .08 * impulse;
      break;
    case 'legL':
      x = .08 * impulse;
      z = -.06 * side * impulse;
      break;
    case 'legR':
      x = .08 * impulse;
      z = .06 * side * impulse;
      break;
    case 'shinL':
    case 'shinR':
      x = -.04 * impulse;
      break;
    default: break;
  }
  if (tuning.chainsaw) {
    // The saw chatters at the wrists and shoulders instead of throwing the
    // whole actor around. A tiny deterministic phase difference keeps the
    // silhouette alive without turning it into noise.
    const sawScale = entry.group === 'armL' || entry.group === 'armR' || entry.group === 'foreL' || entry.group === 'foreR' ? 1.1 : .55;
    x *= .62 * sawScale;
    y *= .54 * sawScale;
    z *= .62 * sawScale;
  }
  if (tuning.heavy) {
    x *= 1.12;
    z *= 1.08;
  }
  const velocityScale = tuning.velocityScale;
  addVelocity(entry, (x * weight + jitter * .008) * velocityScale, y * weight * velocityScale, z * weight * velocityScale);
}

function integrateEntry(entry, h, stiffness, damping) {
  entry.vx += (entry.targetX - entry.x) * stiffness * h;
  entry.vy += (entry.targetY - entry.y) * stiffness * h;
  entry.vz += (entry.targetZ - entry.z) * stiffness * h;
  const drag = Math.max(0, 1 - damping * h);
  entry.vx *= drag;
  entry.vy *= drag;
  entry.vz *= drag;
  entry.x = clamp(entry.x + entry.vx * h, -.72, .72);
  entry.y = clamp(entry.y + entry.vy * h, -.72, .72);
  entry.z = clamp(entry.z + entry.vz * h, -.72, .72);
  if (Math.abs(entry.x) < EPSILON && Math.abs(entry.vx) < EPSILON) entry.x = entry.vx = 0;
  if (Math.abs(entry.y) < EPSILON && Math.abs(entry.vy) < EPSILON) entry.y = entry.vy = 0;
  if (Math.abs(entry.z) < EPSILON && Math.abs(entry.vz) < EPSILON) entry.z = entry.vz = 0;
}

function applyEntryOverlay(state, entry, chatter = 0) {
  if (!entry.bone) return;
  const x = clamp(entry.x + chatter * (entry.group === 'head' || entry.group === 'neck' ? 1.25 : .55), -.78, .78);
  const y = clamp(entry.y + chatter * .24, -.78, .78);
  const z = clamp(entry.z - chatter * .38, -.78, .78);
  if (Math.abs(x) + Math.abs(y) + Math.abs(z) < EPSILON) return;
  entry.euler.set(x, y, z, 'XYZ');
  entry.overlay.setFromEuler(entry.euler);
  entry.inverse.copy(entry.overlay).invert();
  entry.bone.quaternion.premultiply(entry.overlay);
  entry.applied = true;
}

/**
 * Create the reversible reaction state for an existing imported rig or any
 * Object3D with named bones. No geometry, materials, mixer, or physics bodies
 * are created. Missing optional bones are simply skipped.
 */
export function createMeleeReaction(model, options = {}) {
  const entries = [];
  const bones = {};
  const usedBones = new Set();
  for (const [name, group, weight] of GROUPS) {
    const bone = findBone(model, GROUP_ALIASES[group] || [name]);
    if (!bone || usedBones.has(bone)) continue;
    usedBones.add(bone);
    bones[group] = bone;
    entries.push(createEntry(bone, group, weight, entries.length));
  }
  const state = {
    version: MELEE_REACTION_VERSION,
    model,
    entries,
    bones,
    lastHitId: finite(options.lastHitId, 0),
    lastKind: 'bat',
    lastPower: 1,
    age: 99,
    time: 0,
    chatterPhase: hashUnit(options.seed || 0) * TAU,
    wasDead: false,
    deathPoseSeed: 0,
    deathArmed: false,
    tuning: {key: 'bat', power: 1, impact: 1.14, velocityScale: 8, chainsaw: false, heavy: false},
    appliedCount: 0,
    hitCount: 0,
    diagnostics: {
      version: MELEE_REACTION_VERSION,
      boneCount: entries.length,
      active: false,
      lastHitId: finite(options.lastHitId, 0),
      lastKind: 'bat',
      hitCount: 0,
      dead: false,
      maxOffset: 0,
      finite: true,
    },
  };
  return state;
}

/** Remove the additive quaternion left on the rig by the previous frame. */
export function restoreMeleeReaction(state) {
  if (!state?.entries) return false;
  for (const entry of state.entries) {
    if (!entry.applied || !entry.bone) continue;
    entry.bone.quaternion.premultiply(entry.inverse);
    entry.applied = false;
  }
  state.appliedCount = 0;
  return true;
}

/**
 * Apply one bounded reaction frame after the animation mixer. The caller may
 * provide a world-space horizontal hit angle and the rendered root yaw. If a
 * caller misses the explicit restore call, the defensive restore here still
 * prevents additive drift.
 */
export function updateMeleeReaction(state, enemy = {}, dt = 0, rootYaw = 0) {
  if (!state?.entries) return false;
  restoreMeleeReaction(state);
  const safeDt = clamp(finite(dt, 0), 0, .2);
  const dead = !!enemy.dead;
  const hitId = finite(enemy.meleeHitId, state.lastHitId);
  const hasHit = hitId !== state.lastHitId;
  const kind = String(enemy.meleeKind || state.lastKind || 'bat').toLowerCase();
  const power = finite(enemy.meleePower, kind === 'chainsaw' ? .25 : kind === 'heavy' ? 1.5 : 1);
  const tuning = kindTuning(state.tuning, kind, power);
  state.time += safeDt;
  state.age += safeDt;

  if (!dead && state.wasDead) {
    state.deathArmed = false;
    for (const entry of state.entries) setTarget(entry, 0, 0, 0);
  }
  if (dead && !state.wasDead) {
    // Bullet deaths do not have a melee contact id. Leave those to the
    // authored collapse unless this visual has actually received a melee hit.
    state.deathArmed = state.hitCount > 0 || hitId > 0;
    if (state.deathArmed) setDeathPose(state, hitId || state.hitCount + 1);
  }
  state.wasDead = dead;

  if (hasHit) {
    state.lastHitId = hitId;
    state.lastKind = tuning.key;
    state.lastPower = power;
    state.age = 0;
    state.hitCount++;
    state.chatterPhase = hashUnit(hitId * 13.17 + power * 7.1) * TAU;
    const relative = wrapAngle(finite(enemy.meleeHitAngle, rootYaw) - finite(rootYaw));
    const side = Math.sin(relative);
    const front = Math.cos(relative);
    const impulse = tuning.impact * (dead ? 1.16 : 1);
    if (dead && !state.deathArmed) {
      state.deathArmed = true;
      setDeathPose(state, hitId || state.hitCount);
    }
    for (const entry of state.entries) impactEntry(entry, side, front, impulse, tuning, hitId || state.hitCount);
  }

  const substeps = safeDt > .0125 ? Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(safeDt / .0125))) : 1;
  const h = substeps ? safeDt / substeps : 0;
  const stiffness = dead ? 17 : tuning.chainsaw ? 31 : 25;
  const damping = dead ? 5.6 : tuning.chainsaw ? 7.7 : 8.8;
  for (let step = 0; step < substeps; step++) {
    for (const entry of state.entries) integrateEntry(entry, h, stiffness, damping);
  }

  const chatter = tuning.chainsaw && !dead && (enemy.meleeActive || state.age < .34)
    ? Math.sin(state.time * 48 + state.chatterPhase) * .032 * Math.exp(-state.age * 6.5)
    : 0;
  let maxOffset = 0;
  let active = false;
  let finiteState = true;
  for (const entry of state.entries) {
    maxOffset = Math.max(maxOffset, Math.abs(entry.x), Math.abs(entry.y), Math.abs(entry.z));
    if (Math.abs(entry.x) + Math.abs(entry.y) + Math.abs(entry.z) > .001 || Math.abs(entry.vx) + Math.abs(entry.vy) + Math.abs(entry.vz) > .001) active = true;
    finiteState = finiteState && Number.isFinite(entry.x) && Number.isFinite(entry.y) && Number.isFinite(entry.z) && Number.isFinite(entry.vx) && Number.isFinite(entry.vy) && Number.isFinite(entry.vz);
    applyEntryOverlay(state, entry, chatter);
  }
  state.appliedCount = state.entries.reduce((count, entry) => count + (entry.applied ? 1 : 0), 0);
  state.diagnostics.active = active || Math.abs(chatter) > EPSILON;
  state.diagnostics.lastHitId = state.lastHitId;
  state.diagnostics.lastKind = state.lastKind;
  state.diagnostics.hitCount = state.hitCount;
  state.diagnostics.dead = dead;
  state.diagnostics.maxOffset = maxOffset;
  state.diagnostics.finite = finiteState;
  return state.diagnostics.active;
}

/** Clear springs and remove any applied pose, useful on enemy reuse/reset. */
export function resetMeleeReaction(state) {
  if (!state?.entries) return false;
  restoreMeleeReaction(state);
  for (const entry of state.entries) clearEntry(entry);
  state.lastHitId = 0;
  state.lastKind = 'bat';
  state.lastPower = 1;
  state.age = 99;
  state.time = 0;
  state.wasDead = false;
  state.deathArmed = false;
  state.diagnostics.active = false;
  state.diagnostics.maxOffset = 0;
  state.diagnostics.dead = false;
  return true;
}

export function getMeleeReactionDiagnostics(state) {
  if (!state?.diagnostics) return null;
  return {...state.diagnostics};
}
