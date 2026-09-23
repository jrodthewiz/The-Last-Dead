import * as THREE from './vendor/three.module.js';

// Shared look-dev guard for first-person weapons.  The individual factories own
// their palette and maps; this pass only keeps the PBR response in a readable,
// game-scale range so a single hot environment reflection cannot bleach a whole
// gun.  Values are intentionally conservative for the renderer's existing HDR
// exposure and preserve each weapon's dark iron / warm bone identity.
const DEFAULTS = {
  // Keep the body values restrained, but give machined edges enough albedo to
  // separate from the dark receiver under the game's low fill light.
  steel: { roughness: .58, metalness: .76, envMapIntensity: .54, colorScale: .93 },
  steelEdge: { roughness: .46, metalness: .84, envMapIntensity: .5, colorScale: .84 },
  frame: { roughness: .56, metalness: .78, envMapIntensity: .54, colorScale: .94 },
  frameEdge: { roughness: .46, metalness: .84, envMapIntensity: .5, colorScale: .84 },
  metal: { roughness: .6, metalness: .72, envMapIntensity: .5, colorScale: .9 },
  iron: { roughness: .58, metalness: .74, envMapIntensity: .5, colorScale: .9 },
  ironEdge: { roughness: .47, metalness: .82, envMapIntensity: .48, colorScale: .84 },
  bone: { roughness: .91, metalness: 0, envMapIntensity: .25, colorScale: .88, bumpScale: .012 },
  boneDark: { roughness: .95, metalness: 0, envMapIntensity: .18, colorScale: .94, bumpScale: .008 },
  horn: { roughness: .93, metalness: 0, envMapIntensity: .18, colorScale: .92, bumpScale: .008 },
  leather: { roughness: .88, metalness: .025, envMapIntensity: .14, colorScale: .99, bumpScale: .009 },
  brass: { roughness: .5, metalness: .78, envMapIntensity: .45, colorScale: .86 },
  steelEdgeWarm: { roughness: .5, metalness: .78, envMapIntensity: .45, colorScale: .85 },
  black: { roughness: .9, metalness: .16, envMapIntensity: .2, colorScale: .95 },
  dark: { roughness: .95, metalness: .05, envMapIntensity: .11, colorScale: .93 },
  soot: { roughness: .97, metalness: 0, envMapIntensity: .07, colorScale: .93 },
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
    const positions = node.geometry.attributes.position;
    const normals = node.geometry.attributes.normal;
    // Use a broad, surface-space variation instead of vertex-index noise. The
    // index sequence makes the same plate pick up disconnected white speckle.
    const nameSeed = String(node.name || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) * .013;
    for (let i = 0; i < colors.count; i++) {
      const x = positions ? positions.getX(i) : i * .01;
      const y = positions ? positions.getY(i) : 0;
      const z = positions ? positions.getZ(i) : 0;
      const broad = Math.sin(x * 7.1 + y * 4.3 + z * 5.7 + seed * .17 + nameSeed) * .5 + .5;
      const face = normals ? Math.max(0, normals.getY(i) * .24 + normals.getZ(i) * .18) : 0;
      const base = clamp(.91 + broad * .045 + face * .018, .875, .985);
      colors.setXYZ(i, base, base * .972, base * .925);
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
