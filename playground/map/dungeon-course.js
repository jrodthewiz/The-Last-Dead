// Adapts the authored Story descent to the live FPS course contract.
// Coordinates stay in the compiler's 4 m cells so collision, render geometry,
// enemy spawns, keys, and the map playground all use the same source.
import { DUNGEON_LAYERS } from './dungeon-data.js';
import { OPENING_KINDS, compileLayer, encounterReachForWave, roomClearEncounterSchedule } from './dungeon-compiler.js';
import { wallSegments } from './grid.js';
import { dungeonArtDirection } from '../../dungeon-art-direction.js';

const compiledLayers = new Map();
// Keep the first enemies in the entry room, but outside the player's opening melee range.
const START_WAVE_CLEARANCE = 3;

function compiledFor(index) {
  if (!compiledLayers.has(index)) compiledLayers.set(index, compileLayer(DUNGEON_LAYERS[index]));
  return compiledLayers.get(index);
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
  return rooms.find(room => x >= room.bounds.minX && x < room.bounds.maxX && z >= room.bounds.minZ && z < room.bounds.maxZ) || null;
}

export function makeDungeonCourse(index = 0) {
  const floorIndex = Math.max(0, Math.min(DUNGEON_LAYERS.length - 1, Math.floor(Number(index) || 0)));
  const layer = DUNGEON_LAYERS[floorIndex];
  const compiled = compiledFor(floorIndex);
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
    artDirection: dungeonArtDirection({ dungeon: true, id: layer.id }),
    waveCount,
    w: layer.width,
    h: layer.height,
    playerSpawn: { x: layer.entry.x, y: layer.entry.z, angle: layer.entry.angle },
    exit: { x: layer.exit.x, y: layer.exit.z },
    enemies: [],
    rooms: compiled.rooms,
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
  };

  const keyPositions = compiled.keys.map(key => ({
    key,
    position: nearestFloorPoint(compiled.reach, course.w, course.h, key.at[0], key.at[1]),
  }));
  // Keep pickup cells visually readable during combat. A wave spawn should
  // never cover the key that the player is meant to collect after the fight.
  const keyCells = new Set(keyPositions.map(({ position }) => `${position.cellX},${position.cellZ}`));
  const reservedByWave = Array.from({ length: waveCount }, () => new Set(keyCells));
  const entryRoom = roomAt(compiled.rooms, course.playerSpawn.x, course.playerSpawn.y);
  const reachByWave = Array.from({ length: waveCount }, (_, waveIndex) => (
    encounterReachForWave(layer, compiled, waveIndex, roomClearWaveByOpening)
  ));
  for (const spot of layer.spots) {
    const waveIndex = Math.max(0, Math.min(waveCount - 1, Math.floor(spot.wave)));
    const startWaveConstraints = waveIndex === 0
      ? { origin: course.playerSpawn, minDistance: START_WAVE_CLEARANCE, bounds: entryRoom?.bounds }
      : {};
    const position = nearestFloorPoint(reachByWave[waveIndex], course.w, course.h, spot.x, spot.z, reservedByWave[waveIndex], startWaveConstraints);
    const room = roomAt(compiled.rooms, position.x, position.y);
    course.waveSpawns[waveIndex].push({
      id: spot.id,
      x: position.x,
      y: position.y,
      variant: spot.variant,
      roomId: room?.id || null,
    });
  }

  for (const { key, position } of keyPositions) {
    course.keys.push({ ...key, x: position.x, y: position.y });
  }
  rebuildCells(course);
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
