import * as THREE from './vendor/three.module.js';

const ACTIVE = new WeakMap();
const NAMES = ['TissueSag', 'BendLeft', 'BendRight'];
const MAX_DISPLACEMENT = .025;
const ANCHOR_BAND = .12;

const finite = value => Number.isFinite(value) ? value : 0;
const clamp = (value, low, high) => Math.max(low, Math.min(high, finite(value)));
const snapshot = (object, key) => ({own: Object.hasOwn(object, key), value: object[key]});
function restore(object, key, saved) {
  if (saved.own) object[key] = saved.value;
  else delete object[key];
}

function relativeAttribute(attribute, base, count, name) {
  const width = attribute?.itemSize || base.itemSize;
  const data = new Float32Array(count * width);
  if (attribute) {
    if (attribute.count !== count || width !== base.itemSize) throw new Error('Incompatible existing morph attribute');
    for (let i = 0; i < count; i++) for (let channel = 0; channel < width; channel++) {
      data[i * width + channel] = attribute.getComponent(i, channel) - base.getComponent(i, channel);
    }
  }
  const result = new THREE.Float32BufferAttribute(data, width);
  result.name = attribute?.name || name;
  return result;
}

/**
 * Adds bounded, local authored compliance to an existing mesh. This is an
 * anchor-preserving morph field, not collision-aware or volume-conserving physics.
 * Geometry coordinates and sag/bend options are in the mesh's local metre frame.
 */
export function addSoftTissueCompliance(mesh, {axis, anchorEnd = 'max', sag = .025, bend = .012} = {}) {
  if (!mesh?.isMesh || !mesh.geometry?.attributes.position) throw new TypeError('A mesh with positions is required');
  if (ACTIVE.has(mesh)) throw new Error('Soft tissue compliance is already active on this mesh');
  if (axis !== undefined && axis !== 'y' && axis !== 'z') throw new RangeError('axis must be y or z');
  if (anchorEnd !== 'min' && anchorEnd !== 'max') throw new RangeError('anchorEnd must be min or max');

  const source = mesh.geometry;
  const saved = {};
  for (const key of ['geometry', 'morphTargetInfluences', 'morphTargetDictionary', 'morphTexture', 'boundingBox', 'boundingSphere']) {
    saved[key] = snapshot(mesh, key);
  }
  const baseBox = new THREE.Box3().setFromBufferAttribute(source.attributes.position);
  if (![...baseBox.min, ...baseBox.max].every(Number.isFinite)) throw new RangeError('Tissue positions must be finite');
  const size = baseBox.getSize(new THREE.Vector3());
  axis ||= size.y >= size.z ? 'y' : 'z';
  const axisIndex = axis === 'y' ? 1 : 2;
  const length = size[axis];
  if (!Number.isFinite(length) || length < 1e-6) throw new RangeError('The compliance axis has no finite extent');
  const amplitudes = {
    sag: Math.min(clamp(sag, 0, MAX_DISPLACEMENT), length * .25),
    bend: Math.min(clamp(bend, 0, MAX_DISPLACEMENT), length * .25)
  };
  const oldMorphs = source.morphAttributes;
  let oldCount = saved.morphTargetInfluences.value?.length || 0;
  for (const attributes of Object.values(oldMorphs)) oldCount = Math.max(oldCount, attributes.length);
  for (const index of Object.values(saved.morphTargetDictionary.value || {})) oldCount = Math.max(oldCount, index + 1);
  const originalTexture = saved.morphTexture.value;
  if (mesh.isInstancedMesh && originalTexture) oldCount = Math.max(oldCount, originalTexture.source.data.width - 1);
  const dictionary = {...saved.morphTargetDictionary.value};
  if (NAMES.some(name => Object.hasOwn(dictionary, name))) throw new Error('Compliance target name already exists');
  for (let i = 0; i < oldCount; i++) {
    if (!Object.values(dictionary).includes(i)) dictionary[oldMorphs.position?.[i]?.name || String(i)] = i;
  }
  for (let i = 0; i < NAMES.length; i++) dictionary[NAMES[i]] = oldCount + i;

  // Base/index/UV/custom attributes are cloned once, with their original bytes.
  // Absolute source morphs become equivalent relative deltas on this owned copy.
  const geometry = source.clone();
  delete geometry.userData.sharedAsset;
  geometry.userData.softTissueSourceGeometry = source.uuid;
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const position = geometry.attributes.position, normal = geometry.attributes.normal;
  const vertexCount = position.count;
  try {
    for (const [semantic, attributes] of Object.entries(oldMorphs)) {
      const base = geometry.attributes[semantic];
      if (!base) throw new Error('An existing morph has no matching base attribute');
      geometry.morphAttributes[semantic] = [];
      for (let i = 0; i < oldCount; i++) {
        let attribute;
        // Missing attributes are zero deltas, including relative source targets.
        if (!attributes[i]) attribute = new THREE.Float32BufferAttribute(new Float32Array(vertexCount * base.itemSize), base.itemSize);
        else if (source.morphTargetsRelative) attribute = attributes[i].clone();
        else attribute = relativeAttribute(attributes[i], base, vertexCount, String(i));
        geometry.morphAttributes[semantic].push(attribute);
      }
    }
    for (const semantic of ['position', 'normal']) {
      geometry.morphAttributes[semantic] ||= [];
      while (geometry.morphAttributes[semantic].length < oldCount) {
        geometry.morphAttributes[semantic].push(new THREE.Float32BufferAttribute(new Float32Array(vertexCount * 3), 3));
      }
    }
    const directions = [[0, -amplitudes.sag, 0], [-amplitudes.bend, 0, 0], [amplitudes.bend, 0, 0]];
    for (let target = 0; target < NAMES.length; target++) {
      const deltaPosition = new Float32Array(vertexCount * 3), deltaNormal = new Float32Array(vertexCount * 3);
      const direction = directions[target];
      for (let i = 0; i < vertexCount; i++) {
        const coordinate = position.getComponent(i, axisIndex);
        const distance = anchorEnd === 'min' ? coordinate - baseBox.min[axis] : baseBox.max[axis] - coordinate;
        const u = clamp((distance / length - ANCHOR_BAND) / (1 - ANCHOR_BAND), 0, 1);
        if (u === 0) continue; // Keep both anchor positions and normals exact.
        const field = u * u * (3 - 2 * u);
        const derivative = 6 * u * (1 - u) / (length * (1 - ANCHOR_BAND)) * (anchorEnd === 'min' ? 1 : -1);
        const n = [normal.getX(i), normal.getY(i), normal.getZ(i)];
        if (!n.every(Number.isFinite) || !Number.isFinite(coordinate)) throw new Error('Nonfinite source tissue attributes');
        const dot = direction[0] * n[0] + direction[1] * n[1] + direction[2] * n[2];
        const divisor = 1 + derivative * direction[axisIndex];
        const adjusted = n.slice();
        // Inverse-transpose Jacobian of p + direction * field(p_axis).
        adjusted[axisIndex] -= derivative * dot / divisor;
        const normalLength = Math.hypot(...adjusted);
        if (normalLength < 1e-8 || divisor <= .5) throw new Error('Invalid source normals or compliance derivative');
        for (let channel = 0; channel < 3; channel++) {
          deltaPosition[i * 3 + channel] = direction[channel] * field;
          deltaNormal[i * 3 + channel] = adjusted[channel] / normalLength - n[channel];
        }
      }
      for (const [semantic, data] of [['position', deltaPosition], ['normal', deltaNormal]]) {
        const attribute = new THREE.Float32BufferAttribute(data, 3);
        attribute.name = NAMES[target];
        geometry.morphAttributes[semantic].push(attribute);
      }
      for (const semantic of Object.keys(geometry.morphAttributes)) {
        if (semantic !== 'position' && semantic !== 'normal') {
          geometry.morphAttributes[semantic].push(new THREE.Float32BufferAttribute(new Float32Array(vertexCount * geometry.attributes[semantic].itemSize), geometry.attributes[semantic].itemSize));
        }
      }
    }
  } catch (error) {
    geometry.dispose();
    throw error;
  }
  geometry.morphTargetsRelative = true;

  // Conservative once-only envelope for 0..1 existing morphs and the bounded
  // sag/bend combination. No bounding-box work occurs in set().
  const bounds = baseBox.clone();
  for (let i = 0; i < oldCount; i++) {
    const delta = new THREE.Box3().setFromBufferAttribute(geometry.morphAttributes.position[i]);
    bounds.min.x += Math.min(0, delta.min.x); bounds.max.x += Math.max(0, delta.max.x);
    bounds.min.y += Math.min(0, delta.min.y); bounds.max.y += Math.max(0, delta.max.y);
    bounds.min.z += Math.min(0, delta.min.z); bounds.max.z += Math.max(0, delta.max.z);
  }
  bounds.min.x -= amplitudes.bend; bounds.max.x += amplitudes.bend;
  bounds.min.y -= amplitudes.sag;
  geometry.boundingBox = bounds;
  geometry.boundingSphere = bounds.getBoundingSphere(new THREE.Sphere());

  const influences = new Array(oldCount + NAMES.length).fill(0);
  for (let i = 0; i < oldCount; i++) influences[i] = saved.morphTargetInfluences.value?.[i] || 0;
  const instanced = mesh.isInstancedMesh === true;
  const perInstance = instanced && typeof mesh.setMorphAt === 'function' && typeof mesh.getMorphAt === 'function';
  const capacity = instanced ? mesh.instanceMatrix.count : 1;
  if (!Number.isInteger(capacity) || capacity < 1) { geometry.dispose(); throw new RangeError('Instance pool must have nonzero capacity'); }
  const holder = {morphTargetInfluences: new Float32Array(influences.length)};
  let ownedTexture = null, disposed = false;
  try {
    mesh.geometry = geometry;
    mesh.morphTargetInfluences = influences;
    mesh.morphTargetDictionary = dictionary;
    if (instanced) {
    mesh.boundingBox = null; mesh.boundingSphere = null;
    // Native setMorphAt allocates by mesh.count, which may be zero for a hidden
    // pool. Temporarily initialize at capacity and restore its active count.
    mesh.morphTexture = null;
    if (perInstance) {
      const activeCount = mesh.count;
      try {
        mesh.count = capacity;
        for (let index = 0; index < capacity; index++) {
          holder.morphTargetInfluences.fill(0);
          for (let i = 0; i < oldCount; i++) {
            const image = originalTexture?.source.data;
            holder.morphTargetInfluences[i] = image && index < image.height && i < image.width - 1 ? image.data[index * image.width + i + 1] || 0 : influences[i];
          }
          mesh.setMorphAt(index, holder);
        }
        ownedTexture = mesh.morphTexture;
        ownedTexture.needsUpdate = true;
      } finally {
        mesh.count = activeCount;
      }
    }
    }
  } catch (error) {
    const failedTexture = mesh.morphTexture;
    for (const [key, value] of Object.entries(saved)) restore(mesh, key, value);
    geometry.dispose();
    if (failedTexture && failedTexture !== originalTexture) failedTexture.dispose();
    throw error;
  }

  const rig = {
    mesh, ownedGeometry: geometry, status: 'ready',
    controls: {TissueSag: oldCount, BendLeft: oldCount + 1, BendRight: oldCount + 2},
    diagnostics: {axis, anchorEnd, anchorBand: ANCHOR_BAND, lengthMeters: length, amplitudesMeters: amplitudes,
      maximumCombinedDisplacementMeters: MAX_DISPLACEMENT, vertexCount, oldMorphCount: oldCount, capacity,
      instanceMode: perInstance ? 'native-per-instance-morph-texture' : instanced ? 'shared-pool-weights' : 'mesh-weights',
      baseBounds: baseBox.clone(), expandedBounds: bounds.clone(), boundAssumption: 'Existing morph weights are between zero and one.',
      simulation: 'Bounded authored local morph compliance; no softbody collision or measured volume conservation.'},
    set(state, instanceIndex) {
      if (disposed) return rig;
      let sagWeight = clamp(state?.sag, 0, 1), bendWeight = clamp(state?.bend, -1, 1);
      const distance = Math.hypot(sagWeight * amplitudes.sag, bendWeight * amplitudes.bend);
      if (distance > MAX_DISPLACEMENT) {
        const scale = MAX_DISPLACEMENT / distance;
        sagWeight *= scale; bendWeight *= scale;
      }
      if (instanceIndex !== undefined && (!Number.isInteger(instanceIndex) || instanceIndex < 0 || instanceIndex >= capacity)) {
        throw new RangeError('Instance index exceeds the initialized pool capacity');
      }
      if (perInstance) {
        const start = instanceIndex === undefined ? 0 : instanceIndex;
        const end = instanceIndex === undefined ? capacity : instanceIndex + 1;
        for (let index = start; index < end; index++) {
          mesh.getMorphAt(index, holder);
          holder.morphTargetInfluences[oldCount] = sagWeight;
          holder.morphTargetInfluences[oldCount + 1] = Math.max(0, -bendWeight);
          holder.morphTargetInfluences[oldCount + 2] = Math.max(0, bendWeight);
          mesh.setMorphAt(index, holder);
        }
        ownedTexture.needsUpdate = true;
      }
      if (!perInstance || instanceIndex === undefined) {
        influences[oldCount] = sagWeight;
        influences[oldCount + 1] = Math.max(0, -bendWeight);
        influences[oldCount + 2] = Math.max(0, bendWeight);
      }
      return rig;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      rig.status = 'disposed';
      for (const [key, value] of Object.entries(saved)) restore(mesh, key, value);
      geometry.dispose();
      ownedTexture?.dispose();
      if (ACTIVE.get(mesh) === rig) ACTIVE.delete(mesh);
    }
  };
  ACTIVE.set(mesh, rig);
  return rig;
}
