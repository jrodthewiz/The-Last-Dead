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
 root.innerHTML='<kbd></kbd><div class="interaction-copy"><small id="interaction-action"></small><span id="interaction-name"></span><small id="action-label" hidden></small></div><i id="interaction-icon" aria-hidden="true" hidden></i><div id="interaction-progress"></div>';
 const key=root.querySelector('kbd'),name=root.querySelector('#interaction-name'),action=root.querySelector('#interaction-action'),detail=root.querySelector('#action-label'),icon=root.querySelector('#interaction-icon'),bar=root.querySelector('#interaction-progress');
 const feed=document.createElement('div');feed.id='pickup-feed';feed.setAttribute('role','status');feed.setAttribute('aria-live','polite');document.getElementById('hud').append(feed);
 let receipts=[],clock=0,signature='',iconId='';
 const text=(el,value)=>{if(el.textContent!==value)el.textContent=value;};
 function update(i,s,{search=null,healing=null,restore=null,reloading=false}={}){
  const busy=search||healing||restore;root.hidden=!i&&!busy;if(root.hidden)return;
  let title=i?.label||'',verb='INTERACT',note='',fraction=0,blocked=false;
  if(i?.kind==='stash'){title=i.item.name;const searched=s.backpack.searched.includes(i.item.id);verb=searched?'OPEN CONTAINER':'SEARCH CONTAINER';note=searched?'Supplies left inside':'Contents unknown';}
  if(i?.kind==='supply'){const medical=i.item.type==='medkit';title=medical?'Field dressing':'Ammunition & fuel';blocked=medical?s.medkits>=20:!WEAPONS.some(w=>w.capacity&&s.armory[w.id].owned&&(w.id===s.weapon?s.reserve:s.armory[w.id].reserve)<999);verb=blocked?'STORAGE FULL':'PICK UP';note=medical?`Medical belt · ${s.medkits} / 20`:'Resupplies your recovered weapons';}
  if(i?.kind==='weapon'){const w=WEAPONS.find(w=>w.id===i.item.weapon),owned=s.armory[w?.id]?.owned,reserve=w?.id===s.weapon?s.reserve:s.armory[w?.id]?.reserve,melee=w?.kind==='melee';title=w?.name||'Expedition weapon';blocked=!!owned&&(melee||reserve>=999);verb=owned&&melee?'ALREADY CARRIED':blocked?'RESERVE FULL':owned?(w.kind==='saw'?'RECOVER FUEL':'RECOVER AMMUNITION'):'RECOVER & EQUIP';note=owned&&melee?'Your '+w.name+' is in the weapon rack':owned?(w.kind==='saw'?'Recover spare fuel':'Recover '+Math.min(w.capacity,999-reserve)+' spare rounds'):melee?'Ready to wield · no ammunition needed':'Loaded and ready';if(blocked&&!melee)note='Leave it here until you have room';}
  if(i?.kind==='weapon'&&reloading){verb='FINISH RELOADING';note='Then recover this weapon';blocked=false;}
  if(i?.kind==='fuse'){title='Keeper’s spare fuse';verb='PICK UP · MISSION ITEM';note='Repairs the Westlight beacon';}
  if(search){title=search.container.name;verb='SEARCHING';note='Keep close · move away to cancel';fraction=Math.min(1,search.time/1.15);}
  if(restore){title=restore.item.name;verb='RESTORING SIGNAL';note='Keep close to the station';fraction=Math.min(1,restore.time/2.5);}
  if(healing){title=itemDefinition(healing.id).name;verb=healing.id==='beer'?'DRINKING':'APPLYING TREATMENT';note='Treatment stops if you are hit';fraction=Math.min(1,healing.time/healing.duration);}
  const nextIcon=!busy&&i?.kind==='weapon'?'weapon-'+i.item.weapon:healing?healing.id:'';icon.hidden=!nextIcon;if(nextIcon!==iconId){iconId=nextIcon;icon.innerHTML=nextIcon?itemIcon(nextIcon):'';}
  text(key,busy?Math.round(fraction*100)+'%':touch?'USE':'E');text(name,title);text(action,verb);text(detail,note);detail.hidden=!note;bar.style.width=fraction*100+'%';root.classList.toggle('is-working',!!busy);root.classList.toggle('is-full',blocked);root.classList.toggle('is-weapon',i?.kind==='weapon'&&!busy);root.setAttribute('aria-label',verb+' · '+title+(note?' · '+note:''));
 }
 function receipt(items,title='Supplies packed'){
  for(const item of compactReceipts(items,title,getWeapon())){if(!item.count)continue;const def=itemDefinition(item.id),old=receipts.find(r=>r.id===item.id);if(old){old.count+=item.count;old.until=clock+3.8;old.reserves=[...new Set([...(old.reserves||[]),...(item.reserves||[])])];old.title=old.reserves.length?`Ammo & fuel · ${old.reserves.length} other reserves`:item.title;}else receipts.push({...item,name:def?.name||item.name||item.id,until:clock+3.8});}
  receipts=receipts.slice(-3);draw();
 }
 function draw(){const next=receipts.map(r=>r.id+':'+r.count+':'+r.title).join('|');if(next===signature)return;signature=next;feed.replaceChildren();for(const r of receipts){const found=r.id.startsWith('weapon-'),row=document.createElement('div');row.className='pickup-receipt'+(found?' is-discovery':'');const icon=document.createElement('i');icon.innerHTML=itemIcon(r.id);const copy=document.createElement('span'),label=document.createElement('small'),strong=document.createElement('strong'),count=document.createElement('b');label.textContent=found?'Weapon recovered':r.title;strong.textContent=r.name;count.textContent=found?'◆':'+'+r.count;copy.append(label,strong);row.append(icon,copy,count);feed.append(row);}}
 return{update,receipt,tick(dt){clock+=dt;if(!receipts.length)return;const remaining=receipts.filter(r=>r.until>clock);if(remaining.length!==receipts.length){receipts=remaining;draw();}},clear(){receipts=[];signature='';feed.replaceChildren();}};
}
