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
  const reflective = metalness > .55;
  const m = new THREE.MeshPhysicalMaterial({
    color, roughness, metalness,
    // Match the factory profiles so the micro-detail belongs to the same
    // manufactured object instead of becoming a separate mirror-bright kit.
    envMapIntensity: reflective ? .46 : .2,
    clearcoat: reflective ? .22 : .08,
    clearcoatRoughness: reflective ? .28 : .38,
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


// Second-pass construction cues: layered strap plates, vent slots, slotted
// screws, hammer / lugs and worn edge strips. Dimensions follow the factories in
// weapon-occult-redesign.js (+Y up, -Z fire).
function slotScrews(group, positions, metal, dark, axis = 'x', radius = .014) {
  const head = new THREE.CylinderGeometry(radius, radius * 1.08, radius * .7, 10);
  const slot = new THREE.BoxGeometry(radius * 1.7, radius * .3, radius * .3);
  positions.forEach((p, i) => {
    const rot = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'y' ? [0, 0, 0] : [Math.PI / 2, 0, 0];
    add(group, head, metal, p, rot, [1, 1, 1], 'micro-slotted-screw');
    const off = [...p]; if (axis === 'x') off[0] += Math.sign(p[0]) * radius * .36; else if (axis === 'y') off[1] += radius * .36; else off[2] += Math.sign(p[2] || 1) * radius * .36;
    add(group, slot, dark, off, [axis === 'x' ? 0 : 0, axis === 'z' ? 0 : 0, (i % 3) * .6 + (axis === 'x' ? Math.PI / 2 : 0)], [1, 1, 1], 'micro-screw-slot');
  });
}

function ventSlots(group, dark, count, start, step, y, x, w, len) {
  const slot = new THREE.BoxGeometry(w, .008, len);
  for (let i = 0; i < count; i++) add(group, slot, dark, [x, y, start - i * step], [0, 0, 0], [1, 1, 1], 'micro-vent-slot');
}

function edgeStrip(group, metal, from, to, w = .008) {
  const a = V(from), b = V(to), len = a.distanceTo(b);
  const mesh = add(group, new THREE.BoxGeometry(w, w, len), metal, a.clone().add(b).multiplyScalar(.5).toArray(), [0, 0, 0], [1, 1, 1], 'micro-worn-edge');
  mesh.lookAt(b.clone());
  return mesh;
}

function extraDetails(group, kind) {
  const worn = material(0xa9a49a, .3, .92);
  const dark = material(0x050506, .6, .4);
  const steel = material(0x5b5e63, .42, .85);
  if (kind === 'ossuary') {
    // Hammer with a knurled spur, top strap, underlug and ejector rod.
    add(group, plate([[-.03, 0], [.03, 0], [.026, .07], [.0, .085], [-.026, .07]], .05, .006), steel, [0, .2, .255], [0, 0, 0], [1, 1, 1], 'ossuary-hammer');
    for (let i = 0; i < 4; i++) add(group, new THREE.BoxGeometry(.075, .005, .008), dark, [0, .245 + i * .006, .28], [.0, 0, 0], [1, 1, 1], 'ossuary-hammer-knurl');
    add(group, plate([[-.06, -.03], [.06, -.03], [.05, .03], [-.05, .03]], .5, .004), worn, [0, .205, -.02], [Math.PI / 2, 0, 0], [1, 1, 1], 'ossuary-top-strap');
    add(group, plate([[-.055, -.03], [.055, -.03], [.045, .04], [-.045, .04]], .55, .006), steel, [0, -.115, -.62], [Math.PI / 2, 0, 0], [1, 1, 1], 'ossuary-underlug');
    add(group, new THREE.CylinderGeometry(.014, .014, .42, 10), worn, [.0, -.16, -.55], [Math.PI / 2, 0, 0], [1, 1, 1], 'ossuary-ejector-rod');
    add(group, new THREE.SphereGeometry(.024, 10, 8), steel, [0, -.16, -.76], [0, 0, 0], [1, 1, 1], 'ossuary-ejector-knob');
    ventSlots(group, dark, 6, -.36, .085, .168, 0, .04, .05);
    for (const side of [-1, 1]) {
      ventSlots(group, dark, 4, -.42, .12, .045, side * .143, .006, .07);
      edgeStrip(group, worn, [side * .085, .192, .26], [side * .085, .192, -.24]);
      edgeStrip(group, worn, [side * .2, -.03, .26], [side * .2, -.03, -.24]);
    }
    slotScrews(group, [[-.21, .1, .2], [-.21, -.08, .2], [-.21, .1, -.18], [.21, .1, .2], [.21, -.08, .2], [.21, .1, -.18]], worn, dark, 'x');
    // Trigger guard loop and trigger
    add(group, new THREE.TorusGeometry(.07, .009, 8, 22, Math.PI * 1.3), steel, [0, -.24, .15], [0, Math.PI / 2, Math.PI * 1.15], [1, 1, 1], 'ossuary-trigger-guard');
    add(group, plate([[-.008, 0], [.008, 0], [.006, -.075], [-.006, -.075]], .02, .003), worn, [0, -.14, .16], [0, Math.PI / 2, .15], [1, 1, 1], 'ossuary-trigger');
  } else if (kind === 'reliquary') {
    // Rocket chamber: bolted armour bands, fuse ports and a stepped rear-sight lug.
    for (const z of [-.28, .24]) for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + Math.PI / 8;
      // The rear underside belongs to the grip mount and the player's palm.
      // Leave that occupied patch free of protruding chamber fasteners.
      if(z===.24&&Math.cos(a)<-.7)continue;
      slotScrews(group, [[Math.sin(a) * .3, .04 + Math.cos(a) * .3, z]], worn, dark, 'y', .016);
    }
    for (const side of [-1, 1]) {
      ventSlots(group, dark, 5, -.15, .06, .34, side * .06, .012, .035);
      edgeStrip(group, worn, [side * .2, .3, .3], [side * .14, .335, -.33]);
    }
    add(group, plate([[-.05, 0], [.05, 0], [.035, .07], [-.035, .07]], .12, .006), steel, [0, .33, -.02], [0, 0, 0], [1, 1, 1], 'reliquary-top-lug');
    for (let i = 0; i < 6; i++) add(group, new THREE.BoxGeometry(.11, .006, .012), dark, [0, .405, -.05 - i * .03], [0, 0, 0], [1, 1, 1], 'reliquary-lug-grooves');
    // barrel bands
    for (const z of [-.5, -.7, -.85]) add(group, new THREE.TorusGeometry(.17 - (z + .5) * -.1, .009, 6, 20), worn, [0, .04, z], [0, 0, 0], [1, 1, 1], 'reliquary-barrel-band');
  } else if (kind === 'arc') {
    ventSlots(group, dark, 6, -.05, .07, .26, .0, .05, .028);
    for (const side of [-1, 1]) {
      edgeStrip(group, worn, [side * .27, .21, .18], [side * .32, .2, -.62]);
      edgeStrip(group, worn, [side * .2, -.11, .1], [side * .26, -.12, -.55]);
    }
    slotScrews(group, [[-.24, .19, .18], [.24, .19, .18], [-.14, .13, -1.0], [.14, .13, -1.0]], worn, dark, 'y');
    // stepped emitter lens rings
    for (let i = 0; i < 3; i++) add(group, new THREE.TorusGeometry(.11 - i * .012, .006, 6, 24), worn, [0, .1, -1.04 - i * .05], [0, 0, 0], [1, 1, 1], 'arc-emitter-step');
  } else if (kind === 'breach') {
    ventSlots(group, dark, 7, -.28, .09, .2, 0, .06, .04);
    for (const side of [-1, 1]) edgeStrip(group, worn, [side * .2, .17, .2], [side * .2, .17, -.9]);
    slotScrews(group, [[-.24, .08, .05], [.24, .08, .05], [-.24, -.02, -.3], [.24, -.02, -.3]], worn, dark, 'x');
  }
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
  extraDetails(group, kind);
  mergeDetailMeshes(group);
  const registry=root.userData.sculptRuntime?.materials;
  if(registry){const owned=new Set(Object.values(registry));let index=0;group.traverse(node=>{for(const material of (Array.isArray(node.material)?node.material:[node.material]).filter(Boolean))if(!owned.has(material)){registry['detail'+index++]=material;owned.add(material);}});}
  return root;
}
