import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';

// First-person weapons are authored as semantic groups because their recoil,
// heat, inspection, and muzzle sockets are animated after construction.  This
// helper compacts only sibling surfaces inside those groups.  It never hoists
// a mesh through a group, so a pivot keeps the same object identity and local
// animation contract.

const PROTECTED_USER_DATA = [
  'keepSeparate', 'preserveObject', 'weaponBatchIgnore', 'weaponDynamic',
  'animated', 'dynamic', 'pooled', 'smokeSize'
];

function hasProtectedAncestor(node, root) {
  for (let current = node; current; current = current.parent) {
    const data = current.userData || {};
    if (data.weaponMechanism) return true;
    if (data.weaponBatchIgnore || data.keepSeparate || data.preserveObject || data.pooled || data.weaponDynamic || data.dynamic || data.animated) return true;
    if (current === root) break;
  }
  return false;
}

function isProtectedMesh(mesh, root, options) {
  if (!mesh?.isMesh || !mesh.geometry || !mesh.material) return true;
  if (mesh.isSkinnedMesh || mesh.isInstancedMesh || mesh.isBatchedMesh) return true;
  if (Array.isArray(mesh.material)) return true;
  if (hasProtectedAncestor(mesh, root)) return true;
  const data = mesh.userData || {};
  if (PROTECTED_USER_DATA.some(key => data[key])) return true;
  if (typeof options.shouldBatch === 'function' && !options.shouldBatch(mesh, mesh.parent)) return true;
  return false;
}

function isWholeDrawRange(geometry) {
  const range = geometry.drawRange;
  if (!range || range.start !== 0) return false;
  const count = geometry.index?.count ?? geometry.attributes.position?.count ?? 0;
  return range.count === Infinity || range.count === count;
}

function attributeSignature(geometry) {
  return Object.keys(geometry.attributes).sort().map(name => {
    const attribute = geometry.attributes[name];
    return [
      name,
      attribute.itemSize,
      attribute.normalized ? 1 : 0,
      attribute.array?.constructor?.name || '',
      attribute.gpuType ?? ''
    ].join(':');
  }).join('|');
}

function canBatchMesh(mesh, root, options) {
  if (isProtectedMesh(mesh, root, options)) return false;
  const geometry = mesh.geometry;
  const material = mesh.material;
  // Transparent and additive surfaces depend on draw order and self-depth.
  // Keep muzzle, glass, heat haze, smoke, and other effects as authored.
  if (material.transparent || material.opacity < .999 || material.blending !== THREE.NormalBlending || material.depthWrite === false) return false;
  if (!geometry.attributes?.position || !isWholeDrawRange(geometry)) return false;
  // A single-material Box/Extrude geometry may contain groups for its faces.
  // The material-array guard above already excludes true multi-material draws,
  // so flattening same-material groups is safe and keeps the authored surface.
  if (Object.keys(geometry.morphAttributes || {}).length) return false;
  if (mesh.morphTargetInfluences || mesh.morphTargetDictionary) return false;
  return true;
}

function visualState(mesh) {
  return [
    mesh.visible,
    mesh.renderOrder,
    mesh.frustumCulled,
    mesh.castShadow,
    mesh.receiveShadow,
    mesh.layers?.mask ?? 1,
    mesh.onBeforeRender,
    mesh.onAfterRender,
  ];
}

function excludedNode(node, root, options) {
  const list = options.preserve || options.exclude || [];
  if (typeof list === 'function' && list(node)) return true;
  if ((Array.isArray(list) || list instanceof Set) && [...list].some(value => value === node || value === node.name)) return true;
  return hasProtectedAncestor(node, root);
}

function copyDrawState(target, source) {
  target.visible = source.visible;
  target.renderOrder = source.renderOrder;
  target.frustumCulled = source.frustumCulled;
  target.castShadow = source.castShadow;
  target.receiveShadow = source.receiveShadow;
  target.layers.mask = source.layers.mask;
  target.onBeforeRender = source.onBeforeRender;
  target.onAfterRender = source.onAfterRender;
}

function sourceGeometry(mesh) {
  const original = mesh.geometry;
  const geometry = original.index ? original.toNonIndexed() : original.clone();
  if (mesh.matrixAutoUpdate) mesh.updateMatrix();
  // updateMatrix() may be needed for normal meshes, but use the resulting local
  // matrix only.  Parent transforms stay on the semantic pivot.
  geometry.applyMatrix4(mesh.matrix);
  return {geometry, original};
}

function disposeIfUnique(geometry, usage) {
  if (!geometry || geometry.userData?.sharedAsset) return;
  const remaining = Math.max(0, (usage.get(geometry) || 1) - 1);
  usage.set(geometry, remaining);
  if (remaining === 0) geometry.dispose();
}

function createBucket(buckets, mesh) {
  let byMaterial = buckets.get(mesh.material);
  if (!byMaterial) {
    byMaterial = [];
    buckets.set(mesh.material, byMaterial);
  }
  const state = visualState(mesh);
  let bucket = byMaterial.find(candidate => {
    if (candidate.attributes !== attributeSignature(mesh.geometry)) return false;
    for (let i = 0; i < state.length; i++) if (candidate.state[i] !== state[i]) return false;
    return true;
  });
  if (!bucket) {
    bucket = {material: mesh.material, attributes: attributeSignature(mesh.geometry), state, meshes: []};
    byMaterial.push(bucket);
  }
  bucket.meshes.push(mesh);
}

/**
 * Merge static same-material sibling meshes while retaining every parent
 * group.  The return value is useful for measured draw-call reports.
 *
 * `preserve`/`exclude` accepts object references, names, or a predicate.  A
 * tagged `weaponMechanism` or pooled effect is protected automatically.  Call
 * this before installing a shared depth hook, or call it after the hook: the
 * hook is copied only when every source in a batch shares the same function.
 */
export function batchStaticWeaponMeshes(root, options = {}) {
  if (!root?.traverse) return {root, parents: 0, groups: 0, meshesBefore: 0, meshesAfter: 0, mergedMeshes: 0, mergedSources: 0};

  const nodes = [];
  const usage = new Map();
  let meshesBefore = 0;
  root.traverse(node => {
    nodes.push(node);
    if (node.isMesh) {
      meshesBefore++;
      usage.set(node.geometry, (usage.get(node.geometry) || 0) + 1);
    }
  });

  let parents = 0;
  let groups = 0;
  let mergedSources = 0;
  const minMeshes = Math.max(2, Number(options.minMeshes) || 2);

  for (const parent of nodes) {
    if (!parent.children?.length || excludedNode(parent, root, options)) continue;
    const candidates = parent.children.filter(mesh => canBatchMesh(mesh, root, options));
    if (candidates.length < minMeshes) continue;

    const buckets = new Map();
    for (const mesh of candidates) createBucket(buckets, mesh);
    const mergeable = [...buckets.values()].flatMap(materialBuckets => materialBuckets.filter(bucket => bucket.meshes.length >= minMeshes));
    if (!mergeable.length) continue;

    parents++;
    for (const bucket of mergeable) {
      const sources = [];
      for (const mesh of bucket.meshes) {
        const source = sourceGeometry(mesh);
        sources.push(source.geometry);
      }
      const merged = mergeGeometries(sources, false);
      if (!merged) {
        for (const source of sources) source.dispose();
        continue;
      }
      merged.computeBoundingBox();
      merged.computeBoundingSphere();

      const first = bucket.meshes[0];
      const batched = new THREE.Mesh(merged, bucket.material);
      const suffix = bucket.material.uuid ? bucket.material.uuid.slice(-8) : 'material';
      batched.name = `${parent.name || 'weapon-part'}-batch-${suffix}`;
      copyDrawState(batched, first);
      batched.userData.explodeWithParent = bucket.meshes.every(mesh => mesh.userData?.explodeWithParent !== false);
      batched.userData.weaponBatch = {
        sourceCount: bucket.meshes.length,
        sourceNames: bucket.meshes.map(mesh => mesh.name),
        parentName: parent.name || '',
      };

      for (const mesh of bucket.meshes) {
        parent.remove(mesh);
        disposeIfUnique(mesh.geometry, usage);
        mergedSources++;
      }
      for (const source of sources) source.dispose();
      parent.add(batched);
      groups++;
    }
  }

  let meshesAfter = 0;
  root.traverse(node => { if (node.isMesh) meshesAfter++; });
  return {root, parents, groups, meshesBefore, meshesAfter, mergedMeshes: groups, mergedSources};
}

export const weaponBatchingContract = Object.freeze({
  preservesParentPivots: true,
  preservesMaterialIdentity: true,
  protectsTaggedMechanisms: true,
  protectsPooledEffects: true,
});
