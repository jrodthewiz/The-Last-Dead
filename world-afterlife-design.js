import * as THREE from './vendor/three.module.js';

// A small composition pass for the Forsaken Afterlife direction. It is
// deliberately separate from collision, room construction, and landmark
// ownership: this layer only adds cheap sightline control and authored
// silhouette cues around the existing playable spaces.
const CELL = 4;
const VERSION = 'afterlife-map-design-v2';

const PROFILES = Object.freeze({
  foundry: Object.freeze({
    id: 'foundry', frame: 0x5d6868, shadow: 0x090c0d, signal: 0x6d4a45, bone: 0x77756a,
    height: 4.65, ceiling: 5.45, stagger: 1, propSide: 1, landmark: 'pressure-threshold',
  }),
  gallery: Object.freeze({
    id: 'gallery', frame: 0x647171, shadow: 0x080b0c, signal: 0x6d7c78, bone: 0x777b73,
    height: 4.85, ceiling: 5.6, stagger: -1, propSide: -1, landmark: 'ward-threshold',
  }),
  ossuary: Object.freeze({
    id: 'ossuary', frame: 0x77766b, shadow: 0x08090b, signal: 0x6a6875, bone: 0x9a9078,
    height: 5.05, ceiling: 5.75, stagger: 1, propSide: -1, landmark: 'reliquary-threshold',
  }),
  choir: Object.freeze({
    id: 'choir', frame: 0x756b61, shadow: 0x0a0808, signal: 0x76624c, bone: 0x8e8068,
    height: 5.15, ceiling: 5.9, stagger: -1, propSide: 1, landmark: 'resonance-threshold',
  }),
  gullet: Object.freeze({
    id: 'gullet', frame: 0x4c4546, shadow: 0x050607, signal: 0x69423e, bone: 0x74685f,
    height: 4.35, ceiling: 5.15, stagger: 1, propSide: 1, landmark: 'gullet-threshold',
  }),
});

const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));

function courseProfile(course = {}) {
  const id = String(course.id || course.sectorId || '').toLowerCase();
  if (id.includes('f5-') || (id === 'choir' && course.dungeon)) return PROFILES.gullet;
  if (id.includes('f4-') || id === 'choir') return PROFILES.choir;
  if (id.includes('f3-') || id === 'ossuary') return PROFILES.ossuary;
  if (id.includes('f2-')) return PROFILES.gallery;
  return PROFILES.foundry;
}

function cloneRoleMaterial(source, fallback, name, role, options = {}) {
  const material = source?.clone?.() || new THREE.MeshStandardMaterial({
    color: fallback, roughness: .78, metalness: .22,
  });
  if (material.color?.set) material.color.set(fallback);
  if ('roughness' in material) material.roughness = options.roughness ?? .78;
  if ('metalness' in material) material.metalness = options.metalness ?? .22;
  if (material.emissive?.set) material.emissive.set(options.emissive ?? 0x000000);
  if ('emissiveIntensity' in material) material.emissiveIntensity = options.emissiveIntensity ?? 0;
  material.name = name;
  material.userData = { ...(source?.userData || {}), afterlifeMapDesign: VERSION, afterlifeRole: role };
  delete material.userData.sharedLibrary;
  for (const key of ['map', 'normalMap', 'roughnessMap', 'bumpMap', 'emissiveMap']) {
    if (material[key]?.userData) material[key].userData.sharedAsset = true;
  }
  return material;
}

function createMaterials(materials = {}, profile, includeBone = false) {
  const sourceFrame = materials.floorTrim || materials.metalDark || materials.metal || materials.wall;
  const sourceShadow = materials.black || materials.wallDeep || materials.metalDark;
  const sourceSignal = materials.rust || materials.orange || materials.red || materials.hazard;
  const result = {
    frame: cloneRoleMaterial(sourceFrame, profile.frame, 'AfterlifeMapFrame_' + profile.id, 'roomTrim', { roughness: .73, metalness: .34 }),
    shadow: cloneRoleMaterial(sourceShadow, profile.shadow, 'AfterlifeMapShadow_' + profile.id, 'roomRecess', { roughness: .95, metalness: .02 }),
    signal: cloneRoleMaterial(sourceSignal, profile.signal, 'AfterlifeMapSignal_' + profile.id, 'roomAccent', { roughness: .55, metalness: .24, emissive: profile.signal, emissiveIntensity: .08 }),
  };
  if (includeBone) {
    const sourceBone = materials.bone || materials.enemyArmor || materials.floorTrim;
    result.bone = cloneRoleMaterial(sourceBone, profile.bone, 'AfterlifeMapBone_' + profile.id, 'roomBone', { roughness: .82, metalness: .06 });
  }
  return result;
}

function localToWorldPoint(point, course, layoutPoint = false) {
  const x = Number(point?.[0] ?? point?.x ?? 0);
  const z = Number(point?.[1] ?? point?.y ?? point?.z ?? 0);
  const offset = layoutPoint && course.campaign ? CELL * .5 : 0;
  return new THREE.Vector3(x * CELL + offset, 0, z * CELL + offset);
}

function roomCenter(room) {
  if (!room) return null;
  if (room.center && typeof room.center === 'object') {
    return {
      x: Number(room.center.x ?? room.center[0]),
      z: Number(room.center.y ?? room.center.z ?? room.center[1]),
    };
  }
  if (room.bounds && Number.isFinite(Number(room.bounds.minX)) && Number.isFinite(Number(room.bounds.maxX))) {
    return {
      x: (Number(room.bounds.minX) + Number(room.bounds.maxX)) * .5,
      z: (Number(room.bounds.minZ) + Number(room.bounds.maxZ)) * .5,
    };
  }
  const rect = room.rect;
  if (Array.isArray(rect) && rect.length >= 4) {
    return { x: Number(rect[0]) + Number(rect[2]) * .5, z: Number(rect[1]) + Number(rect[3]) * .5 };
  }
  return null;
}

function pushBox(target, position, size, rotationY = 0, rotationZ = 0, tag = '') {
  target.push({ position: position.clone(), size: [...size], rotationY, rotationZ, tag });
}

function matrixFor(entry) {
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, entry.rotationY || 0, entry.rotationZ || 0));
  return new THREE.Matrix4().compose(entry.position, quaternion, new THREE.Vector3(...entry.size));
}

function instanced(parent, geometry, material, entries, name, role, options = {}) {
  if (!entries.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
  mesh.name = name;
  mesh.castShadow = options.castShadow === true;
  mesh.receiveShadow = options.receiveShadow !== false;
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  entries.forEach((entry, index) => mesh.setMatrixAt(index, matrixFor(entry)));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData.afterlifeMapDesign = VERSION;
  mesh.userData.afterlifeSurfaceRole = role;
  // These materials are already authored for the afterlife pass. Mark the
  // pooled draw as one-shot so the later room-surface traversal does not clone
  // them and strand an unreachable material when a world is retired.
  mesh.userData.afterlifeSkip = true;
  mesh.userData.mapEntries = entries.length;
  parent.add(mesh);
  return mesh;
}

function openingBeats(course, profile, max = 4) {
  const raw = Array.isArray(course.openings)
    ? course.openings
      .filter(opening => opening && opening.kind !== 'vent' && Number(opening.width ?? opening.widthCells ?? 0) >= 1)
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : [];
  if (!raw.length) return [];
  const axial = raw.filter(opening => opening.axis === 'h' || opening.axis === 'v');
  const candidates = axial.length ? axial : raw;
  const selected = [];
  const take = opening => {
    if (!opening || selected.some(item => item.id === opening.id)) return;
    selected.push(opening);
  };
  take(candidates[0]);
  take(candidates[Math.floor((candidates.length - 1) * .46)]);
  take(candidates[Math.floor((candidates.length - 1) * .76)]);
  const objective = candidates.find(opening => opening.lockedBy === 'key' || opening.kind === 'gate')
    || candidates[candidates.length - 1];
  take(objective);
  return selected.slice(0, max).map((opening, index) => ({ opening, index, profile }));
}

function appendOpeningFrame(frames, occluders, vanes, signals, beat, profile) {
  const opening = beat.opening;
  const anchor = opening.anchor || { x: opening.x, y: opening.y };
  const center = new THREE.Vector3(Number(anchor?.x || 0) * CELL, 0, Number(anchor?.y || anchor?.z || 0) * CELL);
  const horizontal = opening.axis === 'h' || opening.axis === undefined
    ? opening.side === 'n' || opening.side === 's' || opening.axis === 'h'
    : false;
  const rawWidth = Number(opening.widthCells ?? opening.width ?? 2.2);
  const span = clamp(rawWidth * CELL, 5.2, 19.4);
  const frameWidth = span + 1.1;
  const height = profile.height - (beat.index % 2) * .12;
  const rotationY = horizontal ? 0 : Math.PI / 2;
  const tangent = horizontal ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  const normal = horizontal ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  const side = opening.side === 's' || opening.side === 'e' ? 1 : -1;
  const frameHalf = frameWidth * .5;
  const postSize = [.3, height, .34];
  pushBox(frames, center.clone().add(tangent.clone().multiplyScalar(-frameHalf)), postSize, rotationY, 0, 'threshold:' + opening.id + ':left');
  pushBox(frames, center.clone().add(tangent.clone().multiplyScalar(frameHalf)), postSize, rotationY, 0, 'threshold:' + opening.id + ':right');
  pushBox(frames, center.clone().setY(height), [frameWidth, .28, .38], rotationY, 0, 'threshold:' + opening.id + ':lintel');
  pushBox(frames, center.clone().setY(height - .37).add(normal.clone().multiplyScalar(-.14)), [frameWidth * .78, .12, .08], rotationY, 0, 'threshold:' + opening.id + ':recess');
  const finSide = profile.stagger * (beat.index % 2 ? -1 : 1);
  const fin = center.clone().add(tangent.clone().multiplyScalar(finSide * (frameHalf + .55))).add(normal.clone().multiplyScalar(-side * .48));
  pushBox(occluders, fin, [1.2, 2.65, .42], rotationY, finSide * .045, 'edge-screen:' + opening.id);
  const vane = center.clone().setY(profile.ceiling).add(normal.clone().multiplyScalar(-side * .15));
  pushBox(vanes, vane, [frameWidth * .78, .18, .32], rotationY, 0, 'ceiling-vane:' + opening.id);
  const signal = center.clone().setY(height - .63).add(normal.clone().multiplyScalar(-side * .27));
  pushBox(signals, signal, [.46, .09, .055], rotationY, 0, 'threshold-signal:' + opening.id);
  beat.world = center;
  beat.horizontal = horizontal;
  beat.frameWidth = frameWidth;
  beat.side = side;
  beat.tangent = tangent;
  beat.normal = normal;
}

function storyOpeningCandidates(course) {
  const openings = Array.isArray(course.openings)
    ? course.openings
      .filter(opening => opening && opening.kind !== 'vent' && Number(opening.width ?? opening.widthCells ?? 0) >= 1)
      .filter(opening => opening.axis === 'h' || opening.axis === 'v')
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : [];
  if (!openings.length) return { divider: null, silhouette: null };
  const entryRoomId = course.rooms?.[0]?.id;
  const firstRoomId = course.rooms?.[1]?.id;
  const divider = openings.find(opening => opening.room === firstRoomId)
    || openings.find(opening => opening.room && opening.room !== entryRoomId)
    || openings[1]
    || openings[0];
  const silhouette = openings.find(opening => opening !== divider
    && Number(opening.order ?? 0) > Number(divider?.order ?? -1)
    && opening.room !== entryRoomId)
    || openings.find(opening => opening !== divider)
    || divider;
  return { divider, silhouette };
}

function appendStoryComposition(occluders, vanes, signals, course, profile, composition) {
  const { divider, silhouette } = storyOpeningCandidates(course);
  const appendOpeningInfo = opening => {
    if (!opening) return null;
    const anchor = opening.anchor || { x: opening.x, y: opening.y };
    const center = new THREE.Vector3(Number(anchor?.x || 0) * CELL, 0, Number(anchor?.y || anchor?.z || 0) * CELL);
    const horizontal = opening.axis !== 'v';
    const rawWidth = Number(opening.widthCells ?? opening.width ?? 2.2);
    const span = clamp(rawWidth * CELL, 5.2, 19.4);
    const rotationY = horizontal ? 0 : Math.PI / 2;
    const tangent = horizontal ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    const normal = horizontal ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const side = opening.side === 's' || opening.side === 'e' ? 1 : -1;
    return { opening, center, horizontal, span, frameHalf: (span + 1.1) * .5, rotationY, tangent, normal, side };
  };

  const dividerInfo = appendOpeningInfo(divider);
  if (dividerInfo) {
    // The divider sits just beyond one jamb, with its base on the floor. The
    // opening's center lane stays clear while the edge piece catches a player
    // height sightline one room ahead.
    const edgeSide = profile.stagger;
    const edge = dividerInfo.center.clone()
      .addScaledVector(dividerInfo.tangent, edgeSide * (dividerInfo.frameHalf + .48))
      .addScaledVector(dividerInfo.normal, -dividerInfo.side * .72);
    edge.y = 1.12;
    pushBox(occluders, edge, [.88, 2.24, 1.12], dividerInfo.rotationY, 0, 'eye-divider:' + dividerInfo.opening.id);
    const signal = edge.clone()
      .addScaledVector(dividerInfo.normal, -dividerInfo.side * .57)
      .setY(1.68);
    pushBox(signals, signal, [.38, .08, .06], dividerInfo.rotationY, 0, 'eye-divider-signal:' + dividerInfo.opening.id);
    composition.divider = {
      id: dividerInfo.opening.id,
      roomId: dividerInfo.opening.room || '',
      anchor: [edge.x, edge.y, edge.z],
      openingCenter: [dividerInfo.center.x, dividerInfo.center.y, dividerInfo.center.z],
      edgeSide,
    };
  }

  const silhouetteInfo = appendOpeningInfo(silhouette);
  if (silhouetteInfo) {
    // A short high rail is kept lateral to the route. It reads as a ceiling
    // silhouette against the next room without becoming a floating lintel.
    const edgeSide = -profile.stagger;
    const high = silhouetteInfo.center.clone()
      .addScaledVector(silhouetteInfo.tangent, edgeSide * (silhouetteInfo.frameHalf + 1.05))
      .addScaledVector(silhouetteInfo.normal, -silhouetteInfo.side * .34);
    high.y = profile.ceiling;
    pushBox(vanes, high, [3.35, .16, .28], silhouetteInfo.rotationY, 0, 'lateral-ceiling-silhouette:' + silhouetteInfo.opening.id);
    composition.silhouette = {
      id: silhouetteInfo.opening.id,
      roomId: silhouetteInfo.opening.room || '',
      anchor: [high.x, high.y, high.z],
      edgeSide,
    };
  }
}

function routeSegments(course) {
  const layout = course.layout || course.world || {};
  const routes = Array.isArray(layout.routes) ? layout.routes : [];
  if (routes.length) {
    const primary = routes.find(route => route.role === 'primary' || route.combatLane) || routes[0];
    const points = (primary.points || []).map(point => localToWorldPoint(point, course, true));
    return points.length > 1 ? points : [];
  }
  // Story already receives threshold frames from its compiled opening graph.
  // Repeating a second frame kit along opening-to-opening chords would turn
  // the catacombs into a symmetrical firing gallery, especially in the long
  // halls. Its upper vanes remain attached to the selected thresholds.
  return [];
}

function appendRouteDesign(route, profile, frames, occluders, vanes, signals) {
  if (route.length < 2) return 0;
  let distance = 0;
  let beatIndex = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const start = route[i], end = route[i + 1];
    const delta = end.clone().sub(start);
    const length = Math.hypot(delta.x, delta.z);
    if (length < 2) continue;
    const tangent = new THREE.Vector3(delta.x / length, 0, delta.z / length);
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
    const steps = Math.max(1, Math.min(2, Math.floor(length / 15)));
    for (let step = 0; step < steps; step++) {
      const t = (step + 1) / (steps + 1);
      const center = start.clone().lerp(end, t);
      const side = profile.stagger * ((beatIndex + step) % 2 ? -1 : 1);
      const frameWidth = clamp(Math.min(10.6, length * .7), 6.5, 10.6);
      const frameHalf = frameWidth * .5;
      const yaw = Math.atan2(tangent.x, tangent.z);
      pushBox(frames, center.clone().add(normal.clone().multiplyScalar(-frameHalf)), [.28, profile.height, .34], yaw, 0, 'route-frame:' + i + ':' + step + ':a');
      pushBox(frames, center.clone().add(normal.clone().multiplyScalar(frameHalf)), [.28, profile.height, .34], yaw, 0, 'route-frame:' + i + ':' + step + ':b');
      pushBox(frames, center.clone().setY(profile.height), [frameWidth, .28, .38], yaw, 0, 'route-frame:' + i + ':' + step + ':lintel');
      const screen = center.clone().add(normal.clone().multiplyScalar(side * (frameHalf + .74))).add(tangent.clone().multiplyScalar(.9));
      pushBox(occluders, screen, [1.25, 2.7, .42], yaw, side * .045, 'route-screen:' + i + ':' + step);
      pushBox(vanes, center.clone().setY(profile.ceiling), [frameWidth * .76, .18, .32], yaw, 0, 'route-vane:' + i + ':' + step);
      pushBox(signals, center.clone().add(normal.clone().multiplyScalar(-side * .18)).setY(profile.height - .62), [.44, .09, .055], yaw, 0, 'route-signal:' + i + ':' + step);
      beatIndex++;
    }
    distance += length;
  }
  return distance;
}

function firstCourseLight(course) {
  const lights = Array.isArray(course.lights) ? course.lights : [];
  return lights.find(light => /entry|spawn/i.test(String(light?.role || '')))
    || lights[0]
    || null;
}

function courseSpawnWorld(course) {
  const spawn = course.playerSpawn;
  if (!spawn) return null;
  return localToWorldPoint([spawn.x, spawn.y], course, Boolean(course.campaign));
}

function firstLightWorld(course) {
  const light = firstCourseLight(course);
  if (!light?.anchor) return null;
  return { light, position: localToWorldPoint(light.anchor, course, Boolean(course.campaign)) };
}

function clearEntryTunnelPillar(course, position, profile) {
  if (!course.dungeon || !Array.isArray(course.setpieces)) return { position, adjusted: false, tunnelId: null };
  const tunnel = course.setpieces.find(item => item?.type === 'tunnel' && Array.isArray(item.points) && item.points.length > 1);
  if (!tunnel) return { position, adjusted: false, tunnelId: null };
  const center = localToWorldPoint(tunnel.points[0], course, Boolean(course.campaign));
  const next = localToWorldPoint(tunnel.points[1], course, Boolean(course.campaign));
  const tangent = next.clone().sub(center); tangent.y = 0;
  if (tangent.lengthSq() < .01) return { position, adjusted: false, tunnelId: tunnel.id || null };
  tangent.normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
  const relative = position.clone().sub(center);
  const along = relative.dot(tangent);
  const lateral = relative.dot(normal);
  const radius = clamp(Number(tunnel.width || 2.2) * CELL * .42, 1.35, 2.35);
  // Only correct the prop when it is actually inside the first jamb pair.
  // Keeping the light-pool position untouched farther down the approach avoids
  // turning this small clearance fix into a general layout rule.
  if (Math.abs(along) > 1.35 || Math.abs(lateral) > radius + .62) {
    return { position, adjusted: false, tunnelId: tunnel.id || null };
  }
  const side = profile.propSide >= 0 ? 1 : -1;
  const cleared = center.clone()
    .addScaledVector(normal, side * (radius + 1.05))
    .addScaledVector(tangent, clamp(along, -.55, .55));
  return { position: cleared, adjusted: true, tunnelId: tunnel.id || null };
}

function createPropSlots(course, profile) {
  const slots = [];
  const rooms = Array.isArray(course.rooms) ? course.rooms : [];
  const target = rooms.find(room => /secret|ward|vault|side|flank/i.test(roomLabel(room))) || rooms[1];
  const center = roomCenter(target);
  if (center) {
    const size = target.size || {};
    const halfW = Number(size.w ?? size[0] ?? 3) * .5;
    slots.push({
      kind: 'mourning-cabinet', id: 'mourning-cabinet:' + (target.id || 'room'),
      position: new THREE.Vector3((center.x + profile.propSide * Math.max(.5, halfW - .35)) * CELL, 0, center.z * CELL),
      rotation: profile.propSide < 0 ? Math.PI : 0, roomId: target.id || '', edge: true,
    });
  }
  const entry = rooms.find(room => /entry|spawn/i.test(roomLabel(room))) || rooms[0];
  const entryCenter = roomCenter(entry);
  if (entryCenter) {
    const spawnWorld = courseSpawnWorld(course) || new THREE.Vector3(entryCenter.x * CELL, 0, entryCenter.z * CELL);
    const heading = Number(course.playerSpawn?.angle);
    const forward = Number.isFinite(heading)
      ? new THREE.Vector3(Math.cos(heading), 0, Math.sin(heading)).normalize()
      : new THREE.Vector3(0, 0, -1);
    const lateral = new THREE.Vector3(-forward.z, 0, forward.x).normalize();
    const coldLight = firstLightWorld(course);
    const pool = coldLight?.position || spawnWorld.clone().addScaledVector(forward, 3.2);
    // Use the first authored practical as a readable reveal. The lateral
    // offset keeps the model beside the traversal lane and the small forward
    // offset keeps its silhouette inside that pool rather than behind spawn.
    const poolPosition = pool.clone()
      .addScaledVector(lateral, profile.propSide * 2.05)
      .addScaledVector(forward, .42);
    const cleared = clearEntryTunnelPillar(course, poolPosition, profile);
    slots.push({
      kind: 'wheelchair', id: 'wheelchair:' + (entry.id || 'entry'),
      position: cleared.position, rotation: Math.atan2(forward.x, forward.z) + Math.PI, roomId: entry.id || '', edge: true,
      anchor: coldLight?.light?.role || 'spawn-forward', lightingPool: true,
      pillarClearance: cleared.adjusted, clearanceFrom: cleared.tunnelId,
    });
  }
  return slots;
}

function roomLabel(room) {
  return String(room?.kind || '') + ' ' + String(room?.role || '') + ' ' + String(room?.name || '');
}

function attachExternalProps(parent, slots, materials, course, profile, options, diagnostics) {
  const factories = options.propFactories || {};
  const provided = options.externalProps || [];
  for (const slot of slots) {
    let object = null;
    const factory = factories[slot.kind] || factories[slot.id];
    if (typeof factory === 'function') {
      try {
        object = factory({ slot, materials, course, profile });
      } catch (error) {
        diagnostics.externalPropErrors.push(slot.id + ': ' + (error?.message || error));
      }
    } else {
      const item = provided.find(candidate => candidate?.id === slot.id || candidate?.kind === slot.kind);
      object = item?.root || item || null;
    }
    if (!object?.isObject3D) {
      diagnostics.externalPropsMissing.push(slot.id);
      continue;
    }
    object.position.copy(slot.position);
    object.rotation.y = slot.rotation;
    object.userData = { ...(object.userData || {}), afterlifeMapProp: true, afterlifeMapSlot: slot.id, afterlifeSkip: true };
    parent.add(object);
    diagnostics.externalPropsAttached.push(slot.id);
  }
}

function triangles(geometry, count) {
  const indexed = geometry?.index?.count;
  const vertices = geometry?.attributes?.position?.count || 0;
  return Math.round((indexed || vertices) / 3) * count;
}

function ownedMaterials(root) {
  const values = [];
  root.traverse(node => {
    const list = node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : [];
    for (const material of list) if (material?.userData?.afterlifeMapDesign === VERSION && !values.includes(material)) values.push(material);
  });
  return values;
}

function collectExternalResources(root) {
  const geometries = new Set();
  const materials = new Set();
  root.traverse(node => {
    let external = false;
    for (let parent = node; parent && parent !== root; parent = parent.parent) {
      if (parent.userData?.afterlifeMapProp) {
        external = true;
        break;
      }
    }
    if (!external) return;
    if (node.geometry && !node.geometry.userData?.sharedAsset) geometries.add(node.geometry);
    const list = node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : [];
    for (const material of list) if (material && !material.userData?.sharedLibrary) materials.add(material);
  });
  return { geometries, materials };
}

function disposeExternalResources(resources) {
  for (const geometry of resources.geometries) geometry.dispose?.();
  for (const material of resources.materials) {
    for (const key of ['map', 'normalMap', 'roughnessMap', 'bumpMap', 'emissiveMap']) {
      const texture = material[key];
      if (texture && !texture.userData?.sharedAsset) texture.dispose?.();
    }
    material.dispose?.();
  }
}

/**
 * Add a bounded spatial-composition pass around an existing course.
 *
 * The pass consumes authored openings/routes but never changes cells, walls,
 * blocks, room gates, or collision ownership. Generated props can be supplied
 * through options.propFactories as wheelchair and mourning-cabinet factories.
 */
export function buildAfterlifeMapDesign(root, materials = {}, course = {}, options = {}) {
  if (!root) return { root: null, diagnostics: { name: 'AfterlifeMapDesign', version: VERSION, skipped: true }, dispose: () => {} };
  const existing = root.getObjectByName('AfterlifeMapDesign');
  if (existing?.userData?.afterlifeMapDesignDiagnostics) {
    return { root: existing, diagnostics: existing.userData.afterlifeMapDesignDiagnostics, dispose: () => disposeAfterlifeMapDesign(existing) };
  }

  const profile = courseProfile(course);
  const mapRoot = new THREE.Group();
  mapRoot.name = 'AfterlifeMapDesign';
  mapRoot.userData.afterlifeMapDesign = VERSION;
  mapRoot.userData.noBatch = false;
  root.add(mapRoot);

  const frames = [], occluders = [], vanes = [], signals = [];
  const beats = openingBeats(course, profile, options.maxThresholds ?? (course.dungeon ? 4 : 3));
  const composition = {
    mode: course.dungeon ? 'story-edge-divider' : 'campaign-route',
    divider: null,
    silhouette: null,
  };
  if (course.dungeon) {
    appendStoryComposition(occluders, vanes, signals, course, profile, composition);
  } else {
    beats.forEach(beat => appendOpeningFrame(frames, occluders, vanes, signals, beat, profile));
  }
  const useBonePins = profile.id === 'ossuary' && beats.length > 0 && !course.dungeon;
  const roleMaterials = createMaterials(materials, profile, useBonePins);
  const route = routeSegments(course);
  const routeMeters = appendRouteDesign(route, profile, frames, occluders, vanes, signals);
  const propSlotList = createPropSlots(course, profile);
  const cabinetSlot = propSlotList.find(slot => slot.kind === 'mourning-cabinet');
  if (cabinetSlot && !options.propFactories?.['mourning-cabinet'] && !options.externalProps?.some(item => item?.id === cabinetSlot.id || item?.kind === cabinetSlot.kind)) {
    occluders.push({ position: cabinetSlot.position.clone(), size: [.9, 2.05, .42], rotationY: cabinetSlot.rotation, rotationZ: 0, tag: cabinetSlot.id });
  }

  const frameGeometry = new THREE.BoxGeometry(1, 1, 1);
  const shadowGeometry = new THREE.BoxGeometry(1, 1, 1);
  const signalGeometry = new THREE.BoxGeometry(1, 1, 1);
  const boneGeometry = useBonePins ? new THREE.BoxGeometry(1, 1, 1) : null;
  [frameGeometry, shadowGeometry, signalGeometry, boneGeometry].filter(Boolean).forEach(geometry => { geometry.userData.afterlifeMapDesign = VERSION; });
  const frameMesh = instanced(mapRoot, frameGeometry, roleMaterials.frame, frames, 'AfterlifeThresholdFrames', 'roomTrim', { castShadow: true });
  const shadowMesh = instanced(mapRoot, shadowGeometry, roleMaterials.shadow, occluders, 'AfterlifeSightlineBreaks', 'roomRecess', { castShadow: true });
  const vaneMesh = instanced(mapRoot, shadowGeometry, roleMaterials.shadow, vanes, 'AfterlifeUpperSilhouette', 'roomRecess', { castShadow: false });
  const signalMesh = instanced(mapRoot, signalGeometry, roleMaterials.signal, signals, 'AfterlifeThresholdSignals', 'roomAccent', { castShadow: false, receiveShadow: false });
  const boneEntries = useBonePins ? beats.map(beat => ({
    position: beat.world.clone().add(new THREE.Vector3(0, profile.height - .95, 0)),
    size: [.12, 1.1, .12], rotationY: beat.horizontal ? 0 : Math.PI / 2,
    rotationZ: beat.index % 2 ? -.13 : .13, tag: 'bone-sightline:' + beat.opening.id,
  })) : [];
  const boneMesh = useBonePins
    ? instanced(mapRoot, boneGeometry, roleMaterials.bone, boneEntries, 'AfterlifeReliquaryPins', 'roomBone', { castShadow: false })
    : null;

  const diagnostics = {
    name: 'AfterlifeMapDesign', version: VERSION,
    courseId: String(course.id || course.sectorId || course.index || 'course'),
    profile: profile.id, thresholds: beats.length,
    routeMeters: Math.round(routeMeters * 10) / 10,
    sightlineBreaks: occluders.length, upperSilhouettePieces: vanes.length,
    composition,
    propsFallback: cabinetSlot && !options.propFactories?.['mourning-cabinet'] ? 1 : 0,
    draws: [frameMesh, shadowMesh, vaneMesh, signalMesh, boneMesh].filter(Boolean).length,
    triangles: triangles(frameGeometry, frames.length)
      + triangles(shadowGeometry, occluders.length + vanes.length)
      + triangles(signalGeometry, signals.length)
      + triangles(boneGeometry, boneMesh ? boneEntries.length : 0),
    propSlots: propSlotList.map(slot => ({
      id: slot.id, kind: slot.kind, roomId: slot.roomId,
      position: [slot.position.x, slot.position.y, slot.position.z],
      anchor: slot.anchor || null, lightingPool: slot.lightingPool === true,
      pillarClearance: slot.pillarClearance === true, clearanceFrom: slot.clearanceFrom || null,
    })),
    externalPropsAttached: [], externalPropsMissing: [], externalPropErrors: [],
    collisionChanged: false,
  };
  attachExternalProps(mapRoot, propSlotList, materials, course, profile, options, diagnostics);
  mapRoot.userData.afterlifeMapDesignDiagnostics = diagnostics;
  mapRoot.userData.afterlifeMapDesignOwned = true;
  mapRoot.userData.afterlifeMapProfile = profile.id;
  return { root: mapRoot, diagnostics, dispose: () => disposeAfterlifeMapDesign(mapRoot) };
}

export function disposeAfterlifeMapDesign(root) {
  if (!root) return;
  const externalResources = collectExternalResources(root);
  const parent = root.parent;
  if (parent) parent.remove(root);
  const materials = ownedMaterials(root);
  const geometries = [];
  root.traverse(node => {
    if (node.geometry && node.geometry.userData?.afterlifeMapDesign === VERSION && !geometries.includes(node.geometry)) geometries.push(node.geometry);
  });
  for (const geometry of geometries) geometry.dispose?.();
  for (const material of materials) material.dispose?.();
  disposeExternalResources(externalResources);
  root.userData.afterlifeMapDesignDisposed = true;
}

export function afterlifeMapDesignDiagnostics(root) {
  return { ...(root?.userData?.afterlifeMapDesignDiagnostics || { name: 'AfterlifeMapDesign', version: VERSION, missing: true }) };
}

export { CELL, PROFILES };
export default buildAfterlifeMapDesign;
