import * as THREE from './vendor/three.module.js';

// Shared look-dev guard for first-person weapons.  The individual factories own
// their palette and maps; this pass only keeps the PBR response in a readable,
// game-scale range so a single hot environment reflection cannot bleach a whole
// gun.  Values are intentionally conservative for the renderer's existing HDR
// exposure and preserve each weapon's dark iron / warm bone identity.
const DEFAULTS = {
  steel: { roughness: .58, metalness: .76, envMapIntensity: .58, colorScale: .88 },
  steelEdge: { roughness: .46, metalness: .84, envMapIntensity: .54, colorScale: .76 },
  frame: { roughness: .56, metalness: .78, envMapIntensity: .58, colorScale: .9 },
  frameEdge: { roughness: .46, metalness: .84, envMapIntensity: .54, colorScale: .76 },
  metal: { roughness: .6, metalness: .72, envMapIntensity: .52, colorScale: .86 },
  iron: { roughness: .58, metalness: .74, envMapIntensity: .54, colorScale: .86 },
  ironEdge: { roughness: .47, metalness: .82, envMapIntensity: .52, colorScale: .76 },
  bone: { roughness: .91, metalness: 0, envMapIntensity: .27, colorScale: .84, bumpScale: .012 },
  boneDark: { roughness: .95, metalness: 0, envMapIntensity: .2, colorScale: .92, bumpScale: .008 },
  horn: { roughness: .93, metalness: 0, envMapIntensity: .2, colorScale: .9, bumpScale: .008 },
  leather: { roughness: .88, metalness: .025, envMapIntensity: .16, colorScale: .98, bumpScale: .009 },
  brass: { roughness: .5, metalness: .78, envMapIntensity: .48, colorScale: .8 },
  steelEdgeWarm: { roughness: .5, metalness: .78, envMapIntensity: .48, colorScale: .8 },
  black: { roughness: .9, metalness: .16, envMapIntensity: .22, colorScale: .92 },
  dark: { roughness: .95, metalness: .05, envMapIntensity: .12, colorScale: .9 },
  soot: { roughness: .97, metalness: 0, envMapIntensity: .08, colorScale: .9 },
};

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

/**
 * Apply the common material response without replacing a factory's palette.
 * Optional overrides are keyed by the material names used by the factory.
 */
export function applyWeaponMaterialProfile(materials, overrides = {}) {
  if (!materials) return materials;
  for (const [key, material] of Object.entries(materials)) {
    if (!material || !material.isMaterial) continue;
    const base = DEFAULTS[key];
    const custom = overrides[key] || {};
    if (!base && !Object.keys(custom).length) continue;
    const profile = { ...(base || {}), ...custom };
    if (Number.isFinite(profile.roughness)) material.roughness = clamp(profile.roughness, .12, .99);
    if (Number.isFinite(profile.metalness)) material.metalness = clamp(profile.metalness, 0, 1);
    if (Number.isFinite(profile.envMapIntensity)) material.envMapIntensity = profile.envMapIntensity;
    if (Number.isFinite(profile.bumpScale) && material.bumpMap) material.bumpScale = profile.bumpScale;
    if (Number.isFinite(profile.colorScale) && material.color) material.color.multiplyScalar(profile.colorScale);
    if ('clearcoat' in profile && 'clearcoat' in material) material.clearcoat = profile.clearcoat;
    if ('clearcoatRoughness' in profile && 'clearcoatRoughness' in material) material.clearcoatRoughness = profile.clearcoatRoughness;
    material.userData.weaponSurface = {
      kind: key,
      roughness: material.roughness,
      metalness: material.metalness,
      envMapIntensity: material.envMapIntensity,
      independentChannels: Boolean(material.map || material.roughnessMap || material.bumpMap),
    };
    material.needsUpdate = true;
  }
  return materials;
}

/**
 * Existing factories use low-cost vertex wear to break up repeated texture UVs.
 * Clamp that wear to a narrow, warm range so it reads as aged surface response
 * instead of disconnected white flecks under a bright HDR environment.
 */
export function stabilizeWeaponVertexWear(root, seed = 37) {
  if (!root?.traverse) return;
  root.traverse(node => {
    if (!node.isMesh || !node.geometry?.attributes?.color) return;
    const colors = node.geometry.attributes.color;
    for (let i = 0; i < colors.count; i++) {
      const n = Math.sin((i + seed) * 12.9898 + seed * 1.37) * .5 + .5;
      const base = clamp(.895 + n * .07, .86, .975);
      colors.setXYZ(i, base, base * .975, base * .925);
    }
    colors.needsUpdate = true;
  });
}

export function tagWeaponMechanism(node, mechanism, axis = 'z') {
  if (!node) return node;
  node.userData.weaponMechanism = mechanism;
  node.userData.animationAxis = axis;
  return node;
}

export const weaponMaterialDefaults = DEFAULTS;
