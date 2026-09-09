import * as THREE from './vendor/three.module.js';

// Room materials are deliberately shared by style.  A course can contain many
// rooms, but the palette only allocates a handful of textures/materials and the
// static world pass can still merge compatible meshes.
const CACHE = new WeakMap();
const BUNDLED_TEXTURES = new Map();
const BUNDLED_TEXTURE_READY = new Map();
const CELL = 4;

const PALETTES = Object.freeze({
  bloodworks: Object.freeze({
    base: 0x39262c, panel: 0x634047, trim: 0xb26d55, floor: 0x211a21,
    hazard: 0xdf8d45, signal: 0xff4d49, bone: 0xc9b69c, metal: 0x687581,
  }),
  ossuary: Object.freeze({
    base: 0x2b2b42, panel: 0x4c4868, trim: 0xb0a48e, floor: 0x161827,
    hazard: 0xb47b54, signal: 0xa476ff, bone: 0xd0c4a3, metal: 0x66728a,
  }),
  choir: Object.freeze({
    base: 0x3a2424, panel: 0x684038, trim: 0xc69357, floor: 0x241719,
    hazard: 0xe0984c, signal: 0xff9a48, bone: 0xc9b08a, metal: 0x7d6a66,
  }),
});

const hex = value => `#${value.toString(16).padStart(6, '0')}`;
const brighten = (value, factor = 1) => {
  const color = new THREE.Color(value);
  color.r = Math.min(1, color.r * factor);
  color.g = Math.min(1, color.g * factor);
  color.b = Math.min(1, color.b * factor);
  return color.getHex();
};
const sectorKey = course => String(course.sectorId || course.id || 'bloodworks').toLowerCase();

function hash(seed) {
  let x = (seed >>> 0) || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

function surfaceTexture(sector, style, purpose) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const g = canvas.getContext('2d');
  const palette = PALETTES[sector] || PALETTES.bloodworks;
  const random = hash([...`${sector}:${style}:${purpose}`].reduce((a, c) => a + c.charCodeAt(0), 0));
  const base = purpose === 'floor' ? palette.floor : purpose === 'panel' ? palette.panel : palette.base;
  g.fillStyle = hex(base); g.fillRect(0, 0, 256, 256);

  // A compact trim-sheet-like tile: edge wear, panel seams, and material
  // breakup are shared across all rooms in a style instead of unique images.
  g.globalAlpha = .28;
  for (let i = 0; i < 46; i++) {
    const x = Math.floor(random() * 256), y = Math.floor(random() * 256);
    const w = 12 + Math.floor(random() * 52), h = 2 + Math.floor(random() * 8);
    g.fillStyle = i % 3 ? '#ffffff' : '#05070d';
    g.fillRect(x, y, w, h);
  }
  g.globalAlpha = .8;
  g.strokeStyle = purpose === 'floor' ? '#8a7b742e' : '#c5a58a38';
  g.lineWidth = purpose === 'floor' ? 2 : 3;
  const step = purpose === 'floor' ? 64 : 86;
  for (let x = 0; x <= 256; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  for (let y = 0; y <= 256; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  if (sector === 'ossuary') {
    g.strokeStyle = '#d9c9a84c'; g.lineWidth = 5;
    for (let y = 28; y < 256; y += 54) { g.beginPath(); g.arc(128, y, 18, 0, Math.PI); g.stroke(); }
  } else if (sector === 'choir') {
    g.strokeStyle = '#e8b36a44'; g.lineWidth = 3;
    for (let x = 16; x < 256; x += 48) { g.beginPath(); g.moveTo(x, 12); g.lineTo(x + 28, 242); g.stroke(); }
  } else {
    g.fillStyle = '#c64f4936';
    for (let i = 0; i < 5; i++) { g.fillRect(17 + i * 49, 214 - (i % 2) * 17, 24, 4); }
  }
  g.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  texture.userData.sharedAsset = true;
  texture.userData.roomSurface = { sector, style, purpose };
  return texture;
}

function bundledTexture(file, colorSpace = THREE.SRGBColorSpace) {
  if (typeof document === 'undefined') return null;
  if (BUNDLED_TEXTURES.has(file)) return BUNDLED_TEXTURES.get(file);
  const url = `./assets/textures/${file}`;
  let resolveReady, rejectReady;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  // Keep the rejection observable to roomMaterialsReady() while marking it
  // handled here so an optional prewarm does not create an unhandled event.
  ready.catch(() => {});
  let texture;
  try {
    texture = new THREE.TextureLoader().load(url, loaded => resolveReady(loaded), undefined, error => {
      const detail = error?.message || error?.type || String(error || 'unknown loader error');
      rejectReady(new Error(`Room texture failed to load: ${url} (${detail})`));
    });
  } catch (error) {
    rejectReady(new Error(`Room texture failed to start: ${url} (${error?.message || String(error)})`));
    texture = new THREE.Texture();
  }
  texture.colorSpace = colorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  texture.userData.sharedAsset = true;
  BUNDLED_TEXTURES.set(file, texture);
  BUNDLED_TEXTURE_READY.set(file, ready);
  return texture;
}

// The renderer can await this after room construction and before its first
// gameplay frame. A rejected result contains the exact relative asset URL.
export function roomMaterialsReady() {
  return Promise.all([...BUNDLED_TEXTURE_READY.values()]);
}

function linearDetail(texture) {
  if (!texture) return null;
  const detail = texture.clone();
  detail.colorSpace = THREE.NoColorSpace;
  detail.needsUpdate = true;
  detail.userData.sharedAsset = true;
  return detail;
}

function roomTexture(texture, repeat = [1, 1]) {
  if (!texture) return null;
  const roomMap = texture.clone();
  roomMap.colorSpace = texture.colorSpace;
  roomMap.wrapS = roomMap.wrapT = THREE.RepeatWrapping;
  roomMap.repeat.set(repeat[0], repeat[1]);
  roomMap.anisotropy = texture.anisotropy || 4;
  roomMap.needsUpdate = true;
  roomMap.userData.sharedAsset = true;
  return roomMap;
}

function makeMaterial(base, color, options = {}) {
  const material = base?.clone?.() || new THREE.MeshStandardMaterial();
  material.color.set(color);
  if (options.roughness !== undefined) material.roughness = options.roughness;
  if (options.metalness !== undefined) material.metalness = options.metalness;
  if (options.emissive) {
    material.emissive.set(options.emissive);
    material.emissiveIntensity = options.emissiveIntensity ?? 1.2;
  }
  material.name = options.name || `RoomMaterial_${color.toString(16)}`;
  material.userData.sharedLibrary = true;
  material.userData.roomRole = options.role || 'support';
  return material;
}

function createPalette(materials, sector, styleIndex) {
  const base = PALETTES[sector] || PALETTES.bloodworks;
  const style = `${sector}-${styleIndex}`;
  const wallMap = surfaceTexture(sector, style, 'wall');
  const panelMap = surfaceTexture(sector, style, 'panel');
  const floorMap = surfaceTexture(sector, style, 'floor');
  const wallDetail = linearDetail(wallMap);
  const panelDetail = linearDetail(panelMap);
  const floorDetail = linearDetail(floorMap);
  // Reuse the repo's authored PBR surfaces as the albedo layer. The tiny
  // sector/style tiles remain as linear bump/roughness breakup, so the room
  // variants have different construction identities without flat-color walls.
  const cryptAlbedo = materials.wall?.map || bundledTexture('crypt-wall-albedo.webp');
  const gunmetalAlbedo = materials.metal?.map || bundledTexture('gunmetal_albedo.png');
  const gunmetalNormal = bundledTexture('gunmetal_normal.png', THREE.NoColorSpace);
  const gunmetalRoughness = bundledTexture('gunmetal_roughness.png', THREE.NoColorSpace);
  const organicAlbedo = bundledTexture('dead-arrival-industrial-flesh-metal.png');
  const wall = makeMaterial(materials.wall, brighten(base.base, 2.05), { roughness: .86, metalness: .26, role: 'roomWall', name: `RoomWall_${style}` });
  const panel = makeMaterial(materials.wallPanel, brighten(base.panel, 1.8), { roughness: .69, metalness: .42, role: 'roomPanel', name: `RoomPanel_${style}` });
  const trim = makeMaterial(materials.metal, brighten(base.trim, 1.25), { roughness: .38, metalness: .78, role: 'roomTrim', name: `RoomTrim_${style}` });
  const floor = makeMaterial(materials.floor, brighten(base.floor, 1.85), { roughness: .9, metalness: .23, role: 'roomFloor', name: `RoomFloor_${style}` });
  const floorInset = makeMaterial(materials.floor, brighten(base.floor, 2.35), { roughness: .84, metalness: .2, role: 'roomFloorInset', name: `RoomFloorInset_${style}` });
  const shadow = makeMaterial(materials.black, 0x0b0b12, { roughness: .97, metalness: .04, role: 'roomRecess', name: `RoomRecess_${style}` });
  const hazard = makeMaterial(materials.hazard, base.hazard, { roughness: .45, metalness: .62, role: 'roomHazard', name: `RoomHazard_${style}` });
  const signal = makeMaterial(sector === 'ossuary' ? materials.violet : sector === 'choir' ? materials.orange : materials.red, base.signal, { emissive: base.signal, emissiveIntensity: 2.1, roughness: .32, metalness: .38, role: 'roomSignal', name: `RoomSignal_${style}` });
  const bone = makeMaterial(materials.steel, base.bone, { roughness: .78, metalness: .18, role: 'roomBone', name: `RoomBone_${style}` });
  const metal = makeMaterial(materials.metalDark, base.metal, { roughness: .57, metalness: .76, role: 'roomMetal', name: `RoomMetal_${style}` });
  wall.emissive.set(base.panel); wall.emissiveIntensity = .13;
  panel.emissive.set(base.trim); panel.emissiveIntensity = .11;
  floor.emissive.set(base.base); floor.emissiveIntensity = .035;
  floorInset.emissive.set(base.base); floorInset.emissiveIntensity = .045;
  if (cryptAlbedo) { wall.map = roomTexture(cryptAlbedo, [1.4, 1.1]); wall.bumpMap = wallDetail || materials.wall?.bumpMap || null; wall.roughnessMap = wallDetail || null; wall.bumpScale = .045; wall.needsUpdate = true; }
  if (cryptAlbedo) { panel.map = roomTexture(cryptAlbedo, [1.15, 1.15]); panel.bumpMap = panelDetail || materials.wall?.bumpMap || null; panel.roughnessMap = panelDetail || null; panel.bumpScale = .035; panel.needsUpdate = true; }
  if (floorMap || cryptAlbedo) { floor.map = roomTexture(floorMap || cryptAlbedo, [1.7, 1.7]); floor.bumpMap = floorDetail || materials.floor?.bumpMap || null; floor.roughnessMap = floorDetail || null; floor.bumpScale = .02; floor.needsUpdate = true; }
  if (floorMap || cryptAlbedo) { floorInset.map = floor.map; floorInset.bumpMap = floor.bumpMap; floorInset.roughnessMap = floor.roughnessMap; floorInset.needsUpdate = true; }
  if (gunmetalAlbedo) { trim.map = roomTexture(gunmetalAlbedo, [2.2, 2.2]); trim.normalMap = roomTexture(gunmetalNormal); trim.roughnessMap = roomTexture(gunmetalRoughness); trim.normalScale.set(.5, .5); trim.needsUpdate = true; }
  if (organicAlbedo) { bone.map = roomTexture(organicAlbedo, [1.2, 1.2]); bone.needsUpdate = true; }
  return { sector, style, wall, panel, trim, floor, floorInset, shadow, hazard, signal, bone, metal, maps: [cryptAlbedo, gunmetalAlbedo, gunmetalNormal, gunmetalRoughness, organicAlbedo, wallMap, panelMap, floorMap].filter(Boolean) };
}

export function getRoomPalette(materials, course = {}, styleIndex = 0) {
  if (!materials || typeof materials !== 'object') return createPalette({}, sectorKey(course), styleIndex);
  let byStyle = CACHE.get(materials);
  if (!byStyle) { byStyle = new Map(); CACHE.set(materials, byStyle); }
  const sector = sectorKey(course);
  const key = `${sector}:${styleIndex}`;
  if (!byStyle.has(key)) byStyle.set(key, createPalette(materials, sector, styleIndex));
  return byStyle.get(key);
}

export function roomPaletteNames(course = {}) {
  const sector = sectorKey(course);
  return Object.keys(PALETTES).includes(sector) ? [`${sector}-0`, `${sector}-1`, `${sector}-2`, `${sector}-3`] : ['bloodworks-0'];
}

export { CELL, PALETTES };
