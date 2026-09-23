import * as THREE from './vendor/three.module.js';
import { mergeGeometries } from './vendor/utils/BufferGeometryUtils.js';
import { buildAuthoredWorld } from './world-authored.js';
import { buildRoomKit } from './room-kit.js';
import { buildLifeField, wallSpots, scatterSpots, lifeRng, seedFor } from './world-polish.js';
import { dungeonArtDirection } from './dungeon-art-direction.js';
import { buildSetDressing } from './world-setdressing.js';

// Each sector owns a colour script, a dread line and its own furniture relic, so
// the three descents differ in silhouette, not just in tint.
export const HORROR_SECTOR_THEMES = Object.freeze({
  bloodworks: Object.freeze({
    background: 0x0b0e18, fog: 0x101817, fogNear: 32, fogFar: 100,
    key: 0xffd2a3, rim: 0xe83b23, accent: 0xff3154, accent2: 0xffa24a,
    dread: 'THE FLOOR IS WARM', relic: 'eye', furniture: 'rack', stain: 0x4d0c10,
  }),
  ossuary: Object.freeze({
    background: 0x090b17, fog: 0x17132b, fogNear: 26, fogFar: 92,
    key: 0xc5b8ff, rim: 0x745cff, accent: 0xc98cff, accent2: 0xd9c9a8,
    dread: 'THE DEAD ARE LOAD-BEARING', relic: 'skull-niche', furniture: 'colonnade', stain: 0x2a1230,
  }),
  choir: Object.freeze({
    background: 0x140c0b, fog: 0x261612, fogNear: 24, fogFar: 88,
    key: 0xffc484, rim: 0xd54832, accent: 0xffb15e, accent2: 0xffe0a8,
    dread: 'EVERY BELL IS A MOUTH', relic: 'mouth', furniture: 'bell-frame', stain: 0x4a2408,
  }),
});

export function getHorrorSectorTheme(course = {}) {
  const fallback = course.index === 1 ? 'ossuary' : course.index === 2 ? 'choir' : 'bloodworks';
  const authored = dungeonArtDirection(course);
  const rawId = String(course.id || course.sectorId || fallback).toLowerCase();
  const family = String(course.sectorId || authored?.family || rawId).toLowerCase();
  const base = HORROR_SECTOR_THEMES[family] || HORROR_SECTOR_THEMES.bloodworks;
  return { id: authored?.id || rawId, family, ...(authored || {}), ...base, ...(authored || {}) };
}

const CELL = 4;

const place = (geometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
  if (sx !== 1 || sy !== 1 || sz !== 1) geometry.scale(sx, sy, sz);
  if (rx) geometry.rotateX(rx);
  if (ry) geometry.rotateY(ry);
  if (rz) geometry.rotateZ(rz);
  geometry.translate(x, y, z);
  return geometry;
};
const cyl = (rt, rb, h, seg, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => place(new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z, rx, ry, rz);
const box = (w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => place(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);
const sphere = (r, ws, hs, x = 0, y = 0, z = 0) => place(new THREE.SphereGeometry(r, ws, hs), x, y, z);
const capsule = (r, len, cap, seg, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => place(new THREE.CapsuleGeometry(r, len, cap, seg), x, y, z, rx, ry, rz);
const torus = (r, tube, rad, tub, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, arc = Math.PI * 2) => place(new THREE.TorusGeometry(r, tube, rad, tub, arc), x, y, z, rx, ry, rz);
const ico = (r, detail, x = 0, y = 0, z = 0) => place(new THREE.IcosahedronGeometry(r, detail), x, y, z);
const cone = (r, h, seg, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => place(new THREE.ConeGeometry(r, h, seg), x, y, z, rx, ry, rz);

function mergePieces(parts) {
  const normalized = parts.map(part => (part.index ? part.toNonIndexed() : part));
  const merged = mergeGeometries(normalized, false);
  for (const part of parts) part.dispose?.();
  for (const part of normalized) if (!parts.includes(part)) part.dispose?.();
  if (merged) {
    merged.userData.sharedAsset = true;
    merged.computeBoundingSphere();
    return merged;
  }
  return new THREE.BoxGeometry(.4, .4, .4);
}

function skullParts(x = 0, y = 0, z = 0, scale = 1) {
  return [
    ico(.19 * scale, 1, x, y, z),
    box(.2 * scale, .09 * scale, .16 * scale, x, y - .15 * scale, z + .03 * scale),
  ];
}

let HORROR_GEOMETRY = null;
function horrorGeometry() {
  if (HORROR_GEOMETRY) return HORROR_GEOMETRY;
  const G = {};
  // Bloodworks: a meat rack with chains, hooks and two hanging carcasses.
  const rackParts = [
    box(.22, 3.7, .22, -1.3, 1.85, 0),
    box(.22, 3.7, .22, 1.3, 1.85, 0),
    box(2.9, .2, .24, 0, 3.6, 0),
    box(2.6, .14, .18, 0, 3.32, .02),
  ];
  for (let i = 0; i < 3; i++) {
    const x = -.9 + i * .9;
    rackParts.push(cyl(.03, .03, .5, 5, x, 3.1, .02));
    rackParts.push(torus(.15, .028, 5, 10, x, 2.78, .02, 0, 0, 0, Math.PI * 1.5));
    if (i !== 1) {
      rackParts.push(box(.5, .32, .42, x, 2.45, .02));
      rackParts.push(capsule(.09, .42, 3, 6, x - .14, 2.1, .04, 0, 0, .1));
      rackParts.push(capsule(.09, .42, 3, 6, x + .14, 2.1, 0, 0, 0, -.1));
      rackParts.push(...skullParts(x, 2.72, .04, 1.02));
    }
  }
  G.rack = mergePieces(rackParts);
  // Ossuary: a load-bearing colonnade of spine and ribs.
  const colonnadeParts = [
    box(1.5, .22, 1.5, 0, .11, 0),
    cyl(.16, .24, 5.2, 9, 0, 2.7, 0),
    cyl(.4, .48, .2, 10, 0, .3, 0),
  ];
  for (let i = 0; i < 6; i++) {
    colonnadeParts.push(torus(1.25 - i * .06, .075, 6, 20, 0, 1.05 + i * .78, 0, 0, 0, 0, Math.PI));
  }
  colonnadeParts.push(...skullParts(-.55, 4.2, 0, 1.15));
  colonnadeParts.push(...skullParts(.5, 3.5, .1, 1));
  G.colonnade = mergePieces(colonnadeParts);
  // Choir: a bell frame whose three mouths hang over the aisle.
  const frameParts = [
    box(.24, 4.2, .24, -1.45, 2.1, 0),
    box(.24, 4.2, .24, 1.45, 2.1, 0),
    box(3.3, .24, .3, 0, 4.1, 0),
  ];
  for (let i = 0; i < 3; i++) {
    const x = -1 + i;
    const size = .85 + i * .12;
    frameParts.push(cyl(.03, .03, .6, 5, x, 3.6, 0));
    frameParts.push(torus(.42 * size, .11 * size, 8, 18, x, 3.0, 0, Math.PI / 2));
    frameParts.push(cyl(.44 * size, .5 * size, .16 * size, 14, x, 2.82, 0));
    frameParts.push(sphere(.1 * size, 8, 6, x, 2.68, 0));
  }
  G.bellFrame = mergePieces(frameParts);
  // Wall relics: an eye, a skull niche and a mouth, one per sector.
  G.eyeRelic = mergePieces([
    place(new THREE.SphereGeometry(.34, 12, 9), 0, 0, .1, 0, 0, 0, 1.35, 1, .5),
    sphere(.24, 12, 9, 0, 0, .22),
    ...Array.from({ length: 8 }, (_, i) => {
      const angle = i / 8 * Math.PI * 2;
      return cone(.05, .3, 5, Math.cos(angle) * .3, Math.sin(angle) * .3, .12, Math.PI / 2 * Math.cos(angle), 0, -Math.PI / 2 * Math.sin(angle));
    }),
  ]);
  G.eyeRelicGlow = mergePieces([
    sphere(.1, 8, 6, 0, 0, .4),
    torus(.13, .022, 5, 12, 0, 0, .36, Math.PI / 2),
  ]);
  G.skullRelic = mergePieces([
    box(1.35, 1.5, .16, 0, 0, -.06),
    torus(.62, .07, 6, 16, 0, .28, .04, 0, 0, 0, Math.PI),
    box(.14, .95, .2, -.62, -.2, .04),
    box(.14, .95, .2, .62, -.2, .04),
    box(1.4, .14, .3, 0, -.72, .06),
    ...skullParts(-.32, .05, .22, 1.05),
    ...skullParts(.3, .0, .22, .95),
    ...skullParts(0, .45, .2, .8),
  ]);
  G.skullRelicGlow = mergePieces([
    sphere(.045, 6, 5, -.4, .06, .38),
    sphere(.045, 6, 5, -.24, .06, .38),
    sphere(.045, 6, 5, .22, .01, .38),
    sphere(.045, 6, 5, .38, .01, .38),
  ]);
  G.mouthRelic = mergePieces([
    torus(.72, .11, 8, 20, 0, 0, .06, 0, 0, 0, Math.PI * 1.75),
    ...Array.from({ length: 9 }, (_, i) => {
      const angle = Math.PI * 1.18 + i / 8 * Math.PI * .64;
      const x = Math.cos(angle) * .56, y = Math.sin(angle) * .5;
      return cone(.08, .34, 5, x, y, .16, 0, 0, -angle + Math.PI / 2);
    }),
    ...Array.from({ length: 7 }, (_, i) => {
      const angle = -Math.PI * .18 - i / 6 * Math.PI * .64;
      const x = Math.cos(angle) * .56, y = Math.sin(angle) * .5;
      return cone(.08, .34, 5, x, y, .16, 0, 0, -angle - Math.PI / 2);
    }),
  ]);
  G.mouthRelicInner = mergePieces([
    place(new THREE.SphereGeometry(.5, 10, 8), 0, -.04, .02, 0, 0, 0, 1.1, .62, .3),
    place(new THREE.SphereGeometry(.3, 10, 8), -.06, -.3, .16, 0, 0, 0, 1, .5, .4),
  ]);
  HORROR_GEOMETRY = G;
  return G;
}

const MATERIAL_CACHE = new WeakMap();
function horrorMaterials(materials, theme) {
  let bySector = MATERIAL_CACHE.get(materials);
  if (!bySector) { bySector = new Map(); MATERIAL_CACHE.set(materials, bySector); }
  if (bySector.has(theme.id)) return bySector.get(theme.id);
  const family = theme.family || theme.id;
  const make = (color, options = {}) => {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: options.roughness ?? .8,
      metalness: options.metalness ?? .16,
      emissive: options.emissive ?? 0x000000,
      emissiveIntensity: options.emissiveIntensity ?? 0,
    });
    material.name = `HorrorDetail_${theme.id}_${options.role || 'part'}`;
    material.userData.sharedLibrary = true;
    material.userData.decorFlicker = options.flicker || null;
    return material;
  };
  const bone = make(family === 'choir' ? 0xc9b08a : family === 'ossuary' ? 0xd0c4a3 : 0xc2ae91, { roughness: .82, metalness: .1, role: 'bone' });
  const set = {
    bone,
    dark: make(0x0a0a10, { roughness: .95, metalness: .05, role: 'recess' }),
    gore: make(family === 'ossuary' ? 0x4a1c2c : 0x5d1620, { roughness: .5, metalness: .06, role: 'gore' }),
    flesh: make(0x6b1f2a, { roughness: .62, metalness: .05, role: 'flesh' }),
    brass: make(family === 'ossuary' ? 0x8a7748 : 0xc08d4c, { roughness: .34, metalness: .86, role: 'brass' }),
    accent: make(theme.accent, { roughness: .34, metalness: .1, emissive: theme.accent, emissiveIntensity: 2.1, role: 'accent', flicker: { base: 2.1, speed: 2.4, depth: .4, phase: 1.3 } }),
    accent2: make(theme.accent2, { roughness: .4, metalness: .2, emissive: theme.accent2, emissiveIntensity: 1.4, role: 'accent2', flicker: { base: 1.4, speed: 1.1, depth: .18, phase: 2.6 } }),
  };
  bySector.set(theme.id, set);
  return set;
}

// Wall relics must sit on wall segments that survived opening compilation.
// Room bounds alone include open doors and previously left large reliefs
// floating in the player's first sightline on several Story floors.
function wallRelicSpots(course, width) {
  const rooms = course.rooms || course.roomPlan?.rooms || course.roomPlan;
  const spots = [];
  const doorSpans = [[4, 12], [36, 44]];
  const blocked = x => x < 2.4 || x > width - 2.4 || doorSpans.some(([a, b]) => x > a - 1.6 && x < b + 1.6);
  const horizontalWalls = course.dungeon
    ? new Set((course.walls || []).filter(segment => segment.horizontal)
      .map(segment => `${Math.round(segment.z)},${segment.cx}`))
    : null;
  const seen = new Set();
  if (!Array.isArray(rooms)) return spots;
  for (const room of rooms) {
    const bounds = room?.bounds;
    if (!bounds || !Number.isFinite(bounds.minX)) continue;
    const x0 = bounds.minX * CELL, x1 = bounds.maxX * CELL;
    for (const [z, yaw, facing] of [[bounds.minZ * CELL, 0, 1], [bounds.maxZ * CELL, Math.PI, -1]]) {
      for (let x = x0 + 3.4, step = 0; x < x1 - 3.4; x += 4.8, step += 1) {
        const px = x + ((step * 37) % 7) * .28 - .84;
        if (horizontalWalls) {
          const cellX = Math.floor(px / CELL);
          const wallRow = Math.round(z / CELL);
          // A 1.4 m relief must fit on one intact 4 m wall panel.
          if (px < cellX * CELL + .85 || px > (cellX + 1) * CELL - .85) continue;
          if (!horizontalWalls.has(`${wallRow},${cellX}`)) continue;
          const key = `${wallRow},${cellX},${facing}`;
          if (seen.has(key)) continue;
          seen.add(key);
        } else if (blocked(px)) continue;
        spots.push({ x: px, z: z + facing * .22, yaw });
      }
    }
  }
  return spots;
}

function instancedKit(kind, entries, geometry, material, options = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), euler = new THREE.Euler(), scale = new THREE.Vector3();
  entries.forEach((entry, index) => {
    euler.set(entry.rx || 0, entry.ry || 0, entry.rz || 0);
    quaternion.setFromEuler(euler);
    position.set(entry.x, entry.y || 0, entry.z);
    scale.setScalar(entry.s ?? 1);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = options.castShadow !== false;
  mesh.receiveShadow = options.receiveShadow !== false;
  mesh.name = `HorrorKit_${kind}`;
  mesh.userData.noBatch = true;
  mesh.userData.detailKind = kind;
  mesh.computeBoundingSphere?.();
  return mesh;
}

// A sector-tinted stain sheet: pooled rim, congealed core, drag marks, spray.
// One sheet per sector, shared across world rebuilds.
const STAIN_TEXTURES = new Map();
function stainTexture(theme) {
  if (typeof document === 'undefined') return null;
  if (STAIN_TEXTURES.has(theme.id)) return STAIN_TEXTURES.get(theme.id);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const g = canvas.getContext('2d');
  const tint = new THREE.Color(theme.stain);
  const rgb = value => `${Math.round(value.r * 255)},${Math.round(value.g * 255)},${Math.round(value.b * 255)}`;
  const body = rgb(tint);
  const core = rgb(tint.clone().multiplyScalar(.45));
  const dry = rgb(tint.clone().lerp(new THREE.Color(0x2a2320), .55));
  let seed = 0x2f6e2b1;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 5; i++) {
    const x = 70 + random() * 372, y = 70 + random() * 372, r = 40 + random() * 60;
    g.beginPath();
    for (let step = 0; step <= 28; step++) {
      const angle = step / 28 * Math.PI * 2;
      const wobble = r * (.72 + random() * .5);
      const px = x + Math.cos(angle) * wobble, py = y + Math.sin(angle) * wobble * .82;
      if (step === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    const gradient = g.createRadialGradient(x, y, r * .1, x, y, r);
    gradient.addColorStop(0, `rgba(${core},.92)`);
    gradient.addColorStop(.62, `rgba(${body},.78)`);
    gradient.addColorStop(1, `rgba(${body},0)`);
    g.fillStyle = gradient;
    g.fill();
  }
  for (let i = 0; i < 3; i++) {
    const x = 90 + random() * 300, y = 120 + random() * 260, angle = random() * Math.PI * 2;
    g.save();
    g.translate(x, y); g.rotate(angle);
    const gradient = g.createLinearGradient(0, 0, 190, 0);
    gradient.addColorStop(0, `rgba(${body},.7)`);
    gradient.addColorStop(1, `rgba(${dry},0)`);
    g.fillStyle = gradient;
    g.beginPath();
    g.moveTo(0, -13); g.lineTo(190, -4); g.lineTo(190, 5); g.lineTo(0, 12);
    g.closePath(); g.fill();
    g.restore();
  }
  for (let i = 0; i < 220; i++) {
    const x = random() * 512, y = random() * 512, r = .8 + random() * 5;
    g.fillStyle = `rgba(${body},${.16 + random() * .5})`;
    g.beginPath(); g.ellipse(x, y, r, r * (.6 + random() * .8), random() * Math.PI, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(${dry},${.12 + random() * .3})`;
    g.fillRect(random() * 512, random() * 512, 2 + random() * 9, 1 + random() * 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.userData.sharedAsset = true;
  texture.userData.horrorStain = theme.id;
  STAIN_TEXTURES.set(theme.id, texture);
  return texture;
}

// Per-sector furniture and wall relics.  Everything is merged geometry driven by
// one InstancedMesh per material, so a richer sector costs a handful of draws.
function buildSectorDetailKit(root, materials, course, theme) {
  const geometry = horrorGeometry();
  const mat = horrorMaterials(materials, theme);
  const width = Math.max(1, Math.floor(course.w || 12)) * CELL;
  const field = buildLifeField(course);
  const rng = lifeRng(seedFor(`horror:${theme.id}:${field.w}x${field.h}:${course.index ?? 0}`));
  const group = new THREE.Group();
  group.name = `HorrorDetailKit_${theme.id}`;
  group.userData.sectorId = theme.family || theme.id;
  group.userData.floorId = theme.id;
  group.userData.architecture = theme.architecture || null;
  const budget = (theme.family || theme.id) === 'choir' ? 6 : 7;
  // Furniture stands in the room proper, clear of cover blocks and lanes.
  const furnitureSpots = [];
  const entryX = Number.isFinite(course.playerSpawn?.x) ? course.playerSpawn.x * CELL : null;
  const entryZ = Number.isFinite(course.playerSpawn?.y) ? course.playerSpawn.y * CELL : null;
  for (const spot of wallSpots(field, rng, { inset: 2.7, spacing: 7.4 })) {
    if (furnitureSpots.length >= budget) break;
    if (entryX !== null && entryZ !== null && Math.hypot(spot.x - entryX, spot.z - entryZ) < 9) continue;
    if (!field.accepts(spot.x, spot.z, 1.6, 'ground')) continue;
    furnitureSpots.push(spot);
  }
  const furniture = furnitureSpots.map(spot => ({ x: spot.x, z: spot.z, y: 0, ry: spot.yaw, s: .9 + rng() * .25 }));
  if (furniture.length) {
    const key = theme.furniture === 'colonnade' ? 'colonnade' : theme.furniture === 'bell-frame' ? 'bellFrame' : 'rack';
    const material = theme.furniture === 'colonnade' ? mat.bone : theme.furniture === 'bell-frame' ? mat.brass : (materials.metalDark || mat.dark);
    group.add(instancedKit(`furniture-${key}`, furniture, geometry[key], material));
  }
  // Wall relics ride the room shell bands above head height.
  const relicSpots = wallRelicSpots(course, width);
  const relics = [];
  for (let i = 0; i < relicSpots.length && relics.length < 10; i++) {
    if (i % 2) continue;
    const spot = relicSpots[i];
    relics.push({ x: spot.x, y: 2.62 + (i % 3) * .12, z: spot.z, ry: spot.yaw, s: .95 + ((i * 13) % 5) * .05 });
  }
  if (relics.length) {
    const relicGeo = theme.relic === 'skull-niche' ? 'skullRelic' : theme.relic === 'mouth' ? 'mouthRelic' : 'eyeRelic';
    const glowGeo = theme.relic === 'skull-niche' ? 'skullRelicGlow' : theme.relic === 'mouth' ? 'mouthRelicInner' : 'eyeRelicGlow';
    const relicMaterial = theme.relic === 'mouth' ? mat.gore : theme.relic === 'skull-niche' ? mat.bone : mat.flesh;
    const glowMaterial = theme.relic === 'skull-niche' ? mat.accent : theme.relic === 'mouth' ? mat.dark : mat.accent;
    group.add(instancedKit(`relic-${theme.relic}`, relics, geometry[relicGeo], relicMaterial, { castShadow: false }));
    group.add(instancedKit(`relic-glow-${theme.relic}`, relics, geometry[glowGeo], glowMaterial, { castShadow: false, receiveShadow: false }));
  }
  // One sector-tinted stain sheet, scattered through the walkable floor.
  const stains = [];
  for (const spot of scatterSpots(field, rng, 26, 1.1, 'flat')) {
    stains.push({ x: spot.x, y: .014, z: spot.z, ry: rng() * Math.PI * 2, s: 2.4 + rng() * 2.6 });
  }
  const stainMap = stainTexture(theme);
  if (stains.length && stainMap) {
    const stainMaterial = new THREE.MeshBasicMaterial({ map: stainMap, transparent: true, depthWrite: false, opacity: .92, polygonOffset: true, polygonOffsetFactor: -1 });
    stainMaterial.name = `HorrorStain_${theme.id}`;
    stainMaterial.userData.sharedLibrary = true;
    const plane = new THREE.PlaneGeometry(1, 1);
    plane.rotateX(-Math.PI / 2);
    plane.userData.sharedAsset = true;
    group.add(instancedKit(`stains-${theme.id}`, stains, plane, stainMaterial, { castShadow: false, receiveShadow: false }));
  }
  group.userData.furniture = furniture.length;
  group.userData.relics = relics.length;
  group.userData.stains = stains.length;
  return group;
}

export function buildHorrorDetails(root, materials, course = {}) {
 const sectorTheme=getHorrorSectorTheme(course);
 const authored=buildAuthoredWorld(root,materials,course);
 const rooms=course.dungeon
  ? {rooms:[],roomChunks:[],moving:[],animate:()=>{},setProgression:()=>{},plan:course.rooms||[],route:[]}
  : buildRoomKit(root,materials,{...course,sectorId:sectorTheme.id});
 authored.rooms=rooms.rooms;
 authored.roomChunks=rooms.roomChunks;
 authored.roomPlan=rooms.plan;
 authored.route=rooms.route;
 authored.setRoomProgression=rooms.setProgression;
 authored.moving.push(...rooms.moving.map(item=>item.root));
 const authoredAnimate=authored.animate;
 // Shared detail materials flicker instead of static bloom: eyes breathe, flame
 // gutters and room signals pulse.  The list is built once, never per frame.
 let flickerList=null;
 const animateFlicker=time=>{
  if(!flickerList){
   flickerList=[];
   const seen=new Set();
   root.traverse(object=>{
    const list=object.material?(Array.isArray(object.material)?object.material:[object.material]):[];
    for(const material of list){
     if(!material||seen.has(material))continue;
     const spec=material.userData?.decorFlicker;
     if(spec)seen.add(material),flickerList.push({material,base:spec.base??material.emissiveIntensity??0,speed:spec.speed??2,depth:spec.depth??.25,phase:spec.phase??(material.id%7)*.9});
     else if(material.userData?.roomRole==='roomSignal')seen.add(material),flickerList.push({material,base:material.emissiveIntensity||0,speed:.9,depth:.12,phase:(material.id%5)*1.1});
    }
   });
  }
  for(const item of flickerList)item.material.emissiveIntensity=item.base*(1-item.depth*.5+item.depth*.5*Math.sin(time*item.speed+item.phase));
 };
 authored.animate=t=>{authoredAnimate(t);rooms.animate(t);animateFlicker(t);};
 const steel=materials.metalDark,bone=new THREE.MeshStandardMaterial({color:0xb9b6a0,roughness:.82,metalness:.12}),flesh=new THREE.MeshStandardMaterial({color:0x421516,roughness:.44,metalness:.08});
 const add=(geo,mat,x,y,z)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;root.add(o);return o;};
 const cable=(points,radius,mat)=>add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),32,radius,6,false),mat,0,0,0);
 // Structural ribs sit above jumping height and frame the uninterrupted floor.
 let organ=null,core=null;
 if(!course.dungeon){
  for(const z of [7,19,31,43]){
   cable([[.35,5.8,z],[4,8.5,z],[14,10.6,z],[24,11.5,z],[34,10.6,z],[44,8.5,z],[47.65,5.8,z]],.19,steel);
   cable([[.35,6.5,z],[4,9.2,z],[14,11.3,z],[24,12.2,z],[34,11.3,z],[44,9.2,z],[47.65,6.5,z]],.09,materials.rust);
  }
  // The arena organ remains in the compact campaign; Story uses its authored landmarks.
  organ=add(new THREE.SphereGeometry(1,20,14),flesh,24,8.6,17);organ.scale.set(1.5,2.1,1.15);organ.name='SuspendedOrgan';
  for(let i=0;i<5;i++){const ring=add(new THREE.TorusGeometry(1.7+i*.08,.055,6,36),bone,24,7.3+i*.65,17);ring.rotation.x=Math.PI/2;}
  for(const side of [-1,1]){cable([[24+side*.8,10,17],[24+side*3,10.6,18],[24+side*5,9.3,16],[24+side*8,10.8,17]],.105,materials.rust);cable([[24+side*1.4,8,17],[24+side*2,7.3,16],[24+side*2.3,8.1,17],[24+side*3,11.1,17]],.055,steel);}
  core=add(new THREE.SphereGeometry(.52,16,12),materials.red,24,8.55,15.96);core.name='OrganHeart';
 }
 function sign(text,sub,x,y,z,width=5){
  if(typeof document==='undefined')return null;
  const c=document.createElement('canvas');c.width=1024;c.height=256;const g=c.getContext('2d');g.fillStyle='#15191a';g.fillRect(0,0,1024,256);g.fillStyle='#bdbba6';g.fillRect(22,24,6,208);g.font='bold 82px monospace';g.fillText(text,55,119);g.font='28px monospace';g.fillStyle='#a85543';g.fillText(sub,58,186);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const mm=new THREE.MeshBasicMaterial({map:t});const p=add(new THREE.PlaneGeometry(width,width/4),mm,x,y,z);p.name='FoundrySign_'+text;return p;
 }
 if(!course.dungeon){
  if(sectorTheme.id==='bloodworks')sign('BLOODWORKS','SECTOR 09 / MATERIAL RECOVERY',24,5.9,.2,12);
  sign('NO RESCUE','REMAIN IN THE LIGHT',7.5,3.4,.23,5.5);
  sign('INTAKE 04','BIOLOGICAL WASTE',39.5,3.4,.23,5.5);
 }
 // Sector furniture, wall relics and the stain sheet: the parts that make each
 // descent read as its own level rather than a recoloured arena.
 const detailKit=buildSectorDetailKit(root,materials,course,sectorTheme);
 root.add(detailKit);
 const setDressing=buildSetDressing(root,materials,course);
 return{organ,core,sector:sectorTheme.id,theme:sectorTheme,authored,rooms:rooms.rooms,roomChunks:rooms.roomChunks,roomPlan:rooms.plan,route:rooms.route,setRoomProgression:rooms.setProgression,detailKit,furniture:detailKit.userData.furniture,relics:detailKit.userData.relics,stains:detailKit.userData.stains,setDressing};
}
