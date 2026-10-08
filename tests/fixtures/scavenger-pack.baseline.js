// Run-scoped scavenging: one light resource and one fitting per owned weapon.
// Positions use gameplay cells, like keys and healing supplies (1 cell = 4 m).
import {groundAt} from '../../coastal-terrain.js';
import {actorGroundAt,isStructureWall,traceStructureSegment} from '../../coastal-structures.js';
import {coastalLootBlocked} from '../../coastal-scavenging.js';

export const PACK_CAPACITY = 12;
export const SCRAP_PER_CACHE = 4;
export const MAX_SCAVENGER_CACHES = 12;
export const MAX_PICKUP_HISTORY = 128;
export const SUPPLY_CAPACITY = 12;
export const BANDAGE_RECIPE = Object.freeze({cloth:2,antiseptic:1});
export const BANDAGE_HEAL = 35;
export const supplyCount = supplies => ['cloth','antiseptic','bandage'].reduce((n,id)=>n+(supplies?.[id]||0),0);
const boundedSupplies = value => {
  const result={cloth:0,antiseptic:0,bandage:0};let left=SUPPLY_CAPACITY;
  for(const id of Object.keys(result)){
    const n=Number(value?.[id]);result[id]=Number.isFinite(n)?Math.max(0,Math.min(left,Math.floor(n),id==='bandage'?3:SUPPLY_CAPACITY)):0;
    left-=result[id];
  }
  return result;
};
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
    supplies:boundedSupplies(source.supplies),
  };
}

export const createScavengerPack = validateBackpack;

export function ensureScavengerPack(run) {
  if (!run.backpack) run.backpack = createScavengerPack();
  if (!run.backpack.supplies) run.backpack.supplies=boundedSupplies();
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
    if (nx !== x && cell[nx > x ? 1 : 3]) {
      const edgeX=dx>0?x+1:x,t=(edgeX-from.x)/dx;
      if(!isStructureWall(course,edgeX,from.y+dy*t))return false;
    }
    if (ny !== y && cell[ny > y ? 2 : 0]) {
      const edgeY=dy>0?y+1:y,t=(edgeY-from.y)/dy;
      if(!isStructureWall(course,from.x+dx*t,edgeY))return false;
    }
    x = nx; y = ny;
  }
  return true;
}

export function pickupReachable(run,course,item,reach=.55) {
  if(run.mode!=='play'||run.health<=0||!finite(run.x)||!finite(run.y)
    ||!finite(item.x)||!finite(item.y)||Math.hypot(run.x-item.x,run.y-item.y)>reach)return false;
  const authored=finite(item.floorZ)&&finite(item.itemZ),terrain=!!course?.coastal?.terrain;
  // Old dungeon records have no vertical authoring. Retain their established
  // jump rule; coastal records use the actor's actual support and eye instead.
  if(!authored&&!terrain)return !(run.z>.3)&&pickupLineClear(course,run,item);
  const floor=actorGroundAt(course,run),itemFloor=authored?item.floorZ:groundAt(course,item.x,item.y);
  const floorTolerance=finite(item.reachFloorTolerance)&&item.reachFloorTolerance>0?Math.min(.15,item.reachFloorTolerance):.075;
  // A carried jump does not change the floor the player is reaching from.
  // Continuous terrain is one support even when the nearby ground slopes.
  if((authored||run.structureId)&&Math.abs(floor-itemFloor)>floorTolerance)return false;
  const target={x:item.x,y:item.y,z:authored?item.itemZ:itemFloor+.05};
  const from={x:run.x,y:run.y,z:floor+.4+(run.z||0)-(run.slide||0)*.18};
  if(!finite(from.z)||Math.hypot(target.x-from.x,target.y-from.y,target.z-from.z)>.75)return false;
  return pickupLineClear(course,run,item)&&!traceStructureSegment(course,from,target)&&!coastalLootBlocked(course,from,target);
}

function pickupEvent(run,world,course,item,type) {
  const destination=course?.coastal?.landmarks?.find(p=>p.id===item.destinationId);
  const event={type,pickupId:item.id,playerId:run.playerId||(run===world?'host':'peer'),
    x:item.x,y:item.y,z:finite(item.itemZ)?item.itemZ:groundAt(course,item.x,item.y)+.05};
  if(typeof item.discoveryLabel==='string')event.discoveryLabel=item.discoveryLabel.slice(0,120);
  if(type==='scavenger-search-prompt')event.label=String(item.label||'Supply case').slice(0,120);
  if(type==='scavenger-route'||type==='scavenger-route-prompt'){
    event.label=String(item.label||'Cape footbridge route').slice(0,120);
    event.destinationId=item.destinationId;
    if(destination)event.destinationName=destination.name;
  }
  return event;
}

export function collectScavengerPickup(run, pickupId) {
  const world = run.world || run, course = world.course || run.course;
  const pack = ensureScavengerPack(world);
  if (run !== world) run.backpack = pack;
  const item = attachScavengerPickups(course).find(pickup => pickup.id === pickupId);
  if (!item || pack.collected.includes(item.id)) return { ok: false, reason: 'collected' };
  if (!pickupReachable(run,course,item)) {
    return { ok: false, reason: 'out-of-reach' };
  }
  const route=item.visualKind==='route-folio'&&item.destinationId==='forest';
  const supply=item.visualKind==='supply-case';
  const contents=supply?boundedSupplies(item.contents):null;
  if(supply&&supplyCount(pack.supplies)+supplyCount(contents)>SUPPLY_CAPACITY)return{ok:false,reason:'supplies-full'};
  const amount = route||supply?0:Math.max(1, Math.min(SCRAP_PER_CACHE, Math.floor(Number(item.amount) || SCRAP_PER_CACHE)));
  if (pack.scrap + amount > pack.capacity) return { ok: false, reason: 'full' };
  pack.scrap += amount;
  if(supply)for(const id of Object.keys(contents))pack.supplies[id]+=contents[id];
  pack.collected.push(item.id);
  if (pack.collected.length > MAX_PICKUP_HISTORY) pack.collected.splice(0, pack.collected.length - MAX_PICKUP_HISTORY);
  if(route)run.coastalDestination=item.destinationId;
  const event = {...pickupEvent(run,world,course,item,route?'scavenger-route':supply?'scavenger-supplies':'scavenger-scrap'),amount,total:pack.scrap,...(supply?{contents,label:item.label}:{})};
  world.events?.push(event);
  return { ok: true, amount, event };
}

export function tickScavengerPack(run,{interact=false,peerInteract=run?.peer?.journeyInteract}={}) {
  if ((!run?.course?.dungeon&&!run?.course?.scavenging) || run.mode !== 'play') return;
  const pack = ensureScavengerPack(run);
  if (run.peer) run.peer.backpack = pack;
  const pickups = attachScavengerPickups(run.course);
  for (const player of [run, ...(run.peer ? [run.peer] : [])]) {
    let blockedId = null,promptId=null,usedInteract=false;
    if (player.health <= 0) {player.scavengerBlockedId=null;player.scavengerRoutePromptId=null;continue;}
    for (const item of pickups) {
      if (pack.collected.includes(item.id) || Math.hypot(player.x - item.x, player.y - item.y) > .55) continue;
      if(item.requiresInteract){
        if(!pickupReachable(player,run.course,item))continue;
        promptId=item.id;
        if(player.scavengerRoutePromptId!==promptId)run.events?.push(pickupEvent(player,run,run.course,item,item.visualKind==='supply-case'?'scavenger-search-prompt':'scavenger-route-prompt'));
        if(usedInteract||!(player===run?interact:peerInteract))continue;
        usedInteract=true;
      }
      const result=collectScavengerPickup(player, item.id);
      if(['full','supplies-full'].includes(result.reason)&&!blockedId) {
        blockedId=item.id;
        if(player.scavengerBlockedId!==blockedId)run.events?.push({type:result.reason==='supplies-full'?'scavenger-supplies-full':'scavenger-full',pickupId:item.id,
          playerId:player.playerId||(player===run?'host':'peer')});
      }
    }
    const station=workbenchAccess(player).station;
    if(station&&player.workbenchPromptId!==station.id)run.events?.push({type:'workbench-prompt',playerId:player.playerId||(player===run?'host':'peer'),stationId:station.id,name:station.name});
    player.workbenchPromptId=station?.id||null;
    player.scavengerBlockedId=blockedId;
    player.scavengerRoutePromptId=promptId;
  }
}

export function craftBandage(run) {
  if(!['play','pause'].includes(run.mode)||run.health<=0)return{ok:false,reason:'inactive'};
  const world=run.world||run,pack=ensureScavengerPack(world),s=pack.supplies;
  if(!workbenchAccess(run).available)return{ok:false,reason:'workbench'};
  if(s.bandage>=3)return{ok:false,reason:'bandages-full'};
  if(s.cloth<BANDAGE_RECIPE.cloth||s.antiseptic<BANDAGE_RECIPE.antiseptic)return{ok:false,reason:'materials'};
  s.cloth-=BANDAGE_RECIPE.cloth;s.antiseptic-=BANDAGE_RECIPE.antiseptic;s.bandage++;
  world.events?.push({type:'scavenger-crafted',playerId:run.playerId||'host'});
  return{ok:true};
}

export function useBandage(run) {
  if(!['play','pause'].includes(run.mode)||!finite(run.health)||run.health<=0)return{ok:false,reason:'inactive'};
  const world=run.world||run,pack=ensureScavengerPack(world);
  if(run.health>=100)return{ok:false,reason:'healthy'};
  if(pack.supplies.bandage<1)return{ok:false,reason:'empty'};
  const amount=Math.min(BANDAGE_HEAL,100-run.health);
  pack.supplies.bandage--;run.health+=amount;run.heal=.5;
  world.events?.push({type:'scavenger-bandage',playerId:run.playerId||'host',amount});
  return{ok:true,amount};
}

export function discardSupply(run,id) {
  if(!['play','pause'].includes(run.mode)||run.health<=0)return{ok:false,reason:'inactive'};
  if(!['cloth','antiseptic'].includes(id))return{ok:false,reason:'invalid'};
  const pack=ensureScavengerPack(run.world||run);
  if(pack.supplies[id]<1)return{ok:false,reason:'empty'};
  pack.supplies[id]--;return{ok:true};
}

export function workbenchAccess(run) {
  const course = (run.world || run).course || run.course;
  if (!course?.coastal) return {required:false, available:true, station:null, nearest:null};
  if(!finite(run.x)||!finite(run.y)||!finite(run.z??0))return {required:true,available:false,station:null,nearest:null};
  const stations = course.coastal.workbenches || [];
  let nearest = null, distance = Infinity;
  for (const station of stations) {
    const d = Math.hypot(run.x-station.x, run.y-station.y);
    if (d < distance) {nearest=station; distance=d;}
    if (d > station.reach || Math.abs(actorGroundAt(course,run)-station.floorZ) > .075
      || (run.z || 0) > .15 || !pickupLineClear(course,run,station)) continue;
    const from={x:run.x,y:run.y,z:actorGroundAt(course,run)+.4+(run.z||0)};
    if (!traceStructureSegment(course,from,{x:station.x,y:station.y,z:station.itemZ})) {
      return {required:true,available:true,station,nearest:station,distance:d};
    }
  }
  return {required:true,available:false,station:null,nearest,distance};
}

export function upgradeWeapon(run, weaponIndex = run.weapon) {
  const pack = ensureScavengerPack(run.world || run);
  if (!weaponIndexValid(weaponIndex) || Array.isArray(run.ownedWeapons) && !run.ownedWeapons.includes(weaponIndex)) {
    return { ok: false, reason: 'unowned' };
  }
  if (!['play', 'pause'].includes(run.mode) || run.health <= 0) return { ok: false, reason: 'inactive' };
  if (pack.weaponMods[weaponIndex]) return { ok: false, reason: 'already-fitted' };
  if (pack.scrap < WEAPON_FITTING.cost) return { ok: false, reason: 'scrap' };
  if (!workbenchAccess(run).available) return { ok: false, reason: 'workbench' };
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
