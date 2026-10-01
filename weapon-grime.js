import * as THREE from './vendor/three.module.js';

// Shared procedural wear layer for first-person weapons. It gives every metal
// and lacquered surface uneven roughness (polished edge wear against oily
// grime), soot streaks and dried/wet blood stains without extra draw calls or
// texture downloads. Textures are generated once and shared by all weapons.

let cache = null;

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function makeTextures() {
  if (cache) return cache;
  if (typeof document === 'undefined') return (cache = {});
  const size = 256, rand = rng(0x51ed);
  const albedo = document.createElement('canvas'); albedo.width = albedo.height = size;
  const rough = document.createElement('canvas'); rough.width = rough.height = size;
  const a = albedo.getContext('2d'), r = rough.getContext('2d');
  a.fillStyle = '#f4f0e8'; a.fillRect(0, 0, size, size);
  r.fillStyle = '#c4c4c4'; r.fillRect(0, 0, size, size);
  // Broad oily smudges.
  for (let i = 0; i < 46; i++) {
    const x = rand() * size, y = rand() * size, rad = 10 + rand() * 42;
    const g = a.createRadialGradient(x, y, 0, x, y, rad);
    const dark = 30 + rand() * 40;
    g.addColorStop(0, `rgba(${dark},${dark * .9},${dark * .8},${.16 + rand() * .2})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    a.fillStyle = g; a.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    const gr = r.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    r.fillStyle = gr; r.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // Vertical soot / grime drips.
  for (let i = 0; i < 38; i++) {
    const x = rand() * size, y = rand() * size, len = 20 + rand() * 90;
    a.fillStyle = `rgba(18,14,12,${.1 + rand() * .16})`; a.fillRect(x, y, 1 + rand() * 3, len);
  }
  // Scratches: bright bare metal, lowers roughness.
  for (let i = 0; i < 90; i++) {
    const x = rand() * size, y = rand() * size, ang = rand() * Math.PI, len = 8 + rand() * 46;
    r.strokeStyle = `rgba(70,70,70,${.55 + rand() * .4})`; r.lineWidth = .6 + rand() * .9;
    r.beginPath(); r.moveTo(x, y); r.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); r.stroke();
    a.strokeStyle = `rgba(255,248,235,${.18 + rand() * .2})`; a.lineWidth = .5;
    a.beginPath(); a.moveTo(x, y); a.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); a.stroke();
  }
  // Blood: fresh wet spatter (glossy: low roughness) with a few runs.
  for (let i = 0; i < 16; i++) {
    const x = rand() * size, y = rand() * size, rad = 3 + rand() * 13;
    a.fillStyle = `rgba(${70 + rand() * 40},${6 + rand() * 8},${8 + rand() * 8},${.6 + rand() * .3})`;
    a.beginPath(); a.ellipse(x, y, rad, rad * (.6 + rand() * .5), rand() * 3, 0, Math.PI * 2); a.fill();
    r.fillStyle = 'rgba(40,40,40,.85)'; r.beginPath(); r.ellipse(x, y, rad, rad * .8, 0, 0, Math.PI * 2); r.fill();
    if (rand() > .5) { a.fillStyle = 'rgba(70,6,8,.6)'; a.fillRect(x - 1, y, 2, 12 + rand() * 40); r.fillStyle = 'rgba(40,40,40,.8)'; r.fillRect(x - 1, y, 2, 12 + rand() * 30); }
  }
  for (let i = 0; i < 220; i++) { // fine spatter
    const x = rand() * size, y = rand() * size;
    a.fillStyle = `rgba(80,8,10,${.3 + rand() * .5})`; a.fillRect(x, y, 1 + rand() * 1.6, 1 + rand() * 1.6);
  }
  const mk = (canvas, srgb) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
    t.anisotropy = 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.userData.sharedAsset = true;
    return t;
  };
  return (cache = { map: mk(albedo, true), roughnessMap: mk(rough, false), bumpMap: mk(rough, false) });
}

/** Apply the shared wear layer to standard materials that have no texture of their own. */
export function applyWeaponGrime(root, { strength = 1 } = {}) {
  const tex = makeTextures();
  if (!tex.map || !root?.traverse) return 0;
  const done = new Set();
  root.traverse(node => {
    if (!node.isMesh || node.userData.viewmodelArm) return;
    for (const m of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!m || done.has(m) || !m.isMeshStandardMaterial) continue;
      done.add(m);
      if (m.userData.weaponMicroDetail && m.emissiveIntensity > .2) continue;
      if (m.emissiveIntensity > 1 || m.transparent) continue;
      if (!m.map) m.map = tex.map;
      if (!m.roughnessMap) m.roughnessMap = tex.roughnessMap;
      if (!m.bumpMap) { m.bumpMap = tex.bumpMap; m.bumpScale = .012 * strength; }
      m.userData.weaponGrime = true;
      m.needsUpdate = true;
    }
  });
  return done.size;
}
