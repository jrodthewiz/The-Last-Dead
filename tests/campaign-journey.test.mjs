import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDungeonCourse,setDungeonOpeningOpen} from '../playground/map/dungeon-course.js';
import {newRun,tick,tickPlayer,castRay,canStand,addPeer,angleDiff} from '../engine.js';
import {chapterProfile,updateJourney,JOURNEY_LOG_LIMIT} from '../campaign-journey.js';
import {reachableCells} from '../campaign.js';

const fresh=(index=0)=>{const run=newRun(makeDungeonCourse(index,{journey:true}));run.mode='play';return run;};
function advance(run,seconds,input={}){for(let i=0;i<Math.ceil(seconds*60);i++){tickPlayer(run,1/60,input);updateJourney(run,1/60,{castRay});}}
function atStation(run,index=run.journey.step){const station=run.journey.stations[index];run.x=station.x;run.y=station.y;run.vx=run.vy=0;return station;}
function resolveOrdinaryObjectives(run){
 const p=run.dungeonProgression;p.currentEncounter=null;p.encounterPlan.forEach(node=>node.status='cleared');
 p.nextEncounterIndex=p.encounterPlan.length;p.keysCollected=run.course.keys.map(key=>key.id);
 run.course.enemies=[];
 for(const opening of run.course.openings)if(!opening.secret)setDungeonOpeningOpen(run.course,opening.id,true);
 tick(run,1/60,{});
 assert.equal(p.combatReady,true);
}
function completeChapter(run){
 while(run.journey.target){atStation(run);advance(run,1.1,{interact:true});}
 advance(run,5.1);assert.equal(run.journey.phase,'complete');
}
function walk(run,target){
 const course=run.course,w=course.w,start=Math.floor(run.y)*w+Math.floor(run.x),goal=Math.floor(target.y)*w+Math.floor(target.x);
 const queue=[start],previous=new Map([[start,null]]);
 for(let i=0;i<queue.length;i++){
  const cell=queue[i];if(cell===goal)break;
  for(const [dx,dy,side] of [[1,0,1],[-1,0,3],[0,1,2],[0,-1,0]]){
   const x=cell%w+dx,y=Math.floor(cell/w)+dy,next=y*w+x;
   if(x<0||y<0||x>=w||y>=course.h||course.cells[cell][side]||previous.has(next)||!canStand(course,x+.5,y+.5,.1))continue;
   previous.set(next,cell);queue.push(next);
  }
 }
 assert.ok(previous.has(goal),`${course.id} route reaches ${target.label||'destination'}`);
 const path=[];for(let cell=goal;cell!==null;cell=previous.get(cell))path.unshift({x:cell%w+.5,y:Math.floor(cell/w)+.5});
 for(const point of [...path.slice(1),target]){
  let frames=0;
  while(Math.hypot(run.x-point.x,run.y-point.y)>.13){
   const turn=angleDiff(Math.atan2(point.y-run.y,point.x-run.x),run.angle);
   tick(run,1/60,Math.abs(turn)>.035?{turn:Math.sign(turn)}:{forward:1});
   for(const enemy of run.course.enemies)enemy.dead=true;
   if(run.course!==course||run.mode==='win')return;
   assert.ok(canStand(course,run.x,run.y,.1));assert.ok(++frames<720);
  }
 }
 advance(run,.3);
}

test('opt-in preserves every authored wall, encounter, pickup and evidence; stations occupy distinct reachable cells',()=>{
 for(let index=0;index<5;index++){
  const legacy=makeDungeonCourse(index),live=makeDungeonCourse(index,{journey:true});
  for(const property of ['cells','rooms','blocks','openings','loot','keys','evidence','supplies','waveSpawns','playerSpawn','exit','startingWeapons'])assert.deepEqual(live[property],legacy[property],`${legacy.id}/${property}`);
  assert.equal(newRun(legacy).journey,null);
  const reserved=new Set([...live.keys,...live.loot,...live.evidence,...live.supplies].map(p=>`${Math.floor(p.x)},${Math.floor(p.y)}`));
  for(const station of live.journeyStations){
   const cell=`${Math.floor(station.x)},${Math.floor(station.y)}`;
   assert.ok(live.route.includes(station.roomId));assert.ok(live.dungeonCompiled.reach.has(cell));assert.ok(canStand(live,station.x,station.y,.16));
   assert.equal(reserved.has(cell),false);reserved.add(cell);
   for(const piece of [...live.landmarks,...live.setpieces].filter(piece=>piece.roomId===station.roomId&&piece.anchor&&piece.size)){
    assert.ok(Math.abs(station.x-piece.anchor[0])>piece.size[0]/8+.05
     ||Math.abs(station.y-piece.anchor[1])>piece.size[2]/8+.05,`${station.id} clears authored ${piece.id} footprint`);
   }
   if(station.id==='name-reliquary'){
    const cage=live.landmarks.find(piece=>piece.id==='f3-vault-cage');
    assert.ok(Math.hypot(station.x-cage.anchor[0],station.y-cage.anchor[1])>=1.2,'recovery stays visible beside the preserved bone cage');
   }
  }
 }
});

test('interaction requires held input, living proximity and unobstructed line of sight; release resets partial commitment',()=>{
 const run=fresh();const station=atStation(run);
 advance(run,1.1);assert.equal(run.journey.step,0);assert.equal(run.journey.prompt.available,true);
 advance(run,.3,{interact:true});assert.ok(run.journey.progress>0&&run.journey.progress<1);
 advance(run,.02);assert.equal(run.journey.progress,0);
 run.x=station.x+.9;advance(run,1,{interact:true});assert.equal(run.journey.step,0);assert.equal(run.journey.prompt,null);
 run.x=station.x+.6;const cell=Math.floor(station.y)*run.course.w+Math.floor(station.x);run.course.cells[cell][1]=1;run.course.cells[cell+1][3]=1;
 // Station is center x+.5; stand across its newly sealed east edge.
 run.x=Math.floor(station.x)+1.1;advance(run,1,{interact:true});assert.equal(run.journey.step,0);
 run.course.cells[cell][1]=0;run.course.cells[cell+1][3]=0;atStation(run);run.health=0;advance(run,1,{interact:true});assert.equal(run.journey.step,0);
 run.health=100;advance(run,1,{interact:true});assert.equal(run.journey.phase,'cycling');
 const frozen=JSON.stringify(run.journey);run.mode='pause';advance(run,4,{interact:true});assert.equal(JSON.stringify(run.journey),frozen);
 run.mode='play';advance(run,3.1);assert.equal(run.journey.phase,'complete');
 const seq=run.journey.eventSeq;advance(run,5,{interact:true});assert.equal(run.journey.eventSeq,seq,'completed stations cannot emit duplicate actions');
 const retry=fresh();assert.equal(retry.journey.step,0);assert.equal(retry.journey.completed.length,0);
});

test('chapter sequences are deterministic, require their own actions and persist bounded authored aftermath',()=>{
 const outcomes=[];
 for(let repeat=0;repeat<2;repeat++){
  const results=[];
  for(let index=0;index<5;index++){
   const run=fresh(index);run.dungeonProgression.combatReady=true;
   if(index===2){atStation(run,1);advance(run,1,{interact:true});assert.equal(run.journey.step,0,'return socket cannot replace recovery');}
   if(index===3){atStation(run,2);advance(run,1,{interact:true});assert.equal(run.journey.step,0,'chancel cannot skip the first two chimes');}
   completeChapter(run);
   const actionIds=run.events.filter(e=>e.type==='journey-action').map(e=>e.stationId);
   assert.deepEqual(actionIds,chapterProfile(run.course).actions.map(a=>a.id));
   assert.equal(run.journey.completed.length,1);assert.ok(run.journey.stations.every(s=>s.status==='complete'));
   results.push(JSON.parse(JSON.stringify(run.journey)));
  }
  outcomes.push(results);
 }
 assert.deepEqual(outcomes[0],outcomes[1]);
});

test('all five chapters permit real movement between signatures, carry history and arsenal, and require the final shutdown plus exit',()=>{
 const run=fresh();run.ownedWeapons=[0,1,4,6];run.storyRecords.push({id:'preserved-record',text:'Existing discovery'});
 const peer=addPeer(run);
 for(let index=0;index<5;index++){
  resolveOrdinaryObjectives(run);
  assert.equal(run.dungeonProgression.exitReady,false,`${run.course.id} ordinary objectives do not bypass signature`);
  if(index===4){atStation(run);run.dungeonProgression.combatReady=false;advance(run,1.1,{interact:true});assert.equal(run.journey.step,0);run.dungeonProgression.combatReady=true;}
  while(run.journey.target){
   tick(run,.05,{});run.dungeonProgression.navigationDue=0;tick(run,1/60,{});
   assert.equal(run.dungeonProgression.navigation.kind,'journey');
   assert.equal(run.dungeonProgression.navigation.blocked,false);
   assert.deepEqual(run.dungeonProgression.navigation.target,{x:run.journey.target.x,y:run.journey.target.y});
   assert.equal(run.dungeonProgression.objective,run.journey.objective);
   walk(run,run.journey.target);advance(run,1.1,{interact:true});
  }
  if(index===4){assert.equal(run.journey.phase,'shutdown');assert.equal(run.mode,'play');assert.equal(run.dungeonProgression.exitReady,false);}
  advance(run,5.1);tick(run,1/60,{});
  assert.equal(run.journey.phase,'complete');assert.equal(run.dungeonProgression.exitReady,true);
  assert.equal(run.mode,'play','finishing the event does not automatically win');
  assert.equal(run.journey.completed.length,index+1);
  // Peer cannot accidentally trip the exit while this route is under test.
  peer.x=run.x;peer.y=run.y;peer.dashTime=.18;peer.vx=6;peer.hookTime=.6;peer.pressed={jump:true,dash:true};
  walk(run,run.course.exit);tick(run,1/60,{});
  if(index<4){
   assert.equal(run.course.dungeonIndex,index+1);assert.equal(run.journey.chapterIndex,index+1);
   assert.equal(peer.course,run.course);assert.equal(peer.journey,run.journey);assert.equal(peer.dungeonProgression,run.dungeonProgression);
   assert.equal(peer.dashTime,0);assert.equal(peer.hookTime,0);assert.equal(peer.vx,0);assert.deepEqual(peer.pressed,{});
   assert.ok(canStand(run.course,peer.x,peer.y,.1));assert.deepEqual(peer.ownedWeapons,run.ownedWeapons);
  }
  assert.ok(run.ownedWeapons.includes(4));assert.ok(run.storyRecords.some(r=>r.id==='preserved-record'));
  assert.ok(run.journey.log.length<=JOURNEY_LOG_LIMIT);
 }
 assert.equal(run.mode,'win');assert.equal(run.journey.completed.length,5);
});

test('opt-in first floor opens ordinary encounter gates through its queues before signature and key can complete the descent',()=>{
 const run=fresh(),course=run.course,p=run.dungeonProgression;
 let guard=0;
 while(p.encounterPlan.some(node=>!node.optional&&node.status!=='cleared')){
  const reach=reachableCells(course.cells,course.w,course.h,run);
  const node=p.encounterPlan.find(node=>p.currentEncounter?.nodeIds.includes(node.id))
   ||p.encounterPlan.find(node=>!node.optional&&node.status==='pending'&&p.roomSpawnCells[node.roomId].some(point=>reach.has(`${Math.floor(point.x)},${Math.floor(point.y)}`)));
  assert.ok(node,'next authored encounter remains reachable');
  const point=p.roomSpawnCells[node.roomId].filter(point=>reach.has(`${Math.floor(point.x)},${Math.floor(point.y)}`)
   &&course.keys.every(key=>Math.hypot(point.x-key.x,point.y-key.y)>.8))
   .sort((a,b)=>Math.hypot(b.x-run.x,b.y-run.y)-Math.hypot(a.x-run.x,a.y-run.y))[0];
  walk(run,point);
  let frames=0;
  while(node.status!=='cleared'&&frames++<2400){
   tick(run,1/60,{});for(const enemy of course.enemies)enemy.dead=true;
   if(frames%180===0)run.angle+=Math.PI/2;
  }
  assert.equal(node.status,'cleared','authored queued encounter resolves');
  assert.ok(++guard<=p.encounterPlan.length);
 }
 assert.ok(course.openings.filter(opening=>opening.lockedBy==='room-clear').every(opening=>course.openingState[opening.id]));
 walk(run,course.keys[0]);assert.ok(p.keysCollected.includes(course.keys[0].id));
 tick(run,1/60,{});assert.equal(p.exitReady,false,'ordinary key and encounters cannot skip the pump');
 walk(run,run.journey.target);advance(run,1.1,{interact:true});advance(run,3.1);tick(run,1/60,{});
 assert.equal(p.exitReady,true);walk(run,course.exit);assert.equal(run.course.dungeonIndex,1);
 assert.ok(run.events.some(event=>event.type==='journey-complete'));
});

test('revival discards frozen dash, slide, grapple, slam, melee and pressed input without granting the arsenal',()=>{
 for(const deadHost of [true,false]){
  const run=fresh(),peer=addPeer(run),dead=deadHost?run:peer,alive=deadHost?peer:run;
  resolveOrdinaryObjectives(run);alive.x=run.course.playerSpawn.x;alive.y=run.course.playerSpawn.y;
  dead.health=0;Object.assign(dead,{vx:6,vy:5,vz:2,dashTime:.18,slide:1,hookTime:.6,hookTarget:99,slam:true,wallJumps:3,meleeActive:true,sawActive:true,rifleCharging:true,rifleCharge:1,journeyInteract:true,pressed:{jump:true,dash:true}});
  for(let i=0;i<182;i++)tick(run,1/60,{});
  assert.equal(dead.health,65);assert.equal(dead.z,0);assert.equal(dead.vx,0);assert.equal(dead.vy,0);assert.equal(dead.vz,0);
  for(const key of ['dashTime','slide','hookTime','wallJumps','rifleCharge'])assert.equal(dead[key],0,key);
  for(const key of ['slam','meleeActive','sawActive','rifleCharging','journeyInteract'])assert.equal(dead[key],false,key);
  assert.equal(dead.pressed.dash||false,false);assert.equal(dead.pressed.jump||false,false);
  assert.deepEqual(dead.ownedWeapons,[0]);assert.ok(canStand(run.course,dead.x,dead.y,.1));
 }
});

test('peer held interaction advances shared authoritative action exactly once while movement remains available',()=>{
 const run=fresh(),peer=addPeer(run);const station=run.journey.stations[0];
 peer.x=station.x;peer.y=station.y;peer.vx=peer.vy=0;
 for(let frame=0;frame<46;frame++){tickPlayer(peer,1/60,{interact:true});updateJourney(run,1/60,{castRay});}
 assert.equal(run.journey.step,1);assert.equal(peer.journey,run.journey);
 assert.equal(run.events.filter(e=>e.type==='journey-action').length,1);
 const moving=fresh();atStation(moving);tickPlayer(moving,1/60,{interact:true,forward:1});assert.ok(moving.speed>0);
});
