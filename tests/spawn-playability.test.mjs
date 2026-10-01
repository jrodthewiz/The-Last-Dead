import test from 'node:test';
import assert from 'node:assert/strict';
import {newRun,tick,addPeer,canStand,castRay} from '../engine.js';
import {makeDungeonCourse,setDungeonOpeningOpen} from '../playground/map/dungeon-course.js';
import {roomContainsCell} from '../playground/map/dungeon-compiler.js';
import {createPacing,seenByPlayers} from '../enemy-ai.js';

const env={canStand,castRay};
function step(run,hz=60){run.events=[];tick(run,1/hz,{});}
function patrolRun(){
 const run=newRun(makeDungeonCourse(0));run.mode='play';run.health=100;
 const p=run.dungeonProgression,entry=p.encounterPlan.find(node=>node.roomId===p.entryRoomId);
 entry.status='cleared';p.completedEncounterIds=[entry.id];p.roomsCompleted=[entry.roomId];
 p.nextEncounterIndex=p.encounterPlan.findIndex(node=>!node.optional&&node.status==='pending');
 p.nextRoomId=p.encounterPlan[p.nextEncounterIndex].roomId;
 p.pacing=createPacing();p.pacing.cooldown=0;p.pacing.calm=20;
 return run;
}
function firstPatrolWarning(run){
 for(let frame=0;frame<240&&!run.spawnTelegraphs.some(warning=>warning.ambush);frame++)step(run);
 const warning=run.spawnTelegraphs.find(warning=>warning.ambush);
 assert.ok(warning,'a safe real doorway offers the optional patrol');return warning;
}

test('slow ranged reinforcements reach their warned doorway promptly and retain their combat gait',()=>{
 const run=newRun(makeDungeonCourse(1));run.mode='play';run.health=1e9;
 const room=run.course.rooms.find(room=>room.kind==='entry');let tracked=null,spawnTime=0,arrivalTime=null;
 for(let frame=0;frame<2400&&arrivalTime===null;frame++){
  step(run);
  if(!tracked){const event=run.events.find(event=>event.type==='spawn'&&event.variant==='caster');
   if(event){tracked=run.course.enemies.find(enemy=>enemy.id===event.enemyId);spawnTime=run.time;}}
  if(tracked&&roomContainsCell(room,tracked.x,tracked.y))arrivalTime=run.time;
 }
 assert.ok(arrivalTime!==null,'the caster physically crosses the actual entry');
 assert.ok(arrivalTime-spawnTime<12,`warned caster takes ${arrivalTime-spawnTime}s to arrive`);
 assert.equal(tracked.moveSpeed,.3,'normal ranged combat movement remains authored');
});

test('optional patrols reserve distinct pads and grant a full warning before safe commitment',()=>{
 for(const hz of [30,60,120]){
  const run=patrolRun(),warnings=[];let arrivals=0;
  for(let frame=0;frame<hz*4;frame++){
   step(run,hz);
   for(const warning of run.spawnTelegraphs.filter(warning=>warning.ambush))if(!warnings.some(item=>item.id===warning.id))warnings.push({...warning,time:run.time});
   for(const event of run.events.filter(event=>event.type==='spawn'&&event.ambush)){
    const warning=warnings.find(item=>Math.hypot(item.x-event.x,item.y-event.y)<.001);
    assert.ok(warning,'patrol arrival received its own warning');
    assert.ok(run.time-warning.time>=.5-1e-8,'patrol receives the full reaction window');
    assert.ok(Math.hypot(event.x-run.x,event.y-run.y)>=5.49);
    assert.equal(seenByPlayers(env,run.course,[run],event.x,event.y,{fov:1.4,range:45,near:2.65}),false);
    arrivals++;
   }
  }
  assert.ok(arrivals,'warned patrol still arrives');
  for(let i=0;i<warnings.length;i++)for(let j=i+1;j<warnings.length;j++)assert.ok(Math.hypot(warnings[i].x-warnings[j].x,warnings[i].y-warnings[j].y)>=.7);
 }
});

test('a co-op partner occupying a patrol warning cancels that optional arrival',()=>{
 const run=patrolRun(),warning=firstPatrolWarning(run),peer=addPeer(run);
 Object.assign(peer,{x:warning.x,y:warning.y,health:100});
 for(let frame=0;frame<90;frame++){
  step(run);
  for(const event of run.events.filter(event=>event.type==='spawn'))assert.ok(Math.hypot(event.x-peer.x,event.y-peer.y)>=5.49);
 }
 assert.ok(!run.course.enemies.some(enemy=>enemy.ambush&&Math.hypot(enemy.ingressOrigin.x-warning.x,enemy.ingressOrigin.y-warning.y)<.001));
 assert.ok(!run.spawnTelegraphs.some(item=>item.id===warning.id));
});

test('the pacing observation follows the weakest living co-op player',()=>{
 const run=patrolRun(),peer=addPeer(run);peer.health=20;
 run.dungeonProgression.pacing.calm=4.6;
 for(let frame=0;frame<20;frame++)step(run);
 assert.equal(run.dungeonProgression.pacing.lastHealth,20);
 assert.equal(run.dungeonProgression.pacing.ambushes,0,'low-health relief delays the ready patrol');
 peer.health=0;
 for(let frame=0;frame<20;frame++)step(run);
 assert.equal(run.dungeonProgression.pacing.lastHealth,100,'a dead partner does not supply the living health observation');
});

test('a cleared defended supply room protects either co-op player from patrol scheduling',()=>{
 const run=patrolRun(),peer=addPeer(run),p=run.dungeonProgression;
 const room=run.course.rooms.find(room=>room.flow.safeAfterClear),supply=run.course.supplies.find(item=>item.roomId===room.id);
 assert.ok(supply);p.roomsCompleted.push(room.id);
 for(const node of p.encounterPlan.filter(node=>node.roomId===room.id))node.status='cleared';
 Object.assign(peer,{x:supply.x,y:supply.y,health:100});
 for(let frame=0;frame<120;frame++)step(run);
 assert.equal(p.pacing.ambushes,0);assert.ok(!p.ambushQueue?.length);
});

test('equipment on the forward route follows combat and resumes required guidance after collection',()=>{
 for(const floor of [0,1]){
  const run=newRun(makeDungeonCourse(floor));run.mode='play';run.health=1e9;
  const p=run.dungeonProgression,item=run.course.loot.find(item=>run.course.route.includes(item.roomId)&&!run.ownedWeapons.includes(item.weaponIndex));
  assert.ok(item);const room=run.course.rooms.find(room=>room.id===item.roomId);
  for(const opening of run.course.openings)setDungeonOpeningOpen(run.course,opening.id,true);
  for(const node of p.encounterPlan){const sequence=run.course.rooms.find(room=>room.id===node.roomId).flow.sequence;
   if(sequence<=room.flow.sequence){node.status='cleared';p.completedEncounterIds.push(node.id);p.roomsCompleted.push(node.roomId);}}
  const entry=run.course.playerSpawn;Object.assign(run,{x:entry.x,y:entry.y});
  step(run);assert.equal(p.navigation.kind,'equipment');assert.equal(p.navigation.roomId,item.roomId);
  assert.deepEqual(p.navigation.target,{x:item.x,y:item.y});
  const next=p.encounterPlan.find(node=>!node.optional&&node.status==='pending');assert.ok(next);
  const target=run.course.rooms.find(room=>room.id===next.roomId);
  const point=p.roomSpawnCells[target.id][0];Object.assign(run,point);step(run);
  assert.ok(p.currentEncounter);assert.equal(p.navigation.kind,'combat','an active encounter takes guidance priority');
  p.currentEncounter=null;for(const node of p.encounterPlan)if(node.status==='active')node.status='pending';
  Object.assign(run,{x:item.x,y:item.y});step(run);
  assert.ok(p.lootCollected.includes(item.id));assert.ok(run.ownedWeapons.includes(item.weaponIndex));
  for(let frame=0;frame<20;frame++)step(run);
  assert.notEqual(p.navigation.kind,'equipment','collected weapon resumes progression');
 }
});
