import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';

// Close-camera "last 10%" pass for the four hero weapons.  The factories own
// their macro silhouette; this pass adds authored, high-frequency construction
// cues (machined plates, fasteners, cables and emissive apertures) so the
// result survives a first-person inspection instead of reading as a box-and-
// cylinder kit.  The whole group is protected from static batching because
// these pieces are deliberate semantic detail, not redundant draw-call noise.

const V = p => new THREE.Vector3(...p);

function tube(points, radii, sides = 10) {
  const curve = new THREE.CatmullRomCurve3(points.map(V));
  return new THREE.TubeGeometry(curve, Math.max(8, points.length * 5), radii[0] || .01, sides, false);
}

function plate(points, depth = .012, bevel = .003) {
  const shape = new THREE.Shape(points.map(p => new THREE.Vector2(...p)));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 2, curveSegments: 10, steps: 1,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

function material(color, roughness, metalness, emissive = 0x000000, intensity = 0) {
  const m = new THREE.MeshPhysicalMaterial({
    color, roughness, metalness, clearcoat: .28, clearcoatRoughness: .2,
    emissive, emissiveIntensity: intensity,
  });
  m.userData.weaponMicroDetail = true;
  return m;
}

function add(group, geometry, mat, position, rotation = [0, 0, 0], scale = [1, 1, 1], name = 'micro-detail') {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.scale.set(...scale);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData.weaponBatchIgnore = true;
  group.add(mesh);
  return mesh;
}

function boltArray(group, positions, mat, radius = .014) {
  const geometry = new THREE.CylinderGeometry(radius, radius, radius * 1.8, 6);
  for (let i = 0; i < positions.length; i++) {
    add(group, geometry, mat, positions[i], [0, Math.PI / 2, 0], [1, 1, 1], `micro-hex-bolt-${i}`);
  }
}

function mergeDetailMeshes(group) {
  const direct = group.children.filter(node => node.isMesh && !node.isInstancedMesh);
  if (direct.length < 2) return;
  const usage = new Map();
  for (const node of direct) usage.set(node.geometry, (usage.get(node.geometry) || 0) + 1);
  const buckets = new Map();
  for (const node of direct) {
    node.updateMatrix();
    const source = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
    source.applyMatrix4(node.matrix);
    const list = buckets.get(node.material) || [];
    list.push({source, node});
    buckets.set(node.material, list);
  }
  for (const [mat, entries] of buckets) {
    const merged = mergeGeometries(entries.map(entry => entry.source), false);
    if (!merged) {
      for (const entry of entries) entry.source.dispose();
      continue;
    }
    for (const entry of entries) {
      group.remove(entry.node);
      entry.source.dispose();
      if ((usage.get(entry.node.geometry) || 0) === 1) entry.node.geometry.dispose();
    }
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = `micro-${group.name}-merged-${mat.uuid.slice(0, 4)}`;
    mesh.userData.weaponBatchIgnore = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
  }
}

function commonRail(group, metal, accent, y, z, width = .18) {
  add(group, plate([[-width, -.026], [width, -.026], [width * .86, .026], [-width * .86, .026]], .014, .003), metal, [0, y, z], [Math.PI / 2, 0, 0], [1, 1, 1], 'micro-machined-rail');
  for (const x of [-width * .72, 0, width * .72]) {
    add(group, new THREE.BoxGeometry(.012, .006, .055), accent, [x, y + .018, z], [0, 0, 0], [1, 1, 1], 'micro-rail-slot');
  }
}

function arcDetails(group, mats) {
  const metal = material(0x7c8d9d, .24, .91);
  const dark = material(0x080e18, .44, .62);
  const accent = material(0xc98b43, .3, .9);
  const glow = material(0x64dfff, .18, .14, 0x1c8cff, 5.5);
  commonRail(group, metal, accent, .275, -.34, .15);
  // Capacitor cages and ceramic insulators turn the flat reactor into a
  // believable high-voltage assembly when the weapon is held close.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const z = -.18 - i * .16;
      add(group, new THREE.CylinderGeometry(.031, .034, .082, 16), dark, [side * .207, .055, z], [Math.PI / 2, 0, 0], [1, 1, 1], 'arc-capacitor-cell');
      add(group, new THREE.TorusGeometry(.036, .006, 8, 24), accent, [side * .207, .055, z - .044], [Math.PI / 2, 0, 0], [1, 1, 1], 'arc-capacitor-collar');
      add(group, new THREE.SphereGeometry(.018, 14, 10), glow, [side * .207, .055, z - .048], [0, 0, 0], [1, 1, 1], 'arc-capacitor-lamp');
    }
    add(group, tube([[side * .29, .17, .28], [side * .31, .03, -.08], [side * .3, .04, -.58], [side * .22, .06, -.95]], [.012], 9), accent, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'arc-braided-power-cable');
    boltArray(group, [[side * .305, .22, .16], [side * .305, .22, -.2], [side * .305, .22, -.56]], accent, .013);
  }
  // A nested aperture gives the emitter an optical-stack reading instead of
  // a single cylinder end-cap.
  add(group, new THREE.TorusGeometry(.082, .008, 10, 36), metal, [0, .03, -1.205], [0, 0, 0], [1, 1, 1], 'arc-aperture-machined-ring');
  add(group, new THREE.TorusGeometry(.052, .004, 8, 32), glow, [0, .03, -1.211], [0, 0, 0], [1, 1, 1], 'arc-aperture-inner-ring');
  group.userData.detailMaterial = {metal, accent, glow};
}

function breachDetails(group) {
  const metal = material(0x65717e, .25, .9);
  const dark = material(0x090b10, .52, .62);
  const accent = material(0xc98c43, .3, .88);
  const ember = material(0xff5a2d, .21, .18, 0xd51d0e, 4.8);
  commonRail(group, metal, accent, .245, -.37, .16);
  // Twin barrel indexing collars and pressure screws are intentionally
  // asymmetrical so the shotgun reads as a working break-action mechanism.
  for (const side of [-1, 1]) {
    for (const z of [-.36, -.58, -.8]) {
      add(group, new THREE.TorusGeometry(.132, .007, 8, 32), metal, [side * .12, .045, z], [Math.PI / 2, 0, 0], [1, 1, 1], 'breach-index-collar');
      add(group, new THREE.SphereGeometry(.017, 12, 8), accent, [side * .205, .045, z], [0, 0, 0], [1, 1, 1], 'breach-pressure-screw');
    }
    add(group, tube([[side * .25, .14, .26], [side * .29, .05, -.2], [side * .27, .04, -.7], [side * .2, .06, -.9]], [.011], 9), accent, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'breach-braided-feed');
  }
  // Breech face gets a recessed firing plate and two glowing primer windows.
  add(group, plate([[-.12, -.065], [.12, -.065], [.105, .065], [-.105, .065]], .016, .003), dark, [0, .235, -.18], [Math.PI / 2, 0, 0], [1, 1, 1], 'breach-recessed-breech');
  for (const side of [-1, 1]) add(group, new THREE.TorusGeometry(.026, .005, 7, 22), ember, [side * .075, .252, -.18], [Math.PI / 2, 0, 0], [1, 1, 1], 'breach-primer-glow');
  boltArray(group, [[-.22, .18, -.08], [.22, .18, -.08], [-.22, .18, -.43], [.22, .18, -.43]], accent, .014);
  group.userData.detailMaterial = {metal, accent, ember};
}

function reliquaryDetails(group) {
  const metal = material(0x6f6870, .26, .9);
  const dark = material(0x09070b, .5, .58);
  const accent = material(0xb97835, .28, .88);
  const ember = material(0xff4d36, .2, .16, 0xd91e18, 4.6);
  commonRail(group, metal, accent, .205, -.36, .145);
  // A skeletal shoulder truss breaks the receiver silhouette into load-bearing
  // pieces and gives the launcher a manufactured frame around its bone core.
  for (const side of [-1, 1]) {
    add(group, tube([[side * .17, .17, .22], [side * .29, .2, -.08], [side * .29, .16, -.42], [side * .2, .12, -.68]], [.018], 9), metal, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'reliquary-shoulder-truss');
    for (const z of [.12, -.2, -.52]) {
      add(group, new THREE.TorusGeometry(.029, .006, 8, 20), accent, [side * .29, .18, z], [0, Math.PI / 2, 0], [1, 1, 1], 'reliquary-truss-joint');
      add(group, new THREE.SphereGeometry(.019, 12, 8), ember, [side * .296, .18, z], [0, 0, 0], [1, 1, 1], 'reliquary-signal-lamp');
    }
  }
  add(group, plate([[-.12, -.07], [.12, -.07], [.1, .07], [-.1, .07]], .018, .004), dark, [0, .185, -.05], [Math.PI / 2, 0, 0], [1, 1, 1], 'reliquary-recessed-seal');
  add(group, new THREE.TorusGeometry(.061, .008, 8, 28), accent, [0, .196, -.05], [Math.PI / 2, 0, 0], [1, 1, 1], 'reliquary-seal-ring');
  add(group, tube([[-.11, .22, .19], [-.06, .27, .02], [.06, .27, -.2], [.11, .22, -.39]], [.009], 9), accent, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'reliquary-braided-conduit');
  group.userData.detailMaterial = {metal, accent, ember};
}

function ossuaryDetails(group) {
  const metal = material(0x69616b, .25, .88);
  const dark = material(0x0b080d, .5, .5);
  const accent = material(0xa66a39, .29, .86);
  const glow = material(0xff4b65, .2, .12, 0xdf1739, 4.4);
  commonRail(group, metal, accent, .14, .02, .09);
  // The chamber receives an engraved sextant and paired ocular apertures;
  // these small curves catch the viewmodel fill and make the bone/metal stack
  // legible at the exact scale of the FPS screenshot.
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const x = Math.sin(a) * .128, y = .025 + Math.cos(a) * .128;
    add(group, new THREE.TorusGeometry(.024, .0045, 7, 18), accent, [x, y, -.14], [Math.PI / 2, 0, 0], [1, 1, 1], 'ossuary-chamber-fastener');
    add(group, new THREE.SphereGeometry(.009, 10, 7), glow, [x, y, -.148], [0, 0, 0], [1, 1, 1], 'ossuary-chamber-lamp');
  }
  for (const side of [-1, 1]) {
    add(group, tube([[side * .09, .135, .16], [side * .15, .155, .02], [side * .15, .12, -.2]], [.009], 9), accent, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'ossuary-receiver-conduit');
    boltArray(group, [[side * .12, .135, .1], [side * .12, .135, -.07]], accent, .012);
  }
  add(group, new THREE.TorusGeometry(.054, .006, 8, 24), metal, [0, -.024, -.96], [Math.PI / 2, 0, 0], [1, 1, 1], 'ossuary-bore-crown');
  add(group, new THREE.TorusGeometry(.041, .004, 7, 20), glow, [0, -.024, -.967], [Math.PI / 2, 0, 0], [1, 1, 1], 'ossuary-bore-glow');
  group.userData.detailMaterial = {metal, accent, glow};
}

export function applyWeaponDetailPass(root, kind) {
  if (!root?.add) return root;
  const group = new THREE.Group();
  group.name = `Img2ThreejsMicroDetail-${kind}`;
  group.userData.weaponBatchIgnore = true;
  root.add(group);
  if (kind === 'arc') arcDetails(group);
  else if (kind === 'breach') breachDetails(group);
  else if (kind === 'reliquary') reliquaryDetails(group);
  else ossuaryDetails(group);
  mergeDetailMeshes(group);
  return root;
}
