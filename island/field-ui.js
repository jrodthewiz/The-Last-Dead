import {itemIcon} from './item-icons.js';
import {itemDefinition} from './backpack.js';
import {WEAPONS} from './armory-state.js';

// The same compact field label owns proximity, searching and treatment.
// Receipts live at the edge; frequent collections never replace mission messages.
export function compactReceipts(items,title,equipped){
 const ammo=items.filter(p=>p.count>0&&p.id.startsWith('ammo-'));
 if(ammo.length<2)return items.map(p=>({...p,title}));
 const primary=ammo.find(p=>p.id==='ammo-'+equipped)||ammo[0];
 return [...items.filter(p=>!p.id.startsWith('ammo-')).map(p=>({...p,title})),{...primary,reserves:ammo.filter(p=>p!==primary).map(p=>p.id),title:`Ammo & fuel · ${ammo.length-1} other reserves`}];
}

export function createFieldUI({touch=false,getWeapon=()=>null}={}){
 const root=document.getElementById('interaction');
 root.innerHTML='<div class="interaction-copy"><span id="interaction-name"></span><small id="action-label" hidden></small><small id="interaction-facts" hidden></small></div><div class="interaction-command"><kbd></kbd><small id="interaction-action"></small></div><i id="interaction-icon" aria-hidden="true" hidden></i><div id="interaction-progress"></div>';
 const key=root.querySelector('kbd'),name=root.querySelector('#interaction-name'),action=root.querySelector('#interaction-action'),detail=root.querySelector('#action-label'),icon=root.querySelector('#interaction-icon'),bar=root.querySelector('#interaction-progress');
 const facts=root.querySelector('#interaction-facts');
 const feed=document.createElement('div');feed.id='pickup-feed';feed.setAttribute('role','status');feed.setAttribute('aria-live','polite');document.getElementById('hud').append(feed);
 let receipts=[],clock=0,signature='',iconId='',heldIcon='';
 const emblem=document.getElementById('weapon-emblem'),healthMeter=document.querySelector('.health-meter'),staminaMeter=document.querySelector('.stamina-meter');
 const text=(el,value)=>{if(el.textContent!==value)el.textContent=value;};
 function update(i,s,{search=null,healing=null,restore=null,reloading=false,vehicle=false}={}){
  const held=vehicle?'truck':'weapon-'+s.weapon;if(emblem&&held!==heldIcon){heldIcon=held;emblem.innerHTML=itemIcon(held);}
  for(const [meter,value]of [[healthMeter,s.health],[staminaMeter,s.stamina]])if(meter){const rounded=String(Math.ceil(value));if(meter.getAttribute('aria-valuenow')!==rounded)meter.setAttribute('aria-valuenow',rounded);}
  const busy=search||healing||restore;root.hidden=!i&&!busy;if(root.hidden)return;
  let title=i?.label||'',verb='INTERACT',note='',fraction=0,blocked=false;
  if(i?.kind==='stash'){title=i.item.name;const searched=s.backpack.searched.includes(i.item.id),remaining=Object.entries(s.backpack.remaining[i.item.id]||{}).filter(([,n])=>n>0),empty=searched&&!remaining.length;verb=empty?'PICKED CLEAN':searched?'OPEN':'SEARCH';note=empty?'':searched?remaining.slice(0,2).map(([id,n])=>n+' × '+(itemDefinition(id)?.short||itemDefinition(id)?.name||'supplies')).join(' · ')+(remaining.length>2?' · more':''):'Contents unknown';blocked=empty;}
  if(i?.kind==='supply'){const medical=i.item.type==='medkit';title=medical?'Field dressing':'Ammunition & fuel';blocked=medical?s.medkits>=20:!WEAPONS.some(w=>w.capacity&&s.armory[w.id].owned&&(w.id===s.weapon?s.reserve:s.armory[w.id].reserve)<999);verb=blocked?'STORAGE FULL':'PICK UP';note=medical?`Medical belt · ${s.medkits} / 20`:'Resupplies your recovered weapons';}
  if(i?.kind==='weapon'){const w=WEAPONS.find(w=>w.id===i.item.weapon),owned=s.armory[w?.id]?.owned,reserve=w?.id===s.weapon?s.reserve:s.armory[w?.id]?.reserve,melee=w?.kind==='melee';title=w?.name||'Expedition weapon';blocked=!!owned&&(melee||reserve>=999);verb=owned&&melee?'ALREADY CARRIED':blocked?'RESERVE FULL':owned?(w.kind==='saw'?'TAKE FUEL':'TAKE AMMO'):'TAKE & EQUIP';note=owned&&melee?'Your '+w.name+' is in the weapon rack':owned?(w.kind==='saw'?'Recover spare fuel':'Recover '+Math.min(w.capacity,999-reserve)+' spare rounds'):'';if(blocked&&!melee)note='Leave it here until you have room';}
  if(i?.kind==='stash'&&reloading&&!busy){verb='FINISH RELOADING';note='Then open this container';blocked=true;}
  if(i?.kind==='weapon'&&reloading){verb='FINISH RELOADING';note='Then recover this weapon';blocked=true;}
  if(i?.kind==='fuse'){title='Keeper’s spare fuse';verb='PICK UP · MISSION ITEM';note='Repairs the Westlight beacon';}
  if(search){title=search.container.name;verb=search.time<.22?'UNFASTENING':search.time<.69?'OPENING':'SEARCHING';note='Move away to cancel';fraction=Math.min(1,search.time/1.15);}
  if(restore){title=restore.item.name;verb='RESTORING SIGNAL';note='Keep close to the station';fraction=Math.min(1,restore.time/2.5);}
  if(healing){title=itemDefinition(healing.id).name;verb=healing.id==='beer'?'DRINKING':'APPLYING TREATMENT';note='Treatment stops if you take damage';fraction=Math.min(1,healing.time/healing.duration);}
  const find=!busy&&i?.kind==='weapon'&&!s.armory[i.item.weapon]?.owned?WEAPONS.find(w=>w.id===i.item.weapon):null;
  facts.hidden=!find;if(find){const multiplier=s.backpack.fittings[find.id]?1.2:1;text(facts,find.kind==='melee'?`${Math.round(find.damage*multiplier)} IMPACT · ${find.range} m REACH`:find.kind==='saw'?`${find.capacity} FUEL · HOLD FIRE TO CUT`:`${find.capacity} ${find.kind==='pellet'?'SHELLS':find.kind==='arc'?'CHARGES':find.kind==='rocket'?'ROCKET':'ROUNDS'} · ${find.range} m RANGE`);}
  const nextIcon=healing?healing.id:search||i?.kind==='stash'?'pack':i?.kind==='weapon'?'weapon-'+i.item.weapon:i?.kind==='supply'?(i.item.type==='medkit'?'dressing':'ammo'):i?.kind==='fuse'?'keeper-fuse':'';icon.hidden=!nextIcon;if(nextIcon!==iconId){iconId=nextIcon;icon.innerHTML=nextIcon?itemIcon(nextIcon):'';}
  text(key,busy?Math.round(fraction*100)+'%':blocked?'—':touch?'USE':'E');text(name,title);text(action,verb);text(detail,note);detail.hidden=!note;bar.style.width=fraction*100+'%';root.classList.toggle('is-working',!!busy);root.classList.toggle('is-full',blocked);root.classList.toggle('is-weapon',i?.kind==='weapon'&&!busy);root.setAttribute('aria-label',verb+' · '+title+(note?' · '+note:''));
 }
 function receipt(items,title='Supplies packed'){
  for(const item of compactReceipts(items,title,getWeapon())){if(!item.count)continue;const def=itemDefinition(item.id),old=receipts.find(r=>r.id===item.id),until=clock+(item.id.startsWith('weapon-')?5:3.8);if(old){old.count+=item.count;old.until=until;old.reserves=[...new Set([...(old.reserves||[]),...(item.reserves||[])])];old.title=old.reserves.length?`Ammo & fuel · ${old.reserves.length} other reserves`:item.title;}else receipts.push({...item,name:def?.name||item.name||item.id,until});}
  receipts=receipts.slice(-3);draw();
 }
 function draw(){const next=receipts.map(r=>r.id+':'+r.count+':'+r.title).join('|');if(next===signature)return;signature=next;feed.replaceChildren();for(const r of receipts){const found=r.id.startsWith('weapon-'),row=document.createElement('div');row.className='pickup-receipt'+(found?' is-discovery':'');const icon=document.createElement('i');icon.innerHTML=itemIcon(r.id);const copy=document.createElement('span'),label=document.createElement('small'),strong=document.createElement('strong'),count=document.createElement('b');label.textContent=found?'Equipment found':r.title;strong.textContent=r.name;count.textContent=found?'◆':'+'+r.count;copy.append(label,strong);row.append(icon,copy,count);feed.append(row);}}
 return{update,receipt,tick(dt){clock+=dt;if(!receipts.length)return;const remaining=receipts.filter(r=>r.until>clock);if(remaining.length!==receipts.length){receipts=remaining;draw();}},clear(){receipts=[];signature='';feed.replaceChildren();}};
}
