import * as THREE from './vendor/three.module.js';
import {applyWeaponMaterialProfile, tagWeaponMechanism} from './weapon-materials.js';

// Lightweight first-person weapon kit for the afterlife pass.  The factories
// below use a few large authored forms and named pivots instead of a pile of
// decorative skulls, beads, and emissive rings.  Every animated part is a
// group with shared materials so the existing weapon batching and renderer
// contracts remain intact.

const V = points => points.map(point => new THREE.Vector3(...point));
const damp = (value, target, lambda, dt) => THREE.MathUtils.damp(value, target, lambda, dt);

function material(color, roughness, metalness, emissive = 0x000000, emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({
    color, roughness, metalness, emissive, emissiveIntensity,
  });
}

function fxMaterial(color) {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    depthWrite: false, toneMapped: false,
  });
}

function part(name, parent, parts) {
  const node = new THREE.Group();
  node.name = name;
  node.userData.explodeWithParent = true;
  parent.add(node);
  parts[name] = node;
  return node;
}

function add(parent, geometry, materialValue, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1], name = '') {
  const node = new THREE.Mesh(geometry, materialValue);
  node.name = name || `${parent.name}-surface-${parent.children.length}`;
  node.position.set(...position);
  node.rotation.set(...rotation);
  node.scale.set(...scale);
  node.castShadow = false;
  node.receiveShadow = false;
  node.userData.explodeWithParent = true;
  parent.add(node);
  return node;
}

function addTube(parent, points, radius, materialValue, sides = 6, name = 'tube') {
  return add(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(V(points)), Math.max(6, points.length * 3), radius, sides, false), materialValue, [0, 0, 0], [0, 0, 0], [1, 1, 1], name);
}

function socket(parent, name, position) {
  const node = new THREE.Object3D();
  node.name = name;
  node.position.set(...position);
  node.userData.viewmodelAnchor = name === 'supportGrip';
  parent.add(node);
  return node;
}

function commonMaterials(palette) {
  return {
    steel: material(palette.steel, .68, .72),
    edge: material(palette.edge, .42, .84),
    black: material(palette.black, .92, .16),
    bone: material(palette.bone, .88, 0),
    wood: material(palette.wood, .86, .04),
    brass: material(palette.brass, .5, .74),
    accent: material(palette.accent, .6, .38),
    glow: material(palette.glow, .54, .14, palette.glow, .45),
    heat: material(palette.heat, .42, .18, palette.heat, .5),
    muzzle: fxMaterial(palette.muzzle),
    muzzleCore: fxMaterial(palette.muzzleCore),
    muzzleRing: fxMaterial(palette.muzzleRing),
  };
}

function finish(root, kind, parts, materials, sockets, collider) {
  // Keep material ownership explicit while allowing the shared look-dev pass
  // to tame reflections in the game's dark afterlife lighting.
  applyWeaponMaterialProfile(materials, {
    steel: {roughness: .7, metalness: .7, envMapIntensity: .22},
    edge: {roughness: .46, metalness: .82, envMapIntensity: .27},
    black: {roughness: .94, metalness: .12, envMapIntensity: .08},
    bone: {roughness: .9, envMapIntensity: .16, colorScale: .9},
    wood: {roughness: .9, metalness: .02, envMapIntensity: .1},
    brass: {roughness: .54, metalness: .7, envMapIntensity: .2},
    glow: {roughness: .55, metalness: .1, envMapIntensity: .1},
    heat: {roughness: .4, metalness: .12, envMapIntensity: .1},
  });
  root.userData.muzzle = sockets.muzzle;
  root.userData.projectileOrigin = sockets.projectileOrigin;
  const runtime = {
    parts, sockets, materials, collider,
    explode(amount = 0) {
      const strength = Number(amount) || 0;
      for (const node of Object.values(parts)) {
        if (!node.userData.explodeHome) node.userData.explodeHome = node.position.clone();
        node.position.copy(node.userData.explodeHome);
        node.position.x += Math.sin(node.position.z * 9.1) * strength * .025;
        node.position.y += strength * .018;
      }
    },
    pick(raycaster) {
      const hit = raycaster?.intersectObject(root, true)?.[0];
      return hit?.object?.parent?.name || hit?.object?.name || null;
    },
  };
  root.userData.sculptRuntime = runtime;
  root.userData.resourcesReady = Promise.resolve();
  return root;
}

function addMuzzleFx(parent, materials, length = .3) {
  const muzzleFlash = new THREE.Group();
  muzzleFlash.name = 'muzzle-flash';
  muzzleFlash.visible = false;
  muzzleFlash.userData.pooled = true;
  muzzleFlash.userData.weaponBatchIgnore = true;
  const flashCone = add(muzzleFlash, new THREE.ConeGeometry(.09, length, 6), materials.muzzle, [0, 0, -length * .5], [Math.PI / 2, 0, 0], [1, 1, 1], 'flash-cone');
  const flashCore = add(muzzleFlash, new THREE.ConeGeometry(.045, length * .65, 5), materials.muzzleCore, [0, 0, -length * .3], [Math.PI / 2, 0, 0], [1, 1, 1], 'flash-core');
  const flashRing = add(muzzleFlash, new THREE.TorusGeometry(.09, .009, 5, 14), materials.muzzleRing, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'flash-ring');
  parent.add(muzzleFlash);
  return {muzzleFlash, flashCone, flashCore, flashRing};
}

function basePalette(kind) {
  const palettes = {
    ossuary: {steel: 0x1a1c1e, edge: 0x6d6258, black: 0x080a0b, bone: 0x887967, wood: 0x2b1d1a, brass: 0x76563f, accent: 0x4b2026, glow: 0x8d2635, heat: 0xa4472f, muzzle: 0xff713f, muzzleCore: 0xffead0, muzzleRing: 0xff4930},
    breach: {steel: 0x181b1e, edge: 0x71675d, black: 0x07090a, bone: 0x806f5d, wood: 0x30201c, brass: 0x826044, accent: 0x3d2925, glow: 0x7e2c27, heat: 0xb45031, muzzle: 0xff9c59, muzzleCore: 0xfff1d0, muzzleRing: 0xff542f},
    arc: {steel: 0x182126, edge: 0x69756f, black: 0x070b0d, bone: 0x766f61, wood: 0x211b1c, brass: 0x766047, accent: 0x274354, glow: 0x3e7e92, heat: 0x5ca6b1, muzzle: 0x7cc9d9, muzzleCore: 0xd4f7ef, muzzleRing: 0x4e9eb2},
    reliquary: {steel: 0x171a1d, edge: 0x71645b, black: 0x08090a, bone: 0x8b7968, wood: 0x30201d, brass: 0x7e5a43, accent: 0x442529, glow: 0x7d3033, heat: 0xb04a31, muzzle: 0xff824e, muzzleCore: 0xffead1, muzzleRing: 0xff4a2f},
  };
  return palettes[kind];
}

function commonSockets(root, recoilCarriage, muzzlePosition, projectilePosition, gripPosition, supportPosition) {
  const muzzle = socket(recoilCarriage, 'muzzle', muzzlePosition);
  const projectileOrigin = socket(recoilCarriage, 'projectileOrigin', projectilePosition);
  const grip = socket(root, 'grip', gripPosition);
  const supportGrip = supportPosition ? socket(root, 'supportGrip', supportPosition) : null;
  const heat = socket(recoilCarriage, 'heat', [0, .03, -.55]);
  const inspect = socket(root, 'inspect', [0, .1, .26]);
  return {muzzle, projectileOrigin, grip, supportGrip, heat, inspect};
}

export function buildOssuaryRedesign() {
  const root = new THREE.Group();
  root.name = 'Ossuary';
  const parts = {};
  const materials = commonMaterials(basePalette('ossuary'));
  const receiver = part('receiver', root, parts);
  add(receiver, new THREE.BoxGeometry(.34, .28, .46), materials.steel, [0, .01, -.03], [0, 0, 0], [1, 1, 1], 'receiver-shell');
  add(receiver, new THREE.BoxGeometry(.27, .035, .4), materials.edge, [0, .17, -.04], [0, 0, 0], [1, 1, 1], 'receiver-top-plate');
  add(receiver, new THREE.BoxGeometry(.19, .04, .34), materials.black, [0, -.16, -.03], [0, 0, 0], [1, 1, 1], 'receiver-under-plate');

  const recoilCarriage = part('recoil-carriage', root, parts);
  const barrel = part('barrel', recoilCarriage, parts);
  add(barrel, new THREE.BoxGeometry(.26, .22, .72), materials.black, [0, .02, -.58], [0, 0, 0], [1, 1, 1], 'barrel-shroud');
  add(barrel, new THREE.CylinderGeometry(.085, .1, .65, 8), materials.steel, [0, .02, -.61], [Math.PI / 2, 0, 0], [1, 1, 1], 'barrel-bore');
  const muzzleHousing = part('muzzle-housing', recoilCarriage, parts);
  add(muzzleHousing, new THREE.BoxGeometry(.29, .25, .18), materials.edge, [0, .02, -.99], [0, 0, 0], [1, 1, 1], 'muzzle-block');
  add(muzzleHousing, new THREE.CylinderGeometry(.098, .098, .03, 8), materials.black, [0, .02, -1.09], [Math.PI / 2, 0, 0], [1, 1, 1], 'muzzle-bore');

  const cylinder = part('cylinder', recoilCarriage, parts);
  tagWeaponMechanism(cylinder, 'ossuary-cylinder', 'z');
  add(cylinder, new THREE.CylinderGeometry(.165, .165, .22, 10), materials.bone, [0, .02, -.2], [Math.PI / 2, 0, 0], [1, 1, 1], 'bone-cylinder');
  add(cylinder, new THREE.CylinderGeometry(.19, .19, .045, 10), materials.edge, [0, .02, -.34], [Math.PI / 2, 0, 0], [1, 1, 1], 'ratchet-face');
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    add(cylinder, new THREE.BoxGeometry(.026, .05, .09), materials.black, [Math.cos(a) * .15, .02 + Math.sin(a) * .15, -.36], [0, 0, a], [1, 1, 1], `ratchet-tooth-${i}`);
  }
  const ribs = part('ribs', cylinder, parts);
  for (const side of [-1, 1]) addTube(ribs, [[side * .12, .14, -.08], [side * .19, .07, -.2], [side * .14, -.08, -.32]], .022, materials.bone, 6, `rib-${side}`);

  const jaw = part('jaw', muzzleHousing, parts);
  tagWeaponMechanism(jaw, 'jaw-clamp', 'z');
  const jawLeft = add(jaw, new THREE.BoxGeometry(.045, .17, .22), materials.bone, [-.15, .08, -.05], [0, 0, -.28], [1, 1, 1], 'jaw-left');
  const jawRight = add(jaw, new THREE.BoxGeometry(.045, .17, .22), materials.bone, [.15, .08, -.05], [0, 0, .28], [1, 1, 1], 'jaw-right');
  const spine = part('spine', root, parts);
  add(spine, new THREE.BoxGeometry(.05, .06, 1.12), materials.edge, [0, .2, -.38], [0, 0, 0], [1, 1, 1], 'spine-rail');
  add(spine, new THREE.BoxGeometry(.12, .025, .75), materials.bone, [0, .16, -.49], [0, 0, 0], [1, 1, 1], 'spine-bone');
  const grip = part('grip', root, parts);
  add(grip, new THREE.BoxGeometry(.18, .42, .2), materials.wood, [0, -.18, .09], [.15, 0, 0], [1, 1, 1], 'bakelite-grip');
  add(grip, new THREE.BoxGeometry(.21, .035, .22), materials.edge, [0, -.38, .09], [0, 0, 0], [1, 1, 1], 'grip-cap');

  const sockets = commonSockets(root, recoilCarriage, [0, .02, -1.12], [0, .02, -1.15], [0, -.2, .1], null);
  const fx = addMuzzleFx(muzzleHousing, materials, .28);
  sockets.muzzleFlash = fx.muzzleFlash;
  const shotArc = new THREE.Object3D();
  sockets.shotArc = shotArc;
  const meta = {kind: 'ossuary', parts, sockets, materials, recoilCarriage, cylinder, jaw, ribs, jawLeft, jawRight, spin: 0, recoil: 0, flash: 0, heat: 0, jawTension: 0, lastShot: 0, shotFx: fx};
  finish(root, 'ossuary', parts, materials, sockets, {type: 'box', size: [.42, .74, 1.35]});
  root.userData.ossuary = meta;
  return root;
}

export function animateOssuaryRedesign(root, shot = 0, time = 0, dt = .016) {
  const meta = root?.userData?.ossuary;
  if (!meta) return;
  const delta = Math.max(.001, Number(dt) || .016);
  const shotValue = Number(shot) || 0;
  if (shotValue > meta.lastShot + .01) {
    meta.recoil = 1;
    meta.flash = 1;
    meta.heat = Math.min(1, meta.heat + .3);
    meta.jawTension = 1;
    meta.spin += Math.PI / 3;
  }
  meta.lastShot = shotValue;
  meta.recoil = damp(meta.recoil, 0, 16, delta);
  meta.flash = Math.max(0, meta.flash - delta * 12);
  meta.heat = damp(meta.heat, 0, 1.6, delta);
  meta.jawTension = damp(meta.jawTension, 0, 13, delta);
  meta.recoilCarriage.position.z = meta.recoil * .06;
  meta.recoilCarriage.rotation.x = meta.recoil * -.026;
  meta.cylinder.rotation.z = meta.spin + Math.sin(time * 2.4) * .015;
  meta.jaw.rotation.x = Math.sin(time * 2.2) * .01 - meta.jawTension * .08;
  meta.ribs.rotation.z = Math.sin(time * 2.2) * .012 + meta.jawTension * .035;
  meta.jawLeft.rotation.z = -.28 - meta.jawTension * .22;
  meta.jawRight.rotation.z = .28 + meta.jawTension * .22;
  meta.materials.glow.emissiveIntensity = .22 + meta.heat * 2.2 + meta.flash * 4.6;
  meta.materials.heat.emissiveIntensity = .34 + meta.heat * 3.4 + meta.flash * 3.2;
  meta.shotFx.muzzleFlash.visible = meta.flash > .012;
  meta.shotFx.muzzleFlash.scale.set(.8 + meta.flash * 1.2, .8 + meta.flash * 1.2, .8 + meta.flash);
  meta.shotFx.flashCone.material.opacity = meta.flash * .82;
  meta.shotFx.flashCore.material.opacity = meta.flash * .95;
  meta.shotFx.flashRing.material.opacity = meta.flash * .6;
}

export function buildBreachRedesign() {
  const root = new THREE.Group();
  root.name = 'BreachShotgun';
  const parts = {};
  const materials = commonMaterials(basePalette('breach'));
  const receiver = part('receiver', root, parts);
  add(receiver, new THREE.BoxGeometry(.42, .3, .48), materials.steel, [0, .02, -.02], [0, 0, 0], [1, 1, 1], 'receiver-shell');
  add(receiver, new THREE.BoxGeometry(.34, .035, .4), materials.edge, [0, .19, -.04], [0, 0, 0], [1, 1, 1], 'receiver-plate');
  const recoilCarriage = part('recoil-carriage', root, parts);
  const barrels = part('twin-barrels', recoilCarriage, parts);
  tagWeaponMechanism(barrels, 'twin-pressure-barrels', 'z');
  for (const side of [-1, 1]) {
    add(barrels, new THREE.CylinderGeometry(.105, .12, .88, 10), materials.steel, [side * .115, .05, -.56], [Math.PI / 2, 0, 0], [1, 1, 1], `barrel-${side}`);
    add(barrels, new THREE.CylinderGeometry(.07, .07, .9, 8, 1, true), materials.black, [side * .115, .05, -.56], [Math.PI / 2, 0, 0], [1, 1, 1], `bore-${side}`);
  }
  add(barrels, new THREE.BoxGeometry(.34, .045, .76), materials.edge, [0, .18, -.56], [0, 0, 0], [1, 1, 1], 'barrel-bridge');
  const breechBlock = part('breech-block', recoilCarriage, parts);
  tagWeaponMechanism(breechBlock, 'break-action-breech', 'z');
  add(breechBlock, new THREE.BoxGeometry(.25, .08, .2), materials.edge, [0, .13, -.18], [0, 0, 0], [1, 1, 1], 'breech-carrier');
  add(breechBlock, new THREE.CylinderGeometry(.035, .035, .3, 8), materials.brass, [0, .13, -.18], [0, 0, Math.PI / 2], [1, 1, 1], 'breech-hinge');
  const ribcage = part('ribcage', recoilCarriage, parts);
  for (const side of [-1, 1]) {
    addTube(ribcage, [[side * .12, .18, -.2], [side * .22, .08, -.42], [side * .18, -.09, -.68]], .026, materials.bone, 6, `rib-${side}`);
    addTube(ribcage, [[side * .13, .17, -.3], [side * .23, .08, -.54], [side * .16, -.07, -.82]], .018, materials.edge, 6, `pressure-rail-${side}`);
  }
  const pressureValve = part('pressure-valve', recoilCarriage, parts);
  tagWeaponMechanism(pressureValve, 'pressure-valve', 'z');
  for (const side of [-1, 1]) {
    add(pressureValve, new THREE.CylinderGeometry(.022, .022, .18, 8), materials.brass, [side * .15, .27, -.28], [0, 0, 0], [1, 1, 1], `valve-stem-${side}`);
    add(pressureValve, new THREE.BoxGeometry(.06, .04, .1), materials.edge, [side * .15, .37, -.28], [0, 0, 0], [1, 1, 1], `valve-cap-${side}`);
  }
  const extractors = part('shell-extractors', recoilCarriage, parts);
  add(extractors, new THREE.BoxGeometry(.035, .13, .18), materials.edge, [-.12, .04, -.22], [0, 0, -.2], [1, 1, 1], 'extractor-left');
  add(extractors, new THREE.BoxGeometry(.035, .13, .18), materials.edge, [.12, .04, -.22], [0, 0, .2], [1, 1, 1], 'extractor-right');
  const stock = part('stock', root, parts);
  add(stock, new THREE.BoxGeometry(.25, .3, .38), materials.wood, [0, .02, .34], [.12, 0, 0], [1, 1, 1], 'stock-core');
  const grip = part('grip', root, parts);
  add(grip, new THREE.BoxGeometry(.2, .42, .2), materials.wood, [0, -.22, .07], [.2, 0, 0], [1, 1, 1], 'wood-grip');
  const supportGrip = part('support-grip', root, parts);
  supportGrip.position.set(-.12, -.28, -.43);
  add(supportGrip, new THREE.BoxGeometry(.16, .18, .34), materials.wood, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'support-foregrip');
  const muzzleHousing = part('muzzle-housing', recoilCarriage, parts);
  add(muzzleHousing, new THREE.BoxGeometry(.34, .24, .16), materials.edge, [0, .05, -1.02], [0, 0, 0], [1, 1, 1], 'muzzle-bridge');
  const sockets = commonSockets(root, recoilCarriage, [0, .05, -1.1], [0, .05, -1.13], [0, -.24, .08], [-.12, -.28, -.43]);
  sockets.supportGrip = supportGrip;
  const fx = addMuzzleFx(muzzleHousing, materials, .38);
  sockets.muzzleFlash = fx.muzzleFlash;
  const meta = {kind: 'breach', parts, sockets, materials, recoilCarriage, barrels, breechBlock, extractors, pressureValve, ribcage, recoil: 0, flash: 0, heat: 0, pressurePulse: 0, lastShot: 0, shotFx: fx};
  finish(root, 'breach', parts, materials, sockets, {type: 'capsule', size: [.5, .9, 1.72]});
  root.userData.breach = meta;
  return root;
}

export function animateBreachRedesign(root, time = 0, shot = 0, dt = .016) {
  const meta = root?.userData?.breach;
  if (!meta) return;
  const delta = Math.max(.001, Number(dt) || .016);
  const shotValue = Number(shot) || 0;
  if (shotValue > meta.lastShot + .01) {
    meta.recoil = 1;
    meta.flash = 1;
    meta.heat = Math.min(1, meta.heat + .34);
    meta.pressurePulse = 1;
  }
  meta.lastShot = shotValue;
  meta.recoil = damp(meta.recoil, 0, 14, delta);
  meta.flash = Math.max(0, meta.flash - delta * 10);
  meta.heat = damp(meta.heat, 0, 1.35, delta);
  meta.pressurePulse = damp(meta.pressurePulse, 0, 10, delta);
  meta.recoilCarriage.position.z = meta.recoil * .07;
  meta.recoilCarriage.rotation.x = meta.recoil * -.022;
  meta.breechBlock.position.z = -meta.recoil * .12;
  meta.breechBlock.rotation.x = -meta.recoil * .12;
  meta.extractors.position.z = -meta.recoil * .08;
  meta.barrels.rotation.z = Math.sin(time * 1.8) * .004 + meta.pressurePulse * .014;
  meta.pressureValve.position.y = meta.pressurePulse * .022;
  meta.pressureValve.rotation.z = Math.sin(time * 4.5) * meta.pressurePulse * .035 + meta.pressurePulse * .07;
  meta.ribcage.scale.set(1 + meta.pressurePulse * .035, 1 + meta.pressurePulse * .022, 1);
  meta.materials.glow.emissiveIntensity = .2 + meta.heat * 2.4 + meta.flash * 4.2;
  meta.materials.heat.emissiveIntensity = .3 + meta.heat * 3.2 + meta.flash * 3.8;
  meta.shotFx.muzzleFlash.visible = meta.flash > .012;
  meta.shotFx.muzzleFlash.scale.set(.75 + meta.flash * 1.2, .75 + meta.flash * 1.2, .75 + meta.flash);
  meta.shotFx.flashCone.material.opacity = meta.flash * .9;
  meta.shotFx.flashCore.material.opacity = meta.flash;
  meta.shotFx.flashRing.material.opacity = meta.flash * .65;
}

export function buildArcRedesign() {
  const root = new THREE.Group();
  root.name = 'ArcLance';
  const parts = {};
  const materials = commonMaterials(basePalette('arc'));
  const frame = part('frame', root, parts);
  add(frame, new THREE.BoxGeometry(.06, .28, 1.18), materials.steel, [-.25, .03, -.38], [0, 0, 0], [1, 1, 1], 'left-frame-rail');
  add(frame, new THREE.BoxGeometry(.06, .28, 1.18), materials.steel, [.25, .03, -.38], [0, 0, 0], [1, 1, 1], 'right-frame-rail');
  add(frame, new THREE.BoxGeometry(.54, .045, .07), materials.edge, [0, .18, .16], [0, 0, 0], [1, 1, 1], 'frame-bridge-rear');
  add(frame, new THREE.BoxGeometry(.54, .045, .07), materials.edge, [0, .18, -.88], [0, 0, 0], [1, 1, 1], 'frame-bridge-front');
  const recoil = part('recoil', root, parts);
  const reactor = part('reactor', recoil, parts);
  tagWeaponMechanism(reactor, 'caged-capacitor', 'z');
  add(reactor, new THREE.CylinderGeometry(.15, .15, .72, 10, 1, true), materials.black, [0, .04, -.47], [Math.PI / 2, 0, 0], [1, 1, 1], 'capacitor-shell');
  add(reactor, new THREE.CylinderGeometry(.08, .08, .67, 8, 1, true), materials.glow, [0, .04, -.47], [Math.PI / 2, 0, 0], [1, 1, 1], 'capacitor-core');
  const baffles = part('reactor-baffles', reactor, parts);
  for (const side of [-1, 1]) {
    add(baffles, new THREE.BoxGeometry(.035, .24, .08), materials.edge, [side * .17, .04, -.2], [0, 0, 0], [1, 1, 1], `baffle-${side}-rear`);
    add(baffles, new THREE.BoxGeometry(.035, .24, .08), materials.edge, [side * .17, .04, -.72], [0, 0, 0], [1, 1, 1], `baffle-${side}-front`);
  }
  const heatVents = part('reactor-heat-vents', reactor, parts);
  tagWeaponMechanism(heatVents, 'capacitor-vents', 'z');
  for (const side of [-1, 1]) add(heatVents, new THREE.BoxGeometry(.025, .05, .18), materials.heat, [side * .18, .16, -.46], [0, side * .15, 0], [1, 1, 1], `vent-${side}`);
  const coilGuards = part('coil-guards', root, parts);
  for (const side of [-1, 1]) addTube(coilGuards, [[side * .2, .2, .12], [side * .3, .17, -.45], [side * .2, .2, -.98]], .018, materials.bone, 6, `guard-${side}`);
  const chargeSlider = part('charge-slider', root, parts);
  tagWeaponMechanism(chargeSlider, 'charge-slider', 'z');
  add(chargeSlider, new THREE.BoxGeometry(.04, .04, .2), materials.edge, [0, .24, -.47], [0, 0, 0], [1, 1, 1], 'charge-rod');
  add(chargeSlider, new THREE.BoxGeometry(.1, .06, .05), materials.brass, [0, .24, -.47], [0, 0, 0], [1, 1, 1], 'charge-carriage');
  const emitter = part('emitter', root, parts);
  add(emitter, new THREE.BoxGeometry(.28, .22, .22), materials.edge, [0, .04, -1.02], [0, 0, 0], [1, 1, 1], 'emitter-housing');
  add(emitter, new THREE.CylinderGeometry(.08, .1, .13, 8), materials.black, [0, .04, -1.15], [Math.PI / 2, 0, 0], [1, 1, 1], 'emitter-aperture');
  const emitterClaws = part('emitter-claws', emitter, parts);
  add(emitterClaws, new THREE.BoxGeometry(.04, .16, .2), materials.bone, [-.15, .1, -.08], [0, 0, -.3], [1, 1, 1], 'emitter-claw-left');
  add(emitterClaws, new THREE.BoxGeometry(.04, .16, .2), materials.bone, [.15, .1, -.08], [0, 0, .3], [1, 1, 1], 'emitter-claw-right');
  const grip = part('grip', root, parts);
  add(grip, new THREE.BoxGeometry(.18, .4, .2), materials.wood, [0, -.24, .08], [.18, 0, 0], [1, 1, 1], 'wood-grip');
  const supportGrip = part('support-grip', root, parts);
  supportGrip.position.set(-.04, -.34, -.54);
  add(supportGrip, new THREE.BoxGeometry(.16, .16, .34), materials.wood, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'support-grip-body');
  const sockets = commonSockets(root, recoil, [0, .04, -1.22], [0, .04, -1.25], [0, -.24, .08], [-.04, -.34, -.54]);
  sockets.supportGrip = supportGrip;
  const fx = addMuzzleFx(emitter, materials, .36);
  sockets.muzzleFlash = fx.muzzleFlash;
  const shotArc = part('shot-arc', emitter, parts);
  shotArc.visible = false;
  add(shotArc, new THREE.CylinderGeometry(.012, .025, .48, 6), materials.muzzleCore, [0, .04, -.22], [Math.PI / 2, 0, 0], [1, 1, 1], 'arc-bolt');
  const meta = {kind: 'arc', parts, sockets, materials, recoilCarriage: recoil, reactor, emitter, chargeSlider, baffles, heatVents, coilGuards, recoil: 0, flash: 0, heat: 0, cagePulse: 0, lastShot: 0, shotFx: fx};
  sockets.shotArc = shotArc;
  sockets.corePulse = reactor;
  finish(root, 'arc', parts, materials, sockets, {type: 'capsule', size: [.48, .9, 1.8]});
  root.userData.arc = meta;
  return root;
}

export function animateArcRedesign(root, time = 0, shot = 0, dt = .016) {
  const meta = root?.userData?.arc;
  if (!meta) return;
  const delta = Math.max(.001, Number(dt) || .016);
  const shotValue = Number(shot) || 0;
  if (shotValue > meta.lastShot + .01) {
    meta.recoil = 1;
    meta.flash = 1;
    meta.heat = Math.min(1, meta.heat + .3);
    meta.cagePulse = 1;
  }
  meta.lastShot = shotValue;
  meta.recoil = damp(meta.recoil, 0, 16, delta);
  meta.flash = Math.max(0, meta.flash - delta * 12);
  meta.heat = damp(meta.heat, 0, 1.3, delta);
  meta.cagePulse = damp(meta.cagePulse, 0, 7, delta);
  const charge = THREE.MathUtils.clamp(meta.heat * .7 + meta.cagePulse * .8, 0, 1);
  meta.recoilCarriage.position.z = meta.recoil * .03;
  meta.recoilCarriage.rotation.x = meta.recoil * -.014;
  meta.reactor.rotation.z = time * (.38 + charge * 1.5);
  meta.baffles.scale.set(1 + charge * .12, 1 + charge * .04, 1);
  meta.heatVents.scale.set(1 + charge * .16, 1 + charge * .03, 1);
  meta.coilGuards.rotation.z = Math.sin(time * 2.1) * .01 + charge * .03;
  meta.chargeSlider.position.z = Math.sin(time * 3.1 + charge) * (.1 + charge * .03) - charge * .03;
  meta.materials.glow.emissiveIntensity = .28 + meta.heat * 5.4 + meta.cagePulse * 3.4;
  meta.materials.heat.emissiveIntensity = .25 + meta.heat * 3.8 + meta.cagePulse * 2.2;
  meta.shotFx.muzzleFlash.visible = meta.flash > .012;
  meta.shotFx.muzzleFlash.scale.set(.8 + meta.flash * 1.3, .8 + meta.flash * 1.3, .8 + meta.flash);
  meta.shotFx.flashCone.material.opacity = meta.flash * .75;
  meta.shotFx.flashCore.material.opacity = meta.flash;
  meta.shotFx.flashRing.material.opacity = meta.flash * .55;
  meta.sockets.shotArc.visible = meta.flash > .03;
  meta.sockets.shotArc.scale.setScalar(.8 + meta.flash * 1.35);
}

export function buildReliquaryRedesign() {
  const root = new THREE.Group();
  root.name = 'Reliquary';
  const parts = {};
  const materials = commonMaterials(basePalette('reliquary'));
  const receiver = part('receiver', root, parts);
  add(receiver, new THREE.BoxGeometry(.4, .34, .5), materials.steel, [0, .01, -.03], [0, 0, 0], [1, 1, 1], 'sealed-chassis');
  add(receiver, new THREE.BoxGeometry(.44, .04, .4), materials.edge, [0, .2, -.03], [0, 0, 0], [1, 1, 1], 'top-armor');
  add(receiver, new THREE.BoxGeometry(.05, .22, .34), materials.brass, [-.225, .02, -.06], [0, 0, 0], [1, 1, 1], 'left-seal-rail');
  add(receiver, new THREE.BoxGeometry(.05, .22, .34), materials.brass, [.225, .02, -.06], [0, 0, 0], [1, 1, 1], 'right-seal-rail');
  const recoilCarriage = part('recoil-carriage', root, parts);
  const barrel = part('barrel', recoilCarriage, parts);
  add(barrel, new THREE.BoxGeometry(.3, .25, .72), materials.black, [0, .02, -.58], [0, 0, 0], [1, 1, 1], 'barrel-shell');
  add(barrel, new THREE.CylinderGeometry(.11, .13, .68, 8), materials.steel, [0, .02, -.58], [Math.PI / 2, 0, 0], [1, 1, 1], 'barrel-bore');
  const core = part('core', recoilCarriage, parts);
  tagWeaponMechanism(core, 'sealed-core', 'z');
  add(core, new THREE.CylinderGeometry(.13, .13, .3, 8), materials.bone, [0, .03, -.3], [Math.PI / 2, 0, 0], [1, 1, 1], 'relic-core-shell');
  add(core, new THREE.CylinderGeometry(.055, .055, .27, 8), materials.glow, [0, .03, -.3], [Math.PI / 2, 0, 0], [1, 1, 1], 'relic-core');
  const heatVents = part('heat-vents', recoilCarriage, parts);
  tagWeaponMechanism(heatVents, 'pressure-shutters', 'z');
  for (const side of [-1, 1]) {
    add(heatVents, new THREE.BoxGeometry(.045, .16, .12), materials.edge, [side * .18, .18, -.55], [0, 0, side * .14], [1, 1, 1], `shutter-${side}`);
    add(heatVents, new THREE.BoxGeometry(.025, .11, .08), materials.heat, [side * .21, .18, -.55], [0, 0, side * .14], [1, 1, 1], `vent-${side}`);
  }
  const ribcage = part('ribcage', recoilCarriage, parts);
  for (const side of [-1, 1]) addTube(ribcage, [[side * .13, .18, -.18], [side * .25, .1, -.42], [side * .18, -.04, -.7]], .024, materials.bone, 6, `rib-${side}`);
  const muzzleClaws = part('muzzle-claws', recoilCarriage, parts);
  tagWeaponMechanism(muzzleClaws, 'ceremonial-aperture', 'z');
  const clawLeft = add(muzzleClaws, new THREE.BoxGeometry(.06, .2, .26), materials.bone, [-.18, .1, -1.0], [0, 0, -.25], [1, 1, 1], 'aperture-left');
  const clawRight = add(muzzleClaws, new THREE.BoxGeometry(.06, .2, .26), materials.bone, [.18, .1, -1.0], [0, 0, .25], [1, 1, 1], 'aperture-right');
  const muzzleBrake = part('muzzle-brake', recoilCarriage, parts);
  add(muzzleBrake, new THREE.BoxGeometry(.34, .24, .18), materials.edge, [0, .02, -1.02], [0, 0, 0], [1, 1, 1], 'muzzle-housing');
  add(muzzleBrake, new THREE.CylinderGeometry(.105, .105, .03, 8), materials.black, [0, .02, -1.12], [Math.PI / 2, 0, 0], [1, 1, 1], 'muzzle-aperture');
  const grip = part('grip', root, parts);
  add(grip, new THREE.BoxGeometry(.19, .42, .2), materials.wood, [0, -.2, .06], [.18, 0, 0], [1, 1, 1], 'relic-grip');
  const supportGrip = part('support-grip', root, parts);
  supportGrip.position.set(-.13, -.34, -.62);
  add(supportGrip, new THREE.BoxGeometry(.17, .18, .34), materials.wood, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'support-grip');
  const sockets = commonSockets(root, recoilCarriage, [.0, .02, -1.14], [0, .02, -1.17], [0, -.22, .06], [-.13, -.34, -.62]);
  sockets.supportGrip = supportGrip;
  const fx = addMuzzleFx(muzzleBrake, materials, .42);
  sockets.muzzleFlash = fx.muzzleFlash;
  const heatBloom = socket(recoilCarriage, 'heatBloom', [0, .03, -.96]);
  const explosion = socket(recoilCarriage, 'explosion', [0, .02, -1.17]);
  const meta = {kind: 'reliquary', variant: 'bone-rocket', parts, sockets, materials, recoilCarriage, core, barrel, heatVents, heatBloom, muzzleClaws, ribcage, clawLeft, clawRight, explosion, recoil: 0, flash: 0, heat: 0, ritualPulse: 0, lastShot: 0, shotFx: fx};
  finish(root, 'reliquary', parts, materials, sockets, {type: 'capsule', size: [.44, .84, 1.5]});
  root.userData.reliquary = meta;
  return root;
}

export function animateReliquaryRedesign(root, shot = 0, time = 0, dt = .016) {
  const meta = root?.userData?.reliquary;
  if (!meta) return;
  const delta = Math.max(.001, Number(dt) || .016);
  const shotValue = Number(shot) || 0;
  if (shotValue > meta.lastShot + .01) {
    meta.recoil = 1;
    meta.flash = 1;
    meta.heat = Math.min(1, meta.heat + .34);
    meta.ritualPulse = 1;
  }
  meta.lastShot = shotValue;
  meta.recoil = damp(meta.recoil, 0, 13, delta);
  meta.flash = Math.max(0, meta.flash - delta * 9);
  meta.heat = damp(meta.heat, 0, 1.25, delta);
  meta.ritualPulse = damp(meta.ritualPulse, 0, 8, delta);
  const ritual = THREE.MathUtils.clamp(meta.heat * .62 + meta.ritualPulse * .7, 0, 1);
  meta.recoilCarriage.position.z = meta.recoil * .075;
  meta.recoilCarriage.rotation.x = meta.recoil * -.025;
  meta.core.rotation.z = time * (.8 + ritual * 2.4);
  meta.core.scale.setScalar(1 + ritual * .08);
  meta.heatVents.scale.set(1 + ritual * .2, 1 + ritual * .06, 1);
  meta.heatVents.rotation.z = Math.sin(time * 4.1) * .04 + ritual * .11;
  meta.muzzleClaws.scale.set(1 + ritual * .1, 1 + ritual * .04, 1);
  meta.clawLeft.rotation.z = -.25 - ritual * .14;
  meta.clawRight.rotation.z = .25 + ritual * .14;
  meta.ribcage.scale.set(1 + ritual * .035, 1 + ritual * .02, 1);
  meta.ribcage.rotation.z = Math.sin(time * 2.1) * .01 + ritual * .02;
  meta.materials.glow.emissiveIntensity = .24 + meta.heat * 4.8 + meta.ritualPulse * 3.3;
  meta.materials.heat.emissiveIntensity = .3 + meta.heat * 3.2 + meta.ritualPulse * 2.4;
  meta.shotFx.muzzleFlash.visible = meta.flash > .012;
  meta.shotFx.muzzleFlash.scale.set(.78 + meta.flash * 1.25, .78 + meta.flash * 1.25, .78 + meta.flash);
  meta.shotFx.flashCone.material.opacity = meta.flash * .9;
  meta.shotFx.flashCore.material.opacity = meta.flash;
  meta.shotFx.flashRing.material.opacity = meta.flash * .68;
}
