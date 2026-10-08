import * as THREE from '../../vendor/three.module.js';

// Downloaded CC0 scans, bundled beside the game. UVs measure metres / tileMetres;
// the maps share orientation, repeat and filtering, so one cause owns all channels.
export const BLACKWATER_SURFACES = Object.freeze({
  brick: { id: 'red_brick', tileMetres: 1.4, resolution: 2048 },
  plaster: { id: 'worn_plaster_wall', tileMetres: 1.8, resolution: 1024 },
  asphalt: { id: 'clean_asphalt', tileMetres: 2.1, resolution: 2048 },
  timber: { id: 'weathered_planks', tileMetres: 2, resolution: 1024 },
});

function flatCanvas(rgb) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = `rgb(${rgb.join(' ')})`; ctx.fillRect(0, 0, 2, 2);
  return canvas;
}

export function createBlackwaterSurfaceMaps({ anisotropy = 8 } = {}) {
  const sets = new Map(), owned = new Set(), pending = [], failures = [];
  let disposed = false;
  const loader = typeof document === 'undefined' ? null : new THREE.TextureLoader();
  function channel(asset, suffix, fallback, srgb, resolution) {
    // The texture object stays stable as its image changes. House material clones
    // therefore receive completed maps without a per-frame/material replacement.
    const map = fallback?.isTexture ? fallback : new THREE.Texture(fallback);
    map.name = `blackwater-${asset}-${suffix}`;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.minFilter = THREE.LinearMipmapLinearFilter; map.magFilter = THREE.LinearFilter;
    map.generateMipmaps = true; map.anisotropy = anisotropy;
    map.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    map.needsUpdate = Boolean(map.image);
    const path = `../textures/blackwater/${asset}_${suffix}.${suffix === 'arm' ? 'webp' : 'jpg'}`;
    map.userData = { source: 'Poly Haven CC0', asset, channel: suffix, path, resolution, loaded: false };
    owned.add(map);
    if (loader) pending.push(loader.loadAsync(new URL(path, import.meta.url).href).then(loaded => {
      if (!disposed) { map.image = loaded.image; map.needsUpdate = true; map.userData.loaded = true; }
      loaded.dispose();
    }).catch(error => { failures.push({ asset, channel: suffix, reason: error.message || 'Image load failed' }); }));
    return map;
  }
  return {
    get(role, fallback) {
      if (!loader) return null;
      if (sets.has(role)) return sets.get(role);
      const definition = BLACKWATER_SURFACES[role];
      if (!definition) throw new Error(`Unknown Blackwater scan: ${role}`);
      const albedo = channel(definition.id, 'diff', fallback, true, definition.resolution);
      const normal = channel(definition.id, 'nor_gl', flatCanvas([128, 128, 255]), false, definition.resolution);
      // One 1K texture is borrowed by both AO (red) and roughness (green).
      const arm = channel(definition.id, 'arm', flatCanvas([255, 255, 0]), false, 1024);
      const maps = { ...definition, albedo, normal, arm };
      sets.set(role, maps); return maps;
    },
    ready() { return Promise.all(pending).then(() => ({ loaded: [...owned].filter(t => t.userData.loaded).length, expected: owned.size, failures: [...failures] })); },
    diagnostics() {
      const bytes = [...owned].reduce((sum, t) => sum + t.userData.resolution ** 2 * 4 * 4 / 3, 0);
      return { sets: sets.size, textures: owned.size, loaded: [...owned].filter(t => t.userData.loaded).length, estimatedMipBytes: Math.round(bytes), failures: [...failures], owner: 'district material library; model/style clones borrow textures' };
    },
    dispose() { if (disposed) return; disposed = true; for (const map of owned) map.dispose(); owned.clear(); },
  };
}
