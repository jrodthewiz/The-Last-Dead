import * as THREE from './vendor/three.module.js';

const CELL = 4;
const world = p => ({ x: (p?.[0] ?? 6) * CELL, z: (p?.[1] ?? 6) * CELL });
const mark = (o, moving) => { o.userData.noBatch = true; if (moving) moving.push(o); return o; };
const add = (parent, geometry, material, x = 0, y = 0, z = 0, moving) => {
  const o = new THREE.Mesh(geometry, material);
  o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o);
  return moving ? mark(o, moving) : o;
};
const beam = (parent, material, x, y, z, sx, sy, sz, moving) => add(parent, new THREE.BoxGeometry(sx, sy, sz), material, x, y, z, moving);
const cable = (parent, material, a, b, radius = .05, moving) => {
  const s = new THREE.Vector3(...a), e = new THREE.Vector3(...b), d = e.clone().sub(s);
  const o = add(parent, new THREE.CylinderGeometry(radius, radius, d.length(), 8), material, 0, 0, 0, moving);
  o.position.copy(s).add(e).multiplyScalar(.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return o;
};
const accentFor = (id, m) => id === 'ossuary' ? (m.violet || m.enemyViolet || m.metalDark) : id === 'choir' ? (m.orange || m.gold || m.rust) : (m.red || m.rust || m.metalDark);

function makeLandmark(root, item, sector, m, moving, anchors) {
  const p = world(item.anchor), type = item.type || '', size = item.size || [3, 4, 2.5];
  const group = new THREE.Group(); group.name = 'AuthoredLandmark_' + item.id; group.position.set(p.x, 0, p.z + (item.playerFacing ? CELL * 1.35 : 0)); group.userData.noBatch = true;
  const accent = accentFor(sector, m), dark = m.black || m.metalDark, flesh = new THREE.MeshPhysicalMaterial({ color: sector === 'ossuary' ? 0x2a2238 : sector === 'choir' ? 0x431d1d : 0x431924, roughness: .74, metalness: .2, clearcoat: .22, clearcoatRoughness: .42 }), gateAccent = m.metal || m.rust || dark;
  const w = Math.max(2, size[0] * CELL * .36), h = Math.max(3.6, size[1] * CELL * .66);
  if (type.includes('gate')) {
    beam(group, dark, 0, h * .62, 0, w * 1.9, .45, .5);
    for (const side of [-1, 1]) beam(group, gateAccent, side * w * .72, h * .32, 0, .28, h * .64, .34);
    // Recessed ribbed housing keeps the threshold readable without putting bright cones in the spawn sightline.
    for (let i = -4; i <= 4; i++) {
      const rib = add(group, new THREE.CapsuleGeometry(.075, .62 + (Math.abs(i) % 2) * .16, 4, 8), gateAccent, i * w * .18, h * .17, -.06);
      rib.rotation.z = (i % 2) * .14;
    }
    beam(group, dark, 0, h * .23, .08, w * 1.45, .12, .12);
  } else if (type.includes('bell-array')) {
    const count = sector === 'choir' ? 5 : 3;
    for (let i = 0; i < count; i++) {
      const x = (i / Math.max(1, count - 1) - .5) * w * 1.65, y = 4.3 + (i % 2) * .35;
      const bell = new THREE.Group(); bell.position.set(x, y, 0); bell.userData.noBatch = true;
      const shell = add(bell, new THREE.TorusGeometry(.62 + (i % 2) * .08, .16, 10, 26), m.gold || accent, 0, 0, 0, moving);
      shell.rotation.x = Math.PI / 2; add(bell, new THREE.CylinderGeometry(.7, .8, .14, 16), m.gold || accent, 0, -.2, 0);
      add(bell, new THREE.SphereGeometry(.1, 8, 6), accent, 0, -.48, 0, moving); group.add(bell);
      cable(group, dark, [x, 7.25, 0], [x, y + .25, 0], .04);
    }
    beam(group, dark, 0, 7.3, 0, w * 2.05, .22, .24);
  } else if (type.includes('conduit') || type.includes('gallery') || type.includes('colonnade') || type.includes('rib') || type.includes('tooth')) {
    const count = type.includes('tooth') ? 7 : 5;
    for (let i = 0; i < count; i++) {
      const x = (i / (count - 1) - .5) * w * 1.35;
      const rib = add(group, new THREE.TorusGeometry(.6 + (i % 2) * .12, .1, 8, 22, Math.PI), sector === 'ossuary' ? accent : (m.enemyRed || m.rust), x, h * .53, 0, moving);
      rib.rotation.set(0, Math.PI / 2, Math.PI);
      if (type.includes('tooth')) { const tooth = add(group, new THREE.ConeGeometry(.11, .8 + (i % 3) * .18, 8), m.rust || dark, x, h * .18, -.24); tooth.rotation.x = Math.PI; }
    }
    beam(group, dark, 0, h + .16, 0, w * 1.5, .18, .22);
  } else {
    const body = add(group, new THREE.SphereGeometry(1, 24, 16), flesh, 0, h * .53, 0, moving);
    body.scale.set(w * .42, h * .42, Math.max(1.1, size[2] * CELL * .28));
    const core = add(group, new THREE.SphereGeometry(.28, 16, 12), sector === 'ossuary' ? (m.violet || accent) : (m.red || accent), 0, h * .54, 1.05, moving);
    // The hero is contained in a physical ribcage: dark metal, bone-colored edges, and one small emissive heart.
    const housing = m.weaponDark || m.metalDark || dark;
    const housingEdge = m.metal || m.steel || m.floorTrim || housing;
    for (let i = 0; i < 4; i++) {
      const ring = add(group, new THREE.TorusGeometry(w * (.52 + i * .045), .11, 8, 32), housing, 0, h * (.3 + i * .14), 0, moving);
      ring.rotation.x = Math.PI / 2; ring.rotation.z = i * .21;
    }
    const cageDepth = Math.max(1.2, size[2] * CELL * .38);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const bar = add(group, new THREE.CylinderGeometry(.1, .16, h * .78, 8), housingEdge, Math.cos(a) * w * .72, h * .5, Math.sin(a) * cageDepth * .72, moving);
      bar.rotation.z = Math.sin(a) * .18;
    }
    cable(group, housingEdge, [-w * .66, h * .34, cageDepth * .7], [0, h * .82, cageDepth * .82], .07, moving);
    cable(group, housingEdge, [w * .66, h * .34, cageDepth * .7], [0, h * .82, cageDepth * .82], .07, moving);
    // Front-facing ribs break the smooth silhouette into a readable cage from the player lane.
    for (let i = 0; i < 4; i++) {
      const ribArc = add(group, new THREE.TorusGeometry(w * (.58 + i * .035), .12, 8, 30, Math.PI), housingEdge, 0, h * (.28 + i * .14), cageDepth * .78, moving);
      ribArc.rotation.z = Math.PI;
    }
    // Two recessed vascular tubes give the flesh a constructed, living purpose.
    cable(group, m.rust || housingEdge, [-w * .38, h * .22, cageDepth * .76], [w * .18, h * .52, cageDepth * .86], .065, moving);
    cable(group, m.rust || housingEdge, [w * .38, h * .22, cageDepth * .76], [-w * .18, h * .72, cageDepth * .86], .065, moving);
    for (let i = 0; i < 5; i++) {
      const plate = add(group, new THREE.BoxGeometry(w * (.72 - (i % 2) * .08), .15, .2), housingEdge, 0, h * (.28 + i * .11), cageDepth * .9, moving);
      plate.rotation.z = (i % 2 ? -.035 : .035);
    }
    for (let i = 0; i < 5; i++) {
      const ring = add(group, new THREE.TorusGeometry(w * (.42 + i * .035), .06, 8, 32), housingEdge, 0, h * (.35 + i * .105), 0, moving);
      ring.rotation.x = Math.PI / 2; ring.rotation.z = i * .32;
    }
    for (const side of [-1, 1]) {
      const rib = add(group, new THREE.TorusGeometry(w * .65, .13, 8, 24, Math.PI), housingEdge, side * w * .2, h * .52, 0, moving);
      rib.rotation.set(0, Math.PI / 2, side < 0 ? Math.PI : 0);
      beam(group, housing, side * w * .68, h * .52, 0, .24, h * .72, .26);
    }
    // Backplate, collar, and spinal conduit sell scale and construction depth.
    beam(group, housing, 0, h * .17, cageDepth * .46, w * 1.18, .3, .28);
    add(group, new THREE.CylinderGeometry(.18, .28, h * .88, 10), housing, 0, h * .5, cageDepth * .48, moving);
    add(group, new THREE.TorusGeometry(w * .78, .12, 8, 28), housingEdge, 0, h * .14, 0, moving).rotation.x = Math.PI / 2;
    anchors.hero = body; anchors.core = core;
  }
  root.add(group); return group;
}

function makeMachine(root, item, sector, m, moving, motion) {
  const p = world(item.anchor), group = new THREE.Group(); group.name = 'AuthoredMachine_' + item.id; group.position.set(p.x, 0, p.z); group.userData.noBatch = true;
  const accent = accentFor(sector, m), dark = m.metalDark, span = item.span || [3, 2.5];
  if (item.type === 'gantry') {
    beam(group, dark, 0, 6.4, 0, span[0] * CELL, .26, .34);
    beam(group, dark, -span[0] * CELL * .42, 3.1, 0, .3, 6.2, .3);
    beam(group, dark, span[0] * CELL * .42, 3.1, 0, .3, 6.2, .3);
    const trolley = new THREE.Group(); trolley.position.y = 6.1; trolley.userData.noBatch = true; mark(trolley, moving); beam(trolley, accent, 0, 0, 0, 1.4, .17, .3, moving);
    for (let i = 0; i < (item.cables || 3); i++) cable(trolley, m.rust, [-.45 + i * .3, 0, 0], [-.45 + i * .3, -2.3, 0], .04, moving);
    group.add(trolley); motion.push({ object: trolley, mode: item.motion || 'sway', phase: item.anchor[0] * .3 });
  } else if (item.type.includes('pump') || item.type.includes('organ')) {
    const n = item.pipes || 3;
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * .58, piston = add(group, new THREE.CylinderGeometry(.15, .2, 2.2 + (i % 2) * .4, 10), accent, x, 2.1, 0, moving);
      piston.userData.baseY = piston.position.y; motion.push({ object: piston, mode: item.motion || 'throb', phase: i * .8 });
      add(group, new THREE.TorusGeometry(.28, .05, 7, 16), dark, x, .86, 0);
    }
    beam(group, m.black || dark, 0, .4, 0, span[0] * CELL * .4, .24, .8);
  } else if (item.type.includes('lift') || item.type.includes('winch')) {
    const wheel = add(group, new THREE.TorusGeometry(.62, .12, 9, 22), m.gold || accent, 0, 3.9, 0, moving); wheel.rotation.x = Math.PI / 2;
    motion.push({ object: wheel, mode: item.motion || 'ratchet', phase: item.anchor[0] });
    for (let i = 0; i < (item.cables || 3); i++) cable(group, dark, [(i - 1) * .32, 6.2, 0], [(i - 1) * .32, 1.2, 0], .04);
    beam(group, accent, 0, 6.25, 0, span[0] * CELL, .18, .22);
  } else if (item.type.includes('chandelier')) {
    const chandelier = new THREE.Group(); chandelier.position.y = 5.7; chandelier.userData.noBatch = true; mark(chandelier, moving); cable(chandelier, dark, [0, 1.9, 0], [0, 0, 0], .05, moving);
    const n = item.payload === 'skulls' ? 4 : 5;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, x = Math.cos(a) * span[0] * .35, z = Math.sin(a) * span[1] * .35; add(chandelier, new THREE.SphereGeometry(.2, 10, 8), accent, x, -.18, z); cable(chandelier, dark, [x, .2, z], [x, -.05, z], .035); }
    group.add(chandelier); motion.push({ object: chandelier, mode: item.motion || 'sway', phase: item.anchor[0] * .2 });
  } else {
    const payload = add(group, new THREE.SphereGeometry(.46, 14, 10), m.gore || accent, 0, 2.4, 0, moving); cable(group, dark, [0, 6.2, 0], [0, 2.9, 0], .055); motion.push({ object: payload, mode: item.motion || 'pendulum', phase: item.anchor[0] * .2 });
  }
  root.add(group);
}

export function buildAuthoredWorld(root, materials, course = {}) {
  const layout = course.layout || course.world || {}, sector = course.sectorId || course.id || 'bloodworks';
  const landmarks = course.landmarks || layout.landmarks || [], machinery = course.machinery || layout.machinery || [], moving = [], motion = [], anchors = {};
  for (const item of landmarks) makeLandmark(root, item, sector, materials, moving, anchors);
  for (const item of machinery) makeMachine(root, item, sector, materials, moving, motion);
  const lights = [];
  for (const item of (course.lights || layout.lights || [])) {
    const p = world(item.anchor), light = new THREE.PointLight(new THREE.Color(item.color || '#ff3154'), Math.min(5, item.intensity || 2), 16, 2);
    light.name = 'AuthoredZoneLight_' + (item.role || 'cue'); light.position.set(p.x, 3.2, p.z); light.userData.baseIntensity = light.intensity; light.userData.phase = item.phase || 0; root.add(light); lights.push(light);
  }
  return { hero: anchors.hero || null, core: anchors.core || null, moving, motion, lights, animate: t => animateWorld(motion, moving, lights, t) };
}

function animateWorld(motion, moving, lights, time = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * .001) {
  for (const item of motion) {
    const phase = item.phase || 0;
    if (item.mode === 'ratchet') item.object.rotation.z = time * 1.5 + phase;
    else if (item.mode === 'pendulum' || item.mode === 'sway' || item.mode === 'counterweight') item.object.rotation.z = Math.sin(time * (item.mode === 'pendulum' ? 1.3 : .55) + phase) * (item.mode === 'pendulum' ? .16 : .07);
    else item.object.position.y = (item.object.userData.baseY ?? item.object.position.y) + Math.sin(time * 2.2 + phase) * .08;
  }
  for (const object of moving) {
    if (!object.userData.baseScale) object.userData.baseScale = object.scale.clone();
    object.scale.copy(object.userData.baseScale).multiplyScalar(1 + Math.sin(time * 2 + object.id * .37) * .018);
  }
  for (const light of lights) light.intensity = light.userData.baseIntensity * (.84 + Math.sin(time * 2.1 + light.userData.phase) * .16);
}
