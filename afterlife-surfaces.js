import * as THREE from './vendor/three.module.js';
import {
  AFTERLIFE_CUE_PROFILE,
  AFTERLIFE_SURFACE_PROFILE,
  getAfterlifeMoistureTexture,
} from './room-materials.js';

// This pass is deliberately one-shot.  It gives the world a shared surface
// language while leaving actors, weapons, lights, geometry, and collision
// ownership to their existing systems.
const VERSION = 1;
const ACTOR_FLAGS = Object.freeze([
  'actor', 'enemy', 'player', 'survivor', 'warden', 'bellwraith', 'weapon',
  'viewmodel', 'viewmodelArm', 'viewmodelAnchor', 'combat', 'projectile',
  'muzzle', 'limb', 'gore', 'blood', 'vfx',
]);
const ACTOR_NAME = /(?:^|[_\-. ])(?:actor|enemy|player|survivor|warden|bellwraith|weapon|viewmodel|projectile|muzzle|limb|gore|blood|combat)(?:$|[_\-. ])/i;
const CUE_NAME = /(?:gate|portal|exit|objective|telegraph|combat.?cue|hazard.?cue|target)/i;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function materialsOf(mesh) {
  if (!mesh?.material) return [];
  return Array.isArray(mesh.material) ? mesh.material.filter(Boolean) : [mesh.material];
}

function roleFromMaterial(material) {
  const role = material?.userData?.roomRole;
  return role && AFTERLIFE_SURFACE_PROFILE[role] ? role : null;
}

// Generic world meshes made before the room kit do not carry roomRole.  Their
// names are stable construction vocabulary, so infer only when a material role
// was not authored explicitly.  The signal/hazard checks come first so a
// `WallSignals...` mesh is not mistaken for a neutral plaster wall.
function roleFromName(mesh, material) {
  const name = `${mesh?.name || ''} ${material?.name || ''}`.toLowerCase();
  if (/(?:signal|beacon|indicator|lamp|glow|core)/.test(name)) return 'roomSignal';
  if (/(?:hazard|warning|stripe)/.test(name)) return 'roomHazard';
  if (/(?:floor|ground|deck|tile|seam|grate|threshold)/.test(name)) return 'roomFloor';
  if (/(?:bone|rib|spine|skull|ossuary|skeleton)/.test(name)) return 'roomBone';
  if (/(?:panel|plate|cabinet|bulkhead|hatch)/.test(name)) return 'roomPanel';
  if (/(?:wall|plaster|shell|relief|inset|crown|pillar|arch|coffer)/.test(name)) return 'roomWall';
  if (/(?:trim|rail|frame|pipe|bar|beam|ring|bell)/.test(name)) return 'roomTrim';
  return null;
}

function roleFromIdentity(material, options) {
  const map = options.materialRoles;
  if (!map || !material) return null;
  if (map instanceof Map) return map.get(material) || map.get(material.uuid) || null;
  if (typeof map === 'object') return map[material.uuid] || map[material.name] || null;
  return null;
}

function resolveRole(mesh, material, options) {
  const explicit = mesh?.userData?.afterlifeSurfaceRole;
  if (explicit && AFTERLIFE_SURFACE_PROFILE[explicit]) return explicit;
  return roleFromMaterial(material)
    || roleFromIdentity(material, options)
    || options.roleResolver?.(mesh, material)
    || roleFromName(mesh, material)
    || null;
}

function hasActorMarker(node) {
  if (!node) return false;
  if (node.isLight) return true;
  const data = node.userData || {};
  if (data.afterlifeSkip || data.skipAfterlifeSurfaces) return true;
  if (ACTOR_FLAGS.some(key => data[key] === true)) return true;
  return ACTOR_NAME.test(node.name || '');
}

function isCue(node, options) {
  const data = node?.userData || {};
  if (data.afterlifeCue || data.afterlifePreserveCue || data.objectiveCue || data.combatCue || data.telegraph || data.roomGate || data.portalId || data.gate) return true;
  if (CUE_NAME.test(node?.name || '')) return true;
  try {
    return options.preserveCue?.(node) === true;
  } catch {
    return false;
  }
}

function mutedCueColor(source, saturation = .72, lightness = .66) {
  const hsl = { h: 0, s: 0, l: 0 };
  source.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h, clamp(hsl.s * saturation, 0, 1), clamp(hsl.l * lightness, .12, .74));
}

function setColor(material, color) {
  if (material?.color?.set) material.color.set(color);
}

function setEmissive(material, color, intensity) {
  if (!material?.emissive?.set) return;
  material.emissive.set(color);
  if ('emissiveIntensity' in material && Number.isFinite(intensity)) material.emissiveIntensity = intensity;
}

function styleMaterial(source, role, cue, options, pendingSync = null, lineObject = false) {
  const material = source?.clone?.() || source;
  if (!material) return null;
  // The source material often belongs to the renderer-wide library.  Any
  // texture shared by the clone must stay alive when a retired world disposes
  // its owned clone.
  for (const key of ['map', 'normalMap', 'roughnessMap', 'bumpMap', 'emissiveMap']) {
    const texture = source[key];
    if (texture?.isTexture) texture.userData.sharedAsset = true;
  }
  material.userData = { ...(source.userData || {}), afterlifeSurface: VERSION, afterlifeRole: role, afterlifeCue: cue };
  // A clone belongs to this world root.  Do not mark it as sharedLibrary:
  // renderer disposal can then reclaim the clone while shared maps remain
  // protected by their sharedAsset marker.
  delete material.userData.sharedLibrary;

  const profile = options.surfaceProfile?.[role] || AFTERLIFE_SURFACE_PROFILE[role];
  const cueProfile = options.cueProfile?.[role] || AFTERLIFE_CUE_PROFILE[role];
  if (!profile) return material;
  const sourceColor = source.color?.clone?.() || new THREE.Color(profile.color);

  if (cue && cueProfile) {
    // Keep real gate/objective/combat cues recognizable, but lower their
    // saturation and bloom contribution so they sit inside the dark room.
    setColor(material, mutedCueColor(sourceColor, cueProfile.saturation ?? .72, cueProfile.lightness ?? .66));
    if ('roughness' in material && Number.isFinite(cueProfile.roughness)) material.roughness = cueProfile.roughness;
    if ('metalness' in material && Number.isFinite(cueProfile.metalness)) material.metalness = cueProfile.metalness;
    if (role === 'roomSignal' || role === 'roomAccent') {
      const cueColor = material.color?.clone?.() || sourceColor;
      const intensity = Math.min(source.emissiveIntensity ?? cueProfile.emissiveIntensity ?? 1, cueProfile.emissiveIntensity ?? 1.35);
      setEmissive(material, cueColor, intensity);
    } else if (material.emissive) {
      setEmissive(material, 0x050708, Math.min(source.emissiveIntensity ?? .12, .16));
    }
  } else {
    setColor(material, profile.color);
    if ('roughness' in material && Number.isFinite(profile.roughness)) material.roughness = profile.roughness;
    if ('metalness' in material && Number.isFinite(profile.metalness)) material.metalness = profile.metalness;
    if (material.emissive) {
      const signal = role === 'roomSignal' || role === 'roomAccent';
      setEmissive(material, signal ? profile.color : 0x000000, signal ? (profile.emissiveIntensity ?? .12) : 0);
    }
  }

  // The existing room tiles already contain grime and fine variation.  A
  // shared role roughness tile adds broad, irregular damp patches to generic
  // world meshes as well without adding a shader or per-frame work.
  if (options.moisture !== false && profile.moisture && ('roughnessMap' in material)) {
    const moisture = getAfterlifeMoistureTexture(profile.moisture);
    if (moisture) material.roughnessMap = moisture;
  }
  if (lineObject && role === 'roomFloor') {
    // FloorPanelSeams is a LineSegments overlay rather than a Mesh.  It is
    // useful for spatial scale, but the old saturated red grid read as a
    // constant HUD.  Keep only a graphite trace in the wet floor reflection.
    setColor(material, options.seamColor ?? 0x3b4547);
    material.transparent = true;
    material.opacity = Math.min(Number.isFinite(source.opacity) ? source.opacity : 1, options.seamOpacity ?? .1);
  }
  if ('envMapIntensity' in material) {
    const envScale = role === 'roomFloor' || role === 'roomFloorInset' ? .58 : role === 'roomMetal' || role === 'roomTrim' ? .52 : .36;
    material.envMapIntensity = Math.min(Number.isFinite(source.envMapIntensity) ? source.envMapIntensity : 1, envScale);
  }
  const mapCapableRole = role === 'roomWall' || role === 'roomPanel' || role === 'roomFloor' || role === 'roomFloorInset' || role === 'roomTrim' || role === 'roomMetal' || role === 'roomBone';
  if (material !== source && pendingSync && mapCapableRole && options.trackSourceMaterials !== false && sourceMaterialIsKnown(source, options) && !source.map) {
    pendingSync.push({ source, target: material });
  }
  material.needsUpdate = true;
  return material;
}

function cacheKey(material, role, cue) {
  return `${material.uuid || material.id || 'material'}:${role}:${cue ? 'cue' : 'surface'}`;
}

function sourceMaterialIsKnown(source, options) {
  const sources = options.materialSources || options.materialRoles;
  if (!sources || !source) return false;
  if (Array.isArray(sources)) return sources.includes(source);
  if (sources instanceof Set) return sources.has(source);
  if (sources instanceof Map) return [...sources.keys()].includes(source) || [...sources.values()].includes(source);
  if (typeof sources === 'object') return Object.values(sources).includes(source);
  return false;
}

function scheduleMaterialSync(root, pending, diagnostics, options) {
  if (!pending.length || options.trackSourceMaterials === false) return;
  // TextureLoader is browser-only.  Avoid timers in node material tests and
  // preserve the one-shot/no-per-frame contract of this pass.
  if (typeof document === 'undefined' && typeof window === 'undefined') return;
  let attempt = 0;
  const maxAttempts = Math.max(1, Math.floor(options.materialSyncAttempts ?? 40));
  const delay = Math.max(16, Math.floor(options.materialSyncDelayMs ?? 50));
  diagnostics.materialSyncScheduled = true;
  const sync = () => {
    if (root.userData?.afterlifeSurfaceDisposed) return;
    let unresolved = 0;
    for (const { source, target } of pending) {
      let sourceReady = false;
      for (const key of ['map', 'normalMap', 'bumpMap', 'emissiveMap']) {
        if (source[key]) {
          sourceReady = true;
          if (source[key].userData) source[key].userData.sharedAsset = true;
          if (target[key] !== source[key]) {
            target[key] = source[key];
            target.needsUpdate = true;
          }
        }
      }
      if (!sourceReady) unresolved += 1;
    }
    diagnostics.materialSyncPending = unresolved;
    if (!options.sourceReady && unresolved && attempt++ < maxAttempts) setTimeout(sync, delay);
  };
  if (options.sourceReady?.then) options.sourceReady.then(sync, () => {});
  else setTimeout(sync, 0);
}

/**
 * Apply the Forsaken Afterlife surface language once to an environment root.
 *
 * Call after all static world/room geometry is built and before static
 * batching.  Example:
 *
 *   const diagnostics = applyAfterlifeSurfaces(this.worldRoot, {
 *     sector: course?.sectorId,
 *     excludeRoots: [this._exit?.root, ...this._dungeonPickups.map(item => item.root)],
 *     materialRoles: new Map([
 *       [this.materials.floor, 'roomFloor'],
 *       [this.materials.wall, 'roomWall'],
 *       [this.materials.wallPanel, 'roomPanel'],
 *     ]),
 *     materialSources: this.materials,
 *     preserveCue: node => node.userData?.combatCue === true,
 *   });
 *
 * `sector` is retained in diagnostics for callers that want to log the active
 * art direction; materials are keyed by their authored role so all sectors
 * receive the same neutral afterlife treatment. `materialRoles` is an
 * optional identity map for unnamed meshes. `materialSources` enables a
 * bounded browser-side refresh when a known source material receives a
 * TextureLoader map after this pass has cloned it.
 */
export function applyAfterlifeSurfaces(root, options = {}) {
  if (!root || typeof root !== 'object') {
    return { applied: false, version: VERSION, reason: 'missing-root', visited: 0, meshes: 0, changedMeshes: 0, changedMaterials: 0, clonedMaterials: 0, skipped: 0, preservedCues: 0, roles: {} };
  }
  const previous = root.userData?.afterlifeSurfaceDiagnostics;
  if (root.userData?.afterlifeSurfacesApplied && previous) return { ...previous, reused: true };

  const exclude = new Set((options.excludeRoots || []).filter(Boolean));
  const materialCache = new Map();
  const pendingMaterialSync = [];
  const diagnostics = {
    applied: true,
    version: VERSION,
    sector: options.sector || root.userData?.sectorId || null,
    visited: 0,
    meshes: 0,
    changedMeshes: 0,
    changedMaterials: 0,
    clonedMaterials: 0,
    skipped: 0,
    skippedSubtrees: 0,
    preservedCues: 0,
    materialSyncScheduled: false,
    materialSyncPending: 0,
    roles: {},
  };

  const visit = (node, inheritedSkip = false, inheritedCue = false) => {
    diagnostics.visited += 1;
    const excluded = inheritedSkip || exclude.has(node) || hasActorMarker(node);
    if (excluded) {
      diagnostics.skipped += 1;
      if (node !== root) diagnostics.skippedSubtrees += 1;
      return;
    }
    const cue = inheritedCue || isCue(node, options);
    const surfaceObject = node.isMesh || node.isLine || node.isLineSegments;
    if (surfaceObject && node.material) {
      diagnostics.meshes += 1;
      const sourceMaterials = Array.isArray(node.material) ? node.material : [node.material];
      const nextMaterials = sourceMaterials.slice();
      let meshChanged = false;
      const lineObject = !!(node.isLine || node.isLineSegments);
      sourceMaterials.forEach((source, index) => {
        const role = resolveRole(node, source, options);
        if (!role) return;
        const preserve = cue;
        const key = cacheKey(source, role, preserve);
        let replacement = materialCache.get(key);
        if (!replacement) {
          replacement = styleMaterial(source, role, preserve, options, pendingMaterialSync, lineObject);
          if (replacement) {
            materialCache.set(key, replacement);
            diagnostics.clonedMaterials += replacement !== source ? 1 : 0;
            diagnostics.changedMaterials += 1;
          }
        }
        if (!replacement) return;
        nextMaterials[index] = replacement;
        if (replacement !== source) meshChanged = true;
        diagnostics.roles[role] = (diagnostics.roles[role] || 0) + 1;
        if (preserve) diagnostics.preservedCues += 1;
      });
      if (meshChanged) {
        node.material = Array.isArray(node.material) ? nextMaterials : nextMaterials[0];
        diagnostics.changedMeshes += 1;
      }
    }
    for (const child of node.children || []) visit(child, false, cue);
  };
  visit(root);
  scheduleMaterialSync(root, pendingMaterialSync, diagnostics, options);
  root.userData.afterlifeSurfacesApplied = true;
  root.userData.afterlifeSurfaceDiagnostics = diagnostics;
  return { ...diagnostics };
}

export default applyAfterlifeSurfaces;
