// A cheap, deterministic second wing. Both wings enter the same grid compiler:
// surfaces, collision, door state and navigation never get separate copies.
const PREFIX = 'annex-';
const SECTION_GAP = 4;
const ANNEX_COLORS = ['#a5b087', '#91b1aa', '#a0aab9', '#9ca98a', '#9da6ae'];
const ANNEX_NAMES = ['Pumpworks', 'Isolation Ward', 'Ash Galleries', 'Cold Stores', 'Blackwater Control'];
const mirroredSide = side => side === 'e' ? 'w' : side === 'w' ? 'e' : side;

export function extendDungeonLayer(source, route) {
  const offsetX = source.exit.x + source.entry.x - source.width;
  const originalX = Math.max(0, -offsetX);
  const annexX = originalX + offsetX;
  const originalZ = source.height + SECTION_GAP;
  const point = (at, annex = false) => [
    annex ? annexX + source.width - at[0] : originalX + at[0],
    at[1] + (annex ? 0 : originalZ),
  ];
  const cell = (at, annex = false) => [
    annex ? annexX + source.width - 1 - at[0] : originalX + at[0],
    at[1] + (annex ? 0 : originalZ),
  ];
  const id = (value, annex) => annex ? `${PREFIX}${value}` : value;
  const moveItem = (item, annex = false) => {
    const result = { ...item };
    if (item.id) result.id = id(item.id, annex);
    if (item.roomId) result.roomId = id(item.roomId, annex);
    for (const key of ['anchor', 'at']) if (Array.isArray(item[key])) result[key] = point(item[key], annex);
    if (item.points) result.points = item.points.map(at => point(at, annex));
    return result;
  };
  const moveRoom = (room, annex) => {
    const [x, z, width, depth] = room.rect;
    const result = { ...room, id: id(room.id, annex),
      rect: [annex ? annexX + source.width - x - width : originalX + x,
        z + (annex ? 0 : originalZ), width, depth],
      cover: (room.cover || []).map(at => cell(at, annex)),
      coverPatterns: (room.coverPatterns || []).map(pattern => typeof pattern === 'string' ? pattern
        : { ...pattern, side: annex ? mirroredSide(pattern.side) : pattern.side }),
      sightlines: (room.sightlines || []).map(line => ({ ...line, from: point(line.from, annex), to: point(line.to, annex) })),
      identity: room.identity && { ...room.identity },
      encounter: room.encounter && { ...room.encounter, composition: { ...room.encounter.composition } },
    };
    if (!annex && room.kind === 'exit') {
      result.kind = 'hall';
      result.name = 'Annex Transfer';
      result.identity = { beat: 'recovery', landmark: 'Annex Transfer', goal: 'Follow the cold service lights into the annex' };
    }
    if (annex) {
      result.name = `${ANNEX_NAMES[source.index]} · ${room.name}`;
      result.section = 'annex';
      result.color = ANNEX_COLORS[source.index];
      // Alter the cover rhythm rather than just producing a reflected maze.
      // Thresholds remain protected by the compiler when cover is expanded.
      if (result.cover.length > 1) result.cover = result.cover.filter((_, index) => index % 2 === 0);
      if (result.encounter?.budget > 0) {
        result.encounter.budget = Math.max(3, Math.round(result.encounter.budget * .6));
        result.encounter.maxAlive = Math.min(4, result.encounter.maxAlive || 4);
      }
      if (result.identity) result.identity = { ...result.identity,
        beat: result.identity.beat === 'key-retrieval' ? 'flank' : result.identity.beat,
        landmark: `${ANNEX_NAMES[source.index]} · ${result.identity.landmark}`,
        goal: room.kind === 'exit' ? 'Reach the descent beyond the annex'
          : room.encounter?.budget > 0 ? 'Clear the service wing and follow the cold lights'
          : 'Recover supplies before pushing through the annex',
      };
    }
    return result;
  };
  const moveOpening = (opening, annex) => {
    const width = Math.max(1, Math.round(opening.width || 3));
    const start = Math.round(opening.at - (width - 1) / 2);
    return { ...opening, id: id(opening.id, annex), room: id(opening.room, annex),
      side: annex ? mirroredSide(opening.side) : opening.side,
      at: opening.side === 'n' || opening.side === 's'
        ? annex ? annexX + source.width - start - width + (width - 1) / 2 : originalX + opening.at
        : opening.at + (annex ? 0 : originalZ),
    };
  };
  const originalRooms = source.rooms.map(room => moveRoom(room, false));
  const annexRooms = source.rooms.map(room => moveRoom(room, true));
  const originalExit = originalRooms.find(room => source.rooms.find(item => item.id === room.id)?.kind === 'exit');
  const annexEntry = annexRooms.find(room => room.kind === 'entry');
  const seamX = Math.floor(originalX + source.exit.x);
  const seamFrom = originalExit.rect[1];
  const seamTo = annexEntry.rect[1] + annexEntry.rect[3];
  const seamId = `${source.id}-annex-link`;
  const waveOffset = Math.max(1, ...source.spots.map(spot => spot.wave + 1));
  const originalSpots = source.spots.map(spot => {
    const at = point([spot.x, spot.z]);
    return { ...spot, x: at[0], z: at[1] };
  });
  const annexSpots = annexRooms.filter(room => route.includes(room.id.slice(PREFIX.length)) && room.encounter?.budget > 0)
    .map(room => ({ id: `${room.id}-patrol`, x: room.rect[0] + room.rect[2] / 2,
      z: room.rect[1] + room.rect[3] / 2, roomId: room.id, annex: true,
      wave: waveOffset + Math.floor(route.indexOf(room.id.slice(PREFIX.length)) / 2),
      variant: Object.keys(room.encounter.composition || {})[0] || 'stalker' }));
  const annexScenery = key => (source[key] || []).map((item, index) => {
    const moved = moveItem(item, true);
    if (moved.size) moved.size = moved.size.map((size, axis) => size * (axis === 1 ? 1.06 : index % 2 ? .88 : 1.08));
    if (moved.count) moved.count = Math.max(1, Math.round(moved.count * .65));
    return moved;
  });
  const entry = point([source.entry.x, source.entry.z]);
  const exit = point([source.exit.x, source.exit.z], true);
  const layer = { ...source,
    width: source.width + Math.abs(offsetX), height: source.height * 2 + SECTION_GAP,
    entry: { ...source.entry, x: entry[0], z: entry[1] }, exit: { x: exit[0], z: exit[1] },
    rooms: [...originalRooms, ...annexRooms],
    corridors: [...source.corridors.map(item => moveItem(item)), ...source.corridors.map(item => moveItem(item, true)),
      { id: seamId, kind: 'service', width: 2.4, points: [[seamX + .5, seamFrom], [seamX + .5, seamTo - 1]] }],
    openings: [...source.openings.map(item => moveOpening(item, false)), ...source.openings.map(item => moveOpening(item, true)),
      { id: `${seamId}-south`, room: originalExit.id, side: 'n', at: seamX, width: 1, kind: 'arch' },
      { id: `${seamId}-north`, room: annexEntry.id, side: 's', at: seamX, width: 1, kind: 'arch' }],
    keys: source.keys.map(item => ({ ...moveItem(item), opens: [...item.opens, ...item.opens.map(value => id(value, true))] })),
    loot: (source.loot || []).map(item => moveItem(item)),
    evidence: (source.evidence || []).map(item => moveItem(item)),
    spots: [...originalSpots, ...annexSpots],
    connections: (source.connections || []).map(item => moveItem(item, true)),
    lights: [...source.lights.map(item => moveItem(item)), ...source.lights.map(item => ({ ...moveItem(item, true),
      color: ANNEX_COLORS[source.index], intensity: item.intensity * .9 }))],
  };
  for (const key of ['landmarks', 'machinery', 'setpieces', 'props', 'scares']) {
    layer[key] = [...(source[key] || []).map(item => moveItem(item)), ...annexScenery(key)];
  }
  layer.extension = { type: 'mirrored-service-annex', seed: source.index + 1,
    districtName: ANNEX_NAMES[source.index],
    roomPrefix: PREFIX, annexRoomIds: annexRooms.map(room => room.id),
    originalOffset: { x: originalX, z: originalZ }, annexBounds: { minX: annexX, minZ: 0, maxX: annexX + source.width, maxZ: source.height },
    seam: { x: seamX + .5, fromZ: seamFrom, toZ: seamTo },
    sourceWidth: source.width, sourceHeight: source.height,
  };
  return { layer, route: [...route, ...route.map(value => id(value, true))] };
}
