import {clamp} from './data.js';

// Metre-scale combat profiles adapted from the original eight-weapon port.
// The expedition carbine remains available, including in existing saves.
export const WEAPONS=Object.freeze([
 {id:'carbine',name:'Field carbine',kind:'bullet',capacity:8,reserve:48,damage:40,head:90,range:140,interval:.38,reload:1.6,spread:.003,description:'A steady, economical rifle. Eight rounds. Aim for the head.'},
 {id:'ossuary',name:'Ossuary',kind:'bullet',capacity:6,reserve:24,damage:46,head:100,range:95,interval:.24,reload:1.7,spread:.008,description:'Fast six-shot revolver. Precise fire at close and medium range.'},
 {id:'breach',name:'Breach shotgun',kind:'pellet',capacity:2,reserve:20,damage:14,head:20,pellets:8,range:32,interval:.72,reload:2.3,spread:.065,description:'Two-barrel break action. Eight pellets per shot; open the breech to load both shells.'},
 {id:'arc',name:'Arc lance',kind:'arc',capacity:3,reserve:12,damage:130,head:180,range:125,interval:1.7,reload:2.7,spread:0,description:'Hold fire to charge a penetrating electrical discharge. Hits up to three infected.'},
 {id:'reliquary',name:'Reliquary',kind:'rocket',capacity:1,reserve:5,damage:175,head:175,range:180,interval:1.1,reload:2.8,spread:0,description:'Travelling rockets. Six-metre blast radius; cover blocks the blast.'},
 {id:'carrion',name:'Carrion',kind:'bullet',capacity:30,reserve:90,damage:29,head:65,range:110,interval:.11,reload:2.1,spread:.014,description:'Automatic rifle. Sustained fire heats the barrel; release to cool.'},
 {id:'mourning',name:'Mourning',kind:'bullet',capacity:5,reserve:25,damage:95,head:160,range:260,interval:.78,reload:2.2,spread:.001,description:'Marksman rifle. Deep sights, deliberate shots and long reach.'},
 {id:'bat',name:'Wake bat',kind:'melee',capacity:0,reserve:0,damage:65,head:65,range:2.8,interval:.72,reload:0,spread:0,description:'A heavy sweeping strike. No ammunition needed.'},
 {id:'chainsaw',name:'Ripper',kind:'saw',capacity:100,reserve:100,damage:13,head:13,range:2.4,interval:.105,reload:2.4,spread:0,description:'Hold fire to cut. Consumes fuel; refuel from supply caches.'},
]);
export function ensureArmory(s,saved=s.armory){
 const result={};for(const w of WEAPONS){const old=saved?.[w.id],owned=w.id==='carbine'||w.id==='bat'||old?.owned===true;result[w.id]={owned,ammo:clamp(Math.floor(Number.isFinite(old?.ammo)?old.ammo:w.id==='carbine'?s.ammo:w.capacity),0,w.capacity),reserve:clamp((w.id==='breach'?clamp((old?.ammo||0)-w.capacity,0,3):0)+Math.floor(Number.isFinite(old?.reserve)?old.reserve:w.id==='carbine'?s.reserve:w.reserve),0,999)};}
 s.armory=result;s.weapon=WEAPONS.some(w=>w.id===s.weapon&&result[w.id].owned)?s.weapon:'carbine';const current=result[s.weapon];s.ammo=current.ammo;s.reserve=current.reserve;return s;
}
export function weaponProfile(s){return WEAPONS.find(w=>w.id===s.weapon)||WEAPONS[0];}
export function storeAmmo(s){if(s.armory?.[s.weapon])Object.assign(s.armory[s.weapon],{ammo:s.ammo,reserve:s.reserve});}
export function equip(s,id){if(!s.armory?.[id]?.owned||s.weapon===id)return false;storeAmmo(s);s.weapon=id;s.ammo=s.armory[id].ammo;s.reserve=s.armory[id].reserve;return true;}
export function collectWeapon(s,id){const entry=s.armory[id],w=WEAPONS.find(w=>w.id===id);if(!entry||entry.owned)return false;entry.owned=true;entry.ammo=w.capacity;entry.reserve=Math.max(entry.reserve,w.reserve);return true;}
// Loose finds are consumed by identity, independently of weapon ownership.
// Recovering the same weapon from a cupboard first must not erase the field find.
export function recoverWeapon(s,cache){
 if(s.collected.includes(cache.id))return null;
 const w=WEAPONS.find(w=>w.id===cache.weapon),a=s.armory[cache.weapon];if(!w||!a)return null;
 let receipt;if(!a.owned){collectWeapon(s,w.id);receipt={id:'weapon-'+w.id,count:1};}
 else{storeAmmo(s);const count=Math.min(w.capacity,999-a.reserve);if(count<=0)return null;a.reserve+=count;s.reserve=s.armory[s.weapon].reserve;receipt={id:'ammo-'+w.id,count};}
 s.collected.push(cache.id);return receipt;
}
export const repeatsWhileHeld=w=>w.id==='carrion'||w.kind==='saw'||w.kind==='arc';
export function supplyAmmo(s){storeAmmo(s);for(const w of WEAPONS){const a=s.armory[w.id];if(a.owned&&w.capacity)a.reserve=Math.min(999,a.reserve+(w.id==='carbine'?16:w.kind==='rocket'?2:w.kind==='arc'?3:w.kind==='saw'?40:w.capacity));}s.reserve=s.armory[s.weapon].reserve;}
export function finishReload(s){const w=weaponProfile(s),add=Math.min(w.capacity-s.ammo,s.reserve);s.ammo+=add;s.reserve-=add;storeAmmo(s);return add;}
export function weaponCaches(data){
 const near=(x,z)=>data.buildings.filter(b=>b.enterable&&b.district==='village').sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z))[0];
 const home=data.buildings.find(b=>b.id==='arrival-house'),village=near(-420,160),keeper=data.buildings.find(b=>b.id==='lightkeeper'),orchard=data.buildings.find(b=>b.id==='orchard-house');
 return [{weapon:'ossuary',x:home.x+1,z:home.z-1,place:'Mariner’s Rest cottage'},{weapon:'breach',x:village.x+1,z:village.z-1,place:'Alder Village'},{weapon:'arc',x:948,z:-300,place:'Hospital clinic'},{weapon:'reliquary',x:1145,z:246,place:'East Docks'},{weapon:'carrion',x:-15,z:5,place:'Bridge checkpoint'},{weapon:'mourning',x:keeper.x+1,z:keeper.z-1,place:'Keeper’s house'},{weapon:'chainsaw',x:orchard.x+1,z:orchard.z-1,place:'Orchard cottage'}].map(p=>({...p,id:'weapon-'+p.weapon}));
}
