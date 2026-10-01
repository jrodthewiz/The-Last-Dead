import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createExtractionAnatomy } from '../extraction-anatomy.js';

function validateGeometry(geometry) {
  const { position, normal, uv, color, tissueRegion } = geometry.attributes;
  assert(position && normal && uv && color && tissueRegion);
  assert.equal(normal.count, position.count);
  assert.equal(uv.count, position.count);
  assert.equal(color.count, position.count);
  assert.equal(tissueRegion.count, position.count);
  assert.equal(tissueRegion.itemSize, 1);
  for (const attribute of [position, normal, uv, color, tissueRegion]) for (const value of attribute.array) assert(Number.isFinite(value));
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < normal.count; i++) {
    a.fromBufferAttribute(normal, i);
    assert(Math.abs(a.length() - 1) < 1e-5, 'authored normals must be unit length');
  }
  for (let i = 0; i < geometry.index.count; i += 3) {
    a.fromBufferAttribute(position, geometry.index.getX(i));
    b.fromBufferAttribute(position, geometry.index.getX(i + 1));
    c.fromBufferAttribute(position, geometry.index.getX(i + 2));
    assert(b.sub(a).cross(c.sub(a)).lengthSq() > 1e-18, 'triangle must retain nonzero area');
  }
  assert(geometry.boundingBox && geometry.boundingSphere);
  assert(Number.isFinite(geometry.boundingSphere.radius));
}

function enclosedVolume(geometry, side = 0) {
  const position = geometry.attributes.position, index = geometry.index;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let volume = 0;
  const bounds = new THREE.Box3();
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(position, index.getX(i));
    b.fromBufferAttribute(position, index.getX(i + 1));
    c.fromBufferAttribute(position, index.getX(i + 2));
    if (side && Math.sign(a.x + b.x + c.x) !== side) continue;
    bounds.expandByPoint(a); bounds.expandByPoint(b); bounds.expandByPoint(c);
    volume += a.dot(b.cross(c)) / 6;
  }
  return { volume, size: bounds.getSize(new THREE.Vector3()) };
}

test('heart and paired lungs enclose anatomically sized volumes with outward triangle winding', () => {
  for (const seed of [1, 23, 817]) {
    const anatomy = createExtractionAnatomy(seed);
    const heart = enclosedVolume(anatomy.heart.children[0].geometry);
    // Positive signed volume catches inverted winding, while the lower bound
    // catches longitudinal rings accidentally emitted without their sin/cos.
    assert(heart.volume > .00012 && heart.volume < .00022);
    assert(heart.size.x > .06 && heart.size.y > .09 && heart.size.z > .045);
    const lungs = anatomy.root.getObjectByName('PairedLobulatedLungs').geometry;
    for (const side of [-1, 1]) {
      const lung = enclosedVolume(lungs, side);
      assert(lung.volume > .0004 && lung.volume < .0007);
      assert(lung.size.x > .075 && lung.size.y > .16 && lung.size.z > .055);
    }
    anatomy.dispose();
  }
});

test('procedural harvest anatomy has named organs, finite authored surfaces and bounded rendering cost', () => {
  for (const seed of [1, 23, 817]) {
    const anatomy = createExtractionAnatomy(seed);
    anatomy.setOpening(1);
    const report = anatomy.diagnostics();
    assert(report.triangles <= 10000);
    assert(report.draws <= 18);
    assert(report.materials >= 4 && report.materials <= 6);
    assert.equal(report.coilPoints, 30);
    assert(report.coilLength > 1 && report.coilLength < 1.4);
    for (const name of ['LobedHeartAndGreatVessels', 'PairedLobulatedLungs', 'RightUpperLiver', 'LeftUpperStomach', 'PosteriorKidneys', 'HaustratedColon', 'ContinuousSmallIntestine', 'SplitSternumAndRibArcs', 'DeepThoracicCavity', 'TornFleshWoundRim']) assert(anatomy.root.getObjectByName(name), name);
    anatomy.root.traverse(node => {
      if (!node.isMesh) return;
      validateGeometry(node.geometry);
      assert(node.material.isMeshStandardMaterial);
      assert.equal(node.material.emissive.getHex(), 0);
      assert(node.material.roughness >= .32 && node.material.roughness <= .55);
    });
    anatomy.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(anatomy.root);
    assert(bounds.min.x >= -.17 && bounds.max.x <= .17);
    assert(bounds.min.y >= -.24 && bounds.max.y <= .22);
    assert(bounds.min.z >= -.09 && bounds.max.z <= .055);
    assert(anatomy.heart.isGroup);
    assert.deepEqual(anatomy.heart.position.toArray(), [-.04, .095, .025]);
    anatomy.dispose();
  }
});

test('curved thorax ribs taper into open front ends and the backing remains a deep irregular bowl', () => {
  const anatomy = createExtractionAnatomy(23);
  const ribs = anatomy.root.getObjectByName('SplitSternumAndRibArcs').geometry;
  assert(ribs.boundingBox.max.z - ribs.boundingBox.min.z > .095, 'ribs must wrap through thorax depth');
  const p = ribs.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) < .16 && p.getZ(i) > 0) assert(Math.abs(p.getX(i)) > .065, 'anterior rib ends must leave the heart region open');
  }
  const firstCenter = new THREE.Vector3(), endCenter = new THREE.Vector3(), vertex = new THREE.Vector3();
  // Six unique radial samples per ring, then the duplicated UV seam.
  for (let i = 0; i < 6; i++) { firstCenter.add(vertex.fromBufferAttribute(p, i)); endCenter.add(vertex.fromBufferAttribute(p, 56 + i)); }
  firstCenter.divideScalar(6); endCenter.divideScalar(6);
  const startRadius = vertex.fromBufferAttribute(p, 0).distanceTo(firstCenter), endRadius = vertex.fromBufferAttribute(p, 56).distanceTo(endCenter);
  assert(startRadius > .003 && startRadius < .005);
  assert(endRadius > .002 && endRadius < startRadius * .8, 'front bone tips should taper');
  const cavity = anatomy.root.getObjectByName('DeepThoracicCavity').geometry;
  assert(cavity.boundingBox.min.z < -.088);
  assert(cavity.boundingBox.max.z - cavity.boundingBox.min.z > .06, 'cavity must curve up toward the torn rim');
  assert(anatomy.root.getObjectByName('PosteriorKidneys').geometry.boundingBox.max.z < -.04);
  assert(anatomy.intestines.geometry.boundingBox.max.z > .035, 'gut sits in front of the recessed posterior organs');
  anatomy.dispose();
});

test('every anatomy mesh exposes stable semantic regions for the tissue atlas', () => {
  const anatomy = createExtractionAnatomy(18);
  const expected = {
    LobedHeartAndGreatVessels: 0, PairedLobulatedLungs: 2, RightUpperLiver: 2,
    LeftUpperStomach: 1, PosteriorKidneys: 1, Spleen: 1, HaustratedColon: 1,
    ContinuousSmallIntestine: 1, SplitSternumAndRibArcs: 3, DeepThoracicCavity: 0,
    TornFleshWoundRim: 0, LeftTornSkinFlap: 0, RightTornSkinFlap: 0,
  };
  for (const [name, region] of Object.entries(expected)) {
    const node = anatomy.root.getObjectByName(name), values = node.geometry.attributes.tissueRegion;
    assert.equal(node.userData.tissueRegion, region);
    assert(values.array.every(value => value === region));
    if (!/Rim|Colon|Intestine|Vessels|Rib/.test(name)) {
      for (const value of node.geometry.attributes.uv.array) assert(value >= 0 && value <= 1);
    }
  }
  const region = anatomy.intestines.geometry.attributes.tissueRegion;
  anatomy.updateIntestines(anatomy.coilPoints.map((p, i) => p.clone().add(new THREE.Vector3(0, -.05 * i / 29, .02))));
  assert.equal(anatomy.intestines.geometry.attributes.tissueRegion, region);
  assert(region.array.every(value => value === 1));
  anatomy.dispose();
});

test('incision opens skin and reveals the full cavity without scaling the organs', () => {
  const anatomy = createExtractionAnatomy(8);
  const interior = anatomy.root.getObjectByName('ExposedViscera');
  const flap = anatomy.root.getObjectByName('LeftTornSkinFlap');
  const closed = flap.geometry.attributes.position.array.slice();
  const heartGeometry = anatomy.heart.children[0].geometry.attributes.position.array.slice();
  assert.equal(interior.visible, false);
  assert.equal(anatomy.opening.progress, 0);
  anatomy.setOpening(.35);
  assert.equal(interior.visible, true);
  assert(anatomy.opening.width > 0 && anatomy.opening.width < .282);
  const halfwayWidth = anatomy.opening.width;
  anatomy.setOpening(1);
  assert(anatomy.opening.width > halfwayWidth);
  assert.equal(anatomy.opening.height, .407);
  assert.notDeepEqual(flap.geometry.attributes.position.array, closed);
  assert.deepEqual(anatomy.heart.children[0].geometry.attributes.position.array, heartGeometry);
  assert.deepEqual(anatomy.root.scale.toArray(), [1, 1, 1]);
  validateGeometry(flap.geometry);
  const positionVersion = flap.geometry.attributes.position.version, normalVersion = flap.geometry.attributes.normal.version;
  anatomy.setOpening(1);
  assert.equal(flap.geometry.attributes.position.version, positionVersion, 'an unchanged opening must skip dynamic uploads');
  assert.equal(flap.geometry.attributes.normal.version, normalVersion, 'an unchanged opening must skip normal rebuilding');
  anatomy.setOpening(-1);
  assert.equal(anatomy.opening.progress, 0);
  anatomy.setOpening(9);
  assert.equal(anatomy.opening.progress, 1);
  anatomy.dispose();
});

test('seeded anatomical variation is deterministic and changes coiling and surface pigment', () => {
  const a = createExtractionAnatomy(481), b = createExtractionAnatomy(481), c = createExtractionAnatomy(482);
  assert.deepEqual(a.coilPoints.map(p => p.toArray()), b.coilPoints.map(p => p.toArray()));
  assert.notDeepEqual(a.coilPoints.map(p => p.toArray()), c.coilPoints.map(p => p.toArray()));
  assert.deepEqual(a.heart.children[0].geometry.attributes.color.array, b.heart.children[0].geometry.attributes.color.array);
  assert.notDeepEqual(a.heart.children[0].geometry.attributes.color.array, c.heart.children[0].geometry.attributes.color.array);
  a.dispose(); b.dispose(); c.dispose();
});

test('physics positions deform a continuous intestine tube while reusing every topology buffer', () => {
  const anatomy = createExtractionAnatomy(71), geometry = anatomy.intestines.geometry;
  const position = geometry.attributes.position, normal = geometry.attributes.normal, uv = geometry.attributes.uv, index = geometry.index;
  const positionArray = position.array, normalArray = normal.array, uvArray = uv.array, indexArray = index.array;
  const before = positionArray.slice();
  const points = anatomy.coilPoints.map((p, i) => p.clone().add(new THREE.Vector3(.06 * i / 29, -.3 * (i / 29) ** 2, .14 * Math.sin(i / 29 * Math.PI))));
  for (let frame = 0; frame < 12; frame++) {
    points.at(-1).y -= .002;
    anatomy.updateIntestines(points);
    assert.equal(geometry.attributes.position, position);
    assert.equal(geometry.attributes.normal, normal);
    assert.equal(geometry.attributes.uv, uv);
    assert.equal(geometry.index, index);
    assert.equal(position.array, positionArray); assert.equal(normal.array, normalArray); assert.equal(uv.array, uvArray); assert.equal(index.array, indexArray);
    validateGeometry(geometry);
  }
  assert.notDeepEqual(positionArray, before);
  assert(geometry.boundingBox.min.y < -.49);
  // Exact duplicated radial seams preserve normals and UV continuity.
  for (let row = 0; row <= 87; row++) {
    const a = row * 9, b = a + 8;
    assert.deepEqual([position.getX(a), position.getY(a), position.getZ(a)], [position.getX(b), position.getY(b), position.getZ(b)]);
    assert.deepEqual([normal.getX(a), normal.getY(a), normal.getZ(a)], [normal.getX(b), normal.getY(b), normal.getZ(b)]);
    assert.equal(uv.getY(a), uv.getY(b));
  }
  assert.throws(() => anatomy.updateIntestines([new THREE.Vector3(NaN, 0, 0), new THREE.Vector3()]), TypeError);
  anatomy.dispose();
});

test('disposing the anatomy releases a heart that has been detached for the rigid-body drop', () => {
  const anatomy = createExtractionAnatomy(13), world = new THREE.Group();
  world.add(anatomy.root); world.updateMatrixWorld(true); world.attach(anatomy.heart);
  const geometry = anatomy.heart.children[0].geometry, material = anatomy.heart.children[0].material;
  let geometryDisposals = 0, materialDisposals = 0;
  geometry.addEventListener('dispose', () => geometryDisposals++);
  material.addEventListener('dispose', () => materialDisposals++);
  anatomy.dispose();
  assert.equal(geometryDisposals, 1);
  assert.equal(materialDisposals, 1);
});
