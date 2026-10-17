import {WEAPONS,storeAmmo,collectWeapon} from './armory-state.js';

export const PACK_CAPACITY=24;
export const ITEMS=Object.freeze({
 bandage:{name:'Clean bandage',short:'Bandage',heal:35,time:1.4,colour:'#d5cfaa',description:'A clean roll of dressing. Restores up to 35 health.'},
 beer:{name:'Blackwater stout',short:'Stout',heal:15,time:1.05,colour:'#bc945e',description:'A sealed bottle from the island brewery. Restores up to 15 health.'},
 cloth:{name:'Clean cloth',short:'Cloth',colour:'#a6b7a0',description:'Folded linen. Combine two with antiseptic to make a bandage.'},
 antiseptic:{name:'Antiseptic',short:'Antiseptic',colour:'#8fb3aa',description:'One bottle treats two pieces of cloth. Make bandages in your pack.'},
 scrap:{name:'Salvaged fittings',short:'Fittings',colour:'#a0a78c',description:'Eight fittings reinforce one weapon, increasing its damage by 20%.'},
});
const bounded=(n,max)=>Number.isFinite(n)?Math.max(0,Math.min(max,Math.floor(n))):0;
export function validatePack(value){
 const items={},fittings={};let left=PACK_CAPACITY;
 for(const id of Object.keys(ITEMS)){items[id]=bounded(value?.items?.[id],left);left-=items[id];}
 for(const w of WEAPONS)if(value?.fittings?.[w.id]===true)fittings[w.id]=true;
 const searched=[...new Set((Array.isArray(value?.searched)?value.searched:[]).filter(id=>typeof id==='string'&&/^stash-[\w-]{1,70}$/.test(id)))].slice(0,256),remaining={};
 for(const id of searched){const saved=value?.remaining?.[id];if(saved&&typeof saved==='object'){remaining[id]={};for(const [item,n]of Object.entries(saved))if(itemDefinition(item))remaining[id][item]=bounded(n,99);}}
 return {items,fittings,searched,remaining};
}
export const packCount=s=>Object.values(s.backpack.items).reduce((a,n)=>a+n,0);
export function itemDefinition(id){
 if(ITEMS[id])return ITEMS[id];if(id==='dressing')return {name:'Field dressing',short:'Field dressing',heal:45,time:1.4,description:'A sealed dressing on your medical belt. Restores up to 45 health.',colour:'#d7d6b3'};
 const weapon=WEAPONS.find(w=>id==='ammo-'+w.id||id==='weapon-'+w.id);if(!weapon)return null;
 return {name:id.startsWith('weapon-')?weapon.name:weapon.name+(weapon.kind==='saw'?' fuel':' ammunition'),description:id.startsWith('weapon-')?weapon.description:'Added to this weapon’s reserve.',colour:'#c5af77',weapon:weapon.id};
}
export function openStash(s,stash){if(!s.backpack.searched.includes(stash.id)){s.backpack.searched.push(stash.id);s.backpack.remaining[stash.id]={...stash.loot};}return s.backpack.remaining[stash.id]||{};}
export function transferLoot(s,stash,id,requested=99){
 const loot=openStash(s,stash),available=bounded(loot[id],99);let count=Math.min(available,bounded(requested,99));if(!count)return 0;
 if(ITEMS[id]){count=Math.min(count,PACK_CAPACITY-packCount(s));s.backpack.items[id]+=count;}
 else if(id.startsWith('ammo-')){storeAmmo(s);const entry=s.armory[id.slice(5)];if(!entry)return 0;count=Math.min(count,999-entry.reserve);entry.reserve+=count;s.reserve=s.armory[s.weapon].reserve;}
 else if(id.startsWith('weapon-')){const weapon=id.slice(7);if(!collectWeapon(s,weapon)){const w=WEAPONS.find(w=>w.id===weapon),entry=s.armory[weapon];if(!w?.capacity||entry.reserve>=999)return 0;storeAmmo(s);entry.reserve=Math.min(999,entry.reserve+w.capacity);s.reserve=s.armory[s.weapon].reserve;}count=1;}
 else return 0;
 loot[id]-=count;return count;
}
export function craftBandage(s){const p=s.backpack.items;if(p.cloth<2||p.antiseptic<1)return false;p.cloth-=2;p.antiseptic--;p.bandage++;return true;}
export function fitWeapon(s,id){if(!s.armory[id]?.owned||s.backpack.fittings[id]||s.backpack.items.scrap<8)return false;s.backpack.items.scrap-=8;s.backpack.fittings[id]=true;return true;}
export const weaponDamageMultiplier=s=>s.backpack?.fittings?.[s.weapon]?1.2:1;
export function consumeRemedy(s,id){const item=itemDefinition(id),count=id==='dressing'?s.medkits:s.backpack.items[id];if(!item?.heal||!count||s.health>=100)return null;if(id==='dressing')s.medkits--;else s.backpack.items[id]--;return {id,heal:item.heal,duration:item.time,time:0};}

export function discardItem(s,id){if(!ITEMS[id]||s.backpack.items[id]<1)return false;s.backpack.items[id]--;return true;}
