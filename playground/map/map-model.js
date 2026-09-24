// Top-down map playground model for The Last Dead.
//
// This module turns the authored campaign data into one flat, drawable scene.
// It is deliberately free of DOM and Three.js imports so the same scene the
// browser draws can be asserted from Node in tests/map-playground.test.mjs.
//
// Units: the authored layout is expressed in gameplay cells (1 cell = 4 m).
// Every geometric value this module returns stays in cell space; the renderer
// converts to metres only for the readouts and the scale bar.

import {
  CAMPAIGN_SECTORS,
  CAMPAIGN_MAPS,
  createCampaignCourse,
  canTraverse,
  reachableCells,
} from '../../campaign.js';
import { createRoomProgression, getRoomSequence, syncRoomGateCells } from '../../room-progression.js';
import { DUNGEON_LAYERS, DUNGEON_SUMMARY } from './dungeon-data.js';
import { makeDungeonCourse } from './dungeon-course.js';
import { compileDungeon } from './dungeon-compiler.js';
import {
  CELL as GRID_CELL,
  blockCells,
  cloneCells,
  pathMetrics,
  pathPoints,
  shortestPath,
  solidAt as gridSolidAt,
  wallSegments,
} from './grid.js';

export const CELL = GRID_CELL;
export const ARENA_CELLS = 12;
export const ARENA_METERS = ARENA_CELLS * CELL;

export const ZONE_ROLE_COLORS = Object.freeze({
  spawn: '#4f7dfb',
  'side-flank': '#f2a33c',
  'focal-encounter': '#e0503c',
  objective: '#43c98a',
  'cross-court': '#a86ef2',
});
export const ROUTE_ROLE_COLORS = Object.freeze({
  primary: '#ffd479',
  flank: '#f2a33c',
  'cross-court': '#a86ef2',
});
export const ROOM_STYLE_COLORS = Object.freeze(['#7fb2ff', '#f2a33c', '#e0503c', '#43c98a']);
export const SETPIECE_COLORS = Object.freeze({
  tunnel: '#ff7a90',
  collapse: '#d9a05b',
  bulkhead: '#8fb7d9',
  'pressure-door': '#8fb7d9',
  'recovery-cluster': '#43c98a',
});

export const LAYER_DEFS = Object.freeze([
  { id: 'grid', label: 'Cell grid', hint: '4 m collision grid' },
  { id: 'rooms', label: 'Room bands', hint: 'progression rooms and thresholds' },
  { id: 'corridors', label: 'Corridors', hint: 'story-mode lanes between rooms' },
  { id: 'zones', label: 'Authored zones', hint: 'layout zone rects' },
  { id: 'routes', label: 'Routes', hint: 'primary, flank and cross-court lanes' },
  { id: 'walls', label: 'Walls', hint: 'collision wall segments' },
  { id: 'blocks', label: 'Cover blocks', hint: 'solid authored cells' },
  { id: 'portals', label: 'Thresholds', hint: 'room doors and sealed barriers' },
  { id: 'landmarks', label: 'Landmarks', hint: 'hero and identity props' },
  { id: 'machinery', label: 'Machinery', hint: 'gantries, pumps, lifts' },
  { id: 'setpieces', label: 'Setpieces', hint: 'tunnels, collapses, bulkheads' },
  { id: 'picks', label: 'Keys and secrets', hint: 'story-mode progression items' },
  { id: 'connections', label: 'Floor links', hint: 'lifts, stairs and drops between layers' },
  { id: 'props', label: 'Dressing', hint: 'gore, bones, candles, cages, fog' },
  { id: 'scares', label: 'Scare beats', hint: 'authored horror set pieces' },
  { id: 'lights', label: 'Authored lights', hint: 'zone light anchors' },
  { id: 'spawns', label: 'Spawns', hint: 'enemy spawn anchors and waves' },
  { id: 'path', label: 'Route trace', hint: 'player spawn to exit walk' },
  { id: 'diagnostics', label: 'Warnings', hint: 'design conflicts found in data' },
]);

export { blockCells, cloneCells, pathMetrics, pathPoints, shortestPath, wallSegments };

export function sectorOptions() {
  return CAMPAIGN_SECTORS.map((sector, index) => ({
    index,
    id: sector.id,
    name: sector.name,
    tag: sector.tag,
    blurb: sector.blurb,
    color: sector.color,
  }));
}

function cellIsSolid(cells, width, height, x, y) {
  return gridSolidAt(cells, width, height, x, y);
}

export function cellAt(x, y) {
  return { x: Math.floor(x), y: Math.floor(y) };
}

function routeCrossings(cells, width, height, points) {
  let crossings = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const distance = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(1, Math.ceil(distance * 5));
    let previous = null;
    for (let s = 0; s < steps; s += 1) {
      const t = s / steps;
      const sample = {
        x: Math.floor(a[0] + (b[0] - a[0]) * t),
        y: Math.floor(a[1] + (b[1] - a[1]) * t),
      };
      if (previous && (sample.x !== previous.x || sample.y !== previous.y)) {
        // Resolve corner cuts as two orthogonal moves so a diagonal sample
        // pair is never tested as a single bogus adjacency.
        const stepsX = sample.x !== previous.x;
        const stepsY = sample.y !== previous.y;
        if (stepsX && !canTraverse(cells, width, height, previous.x, previous.y, sample.x, previous.y)) crossings += 1;
        const midX = stepsX ? sample.x : previous.x;
        if (stepsY && !canTraverse(cells, width, height, midX, previous.y, midX, sample.y)) crossings += 1;
      }
      previous = sample;
    }
  }
  return crossings;
}

function roomPortals(room) {
  return (room.portals || [])
    .map(portal => ({
      id: portal.id,
      kind: portal.kind === 'cross-court' ? 'flank' : portal.kind,
      axis: portal.axis,
      at: Number(portal.at),
      span: (portal.span || [0, 0]).map(Number),
      from: portal.from,
      to: portal.to,
      lockedBy: portal.lockedBy || null,
      barrierId: portal.barrierId || null,
      width: Math.abs(Number(portal.span?.[1] ?? 0) - Number(portal.span?.[0] ?? 0)),
    }));
}

function waveUsageForSpawn(sector, spawnIndex) {
  const usage = [];
  sector.waves.forEach((wave, waveIndex) => {
    for (const entry of wave.entries || []) {
      if (entry.spawn !== spawnIndex) continue;
      usage.push({ wave: waveIndex + 1, variant: entry.variant, delay: entry.delay, cost: entry.cost });
    }
  });
  return usage;
}

export function buildSectorScene(sectorIndex = 0, options = {}) {
  const course = createCampaignCourse(sectorIndex);
  const sector = CAMPAIGN_SECTORS[course.sectorIndex];
  const width = course.w || ARENA_CELLS;
  const height = course.h || ARENA_CELLS;
  // createCampaignCourse returns the carved static grid; barrier rows are only
  // applied to a working copy so the playground never mutates the campaign.
  const designedCells = cloneCells(course.cells);
  const progression = createRoomProgression(course, course.sectorIndex, {
    requireEntry: options.requireEntry === true,
  });
  const sealedCourse = { ...course, cells: cloneCells(designedCells), campaign: true };
  sealedCourse.roomProgression = progression;
  syncRoomGateCells(sealedCourse, progression);
  const sealed = cloneCells(sealedCourse.cells);

  const rooms = getRoomSequence(sector.id).map((room, index) => ({
    index,
    id: room.id,
    name: room.name,
    role: room.role,
    theme: room.theme,
    sequence: room.sequence,
    bounds: { ...room.bounds },
    landmarks: [...(room.landmarks || [])],
    encounter: room.encounter ? { ...room.encounter, composition: { ...(room.encounter.composition || {}) } } : null,
    portals: roomPortals(room),
    center: {
      x: (room.bounds.minX + room.bounds.maxX) * 0.5,
      y: (room.bounds.minZ + room.bounds.maxZ) * 0.5,
    },
    size: {
      w: room.bounds.maxX - room.bounds.minX,
      d: room.bounds.maxZ - room.bounds.minZ,
    },
    color: ROOM_STYLE_COLORS[index % ROOM_STYLE_COLORS.length],
  }));

  const zones = (course.zones || []).map((zone, index) => ({
    index,
    id: zone.id,
    role: zone.role,
    rect: [...(zone.rect || [])],
    anchor: [...(zone.anchor || [6, 6])],
    landmark: zone.landmark || null,
    cue: zone.cue || null,
    arena: zone.arena === true,
    exitApproach: zone.exitApproach === true,
    entry: zone.entry || null,
    color: ZONE_ROLE_COLORS[zone.role] || '#8b93a7',
  }));

  const routes = (course.routes || []).map((route, index) => ({
    index,
    id: route.id,
    role: route.role,
    width: Number(route.width || 2),
    points: (route.points || []).map(point => [Number(point[0]), Number(point[1])]),
    cue: route.cue || null,
    combatLane: route.combatLane === true,
    encounter: route.encounter || null,
    color: ROUTE_ROLE_COLORS[route.role] || '#8b93a7',
  }));

  const landmarks = (course.landmarks || []).map((item, index) => ({
    index,
    kind: 'landmark',
    id: item.id,
    type: item.type,
    anchor: [...(item.anchor || [6, 6])],
    size: [...(item.size || [3, 4, 2.5])],
    material: item.material || null,
    animated: item.animated || null,
    hero: item.hero === true,
    playerFacing: item.playerFacing === true,
    zone: zones.find(zone => zone.landmark === item.id) || null,
  }));

  const machinery = (course.machinery || []).map((item, index) => ({
    index,
    kind: 'machinery',
    id: item.id,
    type: item.type,
    anchor: [...(item.anchor || [6, 6])],
    span: [...(item.span || [2, 2])],
    motion: item.motion || null,
    pipes: item.pipes ?? null,
    cables: item.cables ?? null,
    payload: item.payload ?? null,
    hazard: item.hazard || null,
  }));

  const setpieces = (course.setpieces || []).map((item, index) => ({
    index,
    kind: 'setpiece',
    id: item.id,
    type: item.type,
    anchor: [...(item.anchor || item.points?.[0] || [6, 6])],
    points: (item.points || []).map(point => [Number(point[0]), Number(point[1])]),
    width: Number(item.width || 2),
    height: Number(item.height || 5),
    size: item.size ? [...item.size] : null,
    cue: item.cue || null,
    color: SETPIECE_COLORS[item.type] || '#c8c8d4',
  }));

  const lights = (course.lights || []).map((item, index) => ({
    index,
    kind: 'light',
    id: item.role ? `${sector.id}-light-${item.role}` : `${sector.id}-light-${index}`,
    role: item.role || `light-${index}`,
    anchor: [...(item.anchor || [6, 6])],
    color: item.color || '#ffffff',
    intensity: Number(item.intensity || 1),
    phase: Number(item.phase || 0),
  }));

  const spawns = (course.spawnPoints || []).map((point, index) => ({
    index,
    kind: 'spawn',
    id: `${sector.id}-spawn-${index}`,
    x: Number(point.x),
    y: Number(point.y),
    usage: waveUsageForSpawn(sector, index),
  }));

  const player = { x: course.playerSpawn.x, y: course.playerSpawn.y, angle: course.playerSpawn.angle ?? -Math.PI / 2 };
  const exit = { x: course.exit.x, y: course.exit.y };

  const designedPath = shortestPath(designedCells, width, height, player, exit);
  const sealedPath = shortestPath(sealed, width, height, player, exit);
  const designReach = reachableCells(designedCells, width, height, player);
  // The route carve in campaign.js deliberately clears cover that would block
  // the paired Manhattan lanes. Showing the erased blocks as ghosts keeps the
  // authored intent visible next to what the collision grid actually keeps.
  const authoredBlocks = (CAMPAIGN_MAPS[course.sectorIndex]?.blocks || []).map(([x, y]) => ({ x, y, cx: x, cy: y }));
  const survivingKeys = new Set(blockCells(designedCells, width, height).map(block => `${block.x},${block.y}`));
  const ghostBlocks = authoredBlocks.filter(block => !survivingKeys.has(`${block.x},${block.y}`));

  const scene = {
    kind: 'sector',
    sectorIndex: course.sectorIndex,
    id: sector.id,
    name: sector.name,
    tag: sector.tag,
    blurb: sector.blurb,
    color: sector.color,
    cell: CELL,
    width,
    height,
    meters: { w: width * CELL, d: height * CELL },
    cells: designedCells,
    sealedCells: sealed,
    rooms,
    zones,
    routes,
    landmarks,
    machinery,
    setpieces,
    lights,
    spawns,
    player,
    exit,
    walls: wallSegments(designedCells, width, height),
    blocks: blockCells(designedCells, width, height),
    authoredBlocks,
    ghostBlocks,
    progression,
    waves: sector.waves.map((wave, index) => ({
      index: index + 1,
      budget: wave.budget,
      aliveCap: wave.aliveCap,
      intermission: wave.intermission,
      entries: (wave.entries || []).map(entry => ({ ...entry })),
    })),
    path: {
      designed: pathPoints(designedPath),
      sealed: pathPoints(sealedPath),
      metrics: pathMetrics(designedPath),
      sealedMetrics: pathMetrics(sealedPath),
    },
    reach: designReach,
  };

  return refreshScene(scene);
}

// Recomputes the derived view (walk route, stats, warnings) after a draft edit
// moves an anchor. Everything else about the scene is authored data and stays
// untouched, so this is safe to call on every drag frame.
export function refreshScene(scene) {
  if (scene.kind === 'campaign' || scene.kind === 'dungeon-stack') {
    for (const panel of scene.panels) refreshScene(panel);
    scene.stats = {
      sectors: scene.panels.length,
      rooms: scene.panels.reduce((sum, panel) => sum + panel.rooms.length, 0),
      waves: scene.panels.reduce((sum, panel) => sum + panel.waves.length, 0),
      routeMeters: scene.panels.reduce((sum, panel) => sum + panel.stats.routeMeters, 0),
      enemyBudgetTotal: scene.panels.reduce((sum, panel) => sum + panel.stats.enemyBudgetTotal, 0),
      corridors: scene.panels.reduce((sum, panel) => sum + (panel.corridors?.length || 0), 0),
      openings: scene.panels.reduce((sum, panel) => sum + (panel.openings?.length || 0), 0),
      keys: scene.panels.reduce((sum, panel) => sum + (panel.keys?.length || 0), 0),
      secrets: scene.panels.reduce((sum, panel) => sum + (panel.secrets?.length || 0), 0),
      loops: scene.panels.reduce((sum, panel) => sum + (panel.metrics?.loops || 0), 0),
      areaSqMeters: scene.panels.reduce((sum, panel) => sum + panel.width * CELL * panel.height * CELL, 0),
    };
    return scene;
  }
  if (scene.kind === 'dungeon') return refreshDungeonScene(scene);
  const designedPath = shortestPath(scene.cells, scene.width, scene.height, scene.player, scene.exit);
  const sealedPath = shortestPath(scene.sealedCells, scene.width, scene.height, scene.player, scene.exit);
  scene.path = {
    designed: pathPoints(designedPath),
    sealed: pathPoints(sealedPath),
    metrics: pathMetrics(designedPath),
    sealedMetrics: pathMetrics(sealedPath),
  };
  scene.stats = sceneStats(scene);
  scene.diagnostics = collectDiagnostics(scene, {
    designedCells: scene.cells,
    sealed: scene.sealedCells,
    designReach: scene.reach,
    width: scene.width,
    height: scene.height,
  });
  return scene;
}

function refreshDungeonScene(scene) {
  const designedPath = shortestPath(scene.cells, scene.width, scene.height, scene.player, scene.exit);
  const sealedPath = shortestPath(scene.sealedCells, scene.width, scene.height, scene.player, scene.exit);
  scene.path = {
    designed: pathPoints(designedPath),
    sealed: pathPoints(sealedPath),
    metrics: pathMetrics(designedPath),
    sealedMetrics: pathMetrics(sealedPath),
  };
  const metrics = scene.metrics || {};
  const total = scene.width * scene.height;
  scene.stats = {
    totalCells: total,
    walkableCells: metrics.walkableCells ?? total - scene.blocks.length,
    reachableCells: scene.reach?.size ?? 0,
    blockCells: scene.blocks.length,
    wallSegments: scene.walls.length,
    doorSpans: scene.openings.length,
    arenaSqMeters: total * CELL * CELL,
    walkableSqMeters: (metrics.walkableCells ?? 0) * CELL * CELL,
    openAreaPct: metrics.openPct ?? 0,
    coverPct: Math.round((scene.blocks.length / total) * 1000) / 10,
    routeMeters: scene.path.metrics.meters,
    routeSteps: scene.path.metrics.steps,
    routeTurns: scene.path.metrics.turns,
    sealedRouteMeters: scene.path.sealedMetrics.meters,
    enemyBudgetTotal: metrics.enemyBudget ?? 0,
    loops: metrics.loops ?? 0,
    deadEnds: metrics.deadEnds ?? 0,
    corridors: metrics.corridors ?? scene.corridors.length,
    corridorMeters: metrics.corridorMeters ?? 0,
    keys: scene.keys.length,
    secrets: scene.secrets.length,
  };
  scene.diagnostics ||= [];
  return scene;
}

function sceneStats(scene) {
  const total = scene.width * scene.height;
  const walkable = total - scene.blocks.length;
  const reachable = scene.reach?.size || 0;
  const doorSpans = scene.rooms.reduce((sum, room) => sum + room.portals.length, 0);
  return {
    totalCells: total,
    walkableCells: walkable,
    reachableCells: reachable,
    blockCells: scene.blocks.length,
    wallSegments: scene.walls.length,
    doorSpans,
    arenaSqMeters: scene.width * CELL * scene.height * CELL,
    walkableSqMeters: walkable * CELL * CELL,
    openAreaPct: Math.round((reachable / total) * 1000) / 10,
    coverPct: Math.round((scene.blocks.length / total) * 1000) / 10,
    routeMeters: scene.path.metrics.meters,
    routeSteps: scene.path.metrics.steps,
    routeTurns: scene.path.metrics.turns,
    sealedRouteMeters: scene.path.sealedMetrics.meters,
    enemyBudgetTotal: scene.waves.reduce((sum, wave) => sum + wave.budget, 0),
  };
}

function collectDiagnostics(scene, context) {
  const { designedCells, sealed, designReach, width, height } = context;
  const diagnostics = [];
  const at = (x, y) => ({ x, y });
  const push = (severity, code, message, position, itemId = null) => {
    diagnostics.push({ severity, code, message, at: position, itemId });
  };

  if (!scene.path.designed.length) {
    push('error', 'exit-unreachable', 'No walk route from the player spawn to the exit.', { ...scene.exit }, 'exit');
  }
  if (!scene.path.sealed.length) {
    push('info', 'sealed-route', 'The sealed start-of-run gate state blocks the direct spawn-to-exit walk until rooms clear.', { ...scene.player }, 'player');
  }

  for (const spawn of scene.spawns) {
    const key = `${Math.floor(spawn.x)},${Math.floor(spawn.y)}`;
    if (!designReach.has(key)) {
      push('error', 'spawn-unreachable', `Spawn ${spawn.index} is not reachable from the player start.`, at(spawn.x, spawn.y), spawn.id);
    } else if ((spawn.usage || []).length === 0) {
      push('warn', 'spawn-unused', `Spawn ${spawn.index} is authored but no wave uses it.`, at(spawn.x, spawn.y), spawn.id);
    }
  }

  for (const landmark of scene.landmarks) {
    const key = `${Math.floor(landmark.anchor[0])},${Math.floor(landmark.anchor[1])}`;
    if (!designReach.has(key)) {
      push('error', 'landmark-unreachable', `${landmark.id} sits outside the walkable route.`, at(...landmark.anchor), landmark.id);
    }
    if (landmark.zone && !rectContains(landmark.zone.rect, landmark.anchor[0], landmark.anchor[1])) {
      push('warn', 'zone-drift', `${landmark.id} is anchored outside its zone ${landmark.zone.id}.`, at(...landmark.anchor), landmark.id);
    }
  }

  for (const zone of scene.zones) {
    if (zone.landmark && !scene.landmarks.some(landmark => landmark.id === zone.landmark)) {
      push('warn', 'zone-orphan', `Zone ${zone.id} references missing landmark ${zone.landmark}.`, at(...zone.anchor), zone.id);
    }
    const covered = scene.blocks.filter(block => rectContains(zone.rect, block.x + 0.5, block.y + 0.5)).length;
    if (covered > 0) {
      push('info', 'zone-cover', `Zone ${zone.id} contains ${covered} cover cell${covered === 1 ? '' : 's'}.`, at(...zone.anchor), zone.id);
    }
  }

  for (const route of scene.routes) {
    const crossings = routeCrossings(designedCells, width, height, route.points);
    if (crossings > 0) {
      push('error', 'route-blocked', `Route ${route.id} crosses ${crossings} wall edge${crossings === 1 ? '' : 's'}.`, at(...(route.points[Math.floor(route.points.length / 2)] || [6, 6])), route.id);
    }
  }

  if (scene.ghostBlocks.length > 0) {
    const total = scene.authoredBlocks.length;
    push('info', 'cover-carved', `The route carve removed ${scene.ghostBlocks.length} of ${total} authored cover cells; ghosts show the intent.`, at(...[scene.ghostBlocks[0].x + 0.5, scene.ghostBlocks[0].y + 0.5]), 'blocks');
  }

  for (const room of scene.rooms) {
    for (const portal of room.portals) {
      if (portal.width < 2) {
        push('warn', 'door-narrow', `${room.name} has a ${portal.width}-cell doorway.`, at((portal.span[0] + portal.span[1]) / 2, portal.at), portal.id);
      }
      if (portal.kind === 'flank' || portal.axis !== 'horizontal') continue;
      const row = Math.floor(portal.at);
      for (let x = Math.ceil(portal.span[0] - 1e-6); x + 1 <= Math.floor(portal.span[1] + 1e-6); x += 1) {
        const open = canTraverse(designedCells, width, height, x, row, x, row - 1);
        if (!open) {
          push('error', 'door-blocked', `${room.name} door span ${portal.span.join('-')} is sealed in the base grid.`, at(x + 0.5, portal.at), portal.id);
          break;
        }
      }
    }
  }

  for (let i = 1; i < scene.rooms.length; i += 1) {
    const gap = scene.rooms[i - 1].bounds.minZ - scene.rooms[i].bounds.maxZ;
    if (gap > 0.2) {
      push('info', 'room-gap', `${(gap * CELL).toFixed(1)} m of dead space between ${scene.rooms[i].name} and ${scene.rooms[i - 1].name}.`, at(6, (scene.rooms[i].bounds.maxZ + scene.rooms[i - 1].bounds.minZ) / 2), scene.rooms[i].id);
    }
  }

  if (sealed.length !== designedCells.length) {
    push('error', 'gate-grid', 'Gate simulation produced a mismatched cell grid.', { ...scene.player }, 'player');
  }
  return diagnostics;
}

export function rectContains(rect, x, y) {
  if (!rect || rect.length < 4) return false;
  const [rx, ry, rw, rh] = rect;
  return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
}

export function buildCampaignScene() {
  const panels = CAMPAIGN_SECTORS.map((sector, index) => buildSectorScene(index));
  return {
    kind: 'campaign',
    id: 'campaign',
    name: 'The Last Dead',
    panels,
    stats: {
      sectors: panels.length,
      rooms: panels.reduce((sum, panel) => sum + panel.rooms.length, 0),
      waves: panels.reduce((sum, panel) => sum + panel.waves.length, 0),
      routeMeters: panels.reduce((sum, panel) => sum + panel.stats.routeMeters, 0),
      enemyBudgetTotal: panels.reduce((sum, panel) => sum + panel.stats.enemyBudgetTotal, 0),
    },
  };
}

// ---------------------------------------------------------------- story mode

// The compiled dungeon is deterministic, so it is built once and reused by the
// playground. Each layer keeps the arena-scene shape so the same renderer,
// inspector and draft tooling work on both.
const DUNGEON_COMPILED = compileDungeon(DUNGEON_LAYERS);

export const DUNGEON_ROOM_COLORS = Object.freeze({
  entry: '#4f7dfb',
  hub: '#a86ef2',
  arena: '#e0503c',
  ward: '#f2a33c',
  vault: '#ffd479',
  side: '#8b93a7',
  loop: '#43c98a',
  exit: '#43c98a',
  secret: '#59e0d0',
});
export const DUNGEON_CORRIDOR_COLORS = Object.freeze({
  hall: '#ffd479',
  service: '#f2a33c',
  loop: '#a86ef2',
  vent: '#59e0d0',
  secret: '#59e0d0',
});
export const PROP_COLORS = Object.freeze({
  gore: '#8d1622',
  blood: '#5e0f18',
  bones: '#cfbfa4',
  skull: '#ded3b8',
  eyes: '#ff6a3d',
  limb: '#7c2b33',
  altar: '#8a5a3c',
  barrel: '#b4622a',
  oil: '#141014',
  bloodpile: '#701018',
  bodypile: '#6d3a3e',
  candle: '#ffb35e',
  cage: '#8b93a7',
  corpse: '#6d4a52',
  crate: '#8a6a3c',
  sigil: '#a476ff',
  webs: '#cfd8e3',
  fog: '#2b3140',
});
export const SCARE_COLORS = Object.freeze({
  scream: '#ff4d5e',
  'lights-out': '#6d4dff',
  swarm: '#ff9a48',
  collapse: '#d9a05b',
  hunt: '#ff3d36',
  watcher: '#59e0d0',
  mimic: '#c98cff',
});

function hashSeed(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function seededRandom(seed) {
  let state = seed || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Prop clusters expand deterministically, so the map reads as a dressed level
// without hand-placing several hundred individual marks.
export function expandProps(layer) {
  const out = [];
  for (const item of layer.props || []) {
    const random = seededRandom(hashSeed(item.id));
    const color = PROP_COLORS[item.kind] || '#c8c8d4';
    if (Array.isArray(item.points) && item.points.length > 1) {
      const points = item.points;
      const lengths = [];
      let total = 0;
      for (let i = 1; i < points.length; i += 1) {
        const distance = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
        lengths.push(distance);
        total += distance;
      }
      const count = Math.max(2, item.count || 10);
      for (let i = 0; i < count; i += 1) {
        let target = ((i + 0.5) / count) * total;
        let segment = 0;
        while (segment < lengths.length - 1 && target > lengths[segment]) {
          target -= lengths[segment];
          segment += 1;
        }
        const span = lengths[segment] || 1;
        const t = span ? target / span : 0;
        const a = points[segment];
        const b = points[segment + 1];
        out.push({
          id: `${item.id}-${i}`,
          kind: item.kind,
          color,
          x: a[0] + (b[0] - a[0]) * t + (random() - 0.5) * 0.7,
          y: a[1] + (b[1] - a[1]) * t + (random() - 0.5) * 0.7,
          r: 0.22 + random() * (item.kind === 'blood' ? 0.3 : 0.24),
        });
      }
      continue;
    }
    const count = Math.max(1, item.count || 4);
    const spread = Math.max(0.6, item.spread ?? 2);
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * spread * 0.5;
      out.push({
        id: `${item.id}-${i}`,
        kind: item.kind,
        color,
        x: Math.max(0.2, Math.min(layer.width - 0.2, item.at[0] + Math.cos(angle) * radius)),
        y: Math.max(0.2, Math.min(layer.height - 0.2, item.at[1] + Math.sin(angle) * radius)),
        r: 0.24 + random() * 0.55,
      });
    }
  }
  return out;
}

export function dungeonLayerOptions() {
  return DUNGEON_COMPILED.map(layer => ({
    index: layer.index,
    id: layer.id,
    name: layer.name,
    tag: layer.tag,
    act: layer.act,
    depth: layer.depth,
    color: layer.color,
    rooms: layer.rooms.length,
    routeMeters: layer.metrics.routeMeters,
    loops: layer.metrics.loops,
  }));
}

export function dungeonSummary() {
  const metrics = DUNGEON_COMPILED.reduce((totals, layer) => ({
    rooms: totals.rooms + layer.metrics.rooms,
    corridors: totals.corridors + layer.metrics.corridors,
    openings: totals.openings + layer.metrics.openings,
    keys: totals.keys + layer.metrics.keys,
    secrets: totals.secrets + layer.metrics.secrets,
    routeMeters: totals.routeMeters + layer.metrics.routeMeters,
    areaSqMeters: totals.areaSqMeters + layer.metrics.areaSqMeters,
    enemyBudget: totals.enemyBudget + layer.metrics.enemyBudget,
    loops: totals.loops + layer.metrics.loops,
  }), { rooms: 0, corridors: 0, openings: 0, keys: 0, secrets: 0, routeMeters: 0, areaSqMeters: 0, enemyBudget: 0, loops: 0 });
  return { layers: DUNGEON_COMPILED.length, ...metrics, authored: DUNGEON_SUMMARY };
}

export function buildDungeonScene(index = 0) {
  const layerIndex = Math.max(0, Math.min(DUNGEON_COMPILED.length - 1, Math.floor(index)));
  const layer = DUNGEON_COMPILED[layerIndex];
  if (!layer) return null;
  const course = makeDungeonCourse(layerIndex);
  const rooms = layer.rooms.map((room, order) => ({
    index: order,
    order,
    id: room.id,
    name: room.name,
    role: room.kind,
    kind: room.kind,
    sequence: order + 1,
    bounds: { ...room.bounds },
    center: { ...room.center },
    size: { ...room.size },
    shape: room.shape || 'square',
    footprint: [...(room.footprint || [])],
    color: room.color || DUNGEON_ROOM_COLORS[room.kind] || '#8b93a7',
    encounter: room.encounter || null,
    portals: [],
    landmarks: [],
    openings: room.openings,
    note: room.note || null,
    reward: room.reward || null,
    areaSqMeters: room.areaSqMeters,
    reachable: room.reachable,
  }));
  const roomById = new Map(rooms.map(room => [room.id, room]));
  for (const landmark of layer.landmarks || []) {
    const room = roomById.get(landmark.roomId);
    if (room && !room.landmarks.includes(landmark.id)) room.landmarks.push(landmark.id);
  }

  const scene = {
    kind: 'dungeon',
    index: layer.index,
    depth: layer.depth,
    sectorIndex: layer.index,
    id: layer.id,
    name: layer.name,
    tag: layer.tag,
    act: layer.act,
    blurb: layer.tag,
    signature: layer.signature || null,
    wallpaper: layer.wallpaper || null,
    color: layer.color,
    themeId: layer.theme,
    cell: CELL,
    width: layer.width,
    height: layer.height,
    meters: { w: layer.width * CELL, d: layer.height * CELL },
    cells: layer.cells,
    sealedCells: layer.sealedCells,
    rooms,
    zones: [],
    routes: [],
    corridors: (layer.corridors || []).map((corridor, order) => ({
      index: order,
      kind: 'corridor',
      id: corridor.id,
      role: corridor.kind,
      width: corridor.width,
      points: corridor.points.map(point => [Number(point[0]), Number(point[1])]),
      lengthMeters: corridor.lengthMeters,
      color: DUNGEON_CORRIDOR_COLORS[corridor.kind] || '#8b93a7',
    })),
    openings: (layer.openings || []).map((opening, order) => ({
      index: order,
      kind: 'opening',
      id: opening.id,
      role: opening.kind,
      axis: opening.axis,
      at: opening.at,
      span: [...opening.span],
      width: opening.widthCells,
      lockedBy: opening.lockedBy || null,
      keyId: opening.keyId || null,
      secret: opening.secret === true,
      roomId: opening.roomId,
      anchor: { x: opening.anchor.x, y: opening.anchor.y },
    })),
    keys: (layer.keys || []).map(key => ({ ...key, kind: 'key', at: [...key.at] })),
    secrets: (layer.rooms || []).filter(room => room.kind === 'secret').map(room => ({
      id: room.id,
      kind: 'secret',
      name: room.name,
      at: [room.center.x, room.center.y],
      reward: room.reward || 'cache',
      note: room.note || null,
    })),
    connections: (layer.connections || []).map(connection => ({ ...connection, at: [...connection.at] })),
    props: expandProps(layer),
    scares: (layer.scares || []).map((item, order) => ({
      index: order,
      kind: 'scare',
      id: item.id,
      role: item.kind,
      anchor: [...item.at],
      note: item.note || '',
      roomId: item.roomId || null,
      color: SCARE_COLORS[item.kind] || '#ff4d5e',
    })),
    landmarks: (layer.landmarks || []).map((item, order) => ({
      index: order,
      kind: 'landmark',
      id: item.id,
      type: item.type,
      anchor: [...item.anchor],
      size: [...(item.size || [3, 4, 2.5])],
      material: item.material || null,
      animated: item.animated || null,
      hero: item.hero === true,
      playerFacing: item.playerFacing === true,
      roomId: item.roomId || null,
      zone: null,
    })),
    machinery: (layer.machinery || []).map((item, order) => ({
      index: order,
      kind: 'machinery',
      id: item.id,
      type: item.type,
      anchor: [...item.anchor],
      span: [...(item.span || [2, 2])],
      motion: item.motion || null,
      pipes: item.pipes ?? null,
      cables: item.cables ?? null,
      payload: item.payload ?? null,
      hazard: item.hazard || null,
    })),
    setpieces: (layer.setpieces || []).map((item, order) => ({
      index: order,
      kind: 'setpiece',
      id: item.id,
      type: item.type,
      anchor: [...(item.anchor || item.points?.[0] || [6, 6])],
      points: (item.points || []).map(point => [Number(point[0]), Number(point[1])]),
      width: Number(item.width || 2),
      height: Number(item.height || 5),
      size: item.size ? [...item.size] : null,
      cue: item.cue || null,
      color: SETPIECE_COLORS[item.type] || '#c8c8d4',
    })),
    lights: (layer.lights || []).map((item, order) => ({
      index: order,
      kind: 'light',
      id: `${layer.id}-light-${item.role || order}`,
      role: item.role || `light-${order}`,
      anchor: [...item.anchor],
      color: item.color || '#ffffff',
      intensity: Number(item.intensity || 1),
      phase: Number(item.phase || 0),
    })),
    spawns: course.waveSpawns.flatMap((waveSpawns, waveIndex) => waveSpawns.map((spawn, order) => ({
      index: waveIndex * 100 + order,
      kind: 'spawn',
      id: `${course.id}-live-spawn-${waveIndex}-${order}`,
      x: spawn.x,
      y: spawn.y,
      wave: waveIndex,
      usage: [{ wave: waveIndex + 1, variant: spawn.variant, delay: 0, cost: 0 }],
    }))),
    player: { x: layer.entry.x, y: layer.entry.z, angle: layer.entry.angle ?? -Math.PI / 2 },
    exit: { x: layer.exit.x, y: layer.exit.z },
    walls: layer.walls,
    blocks: layer.coverBlocks || layer.blocks,
    authoredBlocks: layer.coverBlocks || layer.blocks,
    ghostBlocks: [],
    reach: layer.reach,
    progression: null,
    waves: [],
    metrics: layer.metrics,
    diagnostics: (layer.diagnostics || []).map(diagnostic => ({ ...diagnostic })),
  };
  return refreshScene(scene);
}

export function buildDungeonOverview() {
  const panels = DUNGEON_COMPILED.map((layer, index) => buildDungeonScene(index));
  const summary = dungeonSummary();
  return {
    kind: 'dungeon-stack',
    id: 'story-descent',
    name: 'The Descent',
    tag: 'STORY MODE',
    panels,
    stats: {
      sectors: panels.length,
      rooms: summary.rooms,
      waves: 0,
      routeMeters: summary.routeMeters,
      enemyBudgetTotal: summary.enemyBudget,
      corridors: summary.corridors,
      openings: summary.openings,
      keys: summary.keys,
      secrets: summary.secrets,
      loops: summary.loops,
      areaSqMeters: summary.areaSqMeters,
    },
  };
}

// Drag edits are stored as one flat map keyed `kind:id` -> [x, y] in cells, so
// they can be undone, diffed and pasted back into the authored campaign.
export function overrideKey(kind, id) {
  return `${kind}:${id}`;
}

export function sceneSnapshot(scene, overrides = {}) {
  const edited = [];
  for (const [key, value] of Object.entries(overrides || {})) {
    if (!Array.isArray(value) || value.length < 2) continue;
    edited.push({
      key,
      cell: [round(value[0]), round(value[1])],
      meters: [round(value[0] * CELL), round(value[1] * CELL)],
    });
  }
  return {
    unit: 'cell',
    scale: CELL,
    sector: scene.id ?? null,
    note: 'Coordinates are gameplay cells (1 cell = 4 m) with the origin at the arena corner (x east, z south).',
    edited,
  };
}

export function summarizeOverrides(scene, overrides = {}, baseline = null) {
  const rows = [];
  const originFor = key => {
    const [kind, ...rest] = key.split(':');
    const id = rest.join(':');
    if (kind === 'anchor') {
      const source = id === 'player' ? scene.player : id === 'exit' ? scene.exit : null;
      return source ? { id: kind + ':' + id, from: [source.x, source.y] } : null;
    }
    const pool = kind === 'landmark' ? scene.landmarks
      : kind === 'machinery' ? scene.machinery
        : kind === 'setpiece' ? scene.setpieces
          : kind === 'light' ? scene.lights
            : kind === 'spawn' ? scene.spawns
              : kind === 'zone' ? scene.zones : [];
    const item = (pool || []).find(candidate => String(candidate.id) === id);
    if (!item) return null;
    const source = Array.isArray(item.anchor) ? item.anchor : [item.x, item.y];
    return { id: item.id, type: item.type || item.role || kind, from: source };
  };
  for (const [key, value] of Object.entries(overrides || {})) {
    const origin = originFor(key);
    if (!origin) continue;
    const authored = baseline?.[key] || origin.from;
    const dx = (value[0] - authored[0]) * CELL;
    const dy = (value[1] - authored[1]) * CELL;
    rows.push({
      key,
      id: origin.id,
      type: origin.type || key.split(':')[0],
      authored: [round(authored[0]), round(authored[1])],
      previous: [round(origin.from[0]), round(origin.from[1])],
      to: [round(value[0]), round(value[1])],
      deltaMeters: [round((value[0] - origin.from[0]) * CELL), round((value[1] - origin.from[1]) * CELL)],
      totalMeters: round(Math.hypot(dx, dy)),
    });
  }
  return rows;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

export function compassLabel(angle) {
  const degrees = ((angle * 180) / Math.PI + 360) % 360;
  const names = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
  return names[Math.round(degrees / 45) % 8];
}
