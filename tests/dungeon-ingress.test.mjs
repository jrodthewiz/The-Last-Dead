import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDungeonCourse,setDungeonOpeningOpen} from '../playground/map/dungeon-course.js';
import {roomContainsCell} from '../playground/map/dungeon-compiler.js';
import {newRun,tick,canStand,castRay,addPeer} from '../engine.js';
import {getIngressCandidates,isIngressRouteOpen,findPath,seenByPlayers,pickSpawnPoint} from '../enemy-ai.js';
const env={canStand,castRay};
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

test('a multi-door hall encounter opens another real approach during contact',()=>{
 const run=newRun(makeDungeonCourse(0));run.mode='play';run.health=100000;
 const candidates=getIngressCandidates(env,run.course,'f1-hall'),openings=[...new Set(candidates.map(p=>p.openingId))];
 let station=null;
 for(let y=12.5;y<16&&!station;y++)for(let x=9.5;x<25&&!station;x++)for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  if(!canStand(run.course,x,y,.16))continue;
  const player={x,y,angle,health:100};
  const available=openings.filter(openingId=>pickSpawnPoint(env,run.course,[player],[],candidates.filter(p=>p.openingId===openingId),{minDist:3.5,behind:false}));
  if(available.length>=2){station=player;break;}
 }
 assert.ok(station,'hall offers a station with two safe offscreen entrances');
 Object.assign(run,station);
 const arrivals=[],cues=[];
 for(let frame=0;frame<2400&&arrivals.length<6;frame++){
  run.events=[];
  tick(run,1/60,{});
  for(const event of run.events){
   if(event.type==='dungeon-ingress'&&event.roomId==='f1-hall'&&event.phaseIndex===0)cues.push(event);
   if(event.type==='spawn'&&event.roomId==='f1-hall'&&event.stage===0){
    arrivals.push(event);
    assert.ok(isIngressRouteOpen(env,run.course,getIngressCandidates(env,run.course,'f1-hall').find(p=>p.ingressId===event.ingressId&&Math.hypot(p.x-event.x,p.y-event.y)<.01)));
    const enemy=run.course.enemies.find(e=>e.id===event.enemyId);enemy.dead=true;
   }
  }
 }
 assert.equal(arrivals.length,4,'the authored four-enemy opening pack arrives through real openings');
 const usedOpenings=new Set(arrivals.map(e=>e.openingId));
 assert.ok(usedOpenings.size>=2,`contact pack should use two doorways: ${[...usedOpenings]}`);
 assert.ok([...usedOpenings].every(id=>cues.some(e=>e.openingId===id)),'each approach has a warning cue');
});

test('every required room has coherent live door ingress and closing its door invalidates the lane',()=>{
 for(let floor=0;floor<5;floor++){
  const course=makeDungeonCourse(floor);
  for(const opening of course.openings)setDungeonOpeningOpen(course,opening.id,true);
  for(const roomId of course.encounterRoute){
   const room=course.rooms.find(r=>r.id===roomId),points=getIngressCandidates(env,course,roomId);
   assert.ok(points.length,roomId);
   for(const point of points){
    const group=course.ingressGroups[roomId].find(g=>g.id===point.ingressId);
    assert.ok(group,`${roomId}: actual authored ingress`);
    assert.equal(roomContainsCell(room,point.x,point.y),false,'staging stays outside destination room');
    assert.ok(isIngressRouteOpen(env,course,point));
    assert.ok(point.route.some(p=>Math.hypot(p.x-group.portal.x,p.y-group.portal.y)<.01),'route crosses its actual opening');
    assert.ok(roomContainsCell(room,point.route.at(-1).x,point.route.at(-1).y));
    assert.ok(Math.abs(wrap(point.facing-Math.atan2(point.route[0].y-point.y,point.route[0].x-point.x)))<1e-8);
   }
   const point=points[0];setDungeonOpeningOpen(course,point.openingId,false);
   assert.equal(isIngressRouteOpen(env,course,point),false);
   assert.ok(getIngressCandidates(env,course,roomId).every(p=>p.openingId!==point.openingId));
   setDungeonOpeningOpen(course,point.openingId,true);
  }
 }
});

test('all five openings spawn upright, face their route, and physically reach the encounter room',()=>{
 for(let floor=0;floor<5;floor++){
  const run=newRun(makeDungeonCourse(floor));run.mode='play';run.health=1e9;
  const course=run.course,room=course.rooms.find(r=>r.kind==='entry'),tracked=new Set();let firstArrival=null;
  for(let frame=0;frame<2400;frame++){
   run.events=[];
   tick(run,1/60,{});
   for(const event of run.events.filter(e=>e.type==='spawn')){
    const enemy=course.enemies.find(e=>e.id===event.enemyId);
    const candidates=getIngressCandidates(env,course,event.roomId);
    const origin=candidates.find(p=>p.ingressId===event.ingressId&&Math.hypot(p.x-event.x,p.y-event.y)<.001);
    assert.ok(origin,`${floor}: spawn is on its coherent ingress`);
    assert.ok(Math.abs(wrap(event.facing-origin.facing))<1e-8,'initial heading is the lane tangent');
    assert.equal(event.spawnAnim,'none');assert.equal(event.z,0);
    assert.ok(Math.hypot(event.x-run.x,event.y-run.y)>=3.49);
    assert.equal(seenByPlayers(env,course,[run],event.x,event.y,{fov:1.4,range:45,near:2.65}),false);
    assert.ok(findPath(env,course,event,run,course.w*course.h));
    tracked.add(enemy.id);
   }
   assert.ok(course.enemies.filter(e=>!e.dead).length<=12);
   for(const enemy of course.enemies){assert.ok(canStand(course,enemy.x,enemy.y,.15));assert.equal(enemy.z,0);
    if(tracked.has(enemy.id)&&roomContainsCell(room,enemy.x,enemy.y)&&firstArrival===null)firstArrival=run.time;}
  }
  assert.ok(tracked.size>=2,`${floor}: opening has pressure`);
  assert.ok(firstArrival!==null&&firstArrival<25,`${floor}: first physical arrival ${firstArrival}`);
 }
});

test('reinforcement phases remain distinct and combat navigation holds the room instead of chasing stragglers',()=>{
 const run=newRun(makeDungeonCourse(0));run.mode='play';run.health=1e9;
 Object.assign(run,{x:17.5,y:14.5,angle:-Math.PI/2});
 const phases=[],spawnTimes=[];let encounter=null;
 for(let frame=0;frame<1800;frame++){
  run.events=[];
  tick(run,1/60,{});
  encounter ||= run.dungeonProgression.currentEncounter;
  for(const event of run.events){
   if(event.type==='dungeon-encounter-phase')phases.push({...event,time:run.time});
   if(event.type==='spawn')spawnTimes.push(run.time);
  }
  if(run.dungeonProgression.currentEncounter){
   const nav=run.dungeonProgression.navigation;
   assert.equal(nav.hold,true);assert.equal(nav.roomId,encounter.roomId);assert.equal(nav.waypoint,null);
   assert.equal(nav.phaseCount,2);
  }
  for(const enemy of run.course.enemies)enemy.dead=true;
  if(encounter&&!run.dungeonProgression.currentEncounter)break;
 }
 assert.deepEqual(phases.map(p=>p.phase),['Read the crossing','Counter approach']);
 assert.ok(phases[1].time-phases[0].time>=4.29,'the crossing grants its authored contact and recovery beat');
 assert.ok(spawnTimes.at(-1)-spawnTimes[0]>=4,'reinforcements arrive as a later combat beat');
 assert.equal(run.dungeonProgression.encounterPlan.find(node=>node.roomId==='f1-hall').status,'cleared');
});

test('a co-op player entering the warned staging point cancels that spawn at commitment',()=>{
 const run=newRun(makeDungeonCourse(0));run.mode='play';run.health=1e9;
 for(let frame=0;frame<900&&!run.spawnTelegraphs.length;frame++)tick(run,1/60,{});
 const warning=run.spawnTelegraphs[0];assert.ok(warning);
 const peer=addPeer(run);peer.x=warning.x;peer.y=warning.y;peer.health=1e9;
 for(let frame=0;frame<90;frame++){
  run.events=[];
  tick(run,1/60,{});
  for(const event of run.events.filter(e=>e.type==='spawn'))assert.ok(Math.hypot(event.x-peer.x,event.y-peer.y)>=3.49);
 }
 assert.ok(!run.course.enemies.some(e=>Math.hypot(e.ingressOrigin.x-warning.x,e.ingressOrigin.y-warning.y)<.001));
});
