import {ensureScavengerPack,supplyCount,SUPPLY_CAPACITY,WEAPON_FITTING} from './scavenger-pack.js';

export function validateStash(value) {
  const weapons=[...new Set(Array.isArray(value?.weapons)?value.weapons:[])].filter(n=>Number.isInteger(n)&&n>0&&n<8);
  const weaponMods={};
  for(const n of weapons)if(value?.weaponMods?.[n]===WEAPON_FITTING.id)weaponMods[n]=WEAPON_FITTING.id;
  const supplies={};
  for(const id of ['cloth','antiseptic','bandage'])supplies[id]=Number.isFinite(value?.supplies?.[id])?Math.max(0,Math.min(99,Math.floor(value.supplies[id]))):0;
  return {weapons,weaponMods,supplies};
}
export function stashAccess(run) {
  const station=run?.course.lowTideStations?.find(p=>p.id==='stash');
  return !!(run?.lowTide?.shelter&&station&&run.course.activeInterior?.id===station.roomId
    &&Math.hypot(run.x-station.x,run.y-station.y)<.9&&run.z<.3&&run.health>0
    &&['play','pause'].includes(run.mode)&&!run.peer&&!run.vehicle?.occupied&&!run.activeVehicle?.occupied);
}
// Transfers conserve equipment and fittings; the starter sidearm always stays packed.
export function transferStash(run,direction,kind,id) {
  if(!stashAccess(run)||!['store','take'].includes(direction))return {ok:false};
  const pack=ensureScavengerPack(run),s=run.lowTide,box=s.stash||(s.stash=validateStash()),store=direction==='store';
  if(kind==='weapon'){
    if(!Number.isInteger(id)||id<1||id>7)return {ok:false};
    const from=store?run.ownedWeapons:box.weapons,to=store?box.weapons:run.ownedWeapons;
    if(!from.includes(id)||to.includes(id))return {ok:false};
    from.splice(from.indexOf(id),1);to.push(id);
    const modsFrom=store?pack.weaponMods:box.weaponMods,modsTo=store?box.weaponMods:pack.weaponMods;
    if(modsFrom[id])modsTo[id]=modsFrom[id];delete modsFrom[id];
    if(store&&run.weapon===id){run.weapon=0;run.meleeActive=false;run.sawActive=false;run.rifleCharging=false;run.rifleCharge=0;}
  }else if(kind==='scrap'){
    const amount=store?Math.min(pack.scrap,99-s.bank):Math.min(s.bank,pack.capacity-pack.scrap);
    if(amount<=0)return {ok:false};s.bank+=store?amount:-amount;pack.scrap+=store?-amount:amount;
  }else if(kind==='supply'&&['cloth','antiseptic','bandage'].includes(id)){
    const from=store?pack.supplies:box.supplies,to=store?box.supplies:pack.supplies;
    if(from[id]<1||to[id]>=(store?99:id==='bandage'?3:SUPPLY_CAPACITY)||!store&&supplyCount(pack.supplies)>=SUPPLY_CAPACITY)return {ok:false};
    from[id]--;to[id]++;
  }else return {ok:false};
  s.revision++;return {ok:true};
}
