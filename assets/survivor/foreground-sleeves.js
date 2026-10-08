import * as THREE from '../../vendor/three.module.js';

const DOWN = new THREE.Vector3(0, -1, 0);
const IDENTITY = new THREE.Quaternion();
const smooth = t => t * t * (3 - 2 * t);

// Keep the imported garment and its material/UVs. Only the owned foreground
// copy bends: its joint centres and metric reach remain the rig's authority.
export function createSleeveBend(pivot, length) {
  pivot.updateWorldMatrix(true, true);
  const inverse = pivot.matrixWorld.clone().invert(), surfaces = [];
  pivot.traverse(mesh => {
    if (!mesh.isMesh) return;
    const toPivot = inverse.clone().multiply(mesh.matrixWorld);
    const fromPivot = toPivot.clone().invert();
    surfaces.push({geometry: mesh.geometry, positions: mesh.geometry.attributes.position.array.slice(),
      normals: mesh.geometry.attributes.normal.array.slice(), toPivot, fromPivot,
      normalToPivot: new THREE.Matrix3().getNormalMatrix(toPivot),
      normalFromPivot: new THREE.Matrix3().getNormalMatrix(fromPivot)});
    mesh.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
    mesh.geometry.attributes.normal.setUsage(THREE.DynamicDrawUsage);
    // The small joint bend can leave the original straight garment bounds.
    mesh.frustumCulled = false;
  });
  return {pivot, length, surfaces, start: new THREE.Quaternion(), end: new THREE.Quaternion(),
    startDirection: new THREE.Vector3(), endDirection: new THREE.Vector3(),
    rotation: new THREE.Quaternion(), inverse: new THREE.Quaternion(), point: new THREE.Vector3(),
    normal: new THREE.Vector3(), centre: new THREE.Vector3(), lastStart: new THREE.Quaternion(0,0,0,0),
    lastEnd: new THREE.Quaternion(0,0,0,0)};
}

export function bendSleeve(state, startFrame, endFrame) {
  state.inverse.copy(state.pivot.quaternion).invert();
  state.start.copy(state.inverse).multiply(startFrame);
  state.end.copy(state.inverse).multiply(endFrame);
  if (Math.abs(state.start.dot(state.lastStart)) > 1 - 1e-9 &&
      Math.abs(state.end.dot(state.lastEnd)) > 1 - 1e-9) return;
  state.lastStart.copy(state.start); state.lastEnd.copy(state.end);
  state.startDirection.copy(DOWN).applyQuaternion(state.start).sub(DOWN);
  state.endDirection.copy(DOWN).applyQuaternion(state.end).sub(DOWN);
  const {length, point, normal, rotation, centre} = state;
  for (const surface of state.surfaces) {
    const position = surface.geometry.attributes.position, normals = surface.geometry.attributes.normal;
    for (let i = 0; i < position.count; i++) {
      point.fromArray(surface.positions, i * 3).applyMatrix4(surface.toPivot);
      const y = point.y;
      // Bend only the joint transitions. Bowing the whole forearm routes its
      // middle through wide receivers (especially the chainsaw housing).
      const span = Math.min(.09, length * .3), start = THREE.MathUtils.clamp(-y / span, 0, 1);
      const end = THREE.MathUtils.clamp((length + y) / span, 0, 1);
      centre.set(0, y, 0)
        .addScaledVector(state.startDirection, span * start * (1 - start) ** 2)
        .addScaledVector(state.endDirection, -span * end * (1 - end) ** 2);
      if (start < 1) rotation.copy(state.start).slerp(IDENTITY, smooth(start));
      else rotation.copy(IDENTITY).slerp(state.end, 1 - smooth(end));
      point.y = 0;
      point.applyQuaternion(rotation).add(centre).applyMatrix4(surface.fromPivot);
      position.setXYZ(i, point.x, point.y, point.z);
      normal.fromArray(surface.normals, i * 3).applyMatrix3(surface.normalToPivot)
        .applyQuaternion(rotation).applyMatrix3(surface.normalFromPivot).normalize();
      normals.setXYZ(i, normal.x, normal.y, normal.z);
    }
    position.needsUpdate = normals.needsUpdate = true;
  }
}
