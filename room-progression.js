// Deterministic Doom-style room graph for the authored campaign.
// Coordinates are gameplay cells (4 m). The renderer may retain the active
// room and its portal neighbors while the engine owns gate state.
const freezeDeep = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freezeDeep);
  }
  return value;
};

const ROOM_TEMPLATES = [
  { key: 'entry', role: 'entry', bounds: { minX: 0, minZ: 9.05, maxX: 12, maxZ: 12 }, entry: { x: 6, y: 10.5 }, exit: { x: 6, y: 9 }, spawnPoints: [[1.5, 10.25], [10.5, 10.25]], threshold: 9, spans: [[1, 3], [9, 11]] },
  { key: 'gallery', role: 'crossfire', bounds: { minX: 0, minZ: 6.05, maxX: 12, maxZ: 8.95 }, entry: { x: 2.1, y: 8.35 }, exit: { x: 9.9, y: 6.25 }, spawnPoints: [[2, 8], [10, 8]], threshold: 6, spans: [[1, 3], [9, 11]] },
  { key: 'court', role: 'focal', bounds: { minX: 0, minZ: 3.05, maxX: 12, maxZ: 5.95 }, entry: { x: 9.9, y: 5.55 }, exit: { x: 2.1, y: 3.2 }, spawnPoints: [[2, 5], [10, 5]], threshold: 3, spans: [[1, 3], [9, 11]] },
  { key: 'objective', role: 'objective', bounds: { minX: 0, minZ: 1.05, maxX: 12, maxZ: 2.95 }, entry: { x: 2.1, y: 2.7 }, exit: { x: 6, y: 1.2 }, spawnPoints: [[5.5, 2], [8.5, 2]], threshold: 1, spans: [[5, 7], [8, 10]] },
];

const SECTOR_SPECS = {
  bloodworks: {
    act: 'act-i', theme: 'bloodworks',
    names: ['Intake Bay', 'Graft Galleries', 'Pulse Court', 'Furnace Spine'],
    landmarks: [['intake-gate', 'south-gate'], ['graft-gallery-west', 'graft-gallery-east', 'west-pump-bank', 'east-pump-bank'], ['pulse-engine', 'court-hoist', 'pulse-court'], ['furnace-spine', 'intake-crane']],
    encounters: [
      { tier: 1, budget: 5, maxAlive: 4, waves: [0], composition: { stalker: 2, caster: 1 }, tactic: 'Hold the threshold; keep both side lanes open.' },
      { tier: 2, budget: 9, maxAlive: 5, waves: [1], composition: { skitter: 2, bloodhound: 1, caster: 2 }, tactic: 'Cross the gallery or rotate through the pump banks.' },
      { tier: 3, budget: 14, maxAlive: 6, waves: [2], composition: { brute: 2, bloodhound: 1, hexer: 1, caster: 1 }, tactic: 'Break the anchor line; cover the long sight lane.' },
      { tier: 4, budget: 0, maxAlive: 0, waves: [], composition: {}, tactic: 'Use the furnace spine as an exit vestibule.' },
    ],
  },
  ossuary: {
    act: 'act-ii', theme: 'ossuary',
    names: ['Bone Descent', 'Rib Colonnade', 'Reliquary Court', 'Bell Apse'],
    landmarks: [['bone-threshold', 'south-descent'], ['rib-colonnade-west', 'rib-colonnade-east', 'crypt-lift-west', 'crypt-lift-east'], ['bone-reliquary', 'reliquary-court', 'reliquary-winches'], ['bell-apse', 'apse-chandelier']],
    encounters: [
      { tier: 2, budget: 9, maxAlive: 5, waves: [0], composition: { bloodhound: 2, skitter: 1, caster: 1 }, tactic: 'Read the rib gate and keep a retreat lane.' },
      { tier: 3, budget: 13, maxAlive: 6, waves: [1], composition: { brute: 2, skitter: 1, hexer: 1, bloodhound: 1 }, tactic: 'Use pillars to break caster lines and rotate the lift banks.' },
      { tier: 4, budget: 18, maxAlive: 6, waves: [2], composition: { bellwraith: 1, warden: 1, bloodhound: 1, hexer: 1 }, tactic: 'Break teleport rhythm with the reliquary as hard cover.' },
      { tier: 5, budget: 0, maxAlive: 0, waves: [], composition: {}, tactic: 'Ring the apse, then sprint the exposed exit spine.' },
    ],
  },
  choir: {
    act: 'act-iii', theme: 'choir',
    names: ['Throat Gate', 'Teeth Galleries', 'Resonance Court', 'Bell Nave'],
    landmarks: [['throat-gate', 'south-throat'], ['teeth-gallery-west', 'teeth-gallery-east', 'choir-organ-west', 'choir-organ-east'], ['mouth-altar', 'resonance-court', 'resonance-winches'], ['bell-nave', 'nave-chandelier']],
    encounters: [
      { tier: 3, budget: 12, maxAlive: 6, waves: [0], composition: { bloodhound: 1, bellwraithEcho: 1, hexer: 1, skitter: 1 }, tactic: 'Survive the opening call; keep both exits readable.' },
      { tier: 4, budget: 18, maxAlive: 7, waves: [1], composition: { bellwraith: 1, mireSinger: 1, bloodhound: 1, skitter: 1 }, tactic: 'Cross the gallery under overlapping ranged pressure.' },
      { tier: 5, budget: 27, maxAlive: 8, waves: [2], composition: { bellwraith: 2, warden: 1, mireSinger: 1, bloodhound: 1 }, tactic: 'Break the choir timing; use the altar shadow to stage your push.' },
      { tier: 6, budget: 0, maxAlive: 0, waves: [], composition: {}, tactic: 'Break the final signal and reach the last descent.' },
    ],
  },
};

function buildRooms(sectorId, spec) {
  const ids = ROOM_TEMPLATES.map(template => sectorId + '-' + spec.act + '-' + template.key);
  return ROOM_TEMPLATES.map((template, index) => {
    const id = ids[index], nextId = index < ids.length - 1 ? ids[index + 1] : 'sector-exit';
    const barrierId = sectorId + '-barrier-' + index;
    const portals = template.spans.map((span, doorIndex) => ({
      id: id + '-portal-' + doorIndex,
      kind: index === ids.length - 1 ? 'lift' : 'door',
      axis: 'horizontal',
      at: template.threshold,
      span,
      from: id,
      to: nextId,
      barrierId,
      lockedBy: 'room-clear',
    }));
    // A side loop inside the gallery provides a deterministic flank/peek lane.
    if (index === 1) portals.push({ id: id + '-cross-court', kind: 'flank', axis: 'vertical', at: 6, span: [6.1, 8.85], from: id, to: id, barrierId: null, lockedBy: null });
    return {
      id,
      sectorId,
      index,
      sequence: index + 1,
      name: spec.names[index],
      role: template.role,
      theme: spec.theme,
      bounds: template.bounds,
      entry: template.entry,
      exit: template.exit,
      spawnPoints: template.spawnPoints.map(([x, y]) => ({ x, y })),
      landmarks: spec.landmarks[index],
      portals,
      encounter: spec.encounters[index],
      visibility: { radius: 1, keepPortals: true, preload: index === 0 ? [] : [index - 1] },
    };
  });
}

export const ROOM_PROGRESSION_VERSION = 2;
export const CAMPAIGN_ROOMS = freezeDeep(Object.entries(SECTOR_SPECS).flatMap(([id, spec]) => buildRooms(id, spec)));
export const ROOM_SEQUENCE_LENGTH = ROOM_TEMPLATES.length;

function roomsForSector(sectorId) {
  const rooms = CAMPAIGN_ROOMS.filter(room => room.sectorId === sectorId);
  return rooms.length ? rooms : CAMPAIGN_ROOMS.slice(0, ROOM_SEQUENCE_LENGTH);
}
export function getRoomSequence(sectorId = 'bloodworks') { return roomsForSector(sectorId); }
export function getRoom(roomId) { return CAMPAIGN_ROOMS.find(room => room.id === roomId) || null; }
export function roomContains(room, x, y, margin = 0) {
  const b = room?.bounds;
  return !!b && x >= b.minX - margin && x <= b.maxX + margin && y >= b.minZ - margin && y <= b.maxZ + margin;
}
export function roomCenter(room) {
  const b = room?.bounds || { minX: 0, minZ: 0, maxX: 0, maxZ: 0 };
  return { x: (b.minX + b.maxX) * .5, y: (b.minZ + b.maxZ) * .5 };
}
export function roomAt(sequence, x, y, fallback = 0) {
  const candidates = (sequence || []).filter(room => roomContains(room, x, y));
  if (!candidates.length) return sequence?.[fallback] || null;
  return candidates.slice().sort((a, b) => {
    const ac = roomCenter(a), bc = roomCenter(b);
    return Math.hypot(ac.x - x, ac.y - y) - Math.hypot(bc.x - x, bc.y - y);
  })[0];
}

export function createRoomProgression(courseOrSector, sectorIndex = 0, options = {}) {
  const sectorId = typeof courseOrSector === 'string' ? courseOrSector : courseOrSector?.sectorId || 'bloodworks';
  const sequence = getRoomSequence(sectorId), gates = {}, barriers = {};
  for (const room of sequence) for (const portal of room.portals || []) {
    gates[portal.id] = { id: portal.id, open: portal.lockedBy !== 'room-clear', kind: portal.kind, from: portal.from, to: portal.to, lockedBy: portal.lockedBy, barrierId: portal.barrierId };
    if (portal.barrierId) {
      barriers[portal.barrierId] ||= { id: portal.barrierId, open: false, axis: portal.axis, at: portal.at, spans: [], gateIds: [] };
      barriers[portal.barrierId].spans.push([...portal.span]);
      barriers[portal.barrierId].gateIds.push(portal.id);
    }
  }
  const progression = {
    version: ROOM_PROGRESSION_VERSION,
    sectorIndex,
    sectorId,
    sequence: sequence.map(room => room.id),
    currentIndex: 0,
    activeRoomId: sequence[0]?.id || null,
    entered: sequence[0]?.id || null,
    pendingIndex: null,
    requireEntry: options?.requireEntry === true,
    completed: [],
    phase: 'combat',
    objective: sequence[0] ? 'Clear ' + sequence[0].name : 'Reach the exit',
    gates,
    barriers,
    collisionRevision: 0,
    lastTransition: null,
    elapsed: 0,
  };
  if (courseOrSector && typeof courseOrSector === 'object') syncRoomGateCells(courseOrSector, progression);
  return progression;
}
export function currentRoom(progression) { return progression ? getRoom(progression.activeRoomId) : null; }

export function isPortalOpen(progression, portalId) { return progression?.gates?.[portalId]?.open === true; }

const ROOM_OPPOSITE = [2, 3, 0, 1];
function cloneCells(cells, width = 12, height = 12) {
  return Array.from({ length: width * height }, (_, index) => {
    const source = cells?.[index];
    return Array.isArray(source) ? [0, 1, 2, 3].map(direction => source[direction] ? 1 : 0) : [0, 0, 0, 0];
  });
}
function markRoomWall(cells, width, height, x, y, direction, value = 1) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) return;
  const index = y * width + x;
  cells[index][direction] = value;
  const nx = x + (direction === 1 ? 1 : direction === 3 ? -1 : 0);
  const ny = y + (direction === 2 ? 1 : direction === 0 ? -1 : 0);
  if (nx >= 0 && ny >= 0 && nx < width && ny < height) cells[ny * width + nx][ROOM_OPPOSITE[direction]] = value;
}
function roomOpeningCell(barrier, index) {
  return (barrier.spans || []).some(([lo, hi]) => index >= Math.ceil(lo - 1e-6) && index + 1 <= Math.floor(hi + 1e-6));
}
function applyRoomBarrier(cells, course, barrier) {
  const width = course?.w || 12, height = course?.h || 12;
  if (barrier.axis === 'horizontal') {
    const row = Math.floor(barrier.at);
    if (row < 0 || row >= height) return;
    for (let x = 0; x < width; x += 1) markRoomWall(cells, width, height, x, row, 0, roomOpeningCell(barrier, x) ? 0 : 1);
  } else {
    const column = Math.floor(barrier.at);
    if (column < 0 || column >= width) return;
    for (let y = 0; y < height; y += 1) markRoomWall(cells, width, height, column, y, 1, roomOpeningCell(barrier, y) ? 0 : 1);
  }
}
function buildRoomRenderCells(course, progression) {
  const width = course?.w || 12, height = course?.h || 12;
  const base = cloneCells(course.staticCells || course.cells, width, height);
  for (const barrier of Object.values(progression?.barriers || {})) applyRoomBarrier(base, course, barrier);
  return base;
}
export function syncRoomGateCells(course, progression = course?.roomProgression) {
  if (!course?.campaign || !progression) return course?.cells || null;
  const width = course.w || 12, height = course.h || 12;
  if (!course.renderCells) {
    course.staticCells ||= cloneCells(course.cells, width, height);
    course.renderCells = buildRoomRenderCells(course, progression);
  }
  const cells = cloneCells(course.renderCells, width, height);
  for (const barrier of Object.values(progression.barriers || {})) if (!barrier.open) applyRoomBarrier(cells, course, { ...barrier, spans: [] });
  progression.collisionRevision ??= 0;
  course.cells = cells;
  course.roomProgression = progression;
  course.roomCollisionRevision = progression.collisionRevision;
  return cells;
}

function crossesBarrier(barrier, ax, ay, bx, by) {
  if (barrier.axis === 'horizontal') return (ay < barrier.at && by >= barrier.at) || (ay > barrier.at && by <= barrier.at);
  return (ax < barrier.at && bx >= barrier.at) || (ax > barrier.at && bx <= barrier.at);
}
function insideSpan(barrier, ax, ay, bx, by) {
  return barrier.spans.some(([lo, hi]) => barrier.axis === 'horizontal'
    ? Math.max(ax, bx) >= lo && Math.min(ax, bx) <= hi
    : Math.max(ay, by) >= lo && Math.min(ay, by) <= hi);
}
export function canTraverseRoomGates(course, progression, ax, ay, bx, by) {
  if (!course?.campaign || !progression) return true;
  for (const barrier of Object.values(progression.barriers || {})) {
    if (!crossesBarrier(barrier, ax, ay, bx, by)) continue;
    // The cell grid is intentionally open around the room bands; these
    // barriers provide the authored wall plane and its two door openings.
    if (!insideSpan(barrier, ax, ay, bx, by) || !barrier.open) return false;
  }
  return true;
}
function openRoomGates(progression, room) {
  let changed = false;
  const ids = [];
  for (const portal of room?.portals || []) {
    if (portal.lockedBy !== 'room-clear' || !progression.gates[portal.id]) continue;
    if (!progression.gates[portal.id].open) {
      progression.gates[portal.id].open = true;
      changed = true;
    }
    ids.push(portal.id);
  }
  for (const barrier of Object.values(progression.barriers || {})) {
    const open = ids.some(id => barrier.gateIds.includes(id)) && barrier.gateIds.every(id => progression.gates[id]?.open);
    if (open && !barrier.open) {
      barrier.open = true;
      changed = true;
    }
  }
  return changed;
}
export function completeRoom(progression, roomIndex = progression?.currentIndex ?? 0) {
  if (!progression || roomIndex < 0 || roomIndex >= progression.sequence.length) return false;
  const roomId = progression.sequence[roomIndex];
  if (!progression.completed.includes(roomId)) progression.completed.push(roomId);
  progression.phase = roomIndex >= progression.sequence.length - 1 ? 'exit' : 'unlocked';
  if (openRoomGates(progression, getRoom(roomId))) progression.collisionRevision = (progression.collisionRevision || 0) + 1;
  const next = progression.sequence[roomIndex + 1];
  progression.objective = next ? 'Reach ' + (getRoom(next)?.name || 'the next room') : 'Reach the sector exit';
  progression.lastTransition = { type: 'room-clear', roomId, roomIndex };
  return true;
}
export function enterRoom(progression, roomIndex) {
  if (!progression || roomIndex < 0 || roomIndex >= progression.sequence.length) return false;
  const roomId = progression.sequence[roomIndex];
  if (roomIndex > progression.currentIndex + 1 || (roomIndex > progression.currentIndex && !progression.completed.includes(progression.sequence[progression.currentIndex]))) return false;
  progression.currentIndex = Math.max(progression.currentIndex, roomIndex);
  progression.pendingIndex = null;
  progression.activeRoomId = roomId;
  progression.entered = roomId;
  progression.phase = 'combat';
  progression.objective = 'Clear ' + (getRoom(roomId)?.name || 'the room');
  progression.lastTransition = { type: 'room-enter', roomId, roomIndex };
  return true;
}
export function updateRoomProgression(run, dt = 0) {
  const progression = run?.roomProgression;
  if (!progression || !run.course?.campaign) return null;
  progression.elapsed += Math.max(0, dt);
  if (run.course.roomCollisionRevision !== progression.collisionRevision) syncRoomGateCells(run.course, progression);
  const sequence = getRoomSequence(progression.sectorId);
  let room = currentRoom(progression);
  if (!room) return progression;
  const director = run.director;

  if (progression.requireEntry && Number.isInteger(progression.pendingIndex) && progression.pendingIndex > progression.currentIndex) {
    const target = sequence[progression.pendingIndex];
    if (target && roomContains(target, run.x, run.y, -.05) && enterRoom(progression, progression.pendingIndex)) {
      run.events?.push({ type: 'room-transition', roomId: progression.activeRoomId, roomIndex: progression.currentIndex, sectorIndex: progression.sectorIndex, sectorId: progression.sectorId });
    }
    room = currentRoom(progression);
    if (run.course.roomCollisionRevision !== progression.collisionRevision) syncRoomGateCells(run.course, progression);
  }

  const waveIndex = room.encounter?.waves?.[0];
  const cleared = room.role !== 'objective' && (
    director?.state === 'intermission' && Number.isInteger(waveIndex) && run.wave > waveIndex ||
    director?.state === 'exit' && room.index === sequence.length - 2 && run.wave >= run.waveCount
  );
  if (cleared && !progression.completed.includes(room.id)) {
    completeRoom(progression, progression.currentIndex);
    const nextIndex = progression.currentIndex + 1;
    if (nextIndex < sequence.length) {
      if (progression.requireEntry) {
        progression.pendingIndex = nextIndex;
        progression.phase = 'unlocked';
        progression.objective = 'Reach ' + (sequence[nextIndex]?.name || 'the next room');
      } else if (enterRoom(progression, nextIndex)) {
        run.events?.push({ type: 'room-transition', roomId: progression.activeRoomId, roomIndex: progression.currentIndex, sectorIndex: progression.sectorIndex, sectorId: progression.sectorId });
      }
    }
  }
  room = currentRoom(progression);
  if (director?.state === 'exit' && progression.currentIndex >= sequence.length - 1) {
    if (openRoomGates(progression, room)) progression.collisionRevision = (progression.collisionRevision || 0) + 1;
    progression.phase = 'exit';
    progression.objective = 'Reach the sector exit';
  }
  if (run.course.roomCollisionRevision !== progression.collisionRevision) syncRoomGateCells(run.course, progression);
  return progression;
}
export function roomProgressionSnapshot(progression) {
  if (!progression) return null;
  return {
    version: progression.version,
    sectorIndex: progression.sectorIndex,
    sectorId: progression.sectorId,
    sequence: [...progression.sequence],
    currentIndex: progression.currentIndex,
    activeRoomId: progression.activeRoomId,
    entered: progression.entered,
    pendingIndex: progression.pendingIndex ?? null,
    requireEntry: progression.requireEntry === true,
    completed: [...progression.completed],
    phase: progression.phase,
    objective: progression.objective,
    collisionRevision: progression.collisionRevision || 0,
    elapsed: progression.elapsed || 0,
    gates: Object.fromEntries(Object.entries(progression.gates).map(([id, gate]) => [id, { ...gate }])),
    barriers: Object.fromEntries(Object.entries(progression.barriers).map(([id, barrier]) => [id, { ...barrier, spans: barrier.spans.map(span => [...span]), gateIds: [...barrier.gateIds] }])),
  };
}
