import test from 'node:test';
import assert from 'node:assert/strict';
import {newRun,tick,canStand,castRay,addPeer} from '../engine.js';
import {makeDungeonCourse} from '../playground/map/dungeon-course.js';
import {getIngressCandidates,isIngressRouteOpen,seenByPlayers} from '../enemy-ai.js';

const env={canStand,castRay};
const runOpening=()=>{const run=newRun(makeDungeonCourse(0));run.mode='play';run.health=1e9;return run;};
const step=(run,hz=60)=>{run.events=[];tick(run,1/hz,{});};
function observeWarnings(run,warnings){
 for(const warning of run.spawnTelegraphs)if(!warnings.has(warning.id))warnings.set(warning.id,{...warning,started:run.time});
}
function warningForSpawn(run,event,warnings){
 const enemy=run.course.enemies.find(enemy=>enemy.id===event.enemyId);
 return [...warnings.values()].filter(warning=>warning.order===enemy.phase).at(-1);
}

test('first contact and later opening arrivals each receive the full half-second warning',()=>{
 for(const hz of [30,60,120]){
 const run=runOpening(),warnings=new Map();let arrivals=0;
 for(let frame=0;frame<30*hz;frame++){
  step(run,hz);observeWarnings(run,warnings);
  for(const event of run.events.filter(event=>event.type==='spawn')){
   const warning=warningForSpawn(run,event,warnings);
   assert.ok(warning,'arrival has an observed warning');
   assert.ok(run.time-warning.started>=.5-1e-8,`warning lasted ${run.time-warning.started}s`);
   assert.ok(Math.hypot(event.x-run.x,event.y-run.y)>=3.49);
   assert.equal(seenByPlayers(env,run.course,[run],event.x,event.y,{fov:1.4,range:45,near:2.65}),false);
   run.course.enemies.find(enemy=>enemy.id===event.enemyId).dead=true;arrivals++;
  }
  if(run.dungeonProgression.completedEncounterIds.length)break;
 }
 assert.ok(arrivals>=4,'opening finishes with its existing encounter pressure');
 assert.ok(run.dungeonProgression.completedEncounterIds.length,'required opening can still clear');
 }
});

test('a co-op staging interruption requires a fresh full warning before retry commitment',()=>{
 const run=runOpening(),warnings=new Map();
 for(let frame=0;frame<900&&!run.spawnTelegraphs.length;frame++){step(run);observeWarnings(run,warnings);}
 const original=run.spawnTelegraphs[0];assert.ok(original);
 const encounter=run.dungeonProgression.currentEncounter;
 encounter.ingressPoints=[encounter.queue.find(item=>item.order===original.order).spawnPoint];
 encounter.ingressRevision=run.course.dungeonRevision;
 const peer=addPeer(run);Object.assign(peer,{x:original.x,y:original.y,health:1e9});
 for(let frame=0;frame<120;frame++){
  step(run);observeWarnings(run,warnings);
  assert.equal(encounter.queue.find(item=>item.order===original.order).status,'queued','unsafe warned item stays queued');
  if(!run.spawnTelegraphs.some(warning=>warning.id===original.id))break;
 }
 assert.ok(!run.spawnTelegraphs.some(warning=>warning.id===original.id),'original warning was canceled');
 Object.assign(peer,{x:run.x+.2,y:run.y,angle:run.angle});
 let arrival=null;
 for(let frame=0;frame<600&&!arrival;frame++){
  step(run);observeWarnings(run,warnings);
  arrival=run.events.find(event=>event.type==='spawn'&&run.course.enemies.find(enemy=>enemy.id===event.enemyId).phase===original.order);
 }
 assert.ok(arrival,'the interrupted item resumes safely');
 const warning=warningForSpawn(run,arrival,warnings);
 assert.notEqual(warning.id,original.id,'retry uses a new warning');
 assert.ok(run.time-warning.started>=.5-1e-8,`retry warning lasted ${run.time-warning.started}s`);
 assert.ok(Math.hypot(arrival.x-peer.x,arrival.y-peer.y)>=3.49);
 assert.equal(seenByPlayers(env,run.course,[run,peer],arrival.x,arrival.y,{fov:1.4,range:45,near:2.65}),false);
});

test('concurrent due items reserve a single safe staging pad rather than warn on top of each other',()=>{
 const run=runOpening();
 for(let frame=0;frame<900&&!run.spawnTelegraphs.length;frame++)step(run);
 const encounter=run.dungeonProgression.currentEncounter;assert.ok(encounter);
 const point=encounter.queue.find(item=>item.spawnPoint)?.spawnPoint;assert.ok(point);
 assert.ok(getIngressCandidates(env,run.course,encounter.roomId).some(candidate=>candidate.ingressId===point.ingressId));
 assert.ok(isIngressRouteOpen(env,run.course,point));
 encounter.ingressPoints=[point];encounter.ingressRevision=run.course.dungeonRevision;
 for(const item of encounter.queue)item.due=item.order<2?(item.telegraph?item.due:.35):9999;
 const arrivals=new Set(),warnings=new Map();
 observeWarnings(run,warnings);
 for(let frame=0;frame<600&&arrivals.size<2;frame++){
  step(run);observeWarnings(run,warnings);
  for(let i=0;i<run.spawnTelegraphs.length;i++)for(let j=i+1;j<run.spawnTelegraphs.length;j++){
   const a=run.spawnTelegraphs[i],b=run.spawnTelegraphs[j];
   assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=.7,'warning pads do not compete');
  }
  for(const event of run.events.filter(event=>event.type==='spawn')){
   const enemy=run.course.enemies.find(enemy=>enemy.id===event.enemyId);arrivals.add(enemy.phase);
   const warning=warningForSpawn(run,event,warnings);
   assert.ok(run.time-warning.started>=.5-1e-8);
  }
  assert.ok(run.course.enemies.filter(enemy=>!enemy.dead).length<=12);
 }
 assert.deepEqual([...arrivals].sort(),[0,1],'both items physically enter after the pad clears');
});
