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

const cellPoint = p => new THREE.Vector3((p?.[0] ?? 6) * CELL, 0, (p?.[1] ?? 6) * CELL);

function makeTunnelSetpiece(root, item, sector, m, moving, lights) {
  const points = (item.points || []).map(cellPoint);
  if (points.length < 2) return null;
  const group = new THREE.Group();
  group.name = 'AuthoredSetpiece_' + item.id;
  group.userData.noBatch = true;
  const dark = m.black || m.metalDark;
  const edge = m.metalDark || m.steel || m.floorTrim || dark;
  const signal = sector === 'ossuary' ? (m.violet || m.enemyViolet) : sector === 'choir' ? (m.orange || m.gold) : (m.red || m.enemyRed);
  const radius = Math.max(1.35, Math.min(2.35, (item.width || 2.2) * CELL * .42));
  const archHeight = Math.max(3.7, Math.min(5.8, item.height || 5));
  const arches = [];
  // Repeated ribs are the authored identity feature: players can read the
  // spine's direction from a distance, just like a Quake tunnel cadence.
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const next = points[Math.min(points.length - 1, i + 1)];
    const previous = points[Math.max(0, i - 1)];
    const tangent = next.clone().sub(previous); tangent.y = 0;
    const yaw = Math.atan2(tangent.x, tangent.z);
    const arch = add(group, new THREE.TorusGeometry(radius, .105, 8, 24, Math.PI), edge, point.x, archHeight * .5, point.z, moving);
    arch.rotation.y = yaw;
    arches.push(arch);
    // Small signal blades break up the silhouette and mark the next combat
    // beat without flooding the player's eye with emissive light.
    const blade = beam(group, signal, point.x - Math.sin(yaw) * radius * .72, archHeight * .9, point.z - Math.cos(yaw) * radius * .72, .12, .08, .58, moving);
    blade.rotation.y = yaw;
    if (i % 2 === 0) {
      const lamp = new THREE.PointLight(new THREE.Color(item.cue === 'amber' ? '#ff9b4a' : '#ff3d51'), .7, 8, 2);
      lamp.name = 'TunnelLamp_' + item.id + '_' + i;
      lamp.position.set(point.x, archHeight * .78, point.z);
      lamp.userData.baseIntensity = lamp.intensity;
      lamp.userData.phase = i * .7 + (item.id?.length || 0) * .13;
      group.add(lamp);
      lights.push(lamp);
    }
  }
  const centerline = points.map(point => new THREE.Vector3(point.x, archHeight * .92, point.z));
  const curve = new THREE.CatmullRomCurve3(centerline);
  const conduit = add(group, new THREE.TubeGeometry(curve, Math.max(10, points.length * 3), .065, 6, false), dark, 0, 0, 0);
  conduit.name = 'TunnelOverheadConduit_' + item.id;
  conduit.userData.explodeWithParent = true;
  // A second, warm conduit implies the tunnel is still carrying emergency
  // power instead of reading as a decorative arch kit.
  const warmline = centerline.map(point => new THREE.Vector3(point.x + .16, point.y - .18, point.z));
  add(group, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(warmline), Math.max(10, points.length * 3), .035, 5, false), signal, 0, 0, 0);
  root.add(group);
  return group;
}

function makeCollapseSetpiece(root, item, sector, m, moving) {
  const p = world(item.anchor), size = item.size || [1.6, 1.3, 1.2];
  const group = new THREE.Group();
  group.name = 'AuthoredSetpiece_' + item.id;
  group.position.set(p.x, 0, p.z);
  group.userData.noBatch = true;
  const rubble = sector === 'ossuary' ? (m.bone || m.enemyArmor) : sector === 'choir' ? (m.rust || m.gore) : (m.wallDeep || m.metalDark);
  const accent = item.cue === 'amber' ? (m.orange || m.hazard) : (m.red || m.rust);
  // A low, asymmetric collapse gives the west branch a believable reason to
  // pinch down while remaining above the movement proxy's walkable floor.
  for (let i = 0; i < 9; i++) {
    const angle = i * 2.39996;
    const r = .32 + (i % 4) * .17;
    const rock = add(group, new THREE.DodecahedronGeometry(.28 + (i % 3) * .09, 0), rubble, Math.cos(angle) * r * size[0], .22 + (i % 3) * .19, Math.sin(angle) * r * size[2], moving);
    rock.rotation.set(i * .21, angle, i * .17);
    rock.scale.y = .62 + (i % 2) * .25;
  }
  for (const side of [-1, 1]) {
    const beamPart = beam(group, m.rust || m.metalDark, side * .63, 1.45, -.05, .1, 2.7, .1, moving);
    beamPart.rotation.z = side * .28;
  }
  const warning = add(group, new THREE.SphereGeometry(.12, 10, 8), accent, 0, 1.48, .18, moving);
  warning.name = 'CollapseWarningLamp';
  root.add(group);
  return group;
}

function makeBulkheadSetpiece(root, item, sector, m, moving, lights) {
  const p = world(item.anchor), group = new THREE.Group();
  group.name = 'AuthoredSetpiece_' + item.id;
  group.position.set(p.x, 0, p.z);
  group.userData.noBatch = true;
  const dark = m.black || m.metalDark, frame = m.metal || m.steel || dark;
  const signal = sector === 'ossuary' ? (m.violet || m.enemyViolet) : sector === 'choir' ? (m.orange || m.gold) : (m.red || m.enemyRed);
  const width = Math.max(5, (item.width || 2.2) * CELL);
  const height = Math.max(3.8, item.height || 4.4);
  beam(group, dark, 0, height * .5, 0, width, height, .2, moving);
  beam(group, frame, -width * .46, height * .5, -.18, .22, height * .88, .28, moving);
  beam(group, frame, width * .46, height * .5, -.18, .22, height * .88, .28, moving);
  beam(group, frame, 0, height * .94, -.18, width * .96, .22, .28, moving);
  for (let i = -3; i <= 3; i++) {
    const stripe = beam(group, i % 2 ? m.hazard || m.orange : dark, i * width * .115, height * .2, -.34, .08, height * .38, .06, moving);
    stripe.rotation.z = i % 2 ? -.22 : .22;
  }
  const wheel = add(group, new THREE.TorusGeometry(Math.min(1.35, width * .17), .095, 8, 24), frame, 0, height * .62, -.34, moving);
  wheel.rotation.x = Math.PI / 2;
  const lamp = new THREE.PointLight(new THREE.Color(item.cue === 'amber' ? '#ff9b4a' : '#ff3d51'), 1.15, 10, 2);
  lamp.name = 'BulkheadLamp_' + item.id;
  lamp.position.set(0, height * .86, -.48);
  lamp.userData.baseIntensity = lamp.intensity;
  lamp.userData.phase = 2.4;
  group.add(lamp); lights.push(lamp);
  root.add(group);
  return group;
}

function makePressureDoorSetpiece(root, item, sector, m, moving, lights) {
  const p = world(item.anchor), group = new THREE.Group();
  group.name = 'AuthoredSetpiece_' + item.id;
  group.position.set(p.x, 0, p.z);
  group.userData.noBatch = true;
  const dark = m.black || m.metalDark, frame = m.metalDark || m.metal || m.steel;
  const signal = sector === 'ossuary' ? (m.violet || m.enemyViolet) : sector === 'choir' ? (m.orange || m.gold) : (m.red || m.enemyRed);
  const hazard = m.hazard || m.orange || frame;
  const width = Math.max(6.2, (item.width || 2.1) * CELL);
  const height = Math.max(4.6, item.height || 5.2);
  // A central pressure door makes the first room's two side openings legible:
  // clear the bay, then choose a flank instead of walking at a blank wall.
  beam(group, dark, 0, height * .48, 0, width * .78, height * .74, .22, moving);
  beam(group, frame, -width * .47, height * .5, -.15, .3, height, .34, moving);
  beam(group, frame, width * .47, height * .5, -.15, .3, height, .34, moving);
  beam(group, frame, 0, height * .97, -.15, width * .98, .3, .34, moving);
  beam(group, frame, 0, height * .08, -.15, width * .98, .18, .34, moving);
  const seam = beam(group, frame, 0, height * .48, -.2, .09, height * .72, .08, moving);
  seam.rotation.z = .02;
  for (let i = -4; i <= 4; i++) {
    const blade = beam(group, i % 2 ? hazard : dark, i * width * .09, height * .16, -.28, .08, height * .24, .07, moving);
    blade.rotation.z = i % 2 ? -.32 : .32;
  }
  // The threshold is a wall-facing prop: keep the ring in the X/Y plane so
  // its emissive silhouette reads from the spawn instead of becoming an
  // edge-on line. This is the focal signal that turns the far wall into a
  // destination rather than another anonymous panel.
  const ring = add(group, new THREE.TorusGeometry(Math.min(1.18, width * .16), .1, 8, 28), signal, 0, height * .53, -.32, moving);
  ring.rotation.set(0, 0, 0);
  const innerRing = add(group, new THREE.TorusGeometry(Math.min(.72, width * .1), .045, 6, 24), hazard, 0, height * .53, -.37, moving);
  innerRing.rotation.set(0, 0, 0);
  // A narrow vertical status bar gives the door a legible center seam even
  // when the bloom is subdued or the player is moving through the bay.
  beam(group, signal, 0, height * .53, -.38, .065, height * .33, .05, moving);
  add(group, new THREE.SphereGeometry(.16, 12, 8), signal, 0, height * .53, -.42, moving);
  for (const side of [-1, 1]) {
    const lamp = new THREE.PointLight(new THREE.Color(item.cue === 'amber' ? '#ff9b4a' : '#ff3d51'), .9, 10, 2);
    lamp.name = 'PressureDoorLamp_' + item.id + '_' + side;
    lamp.position.set(side * width * .37, height * .78, -.55);
    lamp.userData.baseIntensity = lamp.intensity;
    lamp.userData.phase = side < 0 ? .65 : 2.35;
    group.add(lamp); lights.push(lamp);
  }
  root.add(group);
  return group;
}

function makeSetpiece(root, item, sector, m, moving, motion, lights) {
  if (!item || !item.type) return null;
  if (item.type === 'tunnel') return makeTunnelSetpiece(root, item, sector, m, moving, lights);
  if (item.type === 'collapse') return makeCollapseSetpiece(root, item, sector, m, moving);
  if (item.type === 'bulkhead') return makeBulkheadSetpiece(root, item, sector, m, moving, lights);
  if (item.type === 'pressure-door') return makePressureDoorSetpiece(root, item, sector, m, moving, lights);
  return null;
}

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
  const landmarks = course.landmarks || layout.landmarks || [], machinery = course.machinery || layout.machinery || [], setpieces = course.setpieces || layout.setpieces || [], moving = [], motion = [], lights = [], anchors = {};
  for (const item of setpieces) makeSetpiece(root, item, sector, materials, moving, motion, lights);
  for (const item of landmarks) makeLandmark(root, item, sector, materials, moving, anchors);
  for (const item of machinery) makeMachine(root, item, sector, materials, moving, motion);
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
