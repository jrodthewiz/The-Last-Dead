import * as THREE from './vendor/three.module.js';
import { buildDungeonLandmark } from './dungeon-architecture.js';

const storyFixtureMaterialCache = new WeakMap();
const tunnelSignalMaterialCache = new WeakMap();
const CELL = 4;
const F5_GULLET_FRAME = new THREE.MeshStandardMaterial({
  color: 0x443b3c,
  roughness: .9,
  metalness: .02,
});
F5_GULLET_FRAME.name = 'F5GulletFrameBasalt';
F5_GULLET_FRAME.userData.sharedLibrary = true;
const F3_BONE_FRAME = new THREE.MeshStandardMaterial({ color: 0x706b64, roughness: .96, metalness: 0 });
F3_BONE_FRAME.name = 'F3BoneFrame';
F3_BONE_FRAME.userData.sharedLibrary = true;
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

function segmentedTunnelRib(radius, band = .44, depth = .38, segments = 14) {
  const outer = radius + band * .5;
  const inner = Math.max(.2, radius - band * .5);
  const shape = new THREE.Shape();
  for (let i = 0; i <= segments; i++) {
    const angle = Math.PI - i / segments * Math.PI;
    const x = Math.cos(angle) * outer;
    const y = Math.sin(angle) * outer;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  for (let i = segments; i >= 0; i--) {
    const angle = Math.PI - i / segments * Math.PI;
    shape.lineTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth, steps: 1, curveSegments: 1,
    bevelEnabled: true, bevelSegments: 1, bevelSize: .026, bevelThickness: .018,
  });
  geometry.translate(0, 0, -depth * .5);
  geometry.computeVertexNormals();
  geometry.userData.archProfile = 'segmented-load-rib-v2';
  return geometry;
}
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

function tunnelSignalMaterial(materials, sector, art) {
  const source = sector === 'ossuary' ? (materials.violet || materials.enemyViolet) : sector === 'choir' ? (materials.orange || materials.gold) : (materials.red || materials.enemyRed);
  if (!art) return source;
  let cache = tunnelSignalMaterialCache.get(materials);
  if (!cache) { cache = new Map(); tunnelSignalMaterialCache.set(materials, cache); }
  if (!cache.has(art.id)) {
    const material = new THREE.MeshStandardMaterial({
      color: art.accent2, emissive: art.accent2, emissiveIntensity: .62,
      roughness: .36, metalness: .12,
    });
    material.name = `TunnelSignal_${art.id}`;
    material.userData.sharedLibrary = true;
    cache.set(art.id, material);
  }
  return cache.get(art.id);
}

function makeTunnelSetpiece(root, item, sector, m, moving, lights, art) {
  const points = (item.points || []).map(cellPoint);
  if (points.length < 2) return null;
  const group = new THREE.Group();
  group.name = 'AuthoredSetpiece_' + item.id;
  group.userData.noBatch = true;
  const dark = m.black || m.metalDark;
  const isF5ThroatTunnel = item.id?.startsWith('f5-sp-throat');
  const isOssuaryTunnel = item.id?.startsWith('f3-');
  // Catacombs ribs are load-bearing service frames, so use the shared worn
  // metal source when the renderer provides it.  Keeping the source material
  // itself here lets the one-shot afterlife surface pass sync a late-loaded
  // map without allocating another texture or material library.
  const ossuaryFrame = m.wornSteel || m.steel || m.metalDark || m.metal || F3_BONE_FRAME;
  let edge = isF5ThroatTunnel
    ? F5_GULLET_FRAME
    : item.id?.startsWith('f4-') ? (m.rust || m.metalDark || dark)
    : isOssuaryTunnel ? ossuaryFrame
    : item.id?.startsWith('f2-') ? (m.metal || m.steel || dark)
    : (m.metalDark || m.steel || m.floorTrim || dark);
  const signal = tunnelSignalMaterial(m, sector, art);
  // The first two floors share a factory kit, but its finish follows the
  // foundry / surgical ward instead of inheriting blue weapon steel.
  if (art && (art.architecture === 'pressure-foundry' || art.architecture === 'surgical-gallery')) {
    const cache = tunnelSignalMaterialCache.get(m);
    const key = `${art.id}:frame`;
    if (!cache.has(key)) {
      const frame = edge.clone();
      const surgical = art.architecture === 'surgical-gallery';
      frame.color.setHex(surgical ? art.wallSurface : art.trimSurface);
      frame.roughness = surgical ? .52 : .78;
      frame.metalness = surgical ? .18 : .48;
      frame.name = `TunnelFrame_${art.id}`;
      frame.userData.sharedLibrary = true;
      cache.set(key, frame);
    }
    edge = cache.get(key);
  }
  const cueColor = art?.accent2 ?? (item.cue === 'amber' ? 0xff9b4a : 0xff3d51);
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
    const crownY = archHeight * .5 + radius;
    const arch = add(group, segmentedTunnelRib(radius, .44, .38, 14), edge, point.x, archHeight * .5, point.z, moving);
    arch.name = `TunnelRib_${item.id}_${i}`;
    arch.userData.archProfile = 'segmented-load-rib-v2';
    if (isOssuaryTunnel) {
      arch.userData.afterlifeSurfaceRole = 'roomTrim';
      arch.userData.wornFinish = 'dread-worn-steel-v1';
    }
    arch.rotation.y = yaw;
    arches.push(arch);
    // Grounded jambs turn the overhead ribs into a tunnel kit instead of
    // floating decorative hoops. They also create a readable cadence for
    // movement and cover without narrowing the authored lane.
    const span = new THREE.Vector3(Math.cos(yaw) * radius, 0, -Math.sin(yaw) * radius);
    for (const side of [-1, 1]) {
      const leg = beam(group, edge, point.x + span.x * side, archHeight * .25, point.z + span.z * side, .42, archHeight * .5, .38, moving);
      leg.rotation.y = yaw;
      if (isOssuaryTunnel) { leg.userData.afterlifeSurfaceRole = 'roomTrim'; leg.userData.wornFinish = 'dread-worn-steel-v1'; }
      const shoulder = beam(group, edge, point.x + span.x * side, archHeight * .5, point.z + span.z * side, .68, .48, .52, moving);
      shoulder.rotation.y = yaw;
      if (isOssuaryTunnel) { shoulder.userData.afterlifeSurfaceRole = 'roomTrim'; shoulder.userData.wornFinish = 'dread-worn-steel-v1'; }
      // A recessed face and restrained cap define the rib-to-jamb joint.
      const joint = beam(group, dark, point.x + span.x * side, archHeight * .5, point.z + span.z * side, .48, .19, .55);
      joint.name = `TunnelJoint_${item.id}_${i}_${side}`;
      joint.rotation.y = yaw;
      joint.castShadow = false;
      const plinth = beam(group, edge, point.x + span.x * side, .15, point.z + span.z * side, .72, .3, .62, moving);
      plinth.rotation.y = yaw;
      if (isOssuaryTunnel) { plinth.userData.afterlifeSurfaceRole = 'roomTrim'; plinth.userData.wornFinish = 'dread-worn-steel-v1'; }
      const foot = beam(group, signal, point.x + span.x * side, .05, point.z + span.z * side, .36, .055, .25, moving);
      foot.rotation.y = yaw;
      // Flush threshold edge strips echo the jamb spacing; the central lane
      // stays clear and every detail can join the static material batches.
      if (i === 0 || i === points.length - 1) {
        const sill = beam(group, edge, point.x + span.x * side * .84, .055, point.z + span.z * side * .84, .75, .06, 1.25);
        sill.name = `TunnelThreshold_${item.id}_${i}_${side}`;
        sill.rotation.y = yaw;
        sill.castShadow = false;
        for (const offset of [-.38, .38]) {
          const tick = beam(group, signal,
            point.x + span.x * side * .84 + Math.sin(yaw) * offset, .09,
            point.z + span.z * side * .84 + Math.cos(yaw) * offset, .42, .025, .07);
          tick.name = `TunnelThresholdInlay_${item.id}_${i}_${side}_${offset}`;
          tick.rotation.y = yaw;
          tick.castShadow = false;
          tick.receiveShadow = false;
        }
      }
    }
    // Keep the route signal physically attached to the arch crown. The old
    // forward offset made it float over the entry lane in player view.
    const blade = beam(group, signal, point.x, archHeight * .5 + radius + .09, point.z, .4, .08, .15, moving);
    blade.rotation.y = yaw;
    if (i % 2 === 0) {
      // The practical hangs directly from the rib, with a recessed luminous
      // underside. Its existing light now belongs to a visible fixture.
      const housing = beam(group, dark, point.x, crownY - .13, point.z, .76, .23, .38);
      housing.name = `TunnelLampHousing_${item.id}_${i}`;
      housing.rotation.y = yaw;
      const lens = beam(group, signal, point.x, crownY - .255, point.z, .52, .035, .23);
      lens.name = `TunnelLampLens_${item.id}_${i}`;
      lens.rotation.y = yaw;
      lens.castShadow = false;
      lens.receiveShadow = false;
      const lamp = new THREE.PointLight(cueColor, .7, 8, 2);
      lamp.name = 'TunnelLamp_' + item.id + '_' + i;
      lamp.position.set(point.x, crownY - .34, point.z);
      lamp.userData.baseIntensity = lamp.intensity;
      lamp.userData.phase = i * .7 + (item.id?.length || 0) * .13;
      group.add(lamp);
      lights.push(lamp);
    }
  }
  // Keep the first F5 approach tunnel free of overhead lines. From the player
  // spawn, a long cable cuts across the distant Black Gullet and has no visible
  // support at its near end. Other floors keep their service runs.
  const shortSupportedRun = points.every((point, index) => index === 0 || point.distanceTo(points[index - 1]) <= CELL * 4);
  if (!isF5ThroatTunnel && shortSupportedRun) {
    const centerline = points.map(point => new THREE.Vector3(point.x, archHeight * .92, point.z));
    const curve = new THREE.CatmullRomCurve3(centerline);
    const conduit = add(group, new THREE.TubeGeometry(curve, Math.max(10, points.length * 3), .065, 6, false), dark, 0, 0, 0);
    conduit.name = 'TunnelOverheadConduit_' + item.id;
    conduit.userData.explodeWithParent = true;
    // A second, warm conduit implies the tunnel is still carrying emergency
    // power instead of reading as a decorative arch kit.
    const warmline = centerline.map(point => new THREE.Vector3(point.x + .16, point.y - .18, point.z));
    add(group, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(warmline), Math.max(10, points.length * 3), .035, 5, false), signal, 0, 0, 0);
  }
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
  const openingWidth = Number.isFinite(item.openingWidth)
    ? Math.max(0, Math.min(width - 1, item.openingWidth))
    : 0;
  if (openingWidth > 0) {
    // The wall compiler owns whether this doorway is sealed. Keep this authored
    // surround readable without leaving a second, permanently closed panel in
    // the player's live route after the room-clear gate opens.
    const panelWidth = (width - openingWidth) * .5;
    const panelCenter = openingWidth * .5 + panelWidth * .5;
    for (const side of [-1, 1]) {
      beam(group, dark, side * panelCenter, height * .5, 0, panelWidth, height, .2, moving);
      beam(group, frame, side * (openingWidth * .5 + .12), height * .5, -.24, .12, height * .86, .22, moving);
    }
  } else {
    beam(group, dark, 0, height * .5, 0, width, height, .2, moving);
  }
  beam(group, frame, -width * .46, height * .5, -.18, .22, height * .88, .28, moving);
  beam(group, frame, width * .46, height * .5, -.18, .22, height * .88, .28, moving);
  beam(group, frame, 0, height * .94, -.18, width * .96, .22, .28, moving);
  const stripeX = openingWidth > 0
    ? [-1, 1].flatMap(side => [.2, .5, .8].map(t => side * (openingWidth * .5 + ((width - openingWidth) * .5) * t)))
    : Array.from({ length: 7 }, (_, index) => (index - 3) * width * .115);
  stripeX.forEach((x, index) => {
    const stripe = beam(group, index % 2 ? m.hazard || m.orange : dark, x, height * .2, -.34, .08, height * .38, .06, moving);
    stripe.rotation.z = index % 2 ? -.22 : .22;
  });
  if (openingWidth > 0) {
    const warning = add(group, new THREE.TorusGeometry(.19, .035, 7, 18), signal, 0, height * .91, -.36, moving);
    warning.rotation.x = Math.PI / 2;
    warning.name = 'BulkheadClearanceRing';
  }
  const wheelY = openingWidth > 0 ? height * .9 : height * .62;
  const wheel = add(group, new THREE.TorusGeometry(Math.min(1.35, width * .17), .095, 8, 24), frame, 0, wheelY, -.34, moving);
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

function nonRefractiveGlass(material, name) {
  const glass = material?.clone ? material.clone() : material;
  if (!glass) return glass;
  glass.name = name;
  // Preserve tint, transparency, and clearcoat on small authored lenses while
  // avoiding the full-scene render Three.js uses for physical refraction.
  if ('transmission' in glass) glass.transmission = 0;
  glass.needsUpdate = true;
  return glass;
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
  const lensMaterial = nonRefractiveGlass(m.glass || signal, 'IntakeIrisSignalLens');
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
  const glass = nonRefractiveGlass(m.glass || m.metal, `StorySpecimenGlass_${item.id}`);
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

function makeSetpiece(root, item, sector, m, moving, motion, lights, art) {
  if (!item || !item.type) return null;
  let group = null;
  if (item.type === 'tunnel') group = makeTunnelSetpiece(root, item, sector, m, moving, lights, art);
  else if (item.type === 'collapse') group = makeCollapseSetpiece(root, item, sector, m, moving);
  else if (item.type === 'bulkhead') group = makeBulkheadSetpiece(root, item, sector, m, moving, lights);
  else if (item.type === 'pressure-door') group = makePressureDoorSetpiece(root, item, sector, m, moving, lights);
  else if (item.type === 'recovery-cluster') group = makeRecoveryCluster(root, item, sector, m, moving, lights);
  if (!group) return null;

  // These setpieces are authored scenery; only the iris pivot has a live
  // mechanism that may animate. Let the batcher merge the static hardware by
  // material, and keep the pivot as one coherent moving assembly instead of
  // pulsing every bolt, rib, and cable independently.
  const irisPivot = group.getObjectByName('IrisPetalPivot');
  group.userData.noBatch = false;
  group.traverse(node => {
    if (node === group || node === irisPivot) return;
    if (node.isMesh || node.isGroup) node.userData.noBatch = false;
  });
  for (let i = moving.length - 1; i >= 0; i -= 1) {
    let belongsToSetpiece = false;
    for (let parent = moving[i]; parent; parent = parent.parent) {
      if (parent === group) { belongsToSetpiece = true; break; }
    }
    if (belongsToSetpiece && moving[i] !== irisPivot) moving.splice(i, 1);
  }
  if (irisPivot && !moving.includes(irisPivot)) moving.push(irisPivot);
  return group;
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
  const p = world(item.anchor), group = new THREE.Group(); group.name = 'AuthoredMachine_' + item.id; group.position.set(p.x, 0, p.z);
  const accent = accentFor(sector, m), dark = m.metalDark, span = item.span || [3, 2.5];
  if (item.type === 'gantry') {
    beam(group, dark, 0, 6.4, 0, span[0] * CELL, .26, .34);
    beam(group, dark, -span[0] * CELL * .42, 3.1, 0, .3, 6.2, .3);
    beam(group, dark, span[0] * CELL * .42, 3.1, 0, .3, 6.2, .3);
    const trolley = new THREE.Group(); trolley.position.y = 6.1; trolley.userData.noBatch = true; mark(trolley, moving); beam(trolley, accent, 0, 0, 0, 1.4, .17, .3, moving);
    for (let i = 0; i < (item.cables || 3); i++) cable(trolley, m.rust, [-.45 + i * .3, 0, 0], [-.45 + i * .3, -2.3, 0], .04, moving);
    group.add(trolley); motion.push({ object: trolley, mode: item.motion || 'sway', phase: item.anchor[0] * .3 });
  } else if (item.type === 'pipe-organ') {
    const width = Math.max(5.2, Math.min(9.6, span[0] * CELL * 0.88));
    const height = Math.max(4.6, Math.min(7.1, span[1] * 1.08));
    const pipeCount = Math.max(5, Math.min(9, item.pipes || 6));
    beam(group, dark, 0, height * 0.48, -0.36, width * 0.98, height * 0.88, 0.28);
    beam(group, m.steel || m.metal, 0, 0.38, -0.08, width * 1.08, 0.62, 0.72);
    beam(group, m.gold || m.orange || accent, 0, height * 0.92, -0.1, width * 1.04, 0.2, 0.62);
    for (let i = 0; i < pipeCount; i++) {
      const t = pipeCount < 2 ? 0.5 : i / (pipeCount - 1);
      const x = (t - 0.5) * width * 0.82;
      const tier = Math.abs(t - 0.5) * 0.22;
      const pipeHeight = height * (0.54 + (1 - t) * 0.19 - tier);
      const radius = 0.13 + ((i + 1) % 3) * 0.025;
      const pipe = add(group, new THREE.CylinderGeometry(radius * 0.78, radius, pipeHeight, 10), i % 3 === 0 ? m.gold || accent : m.metal || accent, x, 0.68 + pipeHeight * 0.5, -0.02);
      pipe.name = `ResonanceOrganPipe_${i}`;
      const bell = add(group, new THREE.CylinderGeometry(radius * 1.62, radius * 0.78, 0.36, 10), m.steel || m.metal || accent, x, 0.68 + pipeHeight + 0.17, -0.02);
      bell.name = `ResonanceOrganBell_${i}`;
      const collar = add(group, new THREE.TorusGeometry(radius * 0.91, 0.035, 6, 12), m.gold || accent, x, 0.77, 0.03);
      collar.rotation.x = Math.PI / 2;
      collar.name = `ResonanceOrganCollar_${i}`;
    }
    for (const side of [-1, 1]) {
      const brace = beam(group, m.rust || dark, side * width * 0.46, height * 0.5, 0.04, 0.24, height * 0.92, 0.38);
      brace.rotation.z = side * -0.035;
      for (let i = 0; i < 3; i++) {
        const rivet = add(group, new THREE.SphereGeometry(0.08, 8, 6), m.gold || accent, side * width * 0.46, height * (0.22 + i * 0.28), 0.27);
        rivet.name = `ResonanceOrganRivet_${side}_${i}`;
      }
    }
    group.userData.modelId = 'resonance-pipe-organ';
    group.userData.visualOnly = true;
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

function makeStoryLightFixture(root, item, style, materials) {
  const point = world(item.anchor);
  const group = new THREE.Group();
  group.name = `StoryLightFixture_${item.role || 'cue'}`;
  group.position.set(point.x, 0, point.z);
  group.userData.storyLightFixture = style;
  group.userData.visualOnly = true;
  const dark = materials.black || materials.metalDark || materials.wallDeep;
  const frame = materials.metal || materials.steel || dark;
  const bronze = materials.gold || materials.orange || materials.rust || frame;
  const bone = materials.bone || materials.enemyArmor || frame;
  const baseGlass = materials.glass || materials.cyan || materials.red || bronze;
  const glow = {
    'caged-amber': [0xffc66e, 0xff6a2d, 1.1],
    'surgical-bowl': [0xe3efea, 0x78b6af, .78],
    'bone-censer': [0xe0c89d, 0xb97943, .82],
    'bell-censer': [0xffd78b, 0xd58b3f, .95],
    'buried-ember': [0xf06b4b, 0xe32d32, 1.3],
  }[style];
  let glass = baseGlass;
  if (baseGlass?.clone && glow) {
    let materialsByStyle = storyFixtureMaterialCache.get(baseGlass);
    if (!materialsByStyle) {
      materialsByStyle = new Map();
      storyFixtureMaterialCache.set(baseGlass, materialsByStyle);
    }
    glass = materialsByStyle.get(style);
    if (!glass) {
      glass = baseGlass.clone();
      materialsByStyle.set(style, glass);
    }
    glass.name = `StoryFixtureGlow_${style}`;
    glass.color?.setHex(glow[0]);
    glass.emissive?.setHex(glow[1]);
    if ('emissiveIntensity' in glass) glass.emissiveIntensity = glow[2];
    if ('roughness' in glass) glass.roughness = .24;
    if ('metalness' in glass) glass.metalness = .025;
    // Practical bulbs are solid emissive lenses. Transmission would add a
    // scene refraction pass for tiny fixtures without making them read more
    // like light sources, and the source material is shared with world glass.
    if ('transmission' in glass) glass.transmission = 0;
    glass.transparent = false;
    glass.opacity = 1;
    glass.depthWrite = true;
    glass.needsUpdate = true;
    glass.userData.storyFixtureMaterial = style;
  }
  const makeRing = (name, material, radius, tube, y) => {
    const mesh = add(group, new THREE.TorusGeometry(radius, tube, 7, 20), material, 0, y, 0);
    mesh.name = name;
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  };

  if (style === 'caged-amber') {
    cable(group, dark, [0, 5.35, 0], [0, 4.65, 0], .035);
    makeRing('AmberCageTop', bronze, .34, .045, 4.62);
    makeRing('AmberCageFoot', frame, .34, .045, 3.78);
    for (let i = 0; i < 6; i += 1) {
      const angle = i / 6 * Math.PI * 2;
      const x = Math.cos(angle) * .3, z = Math.sin(angle) * .3;
      cable(group, frame, [x, 4.62, z], [x * .72, 3.8, z * .72], .026, null);
    }
    const bulb = add(group, new THREE.SphereGeometry(.19, 12, 9), glass, 0, 4.06, 0);
    bulb.name = 'AmberCagedBulb';
    bulb.scale.y = .82;
  } else if (style === 'surgical-bowl') {
    cable(group, frame, [0, 5.22, 0], [0, 4.35, 0], .035);
    makeRing('SurgicalBowlRim', frame, .46, .055, 3.87);
    const shade = add(group, new THREE.CylinderGeometry(.13, .43, .25, 20, 1, true), materials.porcelain || frame, 0, 4.01, 0);
    shade.name = 'SurgicalBowlShade';
    const optic = add(group, new THREE.SphereGeometry(.12, 12, 8), glass, 0, 3.78, 0);
    optic.name = 'SurgicalBowlOptic';
    for (let i = 0; i < 4; i += 1) {
      const angle = i * Math.PI / 2;
      const brace = beam(group, bronze, Math.cos(angle) * .31, 4.09, Math.sin(angle) * .31, .045, .25, .045);
      brace.name = `SurgicalBowlBrace_${i}`;
    }
  } else if (style === 'bone-censer') {
    cable(group, dark, [0, 5.36, 0], [0, 4.55, 0], .04);
    makeRing('BoneCenserCrown', bone, .37, .065, 4.48);
    makeRing('BoneCenserLowerHoop', bronze, .29, .045, 3.86);
    for (let i = 0; i < 6; i += 1) {
      const angle = i / 6 * Math.PI * 2;
      const x = Math.cos(angle) * .32, z = Math.sin(angle) * .32;
      cable(group, bone, [x, 4.46, z], [x * .88, 3.9, z * .88], .035);
    }
    const censer = add(group, new THREE.ConeGeometry(.23, .48, 8), bronze, 0, 4.03, 0);
    censer.name = 'BoneCenserBowl';
    const ember = add(group, new THREE.SphereGeometry(.1, 10, 8), glass, 0, 3.88, 0);
    ember.name = 'BoneCenserEmber';
  } else if (style === 'bell-censer') {
    cable(group, dark, [0, 5.5, 0], [0, 4.65, 0], .04);
    makeRing('BellCenserCrown', bronze, .4, .06, 4.62);
    const bell = add(group, new THREE.CylinderGeometry(.13, .34, .48, 12), bronze, 0, 4.12, 0);
    bell.name = 'ResonanceBellShade';
    const bellLip = makeRing('ResonanceBellLip', frame, .32, .045, 3.88);
    bellLip.name = 'ResonanceBellRim';
    const clapper = add(group, new THREE.SphereGeometry(.09, 9, 7), glass, 0, 3.78, 0);
    clapper.name = 'ResonanceBellClapper';
    for (let i = 0; i < 3; i += 1) {
      const a = i / 3 * Math.PI * 2;
      cable(group, bronze, [Math.cos(a) * .38, 4.61, Math.sin(a) * .38], [Math.cos(a) * .27, 3.92, Math.sin(a) * .27], .025);
    }
  } else if (style === 'buried-ember') {
    const plinth = add(group, new THREE.CylinderGeometry(.36, .52, .14, 16), dark, 0, .1, 0);
    plinth.name = 'BuriedEmberPlinth';
    makeRing('BuriedEmberRim', bronze, .42, .05, .18);
    const shard = add(group, new THREE.SphereGeometry(.23, 12, 8), glass, 0, .32, 0);
    shard.name = 'BuriedEmberCore';
    shard.scale.set(.72, .62, .72);
    for (let i = 0; i < 4; i += 1) {
      const angle = i * Math.PI / 2;
      const guard = beam(group, frame, Math.cos(angle) * .35, .22, Math.sin(angle) * .35, .055, .28, .055);
      guard.name = `BuriedEmberGuard_${i}`;
    }
  }
  group.traverse(child => {
    if (!child.isMesh || child.material !== glass) return;
    child.castShadow = false;
    child.receiveShadow = false;
  });
  root.add(group);
  return group;
}

// F5's authored lamps are intentionally bright, isolated cues.  The descent
// still needs a quiet value floor around the combat lane so that walls, cover,
// and enemy silhouettes do not disappear between those cues.  These lights
// sit just off the lane and below eye height, so they lift the floor and edge
// planes while leaving the centre of the Black Gullet in shadow.
function addF5LaneLighting(root, course, lights) {
  const art = course.artDirection || {};
  const fillColor = art.laneFillColor || 0x5d2b3d;
  const fillIntensity = art.laneFillIntensity || .34;
  const fillRange = art.laneFillRange || 14;
  const guideColor = art.guidanceColor || 0xb4513f;
  const guideIntensity = art.guidanceIntensity || .38;
  const guideRange = art.guidanceRange || 9;
  const add = (id, anchor, offsetX, y, color, intensity, range, purpose, phase) => {
    const p = world(anchor);
    const light = new THREE.PointLight(new THREE.Color(color), intensity, range, 2);
    light.name = `F5_${id}`;
    light.position.set(p.x + offsetX, y, p.z);
    light.userData.baseIntensity = intensity;
    light.userData.phase = phase;
    light.userData.storyLightPurpose = purpose;
    root.add(light);
    lights.push(light);
  };

  // Two edge sources per arena produce floor bounce from both sides and keep
  // the centre lane available for silhouettes and enemy telegraphs.
  for (const [index, z] of [[1, 16], [2, 10], [3, 4]]) {
    add(`LaneFill_${index}_W`, [14, z], -3.7, 1.35, fillColor, fillIntensity, fillRange, 'lane-fill', index * .71);
    add(`LaneFill_${index}_E`, [14, z], 3.7, 1.35, fillColor, fillIntensity * .92, fillRange, 'lane-fill', index * .71 + 1.8);
  }

  // Small side-mounted practicals mark the two throat thresholds.  They are
  // visible landmarks rather than another overhead sun, so the route reads
  // in motion without flattening the altar recesses.
  add('Guidance_Throat1', [14, 13], 3.15, 2.55, guideColor, guideIntensity, guideRange, 'threshold-guidance', 2.2);
  add('Guidance_Throat2', [14, 7], -3.15, 2.55, guideColor, guideIntensity * .9, guideRange, 'threshold-guidance', 4.1);
}

// The Black Gullet route is intentionally dark, but a dark route still needs a
// readable floor seam, side scale, and a destination rhythm. These pieces are
// visual-only and sit outside the combat lane; they give the player a quiet
// value floor without adding collision or another bank of dynamic lights.
function addF5RouteDressing(root, materials) {
  const floor = new THREE.MeshStandardMaterial({
    color: 0x28242c,
    emissive: 0x0d0a10,
    emissiveIntensity: .16,
    roughness: .9,
    metalness: .06,
  });
  const wall = new THREE.MeshStandardMaterial({
    color: 0x3c3740,
    emissive: 0x0b080d,
    emissiveIntensity: .18,
    roughness: .88,
    metalness: .08,
  });
  const side = materials.mawBasalt || materials.metalDark || materials.dark;
  const edge = materials.mawBasaltEdge || materials.floorTrim || materials.rust || side;
  const bone = materials.mawBoneShade || materials.bone || edge;
  const routeGlow = new THREE.MeshStandardMaterial({
    color: 0x3a111b,
    emissive: 0x8e2635,
    emissiveIntensity: .36,
    roughness: .74,
    metalness: .12,
  });

  // Low floor plates break up the empty black plane and keep the player’s eye
  // on the same centerline as the three descending throats.
  for (let i = 0; i < 9; i += 1) {
    const z = 74 - i * 7.2;
    const plate = beam(root, floor, 56, .035, z, 7.2, .07, 5.1);
    plate.name = `F5RouteFloorPlate_${i}`;
    plate.receiveShadow = true;
    for (const x of [52.15, 59.85]) {
      const seam = beam(root, routeGlow, x, .095, z, .075, .05, 3.6);
      seam.name = `F5RouteSeam_${i}_${x < 56 ? 'L' : 'R'}`;
      seam.receiveShadow = false;
    }
  }

  const beaconGlow = new THREE.MeshStandardMaterial({
    color: 0x4b1b13,
    emissive: 0xd65a25,
    emissiveIntensity: .48,
    roughness: .62,
    metalness: .16,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(.22, .32, .13, 12), beaconGlow);
  beacon.name = 'F5MidDistanceBeacon';
  beacon.position.set(56, .15, 52);
  beacon.castShadow = false;
  beacon.receiveShadow = false;
  root.add(beacon);

  // Neutral side values keep the red accents subordinate to actual walls. The
  // panels remain outside the collision lane and are deliberately segmented so
  // the corridor still feels authored rather than like a single gray box.
  for (let i = 0; i < 8; i += 1) {
    const z = 73 - i * 8.1;
    for (const x of [43.9, 70.1]) {
      const panel = beam(root, wall, x, 2.05, z, 1.4, 3.9, 5.6);
      panel.name = `F5RouteWallPanel_${i}_${x < 56 ? 'L' : 'R'}`;
      panel.receiveShadow = true;
      const inset = beam(root, side, x + (x < 56 ? .16 : -.16), 2.02, z - .08, .16, 3.1, 4.7);
      inset.name = `F5RouteWallInset_${i}_${x < 56 ? 'L' : 'R'}`;
      inset.castShadow = false;
    }
  }

  // Local neutral practicals reveal the wall planes without flattening the
  // center lane or inflating the authored-light count used for combat cues.
  for (const [x, z, phase] of [[44, 63, .2], [70, 39, 1.3]]) {
    const fill = new THREE.PointLight(0x8c7f91, .2, 18, 2);
    fill.name = `F5NeutralWallFill_${x < 56 ? 'L' : 'R'}`;
    fill.position.set(x, 2.35, z);
    fill.userData.baseIntensity = fill.intensity;
    fill.userData.phase = phase;
    root.add(fill);
  }

  // Uneven side piers provide a sense of scale and make the tunnel cadence
  // legible from the entry instead of reading as an unbounded void.
  for (let i = 0; i < 7; i += 1) {
    const z = 70 - i * 9.3;
    for (const sideSign of [-1, 1]) {
      const x = 43.2 + (sideSign > 0 ? 25.6 : 0);
      const pier = beam(root, side, x, 1.55 + (i % 2) * .12, z, .42, 3.05, 1.55);
      pier.name = `F5RoutePier_${i}_${sideSign < 0 ? 'L' : 'R'}`;
      pier.rotation.y = sideSign * (i % 3 === 0 ? .035 : -.025);
      const cap = beam(root, edge, x, 3.08, z, .56, .13, 1.72);
      cap.name = `F5RoutePierCap_${i}_${sideSign < 0 ? 'L' : 'R'}`;
      cap.receiveShadow = true;
    }
  }

  // A few deliberately broken teeth keep the silhouette authored rather than
  // perfectly modular. They are outside the clear 4 m lane and never collide.
  for (let i = 0; i < 4; i += 1) {
    const x = i % 2 ? 67.9 : 41.7;
    const z = 61 - i * 13.2;
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(.22, 1.15 + (i % 2) * .35, 7), bone);
    tooth.name = `F5RouteBrokenTooth_${i}`;
    tooth.position.set(x, 2.65, z);
    tooth.rotation.z = (i % 2 ? -1 : 1) * (.34 + i * .04);
    tooth.castShadow = false;
    tooth.receiveShadow = true;
    root.add(tooth);
  }

  // Two mid-distance marker pairs keep the next throat legible even when the
  // foreground arch is filling the camera. They read as emergency edge lights
  // rather than a bright navigation arrow.
  for (const [index, z] of [[0, 52], [1, 28]]) {
    for (const x of [50.6, 61.4]) {
      const marker = beam(root, routeGlow, x, .78, z, .1, 1.25, .1);
      marker.name = `F5ThresholdMarker_${index}_${x < 56 ? 'L' : 'R'}`;
    }
    const plate = beam(root, edge, 56, .07, z, 2.2, .04, .22);
    plate.name = `F5ThresholdPlate_${index}`;
  }
}

export function buildAuthoredWorld(root, materials, course = {}) {
  const layout = course.layout || course.world || {}, sector = course.sectorId || course.id || 'bloodworks';
  const landmarks = course.landmarks || layout.landmarks || [], machinery = course.machinery || layout.machinery || [], setpieces = course.setpieces || layout.setpieces || [], moving = [], motion = [], lights = [], anchors = {};
  for (const item of setpieces) makeSetpiece(root, item, sector, materials, moving, motion, lights, course.artDirection);
  for (const item of landmarks) {
    const landmark = course.dungeon ? buildDungeonLandmark(item, materials, course, { moving, motion, anchors, lights }) : null;
    if (landmark) root.add(landmark);
    else makeLandmark(root, item, sector, materials, moving, anchors);
  }
  for (const item of machinery) makeMachine(root, item, sector, materials, moving, motion);
  for (const item of (course.lights || layout.lights || [])) {
    const art = course.artDirection;
    const p = world(item.anchor), intensity = Math.min(5, item.intensity || 2) * (art?.authoredLightMultiplier || 1);
    const light = new THREE.PointLight(new THREE.Color(item.color || '#ff3154'), intensity, art?.lightRange || 16, 2);
    const fixtureStyle = art?.lightFixture || null;
    const fixtureY = fixtureStyle === 'buried-ember' ? .38 : art ? 3.9 : 3.2;
    light.name = 'AuthoredZoneLight_' + (item.role || 'cue'); light.position.set(p.x, fixtureY, p.z); light.userData.baseIntensity = light.intensity; light.userData.phase = item.phase || 0; root.add(light); lights.push(light);
    // The entry light is carried by the nearby tunnel rib. A hanging bowl at
    // this distance fills the top of the spawn camera without a visible mount.
    if (fixtureStyle && (item.role !== 'entry' || fixtureStyle === 'buried-ember')) {
      makeStoryLightFixture(root, item, fixtureStyle, materials);
    }
  }
  if (course.id === 'f5-last-descent') {
    addF5RouteDressing(root, materials);
    addF5LaneLighting(root, course, lights);
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
