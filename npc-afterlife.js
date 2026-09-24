import * as THREE from './vendor/three.module.js';
import {createMeshySurvivor} from './assets/survivor/meshy-survivor.js';

// The small enemy family borrows the survivor's authored humanoid mesh and
// animation set.  The visual change is deliberately a material and posture
// pass: the collision model, animation lifecycle, and attack telegraphs remain
// owned by the existing enemy simulation.

const AFTERLIFE_PROFILES = Object.freeze({
  stalker: Object.freeze({
    key: 'stalker', kind: 0, label: 'Ash Witness',
    face: 0xc7c6bd, cloth: 0x27282a, arms: 0x343436,
    socket: 0x050607, signal: 0x6f3038, roughness: .92,
  }),
  skitter: Object.freeze({
    key: 'skitter', kind: 0, label: 'Cinder Witness',
    face: 0xb8b6af, cloth: 0x242326, arms: 0x2d2c31,
    socket: 0x030405, signal: 0x7c3a3b, roughness: .95,
  }),
  bloodhound: Object.freeze({
    key: 'bloodhound', kind: 0, label: 'Sanguine Witness',
    face: 0xd0c5bc, cloth: 0x2a2526, arms: 0x3a2d2e,
    socket: 0x090404, signal: 0x783135, roughness: .89,
  }),
  caster: Object.freeze({
    key: 'caster', kind: 1, label: 'Pallid Cantor',
    face: 0xbcc4c2, cloth: 0x202326, arms: 0x2d3135,
    socket: 0x05090a, signal: 0x5e5a6d, roughness: .94,
  }),
  hexer: Object.freeze({
    key: 'hexer', kind: 1, label: 'Violet Cantor',
    face: 0xb9b2bf, cloth: 0x24212b, arms: 0x302c39,
    socket: 0x08050b, signal: 0x6c566f, roughness: .9,
  }),
  mireSinger: Object.freeze({
    key: 'mireSinger', kind: 1, label: 'Mire Cantor',
    face: 0xb5beb0, cloth: 0x202822, arms: 0x2a342c,
    socket: 0x050a06, signal: 0x4d6654, roughness: .96,
  }),
});

const FALLBACKS = Object.freeze({0: 'stalker', 1: 'caster'});
const tempScale = new THREE.Vector3();
const tempPosition = new THREE.Vector3();
const tempTarget = new THREE.Vector3();
const tempQuat = new THREE.Quaternion();
const tempAxis = new THREE.Vector3();

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function seedNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.abs(Math.floor(number * 9973)) : 0;
}

export function resolveAfterlifeAppearance(kind = 0, requested = '', seed = 0) {
  const direct = AFTERLIFE_PROFILES[requested];
  if (direct?.kind === kind) return direct;
  const choices = Object.values(AFTERLIFE_PROFILES).filter(profile => profile.kind === kind);
  return choices[seedNumber(seed) % choices.length] || AFTERLIFE_PROFILES[FALLBACKS[kind] || 'stalker'];
}

// Engine enemy state keeps `attack` as a cooldown/readiness timer. It reaches
// zero while an enemy is merely eligible to begin a windup, so it is not a
// visual warning signal. Only the committed windup or the short post-release
// strike window should change the silhouette and telegraph.
export function isAfterlifeWarning(kind = 0, enemy = {}) {
  if (enemy?.attacking) return true;
  const strike = Number(enemy?.strike);
  return Number.isFinite(strike) && strike > 0;
}

function copySharedTextureFlags(material) {
  for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'bumpMap', 'aoMap']) {
    const texture = material?.[key];
    if (texture?.userData) texture.userData.sharedAsset = true;
  }
}

function cloneMaterial(material) {
  const copy = material?.clone ? material.clone() : material;
  copySharedTextureFlags(copy);
  return copy;
}

function materialRole(mesh) {
  const name = String(mesh?.name || '');
  if (/head/i.test(name)) return 'face';
  if (/remote.?arms/i.test(name)) return 'arms';
  if (/torso|legs|local/i.test(name)) return 'cloth';
  return 'cloth';
}

function setMaterialColor(material, hex, roughness) {
  if (!material) return;
  material.color?.setHex(hex);
  if ('roughness' in material) material.roughness = roughness;
  if ('metalness' in material) material.metalness = 0;
  if ('envMapIntensity' in material) material.envMapIntensity = .34;
  if (material.emissive) {
    material.emissive.setHex(0x090a0b);
    material.emissiveIntensity = .018;
    material.userData.baseEmissive = material.emissive.clone();
    material.userData.baseEmissiveIntensity = material.emissiveIntensity;
  }
}

function applyAppearance(state, profile) {
  state.appearance = profile;
  for (const entry of state.materialEntries) {
    const color = entry.role === 'face' ? profile.face : entry.role === 'arms' ? profile.arms : profile.cloth;
    setMaterialColor(entry.material, color, entry.role === 'face' ? .86 : profile.roughness);
    entry.material.userData.enemyVariant = profile.key;
    entry.material.userData.afterlifeRole = entry.role;
  }
  for (const item of state.faceParts || []) {
    if (item.material?.color) item.material.color.setHex(item.name.includes('Socket') ? profile.socket : 0x090808);
  }
  if (state.telegraph?.material?.color) state.telegraph.material.color.setHex(profile.signal);
  if (state.hood?.material?.color) state.hood.material.color.setHex(profile.cloth);
}

function findBone(state, ...names) {
  for (const name of names) {
    const bone = state.bones?.[name] || state.bones?.[name.toLowerCase()];
    if (bone) return bone;
  }
  return null;
}

function recordBones(actorState) {
  const bones = {};
  for (const [name, bone] of Object.entries(actorState.bones || {})) bones[name.toLowerCase()] = bone;
  actorState.bones = bones;
  actorState.basePose = actorState.basePose || [];
  actorState.baseByName = new Map(actorState.basePose.map(item => [item.bone.name.toLowerCase(), item]));
}

function attachWorldPart(parent, worldPoint, dimensions, geometry, material, name, options = {}) {
  if (!parent) return null;
  parent.updateMatrixWorld(true);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  parent.worldToLocal(tempPosition.copy(worldPoint));
  mesh.position.copy(tempPosition);
  parent.getWorldScale(tempScale);
  mesh.scale.set(
    dimensions[0] / Math.max(.0001, tempScale.x),
    dimensions[1] / Math.max(.0001, tempScale.y),
    dimensions[2] / Math.max(.0001, tempScale.z),
  );
  mesh.castShadow = options.castShadow ?? false;
  mesh.receiveShadow = options.receiveShadow ?? false;
  mesh.renderOrder = options.renderOrder ?? 2;
  parent.add(mesh);
  return mesh;
}

function addFaceDetails(root, state, profile, kind) {
  const head = findBone(state, 'Head', 'head');
  if (!head) return;
  root.updateMatrixWorld(true);
  head.updateMatrixWorld(true);
  const frontBone = findBone(state, 'headfront', 'headFront', 'head_end') || head;
  frontBone.getWorldPosition(tempTarget);
  const faceCenter = tempTarget.clone();
  const dark = new THREE.MeshStandardMaterial({
    color: profile.socket,
    roughness: 1,
    metalness: 0,
  });
  const mouth = new THREE.MeshStandardMaterial({
    color: 0x080708,
    roughness: 1,
    metalness: 0,
  });
  state.faceParts = [];
  for (const side of [-1, 1]) {
    tempTarget.copy(faceCenter).add(new THREE.Vector3(side * .037, .018, -.007));
    const socket = attachWorldPart(
      head,
      tempTarget,
      [.034, .027, .009],
      new THREE.SphereGeometry(1, 12, 8),
      dark,
      side < 0 ? 'AfterlifeLeftEyeSocket' : 'AfterlifeRightEyeSocket',
    );
    if (socket) state.faceParts.push(socket);
  }
  tempTarget.copy(faceCenter).add(new THREE.Vector3(0, -.070, -.009));
  const slit = attachWorldPart(
    head,
    tempTarget,
    [.066, .010, .007],
    new THREE.BoxGeometry(1, 1, 1),
    mouth,
    'AfterlifeMouthSeam',
  );
  if (slit) state.faceParts.push(slit);

  // The caster's hood makes its silhouette read as a separate role without
  // introducing a floating aura.  It is bone-attached and remains grounded
  // with the imported mesh throughout the animation.
  if (kind === 1) {
    tempTarget.copy(faceCenter).add(new THREE.Vector3(0, .018, .006));
    state.hood = attachWorldPart(
      head,
      tempTarget,
      [.145, .165, .135],
      new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * .70),
      new THREE.MeshStandardMaterial({color: profile.cloth, roughness: .96, metalness: 0}),
      'AfterlifeCasterHood',
      {renderOrder: 1},
    );
    state.faceParts.push(state.hood);
  }
}

function addTelegraph(root, kind, profile) {
  const radius = kind === 0 ? .36 : .47;
  const thickness = kind === 0 ? .022 : .018;
  const material = new THREE.MeshBasicMaterial({
    color: profile.signal,
    transparent: true,
    opacity: .25,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius + thickness, 32), material);
  ring.name = 'AfterlifeAttackTelegraph';
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = .028;
  ring.visible = false;
  root.add(ring);
  return ring;
}

function setBaseActionWeights(state) {
  const {actions} = state.actorState;
  const idle = actions?.Idle_Relaxed;
  const walk = actions?.Walk_Forward;
  const run = actions?.Run_Forward;
  if (idle) idle.setEffectiveWeight(1);
  if (walk) walk.setEffectiveWeight(0);
  if (run) run.setEffectiveWeight(0);
  if (idle && !idle.isRunning()) idle.play();
  if (walk && !walk.isRunning()) walk.play();
  if (run && !run.isRunning()) run.play();
}

function rotateBone(state, name, x = 0, y = 0, z = 0) {
  const bone = findBone(state, name);
  if (!bone) return;
  if (x) {tempAxis.set(1, 0, 0);tempQuat.setFromAxisAngle(tempAxis, x);bone.quaternion.multiply(tempQuat);}
  if (y) {tempAxis.set(0, 1, 0);tempQuat.setFromAxisAngle(tempAxis, y);bone.quaternion.multiply(tempQuat);}
  if (z) {tempAxis.set(0, 0, 1);tempQuat.setFromAxisAngle(tempAxis, z);bone.quaternion.multiply(tempQuat);}
}

function restoreBasePose(state) {
  for (const item of state.actorState.basePose || []) {
    item.bone.position.copy(item.position);
    item.bone.quaternion.copy(item.rotation);
    item.bone.scale.copy(item.scale);
  }
}

function updateFloor(state) {
  const actorState = state.actorState;
  const body = actorState.body;
  if (!body?.getVertexPosition || !actorState.soleSamples?.length) return;
  body.skeleton?.update?.();
  state.actor.updateMatrixWorld(true);
  let floor = Infinity;
  for (const index of actorState.soleSamples) {
    body.getVertexPosition(index, actorState.point);
    actorState.point.applyMatrix4(body.matrixWorld);
    floor = Math.min(floor, actorState.point.y);
  }
  if (Number.isFinite(floor) && Math.abs(floor) > .0005) state.actor.position.y -= floor;
}

function updateMaterialsForHit(state, hit) {
  for (const entry of state.materialEntries) {
    const material = entry.material;
    if (!material?.emissive) continue;
    const base = material.userData.baseEmissive;
    if (base) material.emissive.copy(base);
    material.emissiveIntensity = (material.userData.baseEmissiveIntensity ?? .018) + hit * .62;
  }
}

function applyPosture(state, kind, attackProgress, t, seed) {
  const sway = Math.sin(t * 1.55 + seed) * .035;
  const twitch = Math.sin(t * 4.1 + seed * 1.7) * .022;
  if (kind === 0) {
    // The melee shape leans into the player and keeps one shoulder lower.
    rotateBone(state, 'Spine02', .14, sway * .35, -.035);
    rotateBone(state, 'Spine01', .10, 0, -.025);
    rotateBone(state, 'neck', -.045, sway, -.07 + twitch);
    rotateBone(state, 'Head', .065, -sway * .7, -.11 + twitch);
    rotateBone(state, 'LeftArm', -.18 - attackProgress * .68, 0, -.16);
    rotateBone(state, 'RightArm', .08 - attackProgress * .12, 0, .22);
    rotateBone(state, 'LeftForeArm', -.26 - attackProgress * .54, 0, -.04);
    rotateBone(state, 'RightForeArm', -.32 - attackProgress * .18, 0, .04);
    rotateBone(state, 'Hips', 0, 0, -.018 + sway * .2);
    rotateBone(state, 'LeftUpLeg', Math.sin(t * 5.8 + seed) * .06, 0, 0);
    rotateBone(state, 'RightUpLeg', -Math.sin(t * 5.8 + seed) * .06, 0, 0);
  } else {
    // The caster stays planted but opens the upper silhouette like a silent
    // cantor.  The lifted arms and bowed head separate it from the melee read.
    rotateBone(state, 'Spine02', -.045, sway * .25, .045);
    rotateBone(state, 'Spine01', -.025, 0, .035);
    rotateBone(state, 'neck', -.075, -sway, .075 + twitch);
    rotateBone(state, 'Head', -.055, sway * .4, .14 - twitch);
    rotateBone(state, 'LeftArm', -.72 - attackProgress * .2, 0, -.32);
    rotateBone(state, 'RightArm', -.72 - attackProgress * .2, 0, .32);
    rotateBone(state, 'LeftForeArm', -.46 - attackProgress * .3, 0, -.03);
    rotateBone(state, 'RightForeArm', -.46 - attackProgress * .3, 0, .03);
    rotateBone(state, 'Hips', 0, 0, sway * .08);
    rotateBone(state, 'LeftUpLeg', Math.sin(t * 2.4 + seed) * .025, 0, 0);
    rotateBone(state, 'RightUpLeg', -Math.sin(t * 2.4 + seed) * .025, 0, 0);
  }
}

function updateAction(state, moving, dt) {
  const {actions, mixer} = state.actorState;
  const idle = actions?.Idle_Relaxed;
  const walk = actions?.Walk_Forward;
  const run = actions?.Run_Forward;
  const amount = clamp(moving / .75, 0, 1);
  const running = clamp((moving - 1.1) / 1.4, 0, 1);
  if (idle) idle.setEffectiveWeight(1 - amount);
  if (walk) {walk.setEffectiveWeight(amount * (1 - running));walk.setEffectiveTimeScale(clamp(moving / 1.05, .55, 1.35));}
  if (run) {run.setEffectiveWeight(amount * running);run.setEffectiveTimeScale(clamp(moving / 2.15, .65, 1.35));}
  if (mixer) mixer.update(clamp(dt, 0, .05));
}

export function createAfterlifeEnemy(template, clips = [], kind = 0, variant = '', seed = 0) {
  if (!template) throw new Error('createAfterlifeEnemy requires the survivor GLB template');
  // The survivor template is shared by the local player, peers, and every
  // afterlife clone. Mark every source geometry up front, including the view
  // sleeves that this enemy hides, so future clone/disposal changes remain
  // safe under the renderer's shared-asset guard.
  template.traverse?.(node => {
    if (node.geometry?.userData) node.geometry.userData.sharedAsset = true;
  });
  const profile = resolveAfterlifeAppearance(kind, variant, seed);
  const actor = createMeshySurvivor(template, clips, {firstPerson: false});
  actor.name = 'AfterlifeSurvivorBody';
  const actorState = actor.userData;
  recordBones(actorState);
  const root = new THREE.Group();
  root.name = kind === 1 ? 'AfterlifeCaster' : 'AfterlifeStalker';
  const pivot = new THREE.Group();
  pivot.name = 'AfterlifeDeathPivot';
  root.add(pivot);
  pivot.add(actor);
  actorState.enemyKind = kind;
  actorState.variant = profile.key;
  actorState.baseActorPosition = actor.position.clone();

  const materialEntries = [];
  actor.traverse(node => {
    if (!node.isMesh) return;
    // SkeletonUtils.clone intentionally reuses the survivor geometry. Mark it
    // before the renderer's per-enemy disposal pass so removing a dead actor
    // cannot destroy the shared survivor template used by the player/peers.
    if (node.geometry?.userData) node.geometry.userData.sharedAsset = true;
    const role = materialRole(node);
    const corpseSurface = material => {
      const copy = cloneMaterial(material);
      copy.onBeforeCompile = shader => {
        const strength = role === 'face' ? '0.08' : '0.2';
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          float corpseLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          diffuseColor.rgb = mix(vec3(corpseLuma), diffuseColor.rgb, ${strength});
          ${role === 'face' ? 'diffuseColor.rgb *= 1.35;' : ''}`);
      };
      copy.customProgramCacheKey = () => `afterlife-corpse-${role}-v1`;
      return copy;
    };
    if (Array.isArray(node.material)) {
      node.material = node.material.map(material => {
        const copy = corpseSurface(material);
        materialEntries.push({material: copy, role});
        return copy;
      });
    } else {
      node.material = corpseSurface(node.material);
      materialEntries.push({material: node.material, role});
    }
    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = false;
  });

  const state = {
    root, pivot, actor, actorState, bones: actorState.bones, materials: materialEntries.map(entry => entry.material),
    materialEntries, faceParts: [], telegraph: null, hood: null, appearance: profile,
    deadAt: null, last: 0, lastPosition: null, variant: profile.key, kind, seed,
  };
  addFaceDetails(root, state, profile, kind);
  state.telegraph = addTelegraph(root, kind, profile);
  state.actorState.afterlife = state;
  state.parts = {
    actor,
    body: actor,
    model: actor.children[0] || actor,
    telegraph: state.telegraph,
    attackTelegraph: state.telegraph,
    faceParts: state.faceParts,
    hood: state.hood,
  };
  root.userData.afterlife = state;
  root.userData.parts = state.parts;
  root.userData.source = 'survivor-v02-afterlife';
  root.userData.assetStrategy = 'reused-imported-survivor-rig';
  root.userData.kind = kind;
  root.userData.variant = profile.key;
  setBaseActionWeights(state);
  applyAppearance(state, profile);
  root.updateMatrixWorld(true);
  updateFloor(state);
  // The renderer places the root at the enemy's world position after creation;
  // seed movement tracking on the first animate call instead of treating that
  // spawn placement as a full speed sprint.
  state.lastPosition = null;
  return root;
}

export function resetAfterlifeEnemy(root, variant = '', seed = 0) {
  const state = root?.userData?.afterlife;
  if (!state) return root;
  const profile = resolveAfterlifeAppearance(state.kind, variant || state.variant, seed);
  state.variant = profile.key;
  state.seed = seed;
  state.deadAt = null;
  state.last = 0;
  state.lastPosition = root.position.clone();
  root.visible = true;
  root.scale.set(1, 1, 1);
  state.pivot.position.set(0, 0, 0);
  state.pivot.rotation.set(0, 0, 0);
  state.pivot.scale.set(1, 1, 1);
  state.actor.position.copy(state.actorState.baseActorPosition);
  state.actor.rotation.set(0, 0, 0);
  restoreBasePose(state);
  if (state.actorState.mixer) {
    state.actorState.mixer.stopAllAction();
    setBaseActionWeights(state);
    state.actorState.mixer.setTime?.(0);
  }
  applyAppearance(state, profile);
  state.telegraph.visible = false;
  root.updateMatrixWorld(true);
  updateFloor(state);
  return root;
}

export function animateAfterlifeEnemy(root, enemy = {}, now = 0, seed = 0) {
  const state = root?.userData?.afterlife;
  if (!state) return;
  const t = now * .001;
  const dt = state.last ? Math.min(.05, Math.max(0, (now - state.last) / 1000)) : .016;
  state.last = now;
  const profile = resolveAfterlifeAppearance(state.kind, enemy.variant || state.variant, seed || state.seed);
  if (profile.key !== state.variant) {
    state.variant = profile.key;
    applyAppearance(state, profile);
  }
  const hurt = clamp(Number(enemy.flash || enemy.hitFlash || 0) / .16, 0, 1);
  if (enemy.dead) {
    state.deadAt ??= t;
    const deadProgress = clamp((t - state.deadAt) / .58, 0, 1);
    state.telegraph.visible = false;
    restoreBasePose(state);
    const fall = deadProgress * deadProgress * (3 - 2 * deadProgress);
    state.pivot.rotation.z = state.kind === 0 ? -fall * .82 : fall * .58;
    state.pivot.rotation.x = state.kind === 0 ? fall * .30 : fall * .18;
    state.pivot.position.y = -fall * .055;
    state.actor.scale.setScalar(1 + hurt * .012);
    updateMaterialsForHit(state, hurt);
    root.visible = deadProgress < 1;
    return;
  }
  state.deadAt = null;
  root.visible = true;
  state.pivot.position.set(0, 0, 0);
  state.pivot.rotation.set(0, 0, 0);
  state.pivot.scale.set(1, 1, 1);
  state.actor.scale.setScalar(1 + hurt * .012);
  restoreBasePose(state);

  let moving = 0;
  if (state.lastPosition) {
    const dx = root.position.x - state.lastPosition.x;
    const dz = root.position.z - state.lastPosition.z;
    moving = Math.hypot(dx, dz) / Math.max(.001, dt);
    state.lastPosition.set(root.position.x, root.position.y, root.position.z);
  } else {
    state.lastPosition = root.position.clone();
  }
  updateAction(state, moving, dt);

  const warning = isAfterlifeWarning(state.kind, enemy);
  const defaultWindup = state.kind === 0 ? .28 : .48;
  const windupTotal = Math.max(.001, Number(enemy.windupTime || enemy.windupDuration || defaultWindup));
  const windup = clamp(Number(enemy.windup || 0) / windupTotal, 0, 1);
  const strike = clamp(Number(enemy.strike || 0) / .22, 0, 1);
  const attackProgress = enemy.attacking ? 1 - windup : strike;
  applyPosture(state, state.kind, attackProgress, t, Number(seed || state.seed || 0));
  state.actorState.body?.skeleton?.update?.();
  root.updateMatrixWorld(true);
  updateFloor(state);

  state.telegraph.visible = warning;
  if (warning) {
    state.telegraph.scale.setScalar(1 + attackProgress * .26);
    state.telegraph.material.opacity = clamp(.18 + attackProgress * .36, .18, .58);
  } else {
    state.telegraph.scale.setScalar(1);
    state.telegraph.material.opacity = .2;
  }
  updateMaterialsForHit(state, hurt);
}

export function afterlifeVariationCatalog() {
  return Object.values(AFTERLIFE_PROFILES).map(profile => ({...profile}));
}
