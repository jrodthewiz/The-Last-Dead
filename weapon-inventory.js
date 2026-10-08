import {ensureScavengerPack,pickupReachable} from './scavenger-pack.js';

export const WEAPON_CAPACITY = 8;
export const WEAPON_PICKUP_RADIUS = .65;
const validIndex = value => Number.isInteger(value) && value >= 0 && value < WEAPON_CAPACITY;

// Ownership lives exclusively in ownedWeapons. The backpack only remembers
// consumed world objects; selecting an item never silently equips it.
export function collectWeaponPickup(run, itemOrId, {castRay,interact=false} = {}) {
  const world = run.world || run, course = world.course || run.course;
  const item = course?.weaponPickups?.find(value => typeof itemOrId === 'string'
    ? value.id === itemOrId : value === itemOrId);
  if (!item || typeof item.id !== 'string' || !item.id.length || item.id.length > 160
    || !validIndex(item.weaponIndex) || !Number.isFinite(item.x) || !Number.isFinite(item.y)) return {ok: false, reason: 'invalid'};
  if (run.mode !== 'play' || run.health <= 0 || (run.z || 0) > .3) return {ok: false, reason: 'inactive'};
  const pack = ensureScavengerPack(world);
  pack.weaponPickups ||= [];
  if (pack.weaponPickups.includes(item.id)) return {ok: false, reason: 'collected'};
  const distance = Math.hypot(run.x - item.x, run.y - item.y);
  if (!Number.isFinite(distance) || distance > WEAPON_PICKUP_RADIUS) return {ok: false, reason: 'distance'};
  const supported=course.coastal&&Number.isFinite(item.floorZ)&&Number.isFinite(item.itemZ);
  // Fail closed when callers omit geometry validation, including same-cell
  // pickups: thin interior walls must not leak loot through their surfaces.
  const clearance = typeof castRay === 'function' ? castRay(course, run.x, run.y,
    Math.atan2(item.y - run.y, item.x - run.x), distance + .02)?.dist : NaN;
  if (supported?!pickupReachable(run,course,item,WEAPON_PICKUP_RADIUS)
    :!Number.isFinite(clearance)||clearance<distance+.001) return {ok: false, reason: 'blocked'};
  if(item.requiresInteract&&!interact)return{ok:false,reason:'interact'};
  world.ownedWeapons ||= [];
  const alreadyOwned = world.ownedWeapons.includes(item.weaponIndex);
  if (!alreadyOwned) world.ownedWeapons.push(item.weaponIndex);
  pack.weaponPickups.push(item.id);
  if (world.peer) { world.peer.ownedWeapons = [...world.ownedWeapons]; world.peer.backpack = pack; }
  if (run !== world) { run.ownedWeapons = [...world.ownedWeapons]; run.backpack = pack; }
  (world.events ||= []).push({type: 'weapon-stashed', id: item.id, weaponIndex: item.weaponIndex,
    x: item.x, y: item.y, alreadyOwned,playerId:run.playerId||(run===world?'host':'peer'),label:item.label});
  return {ok: true, weaponIndex: item.weaponIndex, alreadyOwned};
}

export function tickWeaponInventory(run, environment = {}) {
  const world = run.world || run;
  const consumed=new Set();
  if (!world.course?.scavenging) return consumed;
  for (const player of [world, world.peer].filter(Boolean)){
    let promptId=null,usedInteract=false;
    for (const item of world.course.weaponPickups || []){
      const result=collectWeaponPickup(player,item,{...environment,interact:!usedInteract&&!!(player===world?environment.interact:environment.peerInteract)});
      if(result.ok&&item.requiresInteract){usedInteract=true;consumed.add(player);}
      if(result.reason==='interact'&&!promptId){
        promptId=item.id;
        if(player.weaponPromptId!==item.id)world.events?.push({type:'weapon-pickup-prompt',playerId:player.playerId||(player===world?'host':'peer'),label:item.label});
      }
    }
    player.weaponPromptId=promptId;
  }
  return consumed;
}
