// Chapter rules contain no DOM, storage or renderer dependencies.
export const LOW_TIDE_TITLE = 'THE FIRST NAME ON THE MANIFEST';
export const LOW_TIDE_RECORDS = Object.freeze({
  shelter: ['A room above the tide', 'Netmakers is secure. A battery radio sits beside an evacuation list. Someone has circled Customs House. This is your return point.'],
  manifest: ['Manifest 06 / Mara Venn', 'MARA VENN — ferry mechanic. Transferred to Cold Storage, bay 02. Departure status: AWAITING VOICE CONFIRMATION. The next line bears your name.'],
  identified: ['Cold Storage / bay 02', 'The covered remains carry Mara Venn’s numbered work tag. The mortuary record confirms her death eleven days ago. Her repair note requests a starter battery from Ferry Workshop and diesel from Dock Dispatch.'],
  battery: ['Starter battery secured', 'A tested 12 V battery. Reserved for the dock generator; carried separately from scrap.'],
  fuel: ['Diesel secured', 'A sealed can from the dispatch reserve. Reserved for the dock generator; carried separately from scrap.'],
  powered: ['The shift returns', 'Dock circuit restored. The automatic shift bell is connected to the same circuit. It will ring when you leave. Watch the service lanes before returning to Netmakers.'],
  answered: ['Channel 06 / transcript', 'MARA VENN: “Netmakers, this is Mara. I can hear your generator. Don’t send the ferry yet. There are people downstairs.” You are still holding her death record. CHAPTER COMPLETE — the harbor remains open.'],
});
const FLAGS = Object.keys(LOW_TIDE_RECORDS);
export function createLowTide(value) {
  const v=value&&typeof value==='object'?value:{};
  const state={revision:0,bank:Math.max(0,Math.min(99,Math.floor(Number(v.bank)||0))),bellRemaining:0,bellNext:0};
  state.shelter=v.shelter===true;
  state.manifest=state.shelter&&v.manifest===true;
  state.identified=state.manifest&&v.identified===true;
  state.battery=state.identified&&v.battery===true;
  state.fuel=state.identified&&v.fuel===true;
  state.powered=state.battery&&state.fuel&&v.powered===true;
  state.answered=state.powered&&v.answered===true;
  state.bellRemaining=state.powered&&!state.answered?Math.max(0,Math.min(24,Number(v.bellRemaining)||0)):0;
  return state;
}
export function attachLowTide(course) {
  if(!course.lowTide)return;
  const kinds=['manifest','identified','battery','shelter','powered','fuel'];
  course.lowTideStations=course.harborRooms.map((room,i)=>({id:kinds[i],roomId:room.id,
    x:(room.x-room.width/2+3.6)/4,y:room.z/4,
    propX:room.x-room.width/2+1.7,propZ:room.z}));
  const home=course.harborRooms[3];
  course.lowTideStations.push({id:'stash',roomId:home.id,x:home.cache.x-.4,y:home.cache.y,propX:home.cache.x*4,propZ:home.cache.y*4});
}
export function lowTideObjective(run) {
  const s=run.lowTide;if(!s)return null;
  if(!s.shelter)return {id:'shelter',label:'Claim Netmakers safehouse'};
  if(!s.manifest)return {id:'manifest',label:'Read the Customs manifest'};
  if(!s.identified)return {id:'identified',label:'Identify Mara in Cold Storage'};
  if(!s.battery)return {id:'battery',label:'Recover the workshop battery'};
  if(!s.fuel)return {id:'fuel',label:'Recover diesel at Dock Dispatch'};
  if(!s.powered)return {id:'powered',label:'Restore the dock circuit'};
  if(!s.answered)return {id:'shelter',label:'Answer the Netmakers radio'};
  return {id:'shelter',label:'Chapter complete · return to your safehouse'};
}
export function lowTideTarget(run) {
  const objective=lowTideObjective(run);if(!objective)return null;
  const station=run.course.lowTideStations.find(p=>p.id===objective.id);
  const room=run.course.harborRooms.find(r=>r.id===station.roomId);
  return {...(run.course.activeInterior?.id===room.id?station:run.course.activeInterior?run.course.activeInterior.exit:room.door),id:`low-tide-${objective.id}`,label:run.course.activeInterior&&run.course.activeInterior.id!==room.id?'Return to harbor':objective.label};
}
export function lowTidePrompt(run) {
  const s=run.lowTide,room=run.course.activeInterior;
  if(!s||!room||run.vehicle?.occupied||run.z>.3)return null;
  const p=run.course.lowTideStations.find(p=>p.roomId===room.id&&Math.hypot(p.x-run.x,p.y-run.y)<.48);
  if(!p)return null;
  let label,enabled=true;
  switch(p.id){
    case 'shelter':label=!s.shelter?'CLAIM SAFEHOUSE':s.powered&&!s.answered?'ANSWER CHANNEL 06':'REST & SAVE AT SAFEHOUSE';break;
    case 'stash':enabled=s.shelter;label=!enabled?'CLAIM SAFEHOUSE FIRST':run.backpack.scrap>0?(s.bank<99?'STORE CARRIED SCRAP':'STASH FULL'):s.bank>0?'TAKE SCRAP FROM STASH':'STASH EMPTY';break;
    case 'manifest':enabled=s.shelter;label=!enabled?'CLAIM NETMAKERS FIRST':s.manifest?'MANIFEST RECORDED · B JOURNAL':'READ EVACUATION MANIFEST';break;
    case 'identified':enabled=s.manifest;label=!enabled?'FIND THE CUSTOMS MANIFEST':s.identified?'IDENTITY RECORDED · B JOURNAL':'CHECK MARA VENN’S WORK TAG';break;
    case 'battery':case 'fuel':enabled=s.identified&&!s[p.id];label=s[p.id]?'SUPPLY SECURED':!s.identified?'IDENTIFY THE MISSING MECHANIC':p.id==='battery'?'TAKE STARTER BATTERY':'TAKE SEALED DIESEL';break;
    case 'powered':enabled=s.battery&&s.fuel&&!s.powered;label=s.powered?'DOCK CIRCUIT ONLINE':!s.battery||!s.fuel?'NEEDS BATTERY + DIESEL':'RESTORE POWER · SHIFT BELL WILL RING';break;
  }
  return {station:p,enabled,label:`${enabled?'Q · ':''}${label}`};
}
export function tickLowTideInteraction(run,input) {
  if(!run.lowTide)return false;
  const pressed=!!input.interact&&!run.lowTideHeld;run.lowTideHeld=!!input.interact;
  const action=lowTidePrompt(run);
  // Consume a held interaction near a station so it cannot also operate a door.
  if(!action||!input.interact)return false;
  run.roomInteractHeld=true;if(run.vehicle)run.vehicle.interactHeld=true;
  if(!pressed||!action.enabled)return true;
  const s=run.lowTide,id=action.station.id;let record=id;
  if(id==='stash'){
    const amount=run.backpack.scrap>0?Math.min(run.backpack.scrap,99-s.bank):-Math.min(s.bank,run.backpack.capacity);
    if(!amount)return true;
    s.bank+=amount;run.backpack.scrap-=amount;record=null;
  }else if(id==='shelter'){
    run.health=100;run.energy=100;
    if(!s.shelter)s.shelter=true;
    else if(s.powered&&!s.answered){s.answered=true;s.bellRemaining=0;record='answered';}
    else record=null;
  }else{
    if(s[id])return true;
    s[id]=true;if(id==='powered'){s.bellRemaining=24;s.bellNext=0;}
  }
  s.revision++;
  if(record)run.lowTideNotice={title:LOW_TIDE_RECORDS[record][0],text:LOW_TIDE_RECORDS[record][1],until:run.time+16};
  run.events.push({type:'low-tide-progress',record,message:record?LOW_TIDE_RECORDS[record][0]:id==='stash'?'Safehouse stash updated':'Rested at Netmakers',x:run.x,y:run.y,z:.3});
  return true;
}
export function updateLowTide(run,dt) {
  const s=run.lowTide;if(!s||run.course.activeInterior||s.bellRemaining<=0)return;
  s.bellNext-=dt;s.bellRemaining=Math.max(0,s.bellRemaining-dt);
  if(s.bellNext<=0){s.bellNext=8;run.events.push({type:'low-tide-bell',x:16,y:17,z:.8});}
}
export function lowTideJournal(run) {
  const s=run.lowTide;if(!s)return [];
  return FLAGS.filter(k=>s[k]).map(k=>({id:k,title:LOW_TIDE_RECORDS[k][0],text:LOW_TIDE_RECORDS[k][1]}));
}
