import {itemDefinition} from './backpack.js';
import {WEAPONS} from './armory-state.js';

// Shared display names and short decision cues. Inventory IDs, quantities and
// transfer rules stay with the backpack; every UI surface uses the same nouns.
export function itemLabel(id){
 const item=itemDefinition(id);
 return (item?.short||item?.name||'').replace(/ ammunition$/,' ammo');
}

export function itemPurpose(id){
 const item=itemDefinition(id);
 if(item?.heal)return `+${item.heal} health`;
 if(id==='cloth'||id==='antiseptic')return 'Bandage material';
 if(id==='scrap')return 'Weapon reinforcement';
 if(id.startsWith('ammo-'))return 'Reserve';
 return '';
}

export function weaponSupplyLabel(weapon,count){
 return `+${count} ${weapon.kind==='saw'?'fuel':'ammo'}`;
}

// Prompt and touch input share availability, rather than displaying a blocked
// find beside an active Use control. Transfers still enforce their own limits.
export function canPickup(target,state){
 if(target?.kind==='stash')return !state.backpack.searched.includes(target.item.id)||Object.values(state.backpack.remaining[target.item.id]||{}).some(n=>n>0);
 if(target?.kind==='supply')return target.item.type==='medkit'?state.medkits<20:WEAPONS.some(w=>w.capacity&&state.armory[w.id].owned&&(w.id===state.weapon?state.reserve:state.armory[w.id].reserve)<999);
 if(target?.kind==='weapon'){
  const w=WEAPONS.find(w=>w.id===target.item.weapon),owned=state.armory[w?.id]?.owned;
  return !!w&&(!owned||w.capacity>0&&(w.id===state.weapon?state.reserve:state.armory[w.id].reserve)<999);
 }
 return true;
}
