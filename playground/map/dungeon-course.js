// Adapts the authored Story descent to the live FPS course contract.
// Coordinates stay in the compiler's 4 m cells so collision, render geometry,
// enemy spawns, keys, and the map playground all use the same source.
import { DUNGEON_LAYERS, DUNGEON_ROUTES } from './dungeon-data.js';
import { OPENING_KINDS, compileLayer, compileIngressGroups, encounterReachForWave, roomClearEncounterSchedule, roomContainsCell } from './dungeon-compiler.js';
import { wallSegments } from './grid.js';
import { dungeonArtDirection } from '../../dungeon-art-direction.js';
import { roomRecoveryPolicy } from '../../dungeon-encounter-design.js';
import { makeJourneyStations } from '../../campaign-journey.js';
import { extendDungeonLayer } from './dungeon-extension.js';

const compiledLayers = new Map();
const extendedLayouts = new Map();
// Keep the first enemies in the entry room, but outside the player's opening melee range.
const START_WAVE_CLEARANCE = 3;

function layoutFor(index, extended) {
  if (!extended) return { layer: DUNGEON_LAYERS[index], route: DUNGEON_ROUTES[index] };
  if (!extendedLayouts.has(index)) extendedLayouts.set(index, extendDungeonLayer(DUNGEON_LAYERS[index], DUNGEON_ROUTES[index]));
  return extendedLayouts.get(index);
}

function compiledFor(index, extended = false) {
  const key = `${index}:${extended}`;
  if (!compiledLayers.has(key)) compiledLayers.set(key, compileLayer(layoutFor(index, extended).layer));
  return compiledLayers.get(key);
}

function cloneCells(cells) {
  return cells.map(sides => [...sides]);
}

function openOpening(cells, width, height, opening) {
  const lo = opening.span[0];
  const hi = opening.span[1];
  if (opening.axis === 'h') {
    const row = Math.floor(opening.at);
    for (let x = lo; x <= hi; x += 1) {
      if (x < 0 || x >= width || row < 0 || row >= height) continue;
      cells[row * width + x][0] = 0;
      if (row > 0) cells[(row - 1) * width + x][2] = 0;
    }
  } else {
    const column = Math.floor(opening.at);
    for (let z = lo; z <= hi; z += 1) {
      if (z < 0 || z >= height || column < 0 || column >= width) continue;
      cells[z * width + column][3] = 0;
      if (column > 0) cells[z * width + column - 1][1] = 0;
    }
  }
}

function renderedWalls(course, compiled) {
  const cover = new Set(compiled.coverBlocks.map(block => `${block.x},${block.y}`));
  return wallSegments(course.cells, course.w, course.h, { boundaryOnly: true }).filter(segment => {
    const nx = segment.cx + (segment.direction === 1 ? 1 : segment.direction === 3 ? -1 : 0);
    const nz = segment.cy + (segment.direction === 2 ? 1 : segment.direction === 0 ? -1 : 0);
    return !cover.has(`${segment.cx},${segment.cy}`) && !cover.has(`${nx},${nz}`);
  });
}

function rebuildCells(course) {
  const compiled = course.dungeonCompiled;
  const cells = cloneCells(compiled.sealedCells);
  for (const opening of course.openings) {
    if (course.openingState[opening.id] || OPENING_KINDS[opening.kind]?.alwaysOpen) {
      openOpening(cells, course.w, course.h, opening);
    }
  }
  course.cells = cells;
  course.walls = renderedWalls(course, compiled);
  course.dungeonRevision = (course.dungeonRevision || 0) + 1;
}

function nearestFloorPoint(reach, width, height, x, z, reserved = new Set(), constraints = {}) {
  let best = null;
  let bestDistance = Infinity;
  for (let cz = 0; cz < height; cz += 1) {
    for (let cx = 0; cx < width; cx += 1) {
      if (!reach.has(`${cx},${cz}`) || reserved.has(`${cx},${cz}`)) continue;
      const px = cx + 0.5;
      const pz = cz + 0.5;
      const bounds = constraints.bounds;
      if (bounds && (px < bounds.minX || px >= bounds.maxX || pz < bounds.minZ || pz >= bounds.maxZ)) continue;
      const origin = constraints.origin;
      if (origin && (px - origin.x) ** 2 + (pz - origin.y) ** 2 < (constraints.minDistance || 0) ** 2) continue;
      const distance = (px - x) ** 2 + (pz - z) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { x: px, y: pz, cellX: cx, cellZ: cz };
      }
    }
  }
  if (!best) throw new Error('Story floor has no reachable cell for an authored spawn.');
  reserved.add(`${best.cellX},${best.cellZ}`);
  return best;
}

function roomAt(rooms, x, z) {
  return rooms.find(room => roomContainsCell(room, x, z)) || null;
}

export function makeDungeonCourse(index = 0, options = {}) {
  const floorIndex = Math.max(0, Math.min(DUNGEON_LAYERS.length - 1, Math.floor(Number(index) || 0)));
  const extended = options.extended === true;
  const { layer, route } = layoutFor(floorIndex, extended);
  const compiled = compiledFor(floorIndex, extended);
  const initiallyOpen = new Set(compiled.openings
    .filter(opening => OPENING_KINDS[opening.kind]?.alwaysOpen || (!opening.lockedBy && !opening.secret && opening.kind !== 'vent'))
    .map(opening => opening.id));
  const waveCount = Math.max(1, ...layer.spots.map(spot => Math.floor(spot.wave) + 1));
  const roomClearWaveByOpening = roomClearEncounterSchedule(layer, compiled);
  const course = {
    name: layer.name,
    tag: layer.tag,
    blurb: layer.dread,
    id: layer.id,
    index: floorIndex,
    sectorIndex: floorIndex,
    sectorCount: DUNGEON_LAYERS.length,
    sectorId: layer.theme,
    campaign: false,
    dungeon: true,
    dungeonIndex: floorIndex,
    dungeonCount: DUNGEON_LAYERS.length,
    extended,
    extension: extended ? { ...layer.extension,
      baseRouteMeters: compiledFor(floorIndex).metrics.routeMeters,
      routeMeters: compiled.metrics.routeMeters,
      routeRatio: compiled.metrics.routeMeters / compiledFor(floorIndex).metrics.routeMeters,
    } : null,
    artDirection: dungeonArtDirection({ dungeon: true, id: layer.id }),
    waveCount,
    w: layer.width,
    h: layer.height,
    playerSpawn: { x: layer.entry.x, y: layer.entry.z, angle: layer.entry.angle },
    exit: { x: layer.exit.x, y: layer.exit.z },
    enemies: [],
    route: [...route],
    encounterRoute: route.filter(id => compiled.rooms.some(room => room.id === id && room.encounter?.budget > 0 && room.identity?.beat !== 'resupply')),
    ingressGroups: compileIngressGroups(compiled),
    rooms: compiled.rooms.map(room => {
      const keyRoom = layer.keys.some(key => key.roomId === room.id);
      const branch = !route.includes(room.id);
      const role = room.kind === 'entry' ? 'entry' : room.kind === 'exit' ? 'exit'
        : keyRoom ? 'combat' : room.kind === 'secret' ? 'recovery'
        : room.encounter?.budget > 0 ? 'combat'
        : (layer.loot || []).some(item => item.roomId === room.id) ? 'supply' : 'recovery';
      return { ...room, flow: { role, optional: (branch || room.identity?.beat === 'resupply') && !keyRoom,
        sequence: branch ? route.length + room.order : route.indexOf(room.id),
        beat: room.identity?.beat || (role === 'exit' ? 'descent' : role === 'combat' ? 'ambush' : 'recovery'),
        landmark: room.identity?.landmark || room.name,
        landmarkId: layer.landmarks?.find(item => item.roomId === room.id)?.id || null,
        goal: room.identity?.goal || (keyRoom ? 'Recover the lift key' : role === 'combat' && (layer.loot || []).some(item => item.roomId === room.id)
          ? 'Clear the defenders and collect equipment' : role === 'supply' ? 'Collect equipment before pushing on'
          : role === 'recovery' ? 'Recover, then rejoin the forward route' : role === 'exit' ? 'Descend to the next floor'
          : 'Break through and keep moving') } };
    }),
    openings: compiled.openings,
    landmarks: layer.landmarks || [],
    machinery: layer.machinery || [],
    setpieces: layer.setpieces || [],
    lights: layer.lights || [],
    props: layer.props || [],
    scares: layer.scares || [],
    connections: layer.connections || [],
    blocks: compiled.coverBlocks.map(block => [block.x, block.y]),
    dungeonCompiled: compiled,
    openingState: Object.fromEntries(compiled.openings.map(opening => [opening.id, initiallyOpen.has(opening.id)])),
    dungeonRevision: 0,
    waveSpawns: Array.from({ length: waveCount }, () => []),
    roomClearWaveByOpening,
    keys: [],
    loot: [],
    evidence: [],
    supplies: [],
    evidenceTotal: DUNGEON_LAYERS.reduce((sum, floor) => sum + (floor.evidence || []).length, 0),
    startingWeapons: [...new Set([0, ...DUNGEON_LAYERS.slice(0, floorIndex)
      .flatMap(previous => (previous.loot || []).map(item => item.weaponIndex))])],
  };

  const keyPositions = compiled.keys.map(key => ({
    key,
    position: nearestFloorPoint(compiled.reach, course.w, course.h, key.at[0], key.at[1]),
  }));
  const lootReserved = new Set([
    ...compiled.coverBlocks.map(block => `${block.x},${block.y}`),
    ...keyPositions.map(({ position }) => `${position.cellX},${position.cellZ}`),
  ]);
  for (const item of layer.loot || []) {
    const targetRoom = compiled.rooms.find(room => room.id === item.roomId);
    if (!targetRoom) throw new Error(`${layer.id}/${item.id}: missing loot room ${item.roomId}`);
    const position = nearestFloorPoint(compiled.reach, course.w, course.h,
      item.at[0], item.at[1], lootReserved, { bounds: targetRoom.bounds });
    if (roomAt(compiled.rooms, position.x, position.y)?.id !== item.roomId) {
      throw new Error(`${layer.id}/${item.id}: loot escaped ${item.roomId}`);
    }
    course.loot.push({ ...item, x: position.x, y: position.y });
  }
  for (const item of layer.evidence || []) {
    const targetRoom = compiled.rooms.find(room => room.id === item.roomId);
    if (!targetRoom) throw new Error(`${layer.id}/${item.id}: missing evidence room ${item.roomId}`);
    const position = nearestFloorPoint(compiled.reach, course.w, course.h,
      item.at[0], item.at[1], lootReserved, { bounds: targetRoom.bounds });
    if (roomAt(compiled.rooms, position.x, position.y)?.id !== item.roomId) {
      throw new Error(`${layer.id}/${item.id}: evidence escaped ${item.roomId}`);
    }
    course.evidence.push({ ...item, x: position.x, y: position.y });
  }
  // Keep pickup cells visually readable during combat. A wave spawn should
  // never cover the key that the player is meant to collect after the fight.
  const keyCells = new Set([
    ...keyPositions.map(({ position }) => `${position.cellX},${position.cellZ}`),
    ...course.loot.map(item => `${Math.floor(item.x)},${Math.floor(item.y)}`),
    ...course.evidence.map(item => `${Math.floor(item.x)},${Math.floor(item.y)}`),
  ]);
  const reservedByWave = Array.from({ length: waveCount }, () => new Set(keyCells));
  const entryRoom = roomAt(compiled.rooms, course.playerSpawn.x, course.playerSpawn.y);
  const reachByWave = Array.from({ length: waveCount }, (_, waveIndex) => (
    encounterReachForWave(layer, compiled, waveIndex, roomClearWaveByOpening)
  ));
  for (const spot of layer.spots) {
    const waveIndex = Math.max(0, Math.min(waveCount - 1, Math.floor(spot.wave)));
    const annexRoom = spot.annex && course.rooms.find(room => room.id === spot.roomId);
    const startWaveConstraints = waveIndex === 0
      ? { origin: course.playerSpawn, minDistance: START_WAVE_CLEARANCE, bounds: entryRoom?.bounds }
      : annexRoom ? { bounds: annexRoom.bounds } : {};
    // Annex markers remain in their owner room while the original key keeps
    // the transfer corridor sealed. The room encounter scheduler activates
    // them only when the player actually reaches that wing.
    const spawnReach = annexRoom ? compiled.reach : reachByWave[waveIndex];
    const position = nearestFloorPoint(spawnReach, course.w, course.h, spot.x, spot.z, reservedByWave[waveIndex], startWaveConstraints);
    const room = roomAt(compiled.rooms, position.x, position.y);
    course.waveSpawns[waveIndex].push({
      id: spot.id,
      x: position.x,
      y: position.y,
      variant: spot.variant,
      roomId: room?.id || null,
    });
  }

  // Every authored main-route combat beat owns a real encounter, including
  // wards omitted by the old five-wave spot list. Keep legacy wave numbers
  // for gate release compatibility; flow.sequence owns the route order.
  for (const id of course.encounterRoute) {
    if(course.waveSpawns.some(spawns=>spawns.some(spawn=>spawn.roomId===id)))continue;
    const room=course.rooms.find(item=>item.id===id);
    const waveIndex=Math.min(waveCount-1,Math.max(1,Math.floor(room.flow.sequence/2)));
    const point=nearestFloorPoint(compiled.reach,course.w,course.h,room.center.x,room.center.y,
      reservedByWave[waveIndex],{bounds:room.bounds});
    const variants=Object.entries(room.encounter.composition||{}).flatMap(([variant,count])=>Array(count).fill(variant));
    course.waveSpawns[waveIndex].push({id:`${id}-route-threat`,x:point.x,y:point.y,variant:variants[0]||'stalker',roomId:id});
  }
  for(const room of course.rooms)room.encounter={...room.encounter,
    ingressOpeningIds:[...new Set(course.ingressGroups[room.id].map(group=>group.openingId))]};

  for (const { key, position } of keyPositions) {
    course.keys.push({ ...key, x: position.x, y: position.y });
  }
  // Side circulation remains open, except the foundry's final arena: opening
  // both court flanks immediately made the key detour cut through the final
  // fight on its way back to the hall. Its authored doors release together
  // after the approach, completing the ward/pump/gantry loop.
  course.flowOpenings = course.openings.filter(opening => opening.lockedBy === 'room-clear'
    && opening.roomId !== 'f1-court'
    && (opening.side === 'w' || opening.side === 'e')).map(opening => opening.id);
  for (const id of course.flowOpenings) course.openingState[id] = true;
  const entryOpening = course.openings.filter(opening => opening.roomId === entryRoom?.id
    && course.openingState[opening.id] && !opening.secret)
    .sort((a,b) => Math.hypot(a.anchor.x-course.playerSpawn.x,a.anchor.y-course.playerSpawn.y)
      - Math.hypot(b.anchor.x-course.playerSpawn.x,b.anchor.y-course.playerSpawn.y))[0];
  if (entryOpening) course.playerSpawn.angle = Math.atan2(entryOpening.anchor.y-course.playerSpawn.y,
    entryOpening.anchor.x-course.playerSpawn.x);
  for (const room of course.rooms) {
    const recovery = roomRecoveryPolicy(course, room);
    room.flow.safeRespite = recovery.isSafeRoom;
    room.flow.safeAfterClear = recovery.safeAfterClear;
    if (room.reward) room.reward = recovery.label;
    if (!recovery.hasSupply) continue;
    const position = nearestFloorPoint(compiled.reach, course.w, course.h, room.center.x, room.center.y,
      lootReserved, { bounds: room.bounds });
    course.supplies.push({ id: `${room.id}-supplies`, roomId: room.id, kind: 'recovery',
      x: position.x, y: position.y, health: recovery.health, energy: recovery.energy, label: recovery.label });
  }
  rebuildCells(course);
  // Reserve the wall instances once, including every closable doorway. Use
  // fully open passages for permanent dressing so props never float in a
  // doorway after it opens.
  const wallCells = cloneCells(compiled.sealedCells);
  const dressingCells = cloneCells(compiled.sealedCells);
  for (const opening of course.openings) {
    openOpening(dressingCells, course.w, course.h, opening);
    if (OPENING_KINDS[opening.kind]?.alwaysOpen) openOpening(wallCells, course.w, course.h, opening);
  }
  course.permanentWalls = renderedWalls({ ...course, cells: dressingCells }, compiled);
  const slots = new Map();
  const reserve = walls => walls.forEach(wall => slots.set(`${wall.horizontal ? 'h' : 'v'}:${wall.x}:${wall.z}`, wall));
  reserve(course.walls);
  reserve(course.permanentWalls);
  reserve(renderedWalls({ ...course, cells: wallCells }, compiled));
  // Opening a one-cell vent can expose its side walls, too. Reserve those
  // faces without retaining every buried wall inside solid map cells.
  for (const opening of course.openings) {
    const cells = cloneCells(wallCells);
    openOpening(cells, course.w, course.h, opening);
    reserve(renderedWalls({ ...course, cells }, compiled));
  }
  course.wallSlots = [...slots.values()];
  course.dressingCells = dressingCells;
  if (options.journey === true) {
    course.journeyEnabled = true;
    // The last shutdown requires all chambers cleared. Put its operating
    // point at the end of the added wing so it cannot require a return trip
    // to the original final chamber after the annex has been completed.
    if (extended && floorIndex === DUNGEON_LAYERS.length - 1) {
      const roomId = 'f5-hall3', annexId = `annex-${roomId}`;
      const stationRooms = course.rooms.filter(room => room.id !== roomId)
        .map(room => room.id === annexId ? { ...room, id: roomId } : room);
      const stationScenery = pieces => pieces.filter(piece => piece.roomId !== roomId)
        .map(piece => piece.roomId === annexId ? { ...piece, roomId } : piece);
      course.journeyStations = makeJourneyStations({ ...course, rooms: stationRooms,
        landmarks: stationScenery(course.landmarks), setpieces: stationScenery(course.setpieces) })
        .map(station => ({ ...station, roomId: annexId }));
    } else course.journeyStations = makeJourneyStations(course);
  }
  return course;
}

export function setDungeonOpeningOpen(course, openingId, open = true) {
  if (!course?.dungeon || !course.openingState || !(openingId in course.openingState)) return false;
  if (course.openingState[openingId] === Boolean(open)) return false;
  course.openingState[openingId] = Boolean(open);
  rebuildCells(course);
  return true;
}

export { DUNGEON_LAYERS };
