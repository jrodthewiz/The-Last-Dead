import * as THREE from '../../vendor/three.module.js';
import { createBlackwaterSurfaceMaps } from './surface-maps.js';

// Surface identities own their scale. Scans belong to brick, bare timber and
// asphalt; painted siding, pale trim and concrete keep quiet authored grain.
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function tile(kind, base, seed) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const rng = random(seed);
  const fineSurface = ['fine-plaster', 'fine-concrete', 'fine-stone', 'painted-siding'].includes(kind);
  if (fineSurface) { canvas.width = canvas.height = 512; }
  context.fillStyle = base;
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (fineSurface) {
    // Millimetre aggregate and restrained paint variation. Large stains belong
    // to authored damage placements, rather than repeating over every surface.
    for (let i = 0; i < 27000; i++) {
      context.fillStyle = rng() > .5 ? 'rgba(255,255,255,.035)' : 'rgba(25,30,28,.035)';
      context.fillRect(rng() * 512, rng() * 512, 1 + rng(), 1);
    }
    if (kind === 'painted-siding') {
      // Twelve 20cm lap courses within a 2.4m tile; geometry also owns the laps.
      for (let row = 0; row < 12; row++) {
        const y = row * 512 / 12;
        context.fillStyle = 'rgba(255,255,255,.10)'; context.fillRect(0, y + 2.3, 512, 1.1);
        context.fillStyle = 'rgba(22,29,28,.24)'; context.fillRect(0, y, 512, 1.8);
        context.fillStyle = `rgba(38,45,43,${.008 + rng() * .012})`; context.fillRect(0, y + 3, 512, 36);
      }
      for (let i = 0; i < 38; i++) {
        context.fillStyle = 'rgba(70,77,72,.10)'; context.fillRect(rng() * 512, rng() * 512, 2 + rng() * 7, .7);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 8; texture.userData = { source: 'Original authored fine surface', role: kind };
    return texture;
  }
  if (kind === 'brick') {
    context.fillStyle = '#625e55';
    context.fillRect(0, 0, 256, 256);
    const height = 10.67;
    for (let row = -1; row < 25; row++) {
      for (let column = -1; column < 9; column++) {
        const x = column * 32 + (row % 2 ? 16 : 0);
        const light = 30 + rng() * 13;
        context.fillStyle = `hsl(${18 + rng() * 9} 19% ${light}%)`;
        context.fillRect(x + 1.1, row * height + .8, 29.8, height - 1.7);
        context.fillStyle = 'rgba(220,205,177,.12)';
        context.fillRect(x + 1.5, row * height + 1.2, 29, .7);
      }
    }
  }
  if (kind === 'wood') {
    for (let x = 0; x < 256; x += 43) {
      context.fillStyle = 'rgba(20,23,22,.44)';
      context.fillRect(x, 0, 1.8, 256);
      context.fillStyle = 'rgba(211,208,183,.15)';
      context.fillRect(x + 2, 0, 1, 256);
    }
    for (let i = 0; i < 130; i++) {
      const x = rng() * 256, y = rng() * 256;
      context.strokeStyle = `rgba(22,27,26,${.06 + rng() * .15})`;
      context.beginPath(); context.moveTo(x, y);
      context.bezierCurveTo(x - 2, y + 12, x + 2, y + 29, x + .3, y + 58);
      context.stroke();
    }
  }
  if (kind === 'roof') {
    for (let y = 0; y < 256; y += 32) {
      context.fillStyle = 'rgba(16,20,22,.46)';
      context.fillRect(0, y, 256, 2);
      for (let x = y % 64 ? 0 : -32; x < 256; x += 64) {
        context.fillStyle = 'rgba(14,19,22,.36)';
        context.fillRect(x, y, 1, 32);
      }
    }
  }
  // Fine aggregate avoids scaling a single stain across an entire facade.
  for (let i = 0; i < 5500; i++) {
    const light = rng() > .5;
    context.fillStyle = light ? 'rgba(230,225,206,.055)' : 'rgba(12,20,20,.065)';
    context.fillRect(rng() * 256, rng() * 256, 1 + rng() * 2, 1);
  }
  if (kind === 'render' || kind === 'brick' || kind === 'rust') {
    for (let i = 0; i < 35; i++) {
      const x = rng() * 256, y = rng() * 256;
      const gradient = context.createLinearGradient(x, y, x, y + 20 + rng() * 44);
      gradient.addColorStop(0, kind === 'rust' ? 'rgba(131,70,34,.23)' : 'rgba(46,49,39,.14)');
      gradient.addColorStop(1, 'rgba(46,49,39,0)');
      context.fillStyle = gradient;
      context.fillRect(x, y, 1 + rng() * 3, 48);
    }
    for (let i = 0; i < 24; i++) {
      context.fillStyle = 'rgba(213,209,191,.14)';
      context.fillRect(rng() * 256, rng() * 256, 2 + rng() * 9, 1 + rng() * 3);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

export function createBlackwaterMaterials(options = {}) {
  const textures = [];
  const material = (name, color, roughness, metalness = 0, pattern = null) => {
    const map = pattern ? tile(pattern, color, textures.length * 1709 + 81) : null;
    if (map) textures.push(map);
    const result = new THREE.MeshStandardMaterial({ color: map ? '#ffffff' : color, map, roughness, metalness });
    result.name = `blackwater-${name}`;
    result.userData.textureMeters = 2.4;
    return result;
  };
  const materials = {
    masonry: material('damp-concrete', '#929a96', .95, 0, 'fine-concrete'),
    render: material('salt-worn-render', '#c1c2b7', .94, 0, 'fine-plaster'),
    brick: material('harbor-brick', '#805e4c', .91, 0, 'brick'),
    pale: material('limestone-trim', '#dedace', .87, 0, 'fine-stone'),
    wood: material('weathered-timber', '#73766a', .92, 0, 'wood'),
    metal: material('oxidized-petrol-metal', '#425b59', .68, .36, 'rust'),
    rust: material('rusted-steel', '#785c48', .88, .23, 'rust'),
    glass: material('dirty-window-glass', '#4b6368', .31, .15),
    dark: material('unlit-recess', '#171e20', .96),
    roof: material('worn-roof', '#424c4d', .96, 0, 'roof'),
    asphalt: material('worn-asphalt', '#484d49', .96, 0, 'render'),
    paving: material('worn-paving', '#aeb3ac', .95, 0, 'fine-concrete'),
    siding: material('painted-siding', '#ffffff', .88, 0, 'painted-siding'),
    damagedPlaster: material('damaged-plaster', '#b2b7ac', .96, 0, 'render'),
    foliage: material('coastal-foliage', '#536655', .96),
    rubber: material('vehicle-rubber', '#202725', .94),
    carPaint: material('faded-car-paint', '#456568', .48, .08),
    cardboard: material('evacuation-cardboard', '#ac9271', .93, 0, 'fine-plaster'),
    paper: material('evacuation-paper', '#dfdbc8', .88),
    medicine: material('medicine-enamel', '#d7dfd4', .60),
    fabric: material('evacuation-fabric', '#455b61', .97),
    medicalRed: material('first-aid-red', '#b85241', .75),
  };
  for (const [role, value] of Object.entries(materials)) value.userData.lookRole = role;
  materials.foliage.side = THREE.DoubleSide;
  materials.paper.side = THREE.DoubleSide;
  const surfaceMaps = options.loadTextures === false ? null : createBlackwaterSurfaceMaps({ anisotropy: options.anisotropy ?? 8 });
  const scanRoles = { damagedPlaster: 'plaster', brick: 'brick', wood: 'timber', asphalt: 'asphalt' };
  const borrowedTextures = new Set();
  if (surfaceMaps) for (const [role, asset] of Object.entries(scanRoles)) {
    const result = materials[role], maps = surfaceMaps.get(asset, result.map);
    if (!maps) continue;
    result.map = maps.albedo;
    result.normalMap = maps.normal; result.normalScale.set(asset === 'brick' ? .48 : asset === 'asphalt' ? .25 : .35, asset === 'brick' ? .48 : asset === 'asphalt' ? .25 : .35);
    result.roughnessMap = maps.arm; result.aoMap = maps.arm; result.aoMapIntensity = .62;
    result.userData.textureMeters = maps.tileMetres;
    result.userData.surfaceAsset = maps.id;
    result.userData.surfaceSource = `https://polyhaven.com/a/${maps.id}`;
    result.userData.pbrChannels = 'sRGB albedo, linear GL tangent normal, linear ARM (AO red / roughness green)';
    for (const texture of [maps.albedo, maps.normal, maps.arm]) borrowedTextures.add(texture);
    result.needsUpdate = true;
  }
  materials.masonry.userData.textureMeters = 1.2;
  materials.render.userData.textureMeters = 1.2;
  materials.pale.userData.textureMeters = 1.2;
  materials.paving.userData.textureMeters = 1.2;
  materials.siding.userData.textureMeters = 2.4;
  let disposed = false;
  Object.defineProperty(materials, 'ready', { enumerable: false, value: surfaceMaps?.ready() ?? Promise.resolve({ loaded: 0, expected: 0, failures: [] }) });
  Object.defineProperty(materials, 'diagnostics', { enumerable: false, value: () => surfaceMaps?.diagnostics() ?? ({ sets: 0, textures: textures.length, loaded: 0, failures: [], owner: 'procedural material library' }) });
  Object.defineProperty(materials, 'dispose', { enumerable: false, value() {
    if (disposed) return;
    disposed = true;
    Object.values(materials).forEach(value => value.dispose());
    textures.filter(value => !borrowedTextures.has(value)).forEach(value => value.dispose());
    surfaceMaps?.dispose();
  } });
  return materials;
}

// Prefer a borrowed district material. A standalone surface owns its small kit
// through disposeSurface() and must release that library when removed.
export function createBlackwaterSurfaceMaterial(role, { materials, ...options } = {}) {
  const library = materials ?? createBlackwaterMaterials(options);
  if (!library[role]) { if (!materials) library.dispose(); throw new Error(`Unknown Blackwater surface role: ${role}`); }
  const material = library[role];
  if (!materials) {
    Object.defineProperty(material, 'ready', { enumerable: false, value: library.ready });
    Object.defineProperty(material, 'disposeSurface', { enumerable: false, value: () => library.dispose() });
  }
  return material;
}

export function createBlackwaterSignMaterial(label, subtitle = 'BLACKWATER COAST', {
  rim = '#c2baa0', face = '#253c3b', border = '#afa98b', ink = '#d0c9ab', labelFont = 'Georgia, serif', fallback = '#c2baa0',
} = {}) {
  let texture = null;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = rim; context.fillRect(0, 0, 512, 128);
      context.fillStyle = face; context.fillRect(8, 8, 496, 112);
      context.strokeStyle = border; context.lineWidth = 2;
      context.strokeRect(17, 17, 478, 94);
      const text = String(label || 'HARBOR STORES').toUpperCase().slice(0, 30);
      const fontSize = text.length > 21 ? 25 : text.length > 15 ? 31 : 39;
      context.font = `700 ${fontSize}px ${labelFont}`;
      context.textAlign = 'center'; context.fillStyle = ink;
      context.fillText(text, 256, 66, 455);
      context.font = '15px Arial, sans-serif';
      context.fillText(String(subtitle).slice(0, 42), 256, 93, 450);
      context.fillStyle = 'rgba(62,63,49,.3)';
      for (let i = 0; i < 40; i++) context.fillRect((i * 131) % 510, (i * 37) % 125, 2, 3);
      texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
    }
  }
  const material = new THREE.MeshStandardMaterial({ color: texture ? '#ffffff' : fallback, map: texture, roughness: .88 });
  material.name = 'blackwater-shop-sign';
  return material;
}
