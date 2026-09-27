import * as THREE from './vendor/three.module.js';

const cavityMaterial = new THREE.MeshBasicMaterial({ color: 0x080405, side: THREE.DoubleSide });
const lipMaterial = new THREE.MeshBasicMaterial({ color: 0x4b171b, side: THREE.DoubleSide });
const toothMaterial = new THREE.MeshBasicMaterial({ color: 0x9b877b, side: THREE.DoubleSide });
for (const material of [cavityMaterial, lipMaterial, toothMaterial]) material.userData.sharedLibrary = true;

function shapeMesh(name, points, material, z) {
  const shape = new THREE.Shape();
  shape.moveTo(...points[0]);
  for (const point of points.slice(1)) shape.lineTo(...point);
  shape.closePath();
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  mesh.name = name;
  mesh.position.z = z;
  mesh.castShadow = false;
  return mesh;
}

export function createScreamMouth(parent) {
  const mouth = new THREE.Group();
  mouth.name = 'ScreamDrivenMouth';
  parent.add(mouth);

  // A pointed, asymmetric opening follows the upper lip and narrows into the jaw.
  // Separate skin edges make the aperture read as a torn face instead of a ring.
  const cavity = shapeMesh('MouthCavity', [
    [-.053, .012], [-.042, .027], [-.019, .022], [0, .009],
    [.018, .025], [.046, .027], [.055, .008], [.048, -.031],
    [.026, -.063], [0, -.079], [-.023, -.068], [-.049, -.034],
  ], cavityMaterial, -.003);
  const upperLip = shapeMesh('SplitUpperLip', [
    [-.061, .016], [-.048, .034], [-.022, .032], [0, .017],
    [.019, .035], [.05, .034], [.063, .011], [.049, .009],
    [.022, .014], [0, .003], [-.024, .012], [-.049, .008],
  ], lipMaterial, -.006);
  const jaw = shapeMesh('LowerJaw', [
    [-.055, -.018], [-.045, -.046], [-.024, -.07], [0, -.083],
    [.025, -.068], [.051, -.039], [.055, -.018], [.064, -.056],
    [.037, -.091], [0, -.105], [-.035, -.096], [-.061, -.059],
  ], lipMaterial, -.006);
  mouth.add(cavity, upperLip, jaw);

  for (const [x, tip] of [[-.033, -.011], [-.012, -.018], [.014, -.016], [.035, -.009]]) {
    mouth.add(shapeMesh('UnevenUpperTooth', [
      [x - .006, .008], [x + .005, .008], [x + .002, tip],
    ], toothMaterial, -.008));
  }
  mouth.visible = false;
  return { mouth, cavity, jaw };
}

export function setScreamMouthOpen(rig, level) {
  const open = THREE.MathUtils.clamp(level, 0, 1);
  rig.cavity.scale.y = .13 + open * .87;
  rig.jaw.scale.y = .13 + open * .87;
  rig.jaw.position.y = -.009 * open;
}
