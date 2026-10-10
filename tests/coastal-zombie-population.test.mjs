import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHarborCourse} from '../harbor-course.js';
import {canStand,newRun,tick} from '../engine.js';
import {makeCoastalZombiePopulation,attachCoastalZombiePopulation} from '../coastal-zombie-population.js';
import {createMind,stepMind,advanceEnemyAICursor,hash01} from '../enemy-ai.js';
import {hordeFrame,hordeSteering,gaitSpeed} from '../zombie-behavior.js';

test('48 seeded completed-world residents occupy real safe lanes and rooms, with one-time initialization',()=>{
 const course=makeHarborCourse({openWorld:true}),points=makeCoastalZombiePopulation(course,canStand);
 assert.equal(points.length,48);assert.deepEqual(points,makeCoastalZombiePopulation(course,canStand));
 assert.equal(new Set(points.map(p=>p.id)).size,48);
 assert.deepEqual(points.reduce((a,p)=>(a[p.locomotion]=(a[p.locomotion]||0)+1,a),{}),{shambler:24,runner:12,injured:12});
 assert(points.some(p=>p.buildingId));assert(points.some(p=>p.region.startsWith('sidewalk')));
 for(const p of points){
  assert(canStand(course,p.x,p.y,.22),p.id);
  assert(p.x>=p.roamBounds.minX&&p.x<=p.roamBounds.maxX&&p.y>=p.roamBounds.minY&&p.y<=p.roamBounds.maxY);
  for(const road of course.coastal.roads)assert(!(Math.abs(p.x*4-road.x)<road.width/2+.9&&Math.abs(p.y*4-road.z)<road.depth/2+.9),p.id+' road clearance');
  for(const q of [...course.scavengerPickups,...course.weaponPickups])assert(Math.hypot(p.x-q.x,p.y-q.y)>=2.5/4,p.id+' pickup clearance');
 }
 const run=newRun(course);run.mode='play';tick(run,1/60);
 assert.equal(course.enemies.length,56);assert.equal(course.coastal.zombiePopulation.spawned,48);
 const population=attachCoastalZombiePopulation(run,()=>assert.fail('duplicate spawn'),canStand);
 assert.equal(population.spawned,48);
 assert.equal(course.enemies.filter(e=>e.locomotion==='injured').length,12);
 for(let frame=0;frame<5;frame++)tick(run,1/60);
 assert.equal(course.enemies.length,56);assert(run.enemyAIDiagnostics.navSearches<=4);
});

test('initial and failed paths share strict four-search cap and persistent rotation gives every resident a turn',()=>{
 const run={},actors=Array.from({length:56},(_,id)=>{
  const e={id,kind:0,variant:'stalker',x:2,y:2,moveSpeed:1,dead:false,seesTarget:false,attack:99,strike:0};
  createMind(e,{state:'stalk',facing:0,firstAttack:99});e.mind.lastKnown={x:6,y:2};return e;
 });
 const course={w:12,h:12,cells:Array.from({length:144},()=>[1,1,1,1])};
 const attempted=new Set();
 for(let frame=0;frame<14;frame++){
  const ctx={time:frame/60,dt:1/60,course,alive:actors,env:{canStand:()=>false,castRay:()=>({dist:100})},noises:[],navBudget:4,navSearches:0,
   profile:{role:'rush',speed:1},reach:.34,tokens:{melee:0,maxMelee:0,ranged:0,maxRanged:0}};
  const start=advanceEnemyAICursor(run,actors.length);
  for(let i=0;i<actors.length;i++){
   const e=actors[(start+i)%actors.length],before=ctx.navSearches;
   stepMind(ctx,e,{x:6,y:2});if(ctx.navSearches>before)attempted.add(e.id);
  }
  assert.equal(ctx.navSearches,4);assert.equal(ctx.navBudget,0);
 }
 assert.equal(attempted.size,56,'all actors including final array entries receive bounded initial searches');
});

test('5.2-cell spatial neighbors exactly match distance/id nearest-six oracle across cell edges',()=>{
 const actors=Array.from({length:256},(_,id)=>({id,x:hash01(id,5)*100-50,y:hash01(id,6)*100-50,dead:false,mind:{},pack:id%3}));
 actors.push({id:256,x:-.001,y:5.199,mind:{}},{id:257,x:.001,y:5.201,mind:{}});
 const ctx={time:1,alive:actors,env:{castRay:()=>({dist:100})},course:{}};
 const frame=hordeFrame(ctx);
 for(const actor of actors){
  hordeSteering(ctx,actor);
  const expected=frame.members.filter(o=>o.id!==actor.id&&Math.hypot(o.x-actor.x,o.y-actor.y)<5.2)
   .sort((a,b)=>Math.hypot(a.x-actor.x,a.y-actor.y)-Math.hypot(b.x-actor.x,b.y-actor.y)||a.id-b.id).slice(0,6).map(o=>o.id);
  assert.deepEqual(frame.neighbors.get(actor.id).map(o=>o.id),expected);
 }
 assert(frame.operations.candidates<actors.length*actors.length/8,'spread population avoids full all-pairs scan');
 assert.equal(frame.operations.neighborQueries,actors.length);
});

test('upright injured cohort keeps slower Shuffle gait without losing perception or becoming a crawler',()=>{
 const make=locomotion=>{const e={id:1,kind:0,variant:'stalker',locomotion,x:2,y:2};createMind(e,{state:'wander'});return e;};
 const a=make('shambler'),b=make('injured'),ctx={time:0,dt:1/60};
 assert(Math.abs(gaitSpeed(ctx,b,false,8,hash01)/gaitSpeed(ctx,a,false,8,hash01)-.72)<1e-12);
 assert.equal(b.locomotion,'injured');assert(b.mind.gait);
});
