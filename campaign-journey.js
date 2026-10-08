// Authoritative chapter actions. Presentation reads this state; it never advances it.
// All timers use simulation seconds, so pausing and retrying cannot skip an action.
export const JOURNEY_LOG_LIMIT = 12;
const action = (id, roomId, label, kind, text) => ({ id, roomId, label, kind, text, duration: .75 });
export const CHAPTER_PROFILES = Object.freeze([
 { id:'receiving', title:'The Shift That Never Ended', speaker:'Foreman Inez', phase:'prime',
  arrival:'The evacuation truck was logged here. Prime the cargo pump; its transfer ledger points downstairs.',
  actions:[action('cargo-pump','f1-pump','Prime the cargo pump','pump','Cargo pressure restored. The evacuees were transferred to the galleries.')],
  operation:'cycling', operationDuration:3, operationText:'Cargo pipes are cycling. Follow the receiving line toward the descent.',
  aftermath:'The receiving line is online. Inez’s ledger sends the missing evacuees below.' },
 { id:'isolation', title:'Everyone Comes Back', speaker:'Nurse Sera', phase:'isolation',
  arrival:'They arrived as patients. Isolate both wards so we can interrupt the return cycle.',
  actions:[action('ward-a-relay','f2-wardA','Isolate Ward A','relay','Ward A isolated. Sera’s discharge list contains the missing evacuees.'),
   action('drain-relay','f2-wardD','Isolate the drain ward','relay','Both wards isolated. The return circuit is purging.')],
  operation:'purging', operationDuration:3, operationText:'The return circuit is purging. The discharge route continues below.',
  aftermath:'The ward circuit is isolated. Their discharge orders lead to the burial keepers.' },
 { id:'names', title:'The Names They Kept', speaker:'Burial Keeper', phase:'recover',
  arrival:'We kept their names when the records changed. Recover the name reliquary and return it to the court.',
  actions:[{...action('name-reliquary','f3-vault','Recover the name reliquary','reliquary','Truck Six: eighteen evacuees, held in the return circuit. Their names are inside. Bring the reliquary back to the court.'),landmarkClearance:2.6},
   action('name-return','f3-court','Return the names to the court','socket','The eighteen names are restored. The burial ledger identifies the bell service route; the transfer engine below still holds their records.')],
  secondPhase:'carrying', aftermath:'The names are restored to the court. Follow the bell service route.' },
 { id:'choir', title:'A Choir With No Audience', speaker:'Bell Keeper', phase:'chiming',
  arrival:'The bells hold the transfer engine in check. Sound the nave, tower, then chancel chime to reach the warden.',
  actions:[action('nave-chime','f4-nave','Sound the nave chime','chime','The nave answers. Sound the tower next.'),
   action('tower-chime','f4-tower','Sound the tower chime','chime','The tower answers. Finish the chord in the chancel.'),
   action('chancel-chime','f4-chancel','Sound the chancel chime','chime','The containment chord holds. The warden’s descent is open.')],
  operation:'chord', operationDuration:2, operationText:'The containment chord is settling. Reach the descent mouth.',
  aftermath:'The three chimes hold the transfer engine in check. Reach the warden below.' },
 { id:'shutdown', title:'No Further Transfers', speaker:'The Warden', phase:'awaiting-clearance',
  arrival:'The facility marked you deceased. You kept moving. Clear the last chambers, recover access, then stop further transfers.',
  actions:[{...action('transfer-stop','f5-hall3','Stop further transfers','shutdown','Transfer intake closed. Hold the route while the engine winds down.'),duration:1}],
  requireClearance:true, operation:'shutdown', operationDuration:5, operationText:'The transfer engine is winding down. Reach the final threshold.',
  aftermath:'NO FURTHER TRANSFERS. The engine is contained; the eighteen evacuees’ records are released from its return circuit. Leave through the final threshold.' },
]);

export function chapterProfile(course) {
 return course?.dungeon ? CHAPTER_PROFILES[course.dungeonIndex] || null : null;
}

// Place stations in reachable, unobstructed cells of their authored main-route
// rooms. No map walls, evidence, equipment or enemy layouts are changed.
export function makeJourneyStations(course) {
 const profile = chapterProfile(course);
 if (!profile) return [];
 const reserved = new Set([...course.keys,...course.loot,...course.evidence,...course.supplies]
  .map(point => `${Math.floor(point.x)},${Math.floor(point.y)}`));
 return profile.actions.map(item => {
  const room = course.rooms.find(room => room.id === item.roomId);
  // Authored anchors are course cells; sizes are metres. Keep stations out
  // of precise dressing footprints without moving the original scenery.
  // Tall open cages need additional approach clearance: their visual arch
  // can occlude a station even outside the narrow base footprint.
  const scenery=[...(course.landmarks||[]),...(course.setpieces||[])].filter(piece=>piece.roomId===item.roomId
   &&Array.isArray(piece.anchor)&&piece.anchor.length>=2&&Array.isArray(piece.size)&&piece.size.length>=3);
  const clearOfScenery=point=>scenery.every(piece=>{
   const dx=Math.abs(point.x-piece.anchor[0]),dy=Math.abs(point.y-piece.anchor[1]);
   const insideFootprint=dx<=piece.size[0]/8+.05&&dy<=piece.size[2]/8+.05;
   return !insideFootprint&&Math.hypot(dx,dy)>=(item.landmarkClearance||0);
  });
  const points = [];
  for(let y=room.bounds.minZ;y<room.bounds.maxZ;y++)for(let x=room.bounds.minX;x<room.bounds.maxX;x++) {
   const row=room.footprint?.[y-room.bounds.minZ], member=!room.footprint||row?.[x-room.bounds.minX]==='1'||row?.[x-room.bounds.minX]===1;
   const key=`${x},${y}`;
   if(member&&course.dungeonCompiled.reach.has(key)&&!reserved.has(key)
    &&!course.dressingCells[y*course.w+x].every(Boolean)&&clearOfScenery({x:x+.5,y:y+.5}))points.push({x:x+.5,y:y+.5});
  }
  points.sort((a,b)=>Math.hypot(a.x-room.center.x,a.y-room.center.y)-Math.hypot(b.x-room.center.x,b.y-room.center.y)||a.y-b.y||a.x-b.x);
  const point=points[0];
  if(!point)throw new Error(`No clear campaign station cell for ${item.id}`);
  reserved.add(`${Math.floor(point.x)},${Math.floor(point.y)}`);
  return {id:item.id,kind:item.kind,roomId:item.roomId,label:item.label,...point};
 });
}

export function createJourney(course, previous = null) {
 if(!course?.journeyEnabled)return null;
 const profile=chapterProfile(course), stations=course.journeyStations.map(station=>({...station,status:'inactive'}));
 stations[0].status='active';
 return {chapterIndex:course.dungeonIndex,chapterId:profile.id,title:profile.title,phase:profile.phase,
  step:0,progress:0,hold:0,elapsed:0,objective:profile.actions[0].label,target:{...stations[0]},stations,
  completed:(previous?.completed||[]).slice(-5).map(item=>({...item})),log:(previous?.log||[]).slice(-JOURNEY_LOG_LIMIT).map(item=>({...item})),
  eventSeq:previous?.eventSeq||0,announced:false,prompt:null,prompts:{host:null,peer:null}};
}
export const journeyComplete = run => !run.journey || run.journey.phase === 'complete';

function emit(run,type,text,station=null) {
 const state=run.journey, profile=chapterProfile(run.course);
 const event={type:`journey-${type}`,seq:++state.eventSeq,chapterIndex:state.chapterIndex,chapterId:state.chapterId,
  chapter:state.title,phase:state.phase,speaker:profile.speaker,text,...(station?{stationId:station.id,x:station.x,y:station.y}: {})};
 run.events.push(event);
 state.log.unshift({...event});state.log.length=Math.min(state.log.length,JOURNEY_LOG_LIMIT);
}
function clearPrompts(state){state.prompt=null;state.prompts={host:null,peer:null};}
function finish(run,profile) {
 const state=run.journey;
 state.phase='complete';state.progress=1;state.hold=0;state.target=null;state.objective=profile.aftermath;
 clearPrompts(state);
 if(!state.completed.some(item=>item.chapterIndex===state.chapterIndex))state.completed.push({chapterIndex:state.chapterIndex,chapterId:state.chapterId,title:state.title,aftermath:profile.aftermath});
 emit(run,'complete',profile.aftermath);
}

export function updateJourney(run, dt, {castRay}) {
 const state=run.journey;
 if(!state||run.mode!=='play')return;
 const players=[run,run.peer].filter(player=>player&&player.health>0);
 if(!players.length){state.hold=0;state.progress=0;clearPrompts(state);return;}
 const profile=chapterProfile(run.course);
 if(!state.announced){state.announced=true;emit(run,'arrival',profile.arrival);}
 if(state.phase==='complete'){clearPrompts(state);return;}
 dt=Math.max(0,Math.min(.05,Number(dt)||0));
 if(state.phase===profile.operation){
  state.elapsed=Math.min(profile.operationDuration,state.elapsed+dt);state.progress=state.elapsed/profile.operationDuration;
  clearPrompts(state);if(state.elapsed>=profile.operationDuration)finish(run,profile);return;
 }
 const station=state.stations[state.step], action=profile.actions[state.step];
 const progression=run.dungeonProgression;
 const clearance=!profile.requireClearance||progression.combatReady===true;
 clearPrompts(state);
 let operator=null;
 for(const player of players){
  const distance=Math.hypot(player.x-station.x,player.y-station.y);
  const visible=distance<.82&&player.z<.25&&castRay(run.course,player.x,player.y,Math.atan2(station.y-player.y,station.x-player.x),distance+.1).dist>distance-.02;
  if(!visible)continue;
  const prompt={stationId:station.id,label:clearance?action.label:'Clear the chambers and recover access first',available:clearance,progress:state.progress};
  state.prompts[player.playerId||'host']=prompt;if(!state.prompt)state.prompt=prompt;
  if(clearance&&player.journeyInteract&&!operator)operator=player;
 }
 if(!operator){state.hold=0;state.progress=0;return;}
 state.hold=Math.min(action.duration,state.hold+dt);state.progress=state.hold/action.duration;
 if(state.hold+1e-8<action.duration)return;
 station.status='complete';state.step++;state.hold=0;state.progress=0;
 emit(run,'action',action.text,station);
 if(state.step<profile.actions.length){
  const next=state.stations[state.step];next.status='active';state.target={...next};state.objective=profile.actions[state.step].label;
  if(profile.secondPhase)state.phase=profile.secondPhase;
 }else if(profile.operation){
  state.phase=profile.operation;state.elapsed=0;state.target=null;state.objective=profile.operationText;
  emit(run,'phase',profile.operationText,station);
 }else finish(run,profile);
 clearPrompts(state);
}
