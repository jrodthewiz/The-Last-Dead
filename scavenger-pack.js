// Run-scoped scavenging: one light resource and one fitting per owned weapon.
// Positions use gameplay cells, like keys and healing supplies (1 cell = 4 m).
export const PACK_CAPACITY = 12;
export const SCRAP_PER_CACHE = 4;
export const MAX_SCAVENGER_CACHES = 12;
export const MAX_PICKUP_HISTORY = 128;
export const WEAPON_FITTING = Object.freeze({
  id: 'hardened-fitting', name: 'Hardened fitting', cost: 8, damageMultiplier: 1.25,
});

const weaponIndexValid = index => Number.isInteger(index) && index >= 0 && index < 8;
const finite = value => Number.isFinite(value);
const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 160;

export function validateBackpack(value) {
  const source = value && typeof value === 'object' ? value : {};
  const collected = [...new Set((Array.isArray(source.collected) ? source.collected : []).filter(validId))]
    .slice(-MAX_PICKUP_HISTORY);
  const weaponMods = {};
  for (let index = 0; index < 8; index++) {
    if (source.weaponMods?.[index] === WEAPON_FITTING.id) weaponMods[index] = WEAPON_FITTING.id;
  }
  return {
    capacity: PACK_CAPACITY,
    scrap: Math.max(0, Math.min(PACK_CAPACITY, Math.floor(Number(source.scrap) || 0))),
    collected,
    weaponPickups:[...new Set((Array.isArray(source.weaponPickups)?source.weaponPickups:[]).filter(validId))].slice(-MAX_PICKUP_HISTORY),
    weaponMods,
  };
}

export const createScavengerPack = validateBackpack;

export function ensureScavengerPack(run) {
  if (!run.backpack) run.backpack = createScavengerPack();
  return run.backpack;
}

function pointOf(item) {
  if (finite(item?.x) && finite(item?.y)) return { x: item.x, y: item.y };
  const anchor = item?.anchor || item?.at;
  if (Array.isArray(anchor) && finite(anchor[0]) && finite(anchor[1])) return { x: anchor[0], y: anchor[1] };
  return null;
}

function roomContains(room, x, y) {
  const bounds = room.bounds;
  if (!bounds || x < bounds.minX || x >= bounds.maxX || y < bounds.minZ || y >= bounds.maxZ) return false;
  if (!room.footprint) return true;
  const cell = room.footprint[Math.floor(y) - bounds.minZ]?.[Math.floor(x) - bounds.minX];
  return cell === '1';
}

function stableRank(value) {
  let rank = 2166136261;
  for (const character of value) rank = Math.imul(rank ^ character.charCodeAt(0), 16777619);
  return (rank >>> 0) / 4294967296;
}

// Deterministic placement makes the new route useful without copying caches
// onto a key, a hero prop, cover, or an existing recovery case. Course creation
// calls this after any annex transform; lazy calls are safe as well.
export function attachScavengerPickups(course) {
  if (Array.isArray(course?.scavengerPickups)) return course.scavengerPickups;
  if (!course?.dungeon || !course.cells) return [];
  const reserved = [course.exit, ...['keys', 'loot', 'evidence', 'supplies', 'journeyStations',
    'landmarks', 'machinery', 'setpieces', 'props'].flatMap(key => course[key] || [])]
    .map(pointOf).filter(Boolean);
  const blocked = new Set((course.blocks || []).map(block => `${block[0]},${block[1]}`));
  const route = course.route || [];
  const rooms = [...(course.rooms || [])].sort((a, b) => {
    const ai = route.indexOf(a.id), bi = route.indexOf(b.id);
    return (ai < 0 ? route.length + (a.order || 0) : ai) - (bi < 0 ? route.length + (b.order || 0) : bi);
  });
  const courseId = String(course.id || course.sectorId || `floor-${course.dungeonIndex || 0}`);
  const candidates = [];
  for (const room of rooms) {
    if (room.kind === 'exit' || !room.bounds) continue;
    const points = [];
    for (let y = room.bounds.minZ; y < room.bounds.maxZ; y++) {
      for (let x = room.bounds.minX; x < room.bounds.maxX; x++) {
        const px = x + .5, py = y + .5, cell = course.cells[y * course.w + x];
        if (!roomContains(room, px, py) || !cell || cell.every(side => side === 1)
          || blocked.has(`${x},${y}`)) continue;
        if (course.dungeonCompiled?.reach && !course.dungeonCompiled.reach.has(`${x},${y}`)) continue;
        if (reserved.some(point => Math.hypot(px - point.x, py - point.y) < .8)) continue;
        const entry = room.kind === 'entry' && course.playerSpawn;
        if (entry && Math.hypot(px - entry.x, py - entry.y) < .75) continue;
        const centre = entry || room.center || { x: (room.bounds.minX + room.bounds.maxX) / 2,
          y: (room.bounds.minZ + room.bounds.maxZ) / 2 };
        const targetDistance = entry ? 1.25 : 1.5;
        const score = Math.abs(Math.hypot(px - centre.x, py - centre.y) - targetDistance)
          + stableRank(`${courseId}:${room.id}:${x},${y}`) * .25;
        points.push({ x: px, y: py, score });
      }
    }
    points.sort((a, b) => a.score - b.score);
    if (points.length) candidates.push({ room, point: points[0] });
  }
  // Uniform room sampling keeps both halves represented when an annex doubles
  // a floor. No more than twelve small instances are created for one floor.
  const count = Math.min(MAX_SCAVENGER_CACHES, candidates.length);
  const selected = new Set();
  for (let index = 0; index < count; index++) {
    selected.add(count === 1 ? 0 : Math.round(index * (candidates.length - 1) / (count - 1)));
  }
  course.scavengerPickups = [...selected].map(index => {
    const { room, point } = candidates[index];
    return { id: `${courseId}:${room.id}:scrap`, roomId: room.id,
      x: point.x, y: point.y, amount: SCRAP_PER_CACHE, color: 0xd59a56,
      rarity: 'scrap', label: 'Salvaged fittings' };
  });
  return course.scavengerPickups;
}

function pickupLineClear(course, from, to) {
  // Nearby pickup checks still respect sealed doors. Sampled cell transitions
  // avoid importing the engine and keep this module independently testable.
  const dx = to.x - from.x, dy = to.y - from.y;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / .04));
  let x = Math.floor(from.x), y = Math.floor(from.y);
  for (let step = 1; step <= steps; step++) {
    const nx = Math.floor(from.x + dx * step / steps), ny = Math.floor(from.y + dy * step / steps);
    const cell = course.cells?.[y * course.w + x];
    if (!cell) return false;
    if (nx !== x && cell[nx > x ? 1 : 3]) return false;
    if (ny !== y && cell[ny > y ? 2 : 0]) return false;
    x = nx; y = ny;
  }
  return true;
}

export function collectScavengerPickup(run, pickupId) {
  const world = run.world || run, course = world.course || run.course;
  const pack = ensureScavengerPack(world);
  if (run !== world) run.backpack = pack;
  const item = attachScavengerPickups(course).find(pickup => pickup.id === pickupId);
  if (!item || pack.collected.includes(item.id)) return { ok: false, reason: 'collected' };
  if (run.mode !== 'play' || run.health <= 0 || run.z > .3 || !finite(run.x) || !finite(run.y)
    || Math.hypot(run.x - item.x, run.y - item.y) > .55 || !pickupLineClear(course, run, item)) {
    return { ok: false, reason: 'out-of-reach' };
  }
  const amount = Math.max(1, Math.min(SCRAP_PER_CACHE, Math.floor(Number(item.amount) || SCRAP_PER_CACHE)));
  if (pack.scrap + amount > pack.capacity) return { ok: false, reason: 'full' };
  pack.scrap += amount;
  pack.collected.push(item.id);
  if (pack.collected.length > MAX_PICKUP_HISTORY) pack.collected.splice(0, pack.collected.length - MAX_PICKUP_HISTORY);
  const event = { type: 'scavenger-scrap', pickupId: item.id, amount, total: pack.scrap,
    playerId: run.playerId || (run === world ? 'host' : 'peer'), x: item.x, y: item.y, z: .05 };
  world.events?.push(event);
  return { ok: true, amount, event };
}

export function tickScavengerPack(run) {
  if ((!run?.course?.dungeon&&!run?.course?.scavenging) || run.mode !== 'play') return;
  const pack = ensureScavengerPack(run);
  if (run.peer) run.peer.backpack = pack;
  const pickups = attachScavengerPickups(run.course);
  for (const player of [run, ...(run.peer ? [run.peer] : [])]) {
    let blockedId = null;
    if (player.health <= 0 || player.z > .3) {player.scavengerBlockedId=null;continue;}
    for (const item of pickups) {
      if (pack.collected.includes(item.id) || Math.hypot(player.x - item.x, player.y - item.y) > .55) continue;
      const result=collectScavengerPickup(player, item.id);
      if(result.reason==='full') {
        blockedId=item.id;
        if(player.scavengerBlockedId!==blockedId)run.events?.push({type:'scavenger-full',pickupId:item.id,
          playerId:player.playerId||(player===run?'host':'peer')});
        break;
      }
    }
    player.scavengerBlockedId=blockedId;
  }
}

export function upgradeWeapon(run, weaponIndex = run.weapon) {
  const pack = ensureScavengerPack(run.world || run);
  if (!weaponIndexValid(weaponIndex) || Array.isArray(run.ownedWeapons) && !run.ownedWeapons.includes(weaponIndex)) {
    return { ok: false, reason: 'unowned' };
  }
  if (!['play', 'pause'].includes(run.mode) || run.health <= 0) return { ok: false, reason: 'inactive' };
  if (pack.weaponMods[weaponIndex]) return { ok: false, reason: 'already-fitted' };
  if (pack.scrap < WEAPON_FITTING.cost) return { ok: false, reason: 'scrap' };
  pack.scrap -= WEAPON_FITTING.cost;
  pack.weaponMods[weaponIndex] = WEAPON_FITTING.id;
  const event = { type: 'scavenger-upgrade', weaponIndex, cost: WEAPON_FITTING.cost,
    multiplier: WEAPON_FITTING.damageMultiplier, playerId: run.playerId || 'host' };
  (run.world || run).events?.push(event);
  return { ok: true, event };
}

export function weaponDamageMultiplier(run, weaponIndex = run.weapon) {
  const pack = (run.world || run).backpack || run.backpack;
  return weaponIndexValid(weaponIndex) && pack?.weaponMods?.[weaponIndex] === WEAPON_FITTING.id
    ? WEAPON_FITTING.damageMultiplier : 1;
}
