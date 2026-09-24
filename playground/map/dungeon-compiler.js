// Story-mode dungeon compiler.
//
// The authored dungeon describes rooms, corridors and openings in gameplay
// cells. This module turns that description into the exact cell bitfield the
// simulation uses ([north, east, south, west] wall sides per cell), so the
// playground can draw the real thing and the engine can consume it unchanged.
//
// Design rules enforced here:
//   * room footprints follow their authored structural profiles,
//   * corridors are swept to their true width outside every room footprint,
//   * every connection between a room and the rest of the level is an authored
//     opening (arch / door / gate / lift / vent), never an accident of overlap,
//   * cover blocks are punched into rooms but never into an opening ring, so a
//     pillar can never seal a doorway,
//   * a locked door can only be opened by a key that is reachable without it.

import { reachableCells } from '../../campaign.js';
import { CELL, blockCells, cloneCells, loopStats, pathMetrics, pathPoints, shortestPath, wallSegments } from './grid.js';

const SIDE_VECTORS = {
  n: { dx: 0, dz: -1, axis: 'h' },
  s: { dx: 0, dz: 1, axis: 'h' },
  w: { dx: -1, dz: 0, axis: 'v' },
  e: { dx: 1, dz: 0, axis: 'v' },
};

const ROOM_SHAPE_PROFILES = Object.freeze({
  threshold: { bevel: 1 },
  throat: { bevel: 1 },
  chamfer: { bevel: 1 },
  octagon: { bevel: 2 },
  crossing: { bevel: 1, bays: 'all' },
  bay: { bevel: 1, bays: 'long' },
  gallery: { bevel: 1, bays: 'long-pair' },
  aisle: { bevel: 1, bays: 'long-single' },
  bastion: { bevel: 1, bays: 'short' },
  alcove: { bevel: 1, bays: 'quiet-side' },
  square: { bevel: 0 },
});

function openingCellsForRoom(room, openings) {
  const protectedCells = new Set();
  const { minX, minZ, maxX, maxZ } = room.bounds;
  for (const opening of openings || []) {
    if (opening.room !== room.id) continue;
    const side = SIDE_VECTORS[opening.side];
    if (!side) continue;
    const span = Math.max(1, Math.round(opening.width || 3));
    const start = Math.round(opening.at - (span - 1) / 2);
    if (side.axis === 'h') {
      const z = opening.side === 'n' ? minZ : maxZ - 1;
      for (let x = start; x < start + span; x += 1) protectedCells.add(`${x},${z}`);
    } else {
      const x = opening.side === 'w' ? minX : maxX - 1;
      for (let z = start; z < start + span; z += 1) protectedCells.add(`${x},${z}`);
    }
  }
  return protectedCells;
}

function roomFootprint(room, protectedCells) {
  const { minX, minZ, maxX, maxZ } = room.bounds;
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const profile = ROOM_SHAPE_PROFILES[room.shape] || ROOM_SHAPE_PROFILES.chamfer;
  const bevel = Math.max(0, Math.min(
    profile.bevel,
    Math.floor((width - 1) / 2),
    Math.floor((depth - 1) / 2),
  ));
  const cut = new Set();

  // Two-step clips turn larger arenas into faceted courts; one-step clips keep
  // thresholds and small wards broad enough for their authored doors.
  for (let y = 0; y < depth; y += 1) {
    const fromNorth = Math.max(0, bevel - y);
    const fromSouth = Math.max(0, bevel - (depth - 1 - y));
    const inset = Math.max(fromNorth, fromSouth);
    for (let x = 0; x < inset; x += 1) {
      cut.add(`${minX + x},${minZ + y}`);
      cut.add(`${maxX - 1 - x},${minZ + y}`);
    }
  }

  // Shallow wall bays break up long blank faces and give the route a visible
  // beat. Authored opening cells are restored after all shape cuts are made.
  const bayMode = profile.bays;
  if (bayMode) {
    const longX = width >= depth;
    let sides;
    if (bayMode === 'all') sides = ['n', 'e', 's', 'w'];
    else if (bayMode === 'short') sides = longX ? ['w', 'e'] : ['n', 's'];
    else if (bayMode === 'quiet-side') {
      const openSides = new Set(room.openingSides || []);
      const candidate = ['n', 'e', 's', 'w'].find(side => !openSides.has(side));
      sides = candidate ? [candidate] : [];
    } else sides = longX ? ['n', 's'] : ['w', 'e'];

    const count = bayMode === 'long-pair' ? 2 : 1;
    for (const side of sides) {
      const span = side === 'n' || side === 's' ? width : depth;
      if (span < 6 && bayMode !== 'all' && bayMode !== 'short') continue;
      const margin = span >= 7 ? 1 : 0;
      for (let i = 0; i < count; i += 1) {
        const along = Math.round((span - 1) * (i + 1) / (count + 1));
        if (along < margin || along >= span - margin) continue;
        const x = side === 'w' ? minX : side === 'e' ? maxX - 1 : minX + along;
        const z = side === 'n' ? minZ : side === 's' ? maxZ - 1 : minZ + along;
        cut.add(`${x},${z}`);
      }
    }
  }

  const footprint = [];
  let areaCells = 0;
  for (let y = 0; y < depth; y += 1) {
    let row = '';
    for (let x = 0; x < width; x += 1) {
      const key = `${minX + x},${minZ + y}`;
      const walkable = !cut.has(key) || protectedCells.has(key);
      row += walkable ? '1' : '0';
      if (walkable) areaCells += 1;
    }
    footprint.push(row);
  }
  room.areaCells = areaCells;
  room.footprint = footprint;
}

export function roomContainsCell(room, x, z) {
  const cellX = Math.floor(x);
  const cellZ = Math.floor(z);
  if (!room || cellX < room.bounds.minX || cellX >= room.bounds.maxX || cellZ < room.bounds.minZ || cellZ >= room.bounds.maxZ) return false;
  if (!room.footprint) return true;
  return room.footprint[cellZ - room.bounds.minZ]?.[cellX - room.bounds.minX] === '1';
}

export const OPENING_KINDS = Object.freeze({
  arch: { alwaysOpen: true, label: 'arch' },
  door: { alwaysOpen: false, label: 'blast door' },
  gate: { alwaysOpen: false, label: 'key gate' },
  lift: { alwaysOpen: true, label: 'lift' },
  stair: { alwaysOpen: true, label: 'stair' },
  vent: { alwaysOpen: false, label: 'vent crawl' },
});

export function compileLayer(layer) {
  const width = layer.width;
  const height = layer.height;
  const size = width * height;
  const open = new Uint8Array(size);
  // Cell labels feed the room-graph loop metric: positive ids for rooms and
  // corridors, -1 for solid or unlabelled threshold vestibules.
  const labels = new Map();
  const cellLabel = new Int32Array(size).fill(-1);
  let nextLabel = 1;
  const labelFor = key => {
    if (!labels.has(key)) labels.set(key, nextLabel++);
    return labels.get(key);
  };

  const index = (x, z) => z * width + x;
  const inside = (x, z) => x >= 0 && z >= 0 && x < width && z < height;
  const setOpen = (x, z) => {
    if (inside(x, z)) open[index(x, z)] = 1;
  };
  const isOpen = (x, z) => inside(x, z) && open[index(x, z)] === 1;

  const rooms = layer.rooms.map((room, order) => {
    const [x, z, w, h] = room.rect;
    const compiledRoom = {
      ...room,
      order,
      bounds: { minX: x, minZ: z, maxX: x + w, maxZ: z + h },
      center: { x: x + w / 2, y: z + h / 2 },
      size: { w, d: h },
      areaCells: 0,
      areaSqMeters: w * h * CELL * CELL,
      color: room.color,
    };
    compiledRoom.openingSides = (layer.openings || [])
      .filter(opening => opening.room === room.id)
      .map(opening => opening.side);
    roomFootprint(compiledRoom, openingCellsForRoom(compiledRoom, layer.openings));
    compiledRoom.areaSqMeters = compiledRoom.areaCells * CELL * CELL;
    return compiledRoom;
  });
  const roomAt = (x, z) => rooms.find(room => roomContainsCell(room, x, z)) || null;
  // Corridors may never carve through a room's bounding footprint. This also
  // keeps deliberate wall bays as rock instead of accidental side passages.
  const inAnyRoom = (x, z) => rooms.some(room => (
    x >= room.bounds.minX && x < room.bounds.maxX
    && z >= room.bounds.minZ && z < room.bounds.maxZ
  ));

  // 1 — Rooms use their authored structural footprint.
  for (const room of rooms) {
    const label = labelFor(`room:${room.id}`);
    for (let z = room.bounds.minZ; z < room.bounds.maxZ; z += 1) {
      for (let x = room.bounds.minX; x < room.bounds.maxX; x += 1) {
        if (!roomContainsCell(room, x, z)) continue;
        setOpen(x, z);
        cellLabel[index(x, z)] = label;
      }
    }
  }

  // 2 — Corridors carve lanes but never punch through a room footprint.
  const corridors = (layer.corridors || []).map((corridor, order) => {
    const half = Math.max(0.5, corridor.width / 2);
    const points = corridor.points;
    const label = labelFor(`corridor:${corridor.id}`);
    let lengthCells = 0;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const distance = Math.hypot(b[0] - a[0], b[1] - a[1]);
      lengthCells += distance;
      const vx = b[0] - a[0];
      const vz = b[1] - a[1];
      const lengthSquared = vx * vx + vz * vz;
      const minX = Math.max(0, Math.floor(Math.min(a[0], b[0]) - half - 1));
      const maxX = Math.min(width - 1, Math.ceil(Math.max(a[0], b[0]) + half + 1));
      const minZ = Math.max(0, Math.floor(Math.min(a[1], b[1]) - half - 1));
      const maxZ = Math.min(height - 1, Math.ceil(Math.max(a[1], b[1]) + half + 1));
      for (let z = minZ; z <= maxZ; z += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const cx = x + 0.5;
          const cz = z + 0.5;
          const t = lengthSquared > 0
            ? Math.max(0, Math.min(1, ((cx - a[0]) * vx + (cz - a[1]) * vz) / lengthSquared))
            : 0;
          const dx = cx - (a[0] + t * vx);
          const dz = cz - (a[1] + t * vz);
          if (dx * dx + dz * dz > half * half) continue;
          if (inAnyRoom(x, z)) continue;
          setOpen(x, z);
          cellLabel[index(x, z)] = label;
        }
      }
    }
    return { ...corridor, order, lengthCells, lengthMeters: lengthCells * CELL };
  });

  // 3 — Openings carve the threshold on both sides of a room wall.
  const openings = (layer.openings || []).map((opening, order) => {
    const room = rooms.find(candidate => candidate.id === opening.room);
    if (!room) throw new Error(`${layer.id}: opening ${opening.id} references missing room ${opening.room}`);
    const side = SIDE_VECTORS[opening.side];
    if (!side) throw new Error(`${layer.id}: opening ${opening.id} has invalid side ${opening.side}`);
    const span = Math.max(1, Math.round(opening.width || 3));
    const start = Math.round(opening.at - (span - 1) / 2);
    const edgeCells = [];
    const outerCells = [];
    if (side.axis === 'h') {
      const edgeZ = opening.side === 'n' ? room.bounds.minZ : room.bounds.maxZ - 1;
      const outerZ = edgeZ + side.dz;
      for (let x = start; x < start + span; x += 1) {
        edgeCells.push({ x, y: edgeZ });
        outerCells.push({ x, y: outerZ });
        setOpen(x, edgeZ);
        setOpen(x, outerZ);
      }
    } else {
      const edgeX = opening.side === 'w' ? room.bounds.minX : room.bounds.maxX - 1;
      const outerX = edgeX + side.dx;
      for (let z = start; z < start + span; z += 1) {
        edgeCells.push({ x: edgeX, y: z });
        outerCells.push({ x: outerX, y: z });
        setOpen(edgeX, z);
        setOpen(outerX, z);
      }
    }
    const axis = side.axis;
    const at = axis === 'h'
      ? (opening.side === 'n' ? room.bounds.minZ : room.bounds.maxZ)
      : (opening.side === 'w' ? room.bounds.minX : room.bounds.maxX);
    return {
      ...opening,
      order,
      axis,
      at,
      span: [start, start + span - 1],
      widthCells: span,
      roomId: room.id,
      kind: opening.kind || 'arch',
      lockedBy: opening.lockedBy || null,
      keyId: opening.key || null,
      edgeCells,
      outerCells,
      // Marker cell used by the top-down labels and the inspector.
      anchor: axis === 'h'
        ? { x: start + (span - 1) / 2, y: at }
        : { x: at, y: start + (span - 1) / 2 },
    };
  });

  // 4 — Cover: authored single cells and generated patterns, never on a
  // threshold ring so a door can never be blocked by its own room.
  const reserved = new Set();
  for (const opening of openings) {
    for (const cell of [...opening.edgeCells, ...opening.outerCells]) reserved.add(`${cell.x},${cell.y}`);
  }
  const blockSet = new Set();
  const addBlock = (x, z) => {
    if (!inside(x, z)) return;
    const room = roomAt(x, z);
    if (!room) return;
    if (reserved.has(`${x},${z}`)) return;
    blockSet.add(`${x},${z}`);
  };
  for (const room of rooms) {
    for (const [x, z] of room.cover || []) addBlock(x, z);
    for (const pattern of room.coverPatterns || []) {
      for (const [x, z] of expandPattern(pattern, room)) addBlock(x, z);
    }
  }
  for (const key of blockSet) {
    const [x, z] = key.split(',').map(Number);
    open[index(x, z)] = 0;
  }

  // 5 — Wall sides from the walkable mask, then re-seal every room boundary
  // that has no authored opening. Without this step a corridor running beside
  // a room would silently merge with it and the level would stop reading as
  // rooms-and-corridors.
  const openingEdges = new Set();
  for (const opening of openings) {
    if (opening.axis === 'h') {
      const row = Math.floor(opening.at);
      for (let x = opening.span[0]; x <= opening.span[1]; x += 1) openingEdges.add(`h:${x},${row}`);
    } else {
      const column = Math.floor(opening.at);
      for (let z = opening.span[0]; z <= opening.span[1]; z += 1) openingEdges.add(`v:${column},${z}`);
    }
  }
  const cells = new Array(size);
  for (let z = 0; z < height; z += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isOpen(x, z)) {
        cells[index(x, z)] = [1, 1, 1, 1];
        continue;
      }
      cells[index(x, z)] = [
        isOpen(x, z - 1) ? 0 : 1,
        isOpen(x + 1, z) ? 0 : 1,
        isOpen(x, z + 1) ? 0 : 1,
        isOpen(x - 1, z) ? 0 : 1,
      ];
    }
  }
  const opposite = [2, 3, 0, 1];
  const sealEdge = (x, z, direction) => {
    const nx = x + (direction === 1 ? 1 : direction === 3 ? -1 : 0);
    const nz = z + (direction === 2 ? 1 : direction === 0 ? -1 : 0);
    if (!isOpen(nx, nz)) return;
    const key = direction === 0 ? `h:${x},${z}`
      : direction === 2 ? `h:${x},${z + 1}`
        : direction === 1 ? `v:${x + 1},${z}`
          : `v:${x},${z}`;
    if (openingEdges.has(key)) return;
    cells[index(x, z)][direction] = 1;
    cells[index(nx, nz)][opposite[direction]] = 1;
  };
  for (const room of rooms) {
    for (let z = room.bounds.minZ; z < room.bounds.maxZ; z += 1) {
      for (let x = room.bounds.minX; x < room.bounds.maxX; x += 1) {
        if (!roomContainsCell(room, x, z) || !isOpen(x, z)) continue;
        const neighbours = [
          [x, z - 1],
          [x + 1, z],
          [x, z + 1],
          [x - 1, z],
        ];
        for (let direction = 0; direction < neighbours.length; direction += 1) {
          const [nx, nz] = neighbours[direction];
          if (!roomContainsCell(room, nx, nz)) sealEdge(x, z, direction);
        }
      }
    }
  }

  // 6 — Sealed variant closes every door, gate and vent for the start-of-run
  // read and for progression validation.
  const sealed = cloneCells(cells);
  const closeSpan = (target, opening, value) => {
    if (opening.axis === 'h') {
      const row = Math.floor(opening.at);
      for (let x = opening.span[0]; x <= opening.span[1]; x += 1) {
        if (!inside(x, row)) continue;
        target[index(x, row)][0] = value;
        if (inside(x, row - 1)) target[index(x, row - 1)][2] = value;
      }
    } else {
      const column = Math.floor(opening.at);
      for (let z = opening.span[0]; z <= opening.span[1]; z += 1) {
        if (!inside(column, z)) continue;
        target[index(column, z)][3] = value;
        if (inside(column - 1, z)) target[index(column - 1, z)][1] = value;
      }
    }
  };
  for (const opening of openings) {
    if (OPENING_KINDS[opening.kind]?.alwaysOpen) continue;
    closeSpan(sealed, opening, 1);
  }

  const entryPoint = { x: layer.entry.x, y: layer.entry.z };
  const exitPoint = { x: layer.exit.x, y: layer.exit.z };
  const reach = reachableCells(cells, width, height, entryPoint);
  const sealedReach = reachableCells(sealed, width, height, entryPoint);
  const path = shortestPath(cells, width, height, entryPoint, exitPoint);
  const sealedPath = shortestPath(sealed, width, height, entryPoint, exitPoint);
  const loops = loopStats(cells, width, height);
  const roomLoops = roomGraphLoops({ rooms, corridors, openings, cellLabel, width, height, labelFor });
  const blocks = blockCells(cells, width, height);
  // Only solid cells inside a room are cover; everything else is the rock the
  // level was carved out of and should read as background, not as hatch marks.
  const coverBlocks = blocks.filter(block => rooms.some(room => (
    roomContainsCell(room, block.x, block.y)
  )));
  // Only carved boundaries are drawn: the surrounding rock stays a solid mass
  // instead of reading as a lattice of outlined cells.
  const walls = wallSegments(cells, width, height, { boundaryOnly: true });

  for (const room of rooms) {
    let reachableCellsInRoom = 0;
    for (let z = room.bounds.minZ; z < room.bounds.maxZ; z += 1) {
      for (let x = room.bounds.minX; x < room.bounds.maxX; x += 1) {
        if (roomContainsCell(room, x, z) && reach.has(`${x},${z}`)) reachableCellsInRoom += 1;
      }
    }
    room.reachable = reachableCellsInRoom > 0;
    room.openCells = room.areaCells - blocks.filter(block => roomContainsCell(room, block.x, block.y)).length;
    room.openings = openings.filter(opening => opening.roomId === room.id).map(opening => opening.id);
  }

  const metrics = {
    widthCells: width,
    heightCells: height,
    areaSqMeters: width * height * CELL * CELL,
    walkableCells: loops.nodes,
    openPct: Math.round((loops.nodes / size) * 1000) / 10,
    coverCells: coverBlocks.length,
    solidCells: blocks.length,
    wallSegments: walls.length,
    routeMeters: pathMetrics(path).meters,
    routeTurns: pathMetrics(path).turns,
    routeCells: path?.length || 0,
    loops: roomLoops.loops,
    gridCycles: loops.loops,
    roomEdges: roomLoops.edges,
    roomNodes: roomLoops.nodes,
    deadEnds: loops.deadEnds,
    rooms: rooms.length,
    corridors: corridors.length,
    corridorMeters: Math.round(corridors.reduce((sum, corridor) => sum + corridor.lengthMeters, 0)),
    openings: openings.length,
    lockedOpenings: openings.filter(opening => !OPENING_KINDS[opening.kind]?.alwaysOpen).length,
    secrets: rooms.filter(room => room.kind === 'secret').length,
    keys: (layer.keys || []).length,
    enemyBudget: rooms.reduce((sum, room) => sum + (room.encounter?.budget || 0), 0),
  };

  return {
    ...layer,
    rooms,
    corridors,
    openings,
    keys: layer.keys || [],
    secrets: rooms.filter(room => room.kind === 'secret'),
    cells,
    sealedCells: sealed,
    blocks,
    coverBlocks,
    walls,
    reach,
    sealedReach,
    path: pathPoints(path),
    sealedPath: pathPoints(sealedPath),
    pathMetrics: pathMetrics(path),
    sealedPathMetrics: pathMetrics(sealedPath),
    metrics,
  };
}

function roomAtPoint(rooms, x, z) {
  return rooms.find(room => roomContainsCell(room, x, z)) || null;
}

function setOpeningCells(cells, width, height, opening, open) {
  const wall = open ? 0 : 1;
  if (opening.axis === 'h') {
    const row = Math.floor(opening.at);
    for (let x = opening.span[0]; x <= opening.span[1]; x += 1) {
      if (x < 0 || x >= width || row < 0 || row >= height) continue;
      cells[row * width + x][0] = wall;
      if (row > 0) cells[(row - 1) * width + x][2] = wall;
    }
  } else {
    const column = Math.floor(opening.at);
    for (let z = opening.span[0]; z <= opening.span[1]; z += 1) {
      if (z < 0 || z >= height || column < 0 || column >= width) continue;
      cells[z * width + column][3] = wall;
      if (column > 0) cells[z * width + column - 1][1] = wall;
    }
  }
}

function nearestReachablePoint(compiled, x, z) {
  let best = null;
  let bestDistance = Infinity;
  for (let cz = 0; cz < compiled.height; cz += 1) {
    for (let cx = 0; cx < compiled.width; cx += 1) {
      if (!compiled.reach.has(`${cx},${cz}`)) continue;
      const pointX = cx + .5;
      const pointZ = cz + .5;
      const distance = (pointX - x) ** 2 + (pointZ - z) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { x: pointX, y: pointZ };
      }
    }
  }
  return best;
}

// A room-clear threshold is released one wave before the first authored wave
// that enters its room. That gives players time to reach the arena while
// ensuring no encounter spawns behind a still-sealed gate.
export function roomClearEncounterSchedule(layer, compiled) {
  const firstWaveByRoom = new Map();
  for (const spot of layer.spots || []) {
    const point = nearestReachablePoint(compiled, spot.x, spot.z);
    const room = point && roomAtPoint(compiled.rooms, point.x, point.y);
    if (!room) continue;
    const wave = Math.max(0, Math.floor(Number(spot.wave) || 0));
    firstWaveByRoom.set(room.id, Math.min(firstWaveByRoom.get(room.id) ?? Infinity, wave));
  }
  const baseCells = cloneCells(compiled.sealedCells);
  for (const opening of compiled.openings) {
    const initiallyOpen = OPENING_KINDS[opening.kind]?.alwaysOpen
      || (!opening.lockedBy && !opening.secret && opening.kind !== 'vent');
    if (initiallyOpen || opening.lockedBy === 'room-clear') setOpeningCells(baseCells, compiled.width, compiled.height, opening, true);
  }
  const baseReach = reachableCells(baseCells, compiled.width, compiled.height, { x: layer.entry.x, y: layer.entry.z });
  const roomReachable = (room, reach) => {
    if (!room) return false;
    for (let z = room.bounds.minZ; z < room.bounds.maxZ; z += 1) {
      for (let x = room.bounds.minX; x < room.bounds.maxX; x += 1) {
        if (roomContainsCell(room, x, z) && reach.has(`${x},${z}`)) return true;
      }
    }
    return false;
  };
  return Object.fromEntries(compiled.openings
    .filter(opening => opening.lockedBy === 'room-clear')
    .map(opening => {
      const firstWave = firstWaveByRoom.get(opening.roomId);
      if (!Number.isInteger(firstWave)) return [opening.id, null];
      const closedCells = cloneCells(baseCells);
      setOpeningCells(closedCells, compiled.width, compiled.height, opening, false);
      const closedReach = reachableCells(closedCells, compiled.width, compiled.height, { x: layer.entry.x, y: layer.entry.z });
      let releaseWave = Math.max(0, firstWave - 1);
      for (const spot of layer.spots || []) {
        const point = nearestReachablePoint(compiled, spot.x, spot.z);
        const targetRoom = point && roomAtPoint(compiled.rooms, point.x, point.y);
        if (!roomReachable(targetRoom, baseReach) || roomReachable(targetRoom, closedReach)) continue;
        releaseWave = Math.min(releaseWave, Math.max(0, Math.floor(Number(spot.wave) || 0)));
      }
      return [opening.id, releaseWave];
    }));
}

export function encounterReachForWave(layer, compiled, waveIndex, schedule = roomClearEncounterSchedule(layer, compiled)) {
  const cells = cloneCells(compiled.sealedCells);
  for (const opening of compiled.openings) {
    const initiallyOpen = OPENING_KINDS[opening.kind]?.alwaysOpen
      || (!opening.lockedBy && !opening.secret && opening.kind !== 'vent');
    const encounterOpen = opening.lockedBy === 'room-clear'
      && Number.isInteger(schedule[opening.id])
      && schedule[opening.id] <= waveIndex;
    if (initiallyOpen || encounterOpen) setOpeningCells(cells, compiled.width, compiled.height, opening, true);
  }
  return reachableCells(cells, compiled.width, compiled.height, { x: layer.entry.x, y: layer.entry.z });
}

// Counts independent loops in the room/corridor graph rather than 2x2 floor
// quads. A hub with two routes back to the same hall counts as one loop, which
// is the number a level designer actually reasons about.
function roomGraphLoops({ rooms, corridors, openings, cellLabel, width, height, labelFor }) {
  const parent = new Map();
  const find = value => {
    if (!parent.has(value)) parent.set(value, value);
    let root = value;
    while (parent.get(root) !== root) root = parent.get(root);
    while (parent.get(value) !== root) {
      const next = parent.get(value);
      parent.set(value, root);
      value = next;
    }
    return root;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return false;
    parent.set(ra, rb);
    return true;
  };
  const pairs = new Set();
  const nodesUsed = new Set();
  const labelAt = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? -1 : cellLabel[y * width + x]);
  const neighbours = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  for (const opening of openings) {
    const roomLabel = labelFor(`room:${opening.roomId}`);
    for (const cell of opening.outerCells) {
      for (const [dx, dy] of neighbours) {
        const other = labelAt(cell.x + dx, cell.y + dy);
        if (other < 0 || other === roomLabel) continue;
        nodesUsed.add(roomLabel);
        nodesUsed.add(other);
        const key = roomLabel < other ? `${roomLabel}|${other}` : `${other}|${roomLabel}`;
        pairs.add(key);
      }
    }
  }
  for (const pair of pairs) {
    const [a, b] = pair.split('|').map(Number);
    union(a, b);
  }
  // Every distinct room/corridor pair is an edge; the spanning merges above
  // only resolve components, so cycles = edges - nodes + components.
  const edges = pairs.size;
  const roots = new Set();
  for (const node of nodesUsed) roots.add(find(node));
  return {
    nodes: nodesUsed.size,
    edges,
    loops: Math.max(0, edges - nodesUsed.size + roots.size),
    corridors: corridors.length,
    rooms: rooms.length,
  };
}

function expandPattern(pattern, room) {
  const cells = [];
  const { minX, minZ, maxX, maxZ } = room.bounds;
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const name = typeof pattern === 'string' ? pattern : pattern.type;
  const options = typeof pattern === 'string' ? {} : pattern;
  const spacing = Math.max(2, options.spacing || 3);
  if (name === 'colonnade') {
    for (let x = minX + 1; x < maxX - 1; x += spacing) {
      for (const z of [minZ + 1, maxZ - 2]) cells.push([x, z]);
    }
  } else if (name === 'corners') {
    const inset = Math.max(1, options.inset || 1);
    for (const x of [minX + inset, maxX - 1 - inset]) {
      for (const z of [minZ + inset, maxZ - 1 - inset]) cells.push([x, z]);
    }
  } else if (name === 'center') {
    const cx = Math.floor((minX + maxX) / 2);
    const cz = Math.floor((minZ + maxZ) / 2);
    const span = Math.max(1, options.span || 2);
    for (let x = cx - Math.floor(span / 2); x <= cx + Math.floor((span - 1) / 2); x += 1) {
      for (let z = cz - Math.floor(span / 2); z <= cz + Math.floor((span - 1) / 2); z += 1) cells.push([x, z]);
    }
  } else if (name === 'rows') {
    const every = Math.max(2, options.every || 3);
    const length = Math.max(1, options.length || Math.floor(width / 2));
    for (let z = minZ + 1; z < maxZ - 1; z += every) {
      for (let x = 0; x < length; x += 1) cells.push([minX + 1 + x, z]);
    }
  } else if (name === 'ring') {
    const inset = Math.max(1, options.inset || 2);
    const step = Math.max(2, options.step || 3);
    for (let x = minX + inset; x < maxX - inset; x += step) {
      cells.push([x, minZ + inset], [x, maxZ - 1 - inset]);
    }
    for (let z = minZ + inset; z < maxZ - inset; z += step) {
      cells.push([minX + inset, z], [maxX - 1 - inset, z]);
    }
  } else if (name === 'pillars') {
    for (let x = minX + 1; x < maxX - 1; x += spacing) {
      for (let z = minZ + 1; z < maxZ - 1; z += spacing) cells.push([x, z]);
    }
  } else if (name === 'checker') {
    for (let x = minX; x < maxX; x += 1) {
      for (let z = minZ; z < maxZ; z += 1) {
        if ((x + z) % 2 === 0) cells.push([x, z]);
      }
    }
  } else if (name === 'edge') {
    const side = options.side || 'n';
    const run = Math.max(1, options.run || width - 2);
    const start = Math.max(minX, Math.floor(options.from ?? minX + 1));
    for (let i = 0; i < run; i += 1) {
      if (side === 'n') cells.push([start + i, minZ + 1]);
      else if (side === 's') cells.push([start + i, maxZ - 2]);
      else if (side === 'w') cells.push([minX + 1, start - minX + i + minZ]);
      else cells.push([maxX - 2, start - minX + i + minZ]);
    }
  }
  return cells;
}

// Walks the level the way a player must: locked doors stay shut until their
// key is picked up, so a key placed behind its own door is reported instead of
// shipping as an unwinnable level.
export function validateProgression(layer, compiled) {
  const diagnostics = [];
  const { width, height } = compiled;
  const index = (x, z) => z * width + x;
  const entry = { x: layer.entry.x, y: layer.entry.z };
  const collected = new Set();
  let cells = cloneCells(compiled.cells);
  let reach = reachableCells(cells, width, height, entry);
  let progressed = true;
  let guard = 0;
  const closeOpening = opening => {
    if (opening.axis === 'h') {
      const row = Math.floor(opening.at);
      for (let x = opening.span[0]; x <= opening.span[1]; x += 1) {
        cells[index(x, row)][0] = 1;
        if (row - 1 >= 0) cells[index(x, row - 1)][2] = 1;
      }
    } else {
      const column = Math.floor(opening.at);
      for (let z = opening.span[0]; z <= opening.span[1]; z += 1) {
        cells[index(column, z)][3] = 1;
        if (column - 1 >= 0) cells[index(column - 1, z)][1] = 1;
      }
    }
  };
  while (progressed && guard < 32) {
    guard += 1;
    progressed = false;
    for (const key of compiled.keys) {
      if (collected.has(key.id)) continue;
      if (!reach.has(`${Math.floor(key.at[0])},${Math.floor(key.at[1])}`)) continue;
      collected.add(key.id);
      cells = cloneCells(compiled.cells);
      // Combat doors are assumed to open once their room is cleared; only key
      // gates can make a level unwinnable, so those are what this walk closes.
      for (const opening of compiled.openings) {
        if (!opening.keyId) continue;
        if (collected.has(opening.keyId)) continue;
        closeOpening(opening);
      }
      reach = reachableCells(cells, width, height, entry);
      progressed = true;
    }
  }
  for (const key of compiled.keys) {
    if (!collected.has(key.id)) {
      diagnostics.push({
        severity: 'error',
        code: 'key-unreachable',
        message: `${key.name} can never be picked up with the doors that guard it.`,
        at: { x: key.at[0], y: key.at[1] },
        itemId: key.id,
      });
    }
  }
  for (const opening of compiled.openings) {
    if (OPENING_KINDS[opening.kind]?.alwaysOpen) continue;
    const outer = opening.outerCells[Math.floor(opening.outerCells.length / 2)];
    if (outer && !reach.has(`${outer.x},${outer.y}`)) {
      diagnostics.push({
        severity: 'warn',
        code: 'door-side-unreachable',
        message: `${opening.id} has an approach that never opens during progression.`,
        at: { x: opening.anchor.x, y: opening.anchor.y },
        itemId: opening.id,
      });
    }
  }
  const exitReachable = reach.has(`${Math.floor(layer.exit.x)},${Math.floor(layer.exit.z)}`);
  if (!exitReachable) {
    diagnostics.push({
      severity: 'error',
      code: 'exit-unreachable',
      message: 'The exit cannot be reached even after collecting every reachable key.',
      at: { x: layer.exit.x, y: layer.exit.z },
      itemId: 'exit',
    });
  }
  return { diagnostics, collected: [...collected], exitReachable };
}

export function layerDiagnostics(layer, compiled) {
  const diagnostics = [];
  const push = (severity, code, message, at, itemId = null) => diagnostics.push({ severity, code, message, at, itemId });
  const encounterSchedule = roomClearEncounterSchedule(layer, compiled);
  for (const room of compiled.rooms) {
    if (!room.reachable) {
      push('error', 'room-unreachable', `${room.name} has no reachable floor from the entry.`, { x: room.center.x, y: room.center.y }, room.id);
    }
    if (!room.openings.length) {
      push('error', 'room-sealed', `${room.name} has no authored opening.`, { x: room.center.x, y: room.center.y }, room.id);
    }
    if (room.kind !== 'secret' && room.areaCells < 6) {
      push('warn', 'room-tight', `${room.name} is only ${room.size.w * CELL} × ${room.size.d * CELL} m.`, { x: room.center.x, y: room.center.y }, room.id);
    }
  }
  for (const corridor of compiled.corridors) {
    if (corridor.width < 2) {
      push('info', 'crawl-lane', `${corridor.id} is a ${corridor.width}-cell crawl.`, { x: corridor.points[0][0], y: corridor.points[0][1] }, corridor.id);
    }
  }
  for (const opening of compiled.openings) {
    const outer = opening.outerCells[Math.floor(opening.outerCells.length / 2)];
    if (!outer || !compiled.reach.has(`${outer.x},${outer.y}`)) {
      push('error', 'opening-dead', `${opening.id} does not connect to reachable floor.`, { x: opening.anchor.x, y: opening.anchor.y }, opening.id);
    }
    if (opening.widthCells < 2) {
      push('info', 'opening-narrow', `${opening.id} is a single-cell opening.`, { x: opening.anchor.x, y: opening.anchor.y }, opening.id);
    }
    if (opening.lockedBy === 'room-clear' && !Number.isInteger(encounterSchedule[opening.id])) {
      push('error', 'room-clear-no-wave', `${opening.id} guards ${opening.roomId}, but that room has no authored encounter wave to release it.`, { x: opening.anchor.x, y: opening.anchor.y }, opening.id);
    }
  }
  for (const spot of layer.spots || []) {
    const waveIndex = Math.max(0, Math.floor(Number(spot.wave) || 0));
    const target = nearestReachablePoint(compiled, spot.x, spot.z);
    if (!target) {
      push('error', 'spawn-no-floor', `${spot.id} has no walkable floor cell for its wave.`, { x: spot.x, y: spot.z }, spot.id);
      continue;
    }
    const room = roomAtPoint(compiled.rooms, target.x, target.y);
    if (!room) continue;
    const waveReach = encounterReachForWave(layer, compiled, waveIndex, encounterSchedule);
    let roomReachable = false;
    for (let z = room.bounds.minZ; z < room.bounds.maxZ && !roomReachable; z += 1) {
      for (let x = room.bounds.minX; x < room.bounds.maxX; x += 1) {
        if (roomContainsCell(room, x, z) && waveReach.has(`${x},${z}`)) { roomReachable = true; break; }
      }
    }
    if (!roomReachable) {
      push('error', 'spawn-gated', `${spot.id} targets ${room.name} in wave ${waveIndex + 1}, before its encounter gate can be reached.`, { x: spot.x, y: spot.z }, spot.id);
    }
  }
  for (const key of compiled.keys) {
    const room = compiled.rooms.find(candidate => candidate.id === key.roomId);
    if (!room) push('warn', 'key-room', `${key.name} is not placed inside a room.`, { x: key.at[0], y: key.at[1] }, key.id);
    else if (!compiled.reach.has(`${Math.floor(key.at[0])},${Math.floor(key.at[1])}`)) {
      push('error', 'key-in-cover', `${key.name} sits on solid cover and can never be picked up.`, { x: key.at[0], y: key.at[1] }, key.id);
    }
  }
  for (const secret of compiled.secrets) {
    const vent = compiled.openings.find(opening => opening.room === secret.id || opening.roomId === secret.id);
    if (!vent) push('warn', 'secret-no-vent', `${secret.name} has no vent or opening.`, { x: secret.center.x, y: secret.center.y }, secret.id);
  }
  if (compiled.metrics.loops < 2) {
    push('info', 'few-loops', `${layer.name} has ${compiled.metrics.loops} loop${compiled.metrics.loops === 1 ? '' : 's'}; Quake-style levels usually want at least two.`, { x: layer.entry.x, y: layer.entry.z }, layer.id);
  }
  if (compiled.metrics.deadEnds > 4) {
    push('info', 'dead-ends', `${compiled.metrics.deadEnds} dead-end cells; check each one has a reason to exist.`, { x: layer.entry.x, y: layer.entry.z }, layer.id);
  }
  return diagnostics;
}

export function compileDungeon(layers) {
  return layers.map(layer => {
    const compiled = compileLayer(layer);
    const progression = validateProgression(layer, compiled);
    compiled.diagnostics = [...layerDiagnostics(layer, compiled), ...progression.diagnostics];
    compiled.progression = progression;
    compiled.metrics.exitReachableAfterKeys = progression.exitReachable;
    return compiled;
  });
}
