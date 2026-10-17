import {itemIcon} from './item-icons.js';
import {itemDefinition} from './backpack.js';
import {WEAPONS} from './armory-state.js';

// The same compact field label owns proximity, searching and treatment.
// Receipts live at the edge; frequent collections never replace mission messages.
export function createFieldUI({touch=false}={}){
 const root=document.getElementById('interaction');
 root.innerHTML='<kbd></kbd><div class="interaction-copy"><small id="interaction-action"></small><span id="interaction-name"></span><small id="action-label" hidden></small></div><div id="interaction-progress"></div>';
 const key=root.querySelector('kbd'),name=root.querySelector('#interaction-name'),action=root.querySelector('#interaction-action'),detail=root.querySelector('#action-label'),bar=root.querySelector('#interaction-progress');
 const feed=document.createElement('div');feed.id='pickup-feed';feed.setAttribute('role','status');feed.setAttribute('aria-live','polite');document.getElementById('hud').append(feed);
 let receipts=[],clock=0,signature='';
 const text=(el,value)=>{if(el.textContent!==value)el.textContent=value;};
 function update(i,s,{search=null,healing=null,restore=null}={}){
  const busy=search||healing||restore;root.hidden=!i&&!busy;if(root.hidden)return;
  let title=i?.label||'',verb='INTERACT',note='',fraction=0,blocked=false;
  if(i?.kind==='stash'){title=i.item.name;const searched=s.backpack.searched.includes(i.item.id);verb=searched?'OPEN CONTAINER':'SEARCH CONTAINER';note=searched?'Supplies left inside':'Contents unknown';}
  if(i?.kind==='supply'){const medical=i.item.type==='medkit';title=medical?'Field dressing':'Ammunition & fuel';blocked=medical?s.medkits>=20:!WEAPONS.some(w=>w.capacity&&s.armory[w.id].owned&&(w.id===s.weapon?s.reserve:s.armory[w.id].reserve)<999);verb=blocked?'STORAGE FULL':'PICK UP';note=medical?`Medical belt · ${s.medkits} / 20`:'Resupplies your recovered weapons';}
  if(i?.kind==='weapon'){title=WEAPONS.find(w=>w.id===i.item.weapon)?.name||'Expedition weapon';verb='RECOVER WEAPON';note='Added to your expedition arsenal';}
  if(i?.kind==='fuse'){title='Keeper’s spare fuse';verb='PICK UP · MISSION ITEM';note='Repairs the Westlight beacon';}
  if(search){title=search.container.name;verb='SEARCHING';note='Keep close · move away to cancel';fraction=Math.min(1,search.time/1.15);}
  if(restore){title=restore.item.name;verb='RESTORING SIGNAL';note='Keep close to the station';fraction=Math.min(1,restore.time/2.5);}
  if(healing){title=itemDefinition(healing.id).name;verb=healing.id==='beer'?'DRINKING':'APPLYING TREATMENT';note='Treatment stops if you are hit';fraction=Math.min(1,healing.time/healing.duration);}
  text(key,busy?Math.round(fraction*100)+'%':touch?'USE':'E');text(name,title);text(action,verb);text(detail,note);detail.hidden=!note;bar.style.width=fraction*100+'%';root.classList.toggle('is-working',!!busy);root.classList.toggle('is-full',blocked);root.setAttribute('aria-label',verb+' · '+title+(note?' · '+note:''));
 }
 function receipt(items,title='Supplies packed'){
  for(const item of items){if(!item.count)continue;const def=itemDefinition(item.id),old=receipts.find(r=>r.id===item.id);if(old){old.count+=item.count;old.until=clock+3.8;old.title=title;}else receipts.push({...item,name:def?.name||item.name||item.id,title,until:clock+3.8});}
  receipts=receipts.slice(-3);draw();
 }
 function draw(){const next=receipts.map(r=>r.id+':'+r.count+':'+r.title).join('|');if(next===signature)return;signature=next;feed.replaceChildren();for(const r of receipts){const row=document.createElement('div');row.className='pickup-receipt';const icon=document.createElement('i');icon.innerHTML=itemIcon(r.id);const copy=document.createElement('span'),label=document.createElement('small'),strong=document.createElement('strong'),count=document.createElement('b');label.textContent=r.title;strong.textContent=r.name;count.textContent='+'+r.count;copy.append(label,strong);row.append(icon,copy,count);feed.append(row);}}
 return{update,receipt,tick(dt){clock+=dt;if(!receipts.length)return;const remaining=receipts.filter(r=>r.until>clock);if(remaining.length!==receipts.length){receipts=remaining;draw();}},clear(){receipts=[];signature='';feed.replaceChildren();}};
}
