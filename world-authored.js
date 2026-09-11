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
const annulusGeometry = (outer, inner, depth, bevel = .025, segments = 40) => {
  const shape = new THREE.Shape();
  for (let i = 0; i <= segments; i++) {
    const a = i / segments * Math.PI * 2, x = Math.cos(a) * outer, y = Math.sin(a) * outer;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  const hole = new THREE.Path();
  for (let i = 0; i <= segments; i++) {
    const a = -i / segments * Math.PI * 2, x = Math.cos(a) * inner, y = Math.sin(a) * inner;
    if (i === 0) hole.moveTo(x, y); else hole.lineTo(x, y);
  }
  shape.holes.push(hole);
  return new THREE.ExtrudeGeometry(shape, { depth, curveSegments: segments, steps: 1, bevelEnabled: true, bevelSegments: 2, bevelSize: bevel, bevelThickness: Math.min(bevel, depth * .28) });
};
const irisPetalGeometry = () => {
  const shape = new THREE.Shape();
  shape.moveTo(.14, -.15);
  shape.lineTo(.42, -.22);
  shape.lineTo(1.02, -.29);
  shape.quadraticCurveTo(1.1, 0, 1.02, .29);
  shape.lineTo(.42, .22);
  shape.lineTo(.14, .15);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: .09, curveSegments: 8, steps: 1, bevelEnabled: true, bevelSegments: 2, bevelSize: .018, bevelThickness: .018 });
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
    // Grounded jambs turn the overhead ribs into a tunnel kit instead of
    // floating decorative hoops. They also create a readable cadence for
    // movement and cover without narrowing the authored lane.
    const span = new THREE.Vector3(Math.cos(yaw) * radius, 0, -Math.sin(yaw) * radius);
    for (const side of [-1, 1]) {
      const leg = beam(group, edge, point.x + span.x * side, archHeight * .25, point.z + span.z * side, .16, archHeight * .5, .16, moving);
      leg.rotation.y = yaw;
      const foot = beam(group, signal, point.x + span.x * side, .05, point.z + span.z * side, .32, .05, .22, moving);
      foot.rotation.y = yaw;
    }
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
  // The spawn looks down the room's X axis. Rotate the lock so its shutter,
  // signal ring, and hazard trim face that approach instead of presenting a
  // skewed side-wall prop.
  group.rotation.y = Math.PI / 2;
  group.userData.noBatch = true;
  const dark = m.black || m.metalDark, frame = m.metalDark || m.metal || m.steel;
  // Keep the center actuator legible as machined hardware. The red optic is
  // the signal; the spindle/status parts must not collapse into a reticle glyph.
  const irisHardware = m.metal || m.steel || frame;
  const signal = sector === 'ossuary' ? (m.violet || m.enemyViolet) : sector === 'choir' ? (m.orange || m.gold) : (m.red || m.enemyRed);
  const hazard = m.hazard || m.orange || frame;
  const width = Math.max(6.2, (item.width || 2.1) * CELL);
  const height = Math.max(4.6, item.height || 5.2);
  // A central pressure door makes the first room's two side openings legible:
  // clear the bay, then choose a flank instead of walking at a blank wall.
  beam(group, dark, 0, height * .48, 0, width * .78, height * .74, .22, moving);
  // Segmented shutter ribs keep the black face from reading as a flat void;
  // they catch the room reflection behind the brighter lock signal.
  for (let i = -3; i <= 3; i++) {
    const rib = beam(group, i % 2 ? frame : dark, i * width * .105, height * .5, .14, .1, height * .58, .09, moving);
    rib.rotation.z = i * .012;
  }
  for (const y of [.27, .5, .73]) beam(group, frame, 0, height * y, .16, width * .7, .08, .08, moving);
  // Positive local Z is the spawn-facing side of the threshold (the player
  // approaches from positive X after the authored turn). Keep the trim proud of the shutter so the
  // focal silhouette cannot be z-occluded by the room shell.
  beam(group, frame, -width * .47, height * .5, .18, .3, height, .34, moving);
  beam(group, frame, width * .47, height * .5, .18, .3, height, .34, moving);
  beam(group, frame, 0, height * .97, .18, width * .98, .3, .34, moving);
  beam(group, frame, 0, height * .08, .18, width * .98, .18, .34, moving);
  const seam = beam(group, frame, 0, height * .48, .2, .09, height * .72, .08, moving);
  seam.rotation.z = .02;
  for (let i = -4; i <= 4; i++) {
    const blade = beam(group, i % 2 ? hazard : dark, i * width * .09, height * .16, .3, .08, height * .24, .07, moving);
    blade.rotation.z = i % 2 ? -.32 : .32;
  }
  // This is a real wall-mounted containment iris, not a reticle or a floating
  // torus marker. The concentric housing, recessed cavity, articulated petals,
  // sockets, and convex lens give the center signal physical depth from the
  // spawn approach and from a three-quarter camera.
  const centerY = height * .53;
  const housing = add(group, annulusGeometry(1.52, 1.28, .2, .035, 48), dark, 0, centerY, .24, moving);
  housing.name = 'IrisHousingAnnulus';
  const housingBack = add(group, new THREE.CylinderGeometry(1.52, 1.52, .24, 48), dark, 0, centerY, .16, moving);
  housingBack.name = 'IrisHousingBack'; housingBack.rotation.x = Math.PI / 2;
  const bezel = add(group, annulusGeometry(1.34, 1.03, .18, .03, 48), frame, 0, centerY, .43, moving);
  bezel.name = 'IrisSteppedBezel';
  const cavity = add(group, new THREE.CylinderGeometry(1.02, 1.06, .26, 40), m.black || dark, 0, centerY, .34, moving);
  cavity.name = 'IrisRecessedCavity'; cavity.rotation.x = Math.PI / 2;
  const gasket = add(group, annulusGeometry(1.03, .9, .08, .018, 40), m.rust || dark, 0, centerY, .49, moving);
  gasket.name = 'IrisCavityGasket';
  // The petal pivot is an explicit action-ready node. Each tapered plate is
  // an extruded profile with its own hinge pin, so the aperture reads as a
  // fabricated mechanism rather than eight flat decals.
  const petalPivot = new THREE.Group(); petalPivot.name = 'IrisPetalPivot'; petalPivot.position.set(0, centerY, .53); petalPivot.userData.noBatch = true; mark(petalPivot, moving); group.add(petalPivot);
  const petalGeo = irisPetalGeometry();
  const hingeGeo = new THREE.CylinderGeometry(.085, .095, .12, 12);
  const socketGeo = new THREE.CylinderGeometry(.13, .13, .045, 12);
  const petals = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + .12;
    const petal = new THREE.Mesh(petalGeo, i % 2 ? frame : (hazard || frame));
    petal.name = `IrisPetal_${i}`; petal.rotation.z = a; petal.position.set(0, 0, i % 2 ? .02 : .035); petal.castShadow = true; petal.receiveShadow = true; petal.userData.noBatch = true; petalPivot.add(petal); petals.push(petal);
    const pin = new THREE.Mesh(hingeGeo, frame); pin.name = `IrisPetalHinge_${i}`; pin.rotation.x = Math.PI / 2; pin.position.set(Math.cos(a) * .59, Math.sin(a) * .59, .12); pin.castShadow = true; pin.receiveShadow = true; pin.userData.noBatch = true; petalPivot.add(pin);
    const socket = new THREE.Mesh(socketGeo, dark); socket.name = `IrisPetalSocket_${i}`; socket.rotation.x = Math.PI / 2; socket.position.set(Math.cos(a) * .74, Math.sin(a) * .74, .075); socket.userData.noBatch = true; petalPivot.add(socket);
  }
  const actuator = add(group, annulusGeometry(1.11, .95, .1, .018, 40), dark, 0, centerY, .64, moving);
  actuator.name = 'IrisActuatorCam';
  // Eight oriented rods bridge the bezel to the petal sockets. Their endpoints
  // intentionally sit at different depths so the linkage is readable in 3/4.
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + .12;
    cable(group, frame, [Math.cos(a) * 1.24, centerY + Math.sin(a) * 1.24, .49], [Math.cos(a) * .84, centerY + Math.sin(a) * .84, .66], .035, moving).name = `IrisRadialStrut_${i}`;
  }
  const lensMaterial = m.glass?.clone ? m.glass.clone() : (m.glass || signal);
  if (lensMaterial.color?.setHex) lensMaterial.color.setHex(0x173b45);
  if (lensMaterial.emissive?.setHex) lensMaterial.emissive.setHex(0x7b1429);
  if ('emissiveIntensity' in lensMaterial) lensMaterial.emissiveIntensity = 1.25;
  const lens = add(group, new THREE.SphereGeometry(.58, 28, 18), lensMaterial, 0, centerY, .72, moving);
  lens.name = 'IrisConvexLens'; lens.scale.set(1, 1, .38);
  const lensCore = add(group, new THREE.SphereGeometry(.27, 20, 14), signal, 0, centerY, .9, moving);
  lensCore.name = 'IrisHotCore'; lensCore.scale.z = .5;
  const spindle = add(group, new THREE.CylinderGeometry(.17, .21, .26, 18), irisHardware, 0, centerY, .88, moving);
  spindle.name = 'IrisCenterSpindle'; spindle.rotation.x = Math.PI / 2;
  const spindleCap = add(group, new THREE.SphereGeometry(.2, 16, 10), irisHardware, 0, centerY, 1.03, moving);
  spindleCap.name = 'IrisSpindleCap'; spindleCap.scale.z = .42;
  // A physical status spine and two end caps preserve the original red cue,
  // but now terminate into the spindle and bezel instead of floating in space.
  beam(group, irisHardware, 0, centerY, .99, .07, 1.03, .065, moving).name = 'IrisStatusSpine';
  for (const y of [centerY - .56, centerY + .56]) {
    const cap = add(group, new THREE.CylinderGeometry(.105, .105, .1, 12), irisHardware, 0, y, 1.02, moving); cap.rotation.x = Math.PI / 2; cap.name = 'IrisStatusCap';
  }
  // Socketed perimeter fasteners are actual depth-bearing hardware, not
  // screen-space markers. Their dark sockets keep the steel heads legible.
  const boltRadius = 1.42;
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + .08;
    const x = Math.cos(a) * boltRadius, y = centerY + Math.sin(a) * boltRadius;
    const socket = add(group, new THREE.CylinderGeometry(.13, .13, .05, 10), dark, x, y, .45, moving); socket.rotation.x = Math.PI / 2; socket.name = `IrisPerimeterSocket_${i}`;
    const bolt = add(group, new THREE.CylinderGeometry(.082, .095, .11, 10), frame, x, y, .51, moving); bolt.rotation.x = Math.PI / 2; bolt.name = `IrisPerimeterBolt_${i}`;
  }
  group.userData.sculptRuntime = {
    targetId: 'intake-containment-iris', sourceImage: 'docs/build10/build10-game-desktop.png', actionReady: true,
    parts: { housing: housing.name, bezel: bezel.name, cavity: cavity.name, petals: petals.map(p => p.name), actuator: actuator.name, lens: lens.name, status: 'IrisStatusSpine' },
    sockets: ['IrisPetalPivot', 'IrisCenterSpindle'], collider: { type: 'cylinder', radius: 1.55, depth: .72, isTrigger: true },
    approximation: 'Rear mount and seal depth are authored from an occluded in-situ reference.',
  };
  for (const side of [-1, 1]) {
    const lamp = new THREE.PointLight(new THREE.Color(item.cue === 'amber' ? '#ff9b4a' : '#ff3d51'), .9, 10, 2);
    lamp.name = 'PressureDoorLamp_' + item.id + '_' + side;
    lamp.position.set(side * width * .37, height * .78, .55);
    lamp.userData.baseIntensity = lamp.intensity;
    lamp.userData.phase = side < 0 ? .65 : 2.35;
    group.add(lamp); lights.push(lamp);
  }
  root.add(group);
  return group;
}

function makeRecoveryCluster(root, item, sector, m, moving, lights) {
  const p = world(item.anchor), group = new THREE.Group();
  group.name = 'AuthoredSetpiece_' + item.id;
  group.position.set(p.x, 0, p.z);
  // Match the lock's sightline: the player approaches this service hardware
  // down +X, so the cluster can tell the story without becoming a collision
  // object or blocking the combat lane.
  group.rotation.y = Math.PI / 2;
  group.userData.noBatch = true;
  const dark = m.black || m.wallDeep || m.metalDark;
  const steel = m.metalDark || m.metal || m.steel || dark;
  const rust = m.rust || m.gore || steel;
  const hazard = m.hazard || m.orange || rust;
  const signal = sector === 'ossuary' ? (m.violet || m.enemyViolet || steel) : sector === 'choir' ? (m.orange || m.gold || hazard) : (m.red || m.enemyRed || hazard);
  const glass = m.glass || m.metal;
  const span = Math.max(6.2, (item.width || 1.7) * CELL);
  const height = Math.max(4.6, item.height || 5.05);

  // A recessed drain, stained seam, and sparse grate teeth give the lock a
  // functional footprint. The red seam is intentionally lower contrast than
  // the door ring so it guides the eye rather than competing with it.
  beam(group, dark, 0, .065, .92, span * .72, .07, .56, moving);
  beam(group, rust, 0, .115, 1.16, span * .54, .025, .06, moving);
  for (let i = -4; i <= 4; i++) beam(group, i % 2 ? steel : dark, i * span * .082, .14, .92, .045, .11, .48, moving);

  // Collapse the storytelling into one anchored quarantine-service manifold.
  // Every piece has a job: the box is bolted to the lock frame, the canister
  // is an inspection sample, the hoses feed the base, and the drain takes the
  // contaminated runoff away. This keeps the plant identity without prop
  // scatter in the combat lane.
  const manifoldX = -span * .35;
  beam(group, dark, manifoldX, height * .59, .2, .76, .88, .12, moving);
  const manifold = beam(group, rust, manifoldX, height * .59, .3, .62, .72, .06, moving);
  manifold.rotation.z = -.045;
  for (let i = -1; i <= 1; i++) {
    const stripe = beam(group, i % 2 ? hazard : dark, manifoldX + i * .11, height * .46, .38, .035, .17, .024, moving);
    stripe.rotation.z = -.2;
  }
  // Short steel brackets visibly pin the manifold to the pressure-lock frame.
  beam(group, steel, manifoldX + span * .08, height * .7, .12, .28, .1, .1, moving);
  beam(group, steel, manifoldX + span * .08, height * .48, .12, .28, .1, .1, moving);
  const canisterX = manifoldX + .18;
  const canister = add(group, new THREE.CylinderGeometry(.12, .15, .42, 10), glass, canisterX, height * .78, .54, moving);
  canister.rotation.z = -.06;
  add(group, new THREE.CylinderGeometry(.06, .08, .32, 8), sector === 'ossuary' ? (m.bone || steel) : (m.blood || rust), canisterX, height * .78, .59, moving);
  const collar = add(group, new THREE.TorusGeometry(.14, .025, 6, 16), signal, canisterX, height * .78, .6, moving);
  collar.rotation.x = Math.PI / 2;
  // Two thicker feeds visibly route from the manifold into the lock base.
  cable(group, rust, [manifoldX + .06, height * .48, .4], [manifoldX + .14, .18, .25], .07, moving);
  cable(group, dark, [manifoldX + .18, height * .42, .42], [-.12, .15, .24], .05, moving);
  const broken = beam(group, rust, manifoldX - .08, height * .34, .24, .3, .24, .05, moving);
  broken.rotation.z = -.12;
  const warning = add(group, new THREE.SphereGeometry(.07, 10, 8), hazard, manifoldX + .26, height * .34, .34, moving);
  warning.name = 'RecoveryWarningLamp';

  const cool = new THREE.PointLight(new THREE.Color('#9ac9d8'), .34, 7, 2);
  cool.name = 'RecoveryColdFill_' + item.id;
  cool.position.set(-span * .34, height * .66, .52);
  cool.userData.baseIntensity = cool.intensity;
  cool.userData.phase = .9;
  group.add(cool); lights.push(cool);
  const practical = new THREE.PointLight(new THREE.Color(item.cue === 'amber' ? '#ffb35c' : '#ff704f'), .45, 6, 2);
  practical.name = 'RecoveryPractical_' + item.id;
  practical.position.set(manifoldX, height * .42, .58);
  practical.userData.baseIntensity = practical.intensity;
  practical.userData.phase = 1.8;
  group.add(practical); lights.push(practical);
  // One continuous, non-emissive utility run carries the lock's service logic
  // into the maintenance spine. It is intentionally singular and directional
  // so the route reads without turning the ceiling into pipe clutter.
  const utilityPoints = [
    new THREE.Vector3(.18, height * .92, .62),
    new THREE.Vector3(1.35, height * .92, .42),
    new THREE.Vector3(2.65, height * .91, .08),
    new THREE.Vector3(4.05, height * .9, -.62),
    new THREE.Vector3(5.35, height * .89, -1.5),
  ];
  const utility = add(group, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(utilityPoints), 18, .085, 7, false), steel, 0, 0, 0, moving);
  utility.name = 'RecoveryUtilityRun_' + item.id;
  utility.userData.explodeWithParent = true;
  // The open maintenance cavity is placed on the lock-side service assembly
  // itself so the missing panel silhouette survives the gameplay camera's
  // oblique wall view. It is one bay, with a single offset frame and two feeds.
  const cavityX = .35, cavityZ = 2.55;
  const cavity = beam(group, dark, cavityX, height * .55, cavityZ, 1.72, 3.48, .12, moving);
  cavity.name = 'IntakeOpenMaintenanceCavity';
  const offsetFrame = beam(group, hazard, cavityX + .94, height * .56, cavityZ - .08, .18, 3.88, .18, moving);
  offsetFrame.name = 'IntakeOpenMaintenanceOffsetFrame';
  offsetFrame.rotation.z = .075;
  beam(group, steel, cavityX, height * .95, cavityZ - .08, 1.82, .14, .18, moving).name = 'IntakeOpenMaintenanceHeader';
  beam(group, hazard, cavityX, height * .1, cavityZ - .08, 1.82, .1, .18, moving).name = 'IntakeOpenMaintenanceSill';
  const cavityPipe = add(group, new THREE.CylinderGeometry(.13, .13, 2.7, 8), rust, cavityX - .48, height * .55, cavityZ - .2, moving);
  cavityPipe.name = 'IntakeOpenMaintenanceVerticalFeed';
  cavityPipe.rotation.z = .04;
  const cavityCross = add(group, new THREE.CylinderGeometry(.105, .105, 1.35, 8), hazard, cavityX + .08, height * .48, cavityZ - .22, moving);
  cavityCross.name = 'IntakeOpenMaintenanceCrossFeed';
  cavityCross.rotation.x = Math.PI / 2;
  root.add(group);
  return group;
}

function makeSetpiece(root, item, sector, m, moving, motion, lights) {
  if (!item || !item.type) return null;
  if (item.type === 'tunnel') return makeTunnelSetpiece(root, item, sector, m, moving, lights);
  if (item.type === 'collapse') return makeCollapseSetpiece(root, item, sector, m, moving);
  if (item.type === 'bulkhead') return makeBulkheadSetpiece(root, item, sector, m, moving, lights);
  if (item.type === 'pressure-door') return makePressureDoorSetpiece(root, item, sector, m, moving, lights);
  if (item.type === 'recovery-cluster') return makeRecoveryCluster(root, item, sector, m, moving, lights);
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
