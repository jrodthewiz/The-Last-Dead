import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHarborCourse} from '../harbor-course.js';
import {newRun,tick,canStand,castRay,shoot} from '../engine.js';
import {getActiveVehicle} from '../harbor-vehicle-fleet.js';
import {pickupReachable} from '../scavenger-pack.js';
import {createMind,isHunting} from '../enemy-ai.js';
import {IslandBasementConnection} from '../island-basement.js';

const step=(r,frames,input={})=>{for(let i=0;i<frames;i++)tick(r,1/60,input);};
const place=(r,p)=>Object.assign(r,p,{z:0,vx:0,vy:0,vz:0,supportZ:null,supportId:null,structureId:null,slide:0,dashTime:0});

test('completed island city supports fleet, loot, live residents and retained basement through the real engine',async t=>{
 const source=makeHarborCourse({openWorld:true,cityLootSeed:71003}),r=newRun(source);r.mode='play';step(r,1);
 const actors=[...r.course.enemies];
 await t.test('population uses final 55-prop authority and keeps 56 unique initial residents',()=>{
  assert.equal(r.course.enemies.length,56);assert.equal(r.course.coastal.zombiePopulation.spawned,48);
  assert.equal(new Set(r.course.enemies.map(e=>e.id)).size,56);
  assert(r.course.coastal.cityLife);assert(r.course.coastal.cityLoot.added>0);
  for(const item of r.course.scavengerPickups.filter(p=>p.cityLoot)){
   assert(canStand(r.course,item.approach.x,item.approach.y,.12),item.id+' completed-world approach');
   assert(pickupReachable({...r,...item.approach,z:0,supportZ:null,structureId:null},r.course,item),item.id+' actual pickup reach/occlusion');
  }
  for(const e of r.course.enemies.filter(e=>e.populationId))assert(canStand(r.course,e.x,e.y,.16),e.populationId);
  for(const e of actors)e.dead=true;
 });
 await t.test('Q enters an actual street car, held Q cannot eject, movement vacates its old collision and braking permits exit',()=>{
  assert.equal(r.vehicleFleet.cars.length,16);assert(r.vehicleFleet.helicopter);
  const v=r.vehicleFleet.cars.find(v=>v.kind==='sedan')||r.vehicleFleet.cars[0];
  const distance=v.halfWidth+.35;
  const approach=[1,-1].map(sign=>({x:v.x-Math.sin(v.angle)*distance*sign,y:v.y+Math.cos(v.angle)*distance*sign}))
   .find(p=>canStand(r.course,p.x,p.y,.12));assert(approach,'a real car has an accessible side');
  const home={x:v.x,y:v.y};place(r,approach);step(r,1,{});step(r,1,{interact:true});
  assert.equal(getActiveVehicle(r),v);assert(v.occupied);assert.equal(shoot(r),false);
  step(r,75,{interact:true,forward:1});assert(v.occupied,'held Q is not another press');
  assert(v.distance>.4,'actual engine dispatch moves the vehicle');assert(Math.hypot(v.x-home.x,v.y-home.y)>.4);
  assert(canStand(r.course,home.x,home.y,.12),'former car footprint is no longer a static ghost');
  assert(!canStand(r.course,v.x,v.y,.12),'current car footprint follows the moved simulation');
  step(r,1,{});step(r,1,{interact:true});assert(v.occupied);assert(r.events.some(e=>e.type==='vehicle-stop-first'));
  step(r,100,{jump:true});step(r,1,{});step(r,1,{interact:true});assert(!v.occupied);assert.equal(getActiveVehicle(r),null);
  assert(canStand(r.course,r.x,r.y,.12));
 });
 await t.test('real helicopter entry spins up, takes off, rejects airborne exit, lands and dismounts',()=>{
  const v=r.vehicleFleet.helicopter,side=v.halfWidth+.42;
  const approach=[1,-1].map(sign=>({x:v.x-Math.sin(v.angle)*side*sign,y:v.y+Math.cos(v.angle)*side*sign})).find(p=>canStand(r.course,p.x,p.y,.12));
  assert(approach);place(r,approach);step(r,1,{});step(r,1,{interact:true});assert.equal(getActiveVehicle(r),v);
  step(r,180,{jump:true});assert(v.rotorSpeed>.9);assert(v.altitudeM>2);assert(!v.landed);
  step(r,1,{});step(r,1,{interact:true});assert(v.occupied);assert(r.events.some(e=>e.type==='vehicle-land-first'));
  step(r,220,{slide:true});assert(v.landed);assert(v.altitudeM<.1);
  step(r,1,{});step(r,1,{interact:true});assert(!v.occupied);assert.equal(getActiveVehicle(r),null);
  assert(canStand(r.course,r.x,r.y,.12));
 });
 await t.test('an actual seeded interior case prompts without collecting, Q collects once and preserves contents',()=>{
  const items=r.course.scavengerPickups.filter(p=>p.cityLoot&&p.visualKind==='supply-case');assert(items.length);
  const item=items.find(p=>canStand(r.course,p.approach.x,p.approach.y,.12)&&pickupReachable({...r,...p.approach,z:0,supportZ:null,structureId:null},r.course,p));assert(item,'seeded city loot has a reachable real support');
  place(r,item.approach);step(r,1,{});assert(!r.backpack.collected.includes(item.id));
  assert.equal(r.scavengerRoutePromptId,item.id);
  const before={...r.backpack.supplies};step(r,1,{interact:true});assert(r.backpack.collected.includes(item.id));
  for(const [kind,amount]of Object.entries(item.contents))assert.equal(r.backpack.supplies[kind],before[kind]+amount);
  const collected=[...r.backpack.collected],supplies={...r.backpack.supplies};step(r,4,{interact:true});step(r,1,{});step(r,1,{interact:true});
  assert.deepEqual(r.backpack.collected,collected);assert.deepEqual(r.backpack.supplies,supplies);
 });
 await t.test('a real resident sees an unobstructed player, notices with its head, turns and pursues',()=>{
  let fixture;
  for(const e of actors.filter(e=>e.populationId&&!e.roomId&&e.locomotion==='shambler')){
   for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    const target={x:e.x+Math.cos(angle)*3.5,y:e.y+Math.sin(angle)*3.5};
    if(canStand(r.course,target.x,target.y,.12)&&castRay(r.course,e.x,e.y,angle,3.6,e.groundZ+.32).dist>=3.49){fixture={e,angle,target};break;}
   }
   if(fixture)break;
  }
  assert(fixture,'source resident and actual clear lane support recognition');const {e,angle,target}=fixture;
  e.dead=false;e.attacking=false;e.strike=0;e.stagger=0;e.attack=99;createMind(e,{state:'wander',facing:angle-.6,firstAttack:99});e.mind.pause=999;
  r.course.enemies=[e];place(r,target);r.angle=angle+Math.PI;
  const start={x:e.x,y:e.y,facing:e.facing};step(r,12);
  assert.equal(e.state,'notice');assert(e.look>.15);assert.equal(e.facing,start.facing);assert.equal(e.moving,0);
  step(r,24);assert(Math.abs(e.facing-start.facing)>.04,'body follows initial head recognition');
  for(let frame=0;frame<240&&!isHunting(e);frame++)step(r,1);
  assert(isHunting(e));assert(e.mind.sighting.confirmed);step(r,60);
  assert(Math.hypot(e.x-start.x,e.y-start.y)>.05);assert(e.moving>0);
  assert(r.enemyAIDiagnostics.navSearches<=4);
  e.dead=true;
 });
 await t.test('room state reaches bare vehicle collision authority and cached basement returns to the same fleet',()=>{
  const room=r.course.harborRooms[0];r.course.activeInterior=room;
  assert.equal(r.vehiclePhysics.staticCourse.activeInterior,room,'interior state must be shared by facade and static authority');
  assert(canStand(r.course,room.spawn.x,room.spawn.y,.12));r.course.activeInterior=null;
  place(r,r.course.basementPortal);const connection=new IslandBasementConnection(),fleet=r.vehicleFleet,facade=r.course;
  const basement=connection.transition(r);assert(basement?.course.dungeonCompiled);
  basement.health=73;const returned=connection.transition(basement);assert.equal(returned,r);assert.equal(returned.health,73);
  assert.equal(returned.vehicleFleet,fleet);assert.equal(returned.course,facade);assert.equal(returned.course.activeInterior,null);
 });
 r.vehiclePhysics.dispose();
});
