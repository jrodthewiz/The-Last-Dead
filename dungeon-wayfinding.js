import * as THREE from './vendor/three.module.js';
import { mergeGeometries } from './vendor/utils/BufferGeometryUtils.js';

const CELL = 4;
const STATES = { quiet: 0x655c4e, next: 0xffbb65, combat: 0xc46c48, cleared: 0x759b92 };
const ROOM_COLORS = { entry: 0x748b93, combat: 0x786856, supply: 0x639b92, recovery: 0x639b92, exit: 0xb19b73 };
const NORMAL = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

export function routeGuidancePoints(navigation, player) {
  if (!navigation || navigation.blocked || !navigation.waypoint || !Array.isArray(navigation.path)) return [];
  const points = [];
  for (let i = 0; i < navigation.path.length - 1 && points.length < 5; i++) {
    const p = navigation.path[i], next = navigation.path[i + 1];
    if (Math.hypot(p.x - player.x, p.y - player.y) < .5) continue;
    if (Math.hypot(p.x - player.x, p.y - player.y) > 5) break;
    points.push({ x: p.x * CELL, z: p.y * CELL, yaw: Math.atan2(next.x - p.x, next.y - p.y) });
  }
  return points;
}

// The room graph owns destinations. This planner adds no blockers and never
// invents a straight-line route through a wall or reveals a secret opening.
export function planDungeonWayfinding(course) {
  if (!course?.dungeon) return [];
  const encounterOrder = [...new Set((course.waveSpawns || []).flat().map(item => item.roomId).filter(Boolean))];
  const rooms = (course.rooms || []).filter(room => room.kind !== 'secret');
  return rooms.slice(0, 16).flatMap((room, atlasRow) => {
    const sequence = Number.isFinite(room.flow?.sequence) ? room.flow.sequence : room.order;
    const previous = rooms.filter(item => (item.flow?.sequence ?? item.order) < sequence).sort((a, b) => (b.flow?.sequence ?? b.order) - (a.flow?.sequence ?? a.order))[0];
    const approach = previous?.center || course.playerSpawn;
    const choices = (course.openings || []).filter(opening =>
      (opening.roomId || opening.room) === room.id && opening.kind !== 'vent' && !opening.secret && opening.anchor);
    choices.sort((a, b) => {
      const distance = opening => Math.hypot(opening.anchor.x - (approach?.x || 0), opening.anchor.y - (approach?.y || 0));
      return distance(a) - distance(b);
    });
    const role = room.flow?.role || (room.kind === 'exit' ? 'exit' : room.kind === 'entry' ? 'entry' : room.encounter?.budget ? 'combat' : 'supply');
    const number = Number.isFinite(sequence) ? sequence : encounterOrder.indexOf(room.id);
    return choices.slice(0, room.kind === 'hub' || room.kind === 'arena' ? 2 : 1).flatMap(opening => {
      if (!NORMAL[opening.side]) return [];
      const normal = NORMAL[opening.side];
      return [{ roomId: room.id, name: room.name || room.id, role, atlasRow,
      number: number >= 0 ? String(number + 1).padStart(2, '0') : '—',
      openingId: opening.id, normal, yaw: Math.atan2(normal[0], normal[1]),
      // Compiled anchors use the midpoint of cell indices. Wall segments use
      // cell centres along their tangent, so add half a cell on that axis.
      x: opening.anchor.x * CELL + (opening.axis === 'h' ? CELL * .5 : 0) + normal[0] * .9,
      z: opening.anchor.y * CELL + (opening.axis === 'v' ? CELL * .5 : 0) + normal[1] * .9,
      width: Math.max(CELL, (opening.widthCells || opening.width || 1) * CELL),
      }];
    });
  });
}

function signAtlas(plan) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 2048;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const draw = substrate => {
    ctx.fillStyle = '#191f20'; ctx.fillRect(0, 0, 1024, 2048);
    plan.forEach((item, index) => {
    const y = item.atlasRow * 128;
    ctx.fillStyle = '#afab96'; ctx.fillRect(8, y + 8, 1008, 112);
    if (substrate) ctx.drawImage(substrate, 8, y + 8, 1008, 112);
    ctx.strokeStyle = '#484d47'; ctx.lineWidth = 5; ctx.strokeRect(17, y + 17, 990, 94);
    ctx.fillStyle = '#343b3b'; ctx.fillRect(24, y + 24, 120, 80);
    ctx.fillStyle = '#dbc190'; ctx.font = 'bold 68px monospace'; ctx.textAlign = 'center';
    ctx.fillText(item.role === 'exit' ? '↓' : item.number, 84, y + 85);
    ctx.textAlign = 'left'; ctx.fillStyle = '#142022'; ctx.font = 'bold 65px sans-serif';
    ctx.fillText(item.name.toUpperCase(), 169, y + 86, 800);
    // Wear stays on the border so names survive minification and bodycam grain.
    ctx.fillStyle = '#555a51';
    for (let i = 0; i < 13; i++) ctx.fillRect(25 + (i * 83 + index * 29) % 975, y + (i % 2 ? 11 : 112), 8 + i % 7, 4);
    });
  };
  draw();
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'DungeonDestinationEnamelAtlas'; texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const image = new Image();
  image.onload = () => { draw(image); texture.needsUpdate = true; };
  image.src = './assets/textures/dungeon-enamel-wayfinding-v2.webp';
  return texture;
}

function steamTexture() {
  const w = 32, h = 64, data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / (w - 1), v = y / (h - 1);
    const center = .5 + Math.sin(v * 13) * .09;
    const shape = Math.max(0, 1 - Math.abs(u - center) * 2.7);
    const edge = Math.sin(v * Math.PI);
    const i = (y * w + x) * 4;
    data[i] = 155; data[i + 1] = 174; data[i + 2] = 174;
    data[i + 3] = Math.round(255 * shape * shape * edge * edge * (.65 + Math.sin(v * 37 + u * 9) * .2));
  }
  const map = new THREE.DataTexture(data, w, h); map.needsUpdate = true;
  map.colorSpace = THREE.SRGBColorSpace; map.magFilter = map.minFilter = THREE.LinearFilter;
  return map;
}

export function buildDungeonWayfinding(parent, course) {
  const plan = planDungeonWayfinding(course);
  if (!plan.length) return { update() {}, dispose() {}, diagnostics: { signs: 0, draws: 0 } };
  const root = new THREE.Group(); root.name = 'DungeonWayfinding';
  root.userData.noBatch = true; root.userData.afterlifeSkip = true; root.userData.visualOnly = true;
  parent.add(root);
  const atlas = signAtlas(plan);
  // A bounded retroreflective face keeps printed text below HDR bloom. The
  // destination practical still lights the actual doorway and surrounding wall.
  const enamel = new THREE.MeshBasicMaterial({ color: 0xb3aa95, map: atlas, toneMapped: true });
  const indicatorMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: true });
  const indicators = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), indicatorMaterial, plan.length * 3);
  indicators.name = 'DestinationThresholdLenses';
  const mounts = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), enamel, plan.length * 6);
  mounts.name = 'DestinationPlaqueMounts';
  const marker = new THREE.Object3D(), signGeometries = [], cues = [];
  const tint = new THREE.Color();
  plan.forEach((item, index) => {
    marker.position.set(item.x, 3.35, item.z); marker.rotation.set(0, item.yaw, 0); marker.scale.set(1, 1, 1); marker.updateMatrix();
    const face = new THREE.PlaneGeometry(4.4, .86);
    const uv = face.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - item.atlasRow / 16 - (1 - uv.getY(i)) / 16);
    face.applyMatrix4(marker.matrix); signGeometries.push(face);
    const tangentX = Math.cos(item.yaw), tangentZ = -Math.sin(item.yaw);
    for (let j = 0; j < 3; j++) {
      const side = j === 0 ? 0 : j === 1 ? -1 : 1;
      marker.position.set(item.x + tangentX * side * (item.width * .5 + .12), j === 0 ? 3.77 : 1.4,
        item.z + tangentZ * side * (item.width * .5 + .12));
      marker.scale.set(j === 0 ? 4.44 : .1, j === 0 ? .055 : .78, .065); marker.updateMatrix();
      indicators.setMatrixAt(index * 3 + j, marker.matrix); indicators.setColorAt(index * 3 + j, tint.setHex(STATES.quiet));
      marker.position.addScaledVector(new THREE.Vector3(item.normal[0], 0, item.normal[1]), -.06);
      marker.scale.set(j === 0 ? 4.58 : .19, j === 0 ? .99 : .94, .09);
      if (j === 0) marker.position.y = 3.35;
      marker.updateMatrix(); mounts.setMatrixAt(index * 6 + j, marker.matrix);
    }
    marker.position.set(item.x + tangentX * (item.width * .5 + .34), .18, item.z + tangentZ * (item.width * .5 + .34));
    marker.scale.set(.38, .15, .18); marker.updateMatrix(); mounts.setMatrixAt(index * 6 + 3, marker.matrix);
    for (const [j, side] of [[4, -1], [5, 1]]) {
      marker.position.set(item.x + tangentX * side * 1.8, 4.64, item.z + tangentZ * side * 1.8);
      marker.scale.set(.035, 1.7, .035); marker.updateMatrix(); mounts.setMatrixAt(index * 6 + j, marker.matrix);
    }
    const cue = new THREE.PointLight(0xffbd78, 1.65, 12, 2);
    cue.name = `DungeonDestinationLight_${item.roomId}`;
    cue.position.set(item.x + item.normal[0] * .8, 2.55, item.z + item.normal[1] * .8);
    cue.userData.baseIntensity = 1.65; cue.userData.destinationCue = true;
    cue.userData.guidanceGain = .28; cue.userData.roomId = item.roomId;
    root.add(cue); cues.push(cue);
  });
  // Hardware uses the atlas's unlettered dark border. Baking these static
  // brackets with the plaque faces avoids another draw/material per map.
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < mounts.count; i++) {
    mounts.getMatrixAt(i, matrix);
    const bracket = mounts.geometry.clone();
    for (let v = 0; v < bracket.attributes.uv.count; v++) bracket.attributes.uv.setXY(v, .002, .998);
    bracket.applyMatrix4(matrix); signGeometries.push(bracket);
  }
  mounts.geometry.dispose();
  const faces = new THREE.Mesh(mergeGeometries(signGeometries), enamel); faces.name = 'NumberedDestinationPlaques';
  signGeometries.forEach(geometry => geometry.dispose());
  root.add(faces, indicators);
  // The optional loading return bends north. Put its plaque on the left side
  // of the end wall, outside the central service post and in view on approach.
  let returnSign = null, returnSignTexture = null;
  if (course.dungeonIndex === 0 && course.openings?.some(opening => opening.id === 'f1-o-hall-loading-return') && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 192;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#20201b'; ctx.fillRect(0, 0, 768, 192);
      ctx.strokeStyle = '#aa764a'; ctx.lineWidth = 12; ctx.strokeRect(9, 9, 750, 174);
      ctx.fillStyle = '#ddb878'; ctx.font = 'bold 94px monospace'; ctx.textAlign = 'center';
      ctx.fillText('\u2190 HALL', 384, 128);
      returnSignTexture = new THREE.CanvasTexture(canvas); returnSignTexture.colorSpace = THREE.SRGBColorSpace;
      returnSign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, .8), new THREE.MeshBasicMaterial({ map: returnSignTexture, side: THREE.DoubleSide }));
      returnSign.name = 'LoadingReturnBendSign'; returnSign.position.set(25 * CELL - .3, 2.35, 20.6 * CELL);
      returnSign.rotation.y = -Math.PI / 2; root.add(returnSign);
    }
  }
  // Recessed guidance strips follow the solved open-cell route, including its
  // next bend. No straight line to a destination hidden behind a locked wall.
  const guideMaterial = new THREE.MeshBasicMaterial({ color: 0xe6ab60, toneMapped: true });
  const guides = new THREE.InstancedMesh(new THREE.BoxGeometry(.46, .018, .065), guideMaterial, 10);
  guides.name = 'RouteFloorGuidance'; guides.frustumCulled = false; guides.count = 0;
  root.add(guides);
  const routeLight = new THREE.PointLight(0xefb46f, 1, 8, 2);
  routeLight.name = 'ReachableWaypointPractical';
  routeLight.userData = { baseIntensity: 1, destinationCue: true, dynamicCue: true, guidanceGain: 0, guidancePriority: .35 };
  root.add(routeLight);
  const vents = plan.filter(item => item.role !== 'exit').slice(0, 3);
  const steamMap = steamTexture();
  const steamMaterial = new THREE.MeshBasicMaterial({ map: steamMap, color: 0x93a3a2, transparent: true, opacity: .1, depthWrite: false, side: THREE.DoubleSide });
  const steam = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), steamMaterial, vents.length * 6);
  steam.name = 'ThresholdServiceSteam'; steam.frustumCulled = false;
  root.add(steam);
  let lastState = '';
  const update = (run = {}, now = 0, reducedMotion = false) => {
    const progression = run.dungeonProgression || {};
    const target = progression.navigation?.roomId || progression.nextRoomId;
    const active = progression.currentEncounterRoomId;
    const cleared = progression.roomsCompleted || [];
    const route = routeGuidancePoints(progression.navigation, { x: run.x || 0, y: run.y || 0 });
    guides.count = route.length * 2;
    route.forEach((p, i) => {
      for (const [j, side] of [[0, -1], [1, 1]]) {
        marker.position.set(p.x + Math.cos(p.yaw) * side * .16, .035, p.z - Math.sin(p.yaw) * side * .16);
        marker.rotation.set(0, p.yaw + side * Math.PI / 4, 0); marker.scale.set(1, 1, 1); marker.updateMatrix();
        guides.setMatrixAt(i * 2 + j, marker.matrix);
      }
    });
    guides.instanceMatrix.needsUpdate = true;
    routeLight.userData.guidanceGain = route.length ? .42 : 0;
    if (route.length) routeLight.position.set(route[0].x, 1.8, route[0].z);
    const state = `${target}|${active}|${cleared.join(',')}|${route.map(p => `${p.x},${p.z}`).join(';')}`;
    if (state !== lastState) {
      plan.forEach((item, index) => {
        const onRoute = route.some(p => Math.hypot(item.x - p.x, item.z - p.z) < 7);
        const next = item.roomId === target && onRoute, fighting = item.roomId === active;
        const status = fighting ? 'combat' : next ? 'next' : cleared.includes(item.roomId) ? 'cleared' : 'quiet';
        tint.setHex(status === 'quiet' ? ROOM_COLORS[item.role] || STATES.quiet : STATES[status]);
        for (let j = 0; j < 3; j++) indicators.setColorAt(index * 3 + j, tint);
        cues[index].userData.guidanceGain = next ? 1 : fighting ? .72 : .28;
        cues[index].userData.guidancePriority = next ? .6 : 1;
      });
      indicators.instanceColor.needsUpdate = true; lastState = state;
    }
    steam.visible = !reducedMotion;
    if (!reducedMotion) {
      vents.forEach((item, index) => {
        const tangentX = Math.cos(item.yaw), tangentZ = -Math.sin(item.yaw);
        for (let p = 0; p < 6; p++) {
          const phase = (now * .000095 + p / 6 + index * .27) % 1;
          const drift = Math.sin(phase * 6 + p) * .13;
          marker.position.set(item.x + tangentX * (item.width * .5 + .34 + drift), .2 + phase * 1.8, item.z + tangentZ * (item.width * .5 + .34 + drift));
          marker.rotation.set(0, item.yaw, Math.sin(phase * 4 + p) * .12);
          marker.scale.set(.26 + phase * .4, .65 + phase * .55, 1); marker.updateMatrix();
          steam.setMatrixAt(index * 6 + p, marker.matrix);
        }
      });
      steam.instanceMatrix.needsUpdate = true;
    }
  };
  update();
  const diagnostics = { signs: plan.length + Number(Boolean(returnSign)), draws: 4 + Number(Boolean(returnSign)), triangles: plan.length * 110 + steam.count * 2 + 120 + Number(Boolean(returnSign)) * 2, activeLightIncrease: 0, steamCards: steam.count, routeStrips: 10, collisionChanged: false,
    destinations: plan.map(({ roomId, openingId, role, number }) => ({ roomId, openingId, role, number })) };
  root.userData.wayfindingDiagnostics = diagnostics;
  return { root, update, diagnostics, dispose() {
    root.removeFromParent(); faces.geometry.dispose(); indicators.geometry.dispose(); steam.geometry.dispose(); guides.geometry.dispose(); guideMaterial.dispose();
    enamel.dispose(); indicatorMaterial.dispose(); steamMaterial.dispose(); atlas?.dispose(); steamMap.dispose();
    returnSign?.geometry.dispose(); returnSign?.material.dispose(); returnSignTexture?.dispose();
  } };
}
