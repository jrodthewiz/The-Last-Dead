import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCourse,canStand,castRay} from '../engine.js';
import {makeDungeonCourse,setDungeonOpeningOpen} from '../playground/map/dungeon-course.js';
import {createMind,stepMind,clearLine,getIngressCandidates,hash01} from '../enemy-ai.js';
const env={canStand,castRay};

function actor(course,from,target,{variant='stalker',hz=60}={}){
 const enemy={id:50,...from,variant,moveSpeed:.72,dead:false};
 createMind(enemy,{state:'stalk',firstAttack:0});
 const ctx={env,course,dt:1/hz,time:0,noises:[],alive:[enemy],navBudget:4,
  profile:{role:variant==='bloodhound'?'hunter':'rush',speed:.72},reach:.7,
  tokens:{melee:3,maxMelee:3,ranged:0,maxRanged:2}};
 return {enemy,ctx,target,hz};
}
function advance(sim,seconds,slots=0){
 let permitted=0;
 for(let i=0;i<seconds*sim.hz;i++){
  const {ctx,enemy,target}=sim;ctx.time+=ctx.dt;ctx.navBudget=4;
  ctx.tokens.melee=slots?0:3;
  const distance=Math.hypot(target.x-enemy.x,target.y-enemy.y);
  enemy.seesTarget=castRay(ctx.course,enemy.x,enemy.y,Math.atan2(target.y-enemy.y,target.x-enemy.x),distance+.1).dist>distance-.01;
  permitted+=Number(stepMind(ctx,enemy,target).attackOK);
  assert.ok(canStand(ctx.course,enemy.x,enemy.y,.15),'pressure motion must stay in collision-safe space');
 }
 return permitted;
}

test('waiting melee closes distance at 30/60/120Hz without bypassing attack slots',()=>{
 const distances=[];
 for(const hz of [30,60,120]){
  const sim=actor(makeCourse(),{x:6,y:5},{x:6,y:9,angle:-Math.PI/2},{hz});
  assert.equal(advance(sim,6),0);
  const distance=Math.hypot(sim.enemy.x-6,sim.enemy.y-9);distances.push(distance);
  assert.ok(distance<2.3,`waiting attacker closes from4 cells, got${distance}`);
  assert.equal(sim.enemy.mind.token,false);
  assert.ok(advance(sim,5,1)>0,'a released slot lets the waiting attacker close and request a warned attack');
 }
 assert.ok(Math.max(...distances)-Math.min(...distances)<.04,'pressure does not depend on frame rate');
});

test('a hunter in a narrow corridor advances instead of repeatedly selecting wall flanks',()=>{
 const course=makeCourse(),open=(x,y)=>y===6&&x>=1&&x<=10;
 course.cells=Array.from({length:course.w*course.h},(_,i)=>{
  const x=i%course.w,y=Math.floor(i/course.w);
  return open(x,y)?[[0,-1],[1,0],[0,1],[-1,0]].map(([dx,dy])=>open(x+dx,y+dy)?0:1):[1,1,1,1];
 });
 const sim=actor(course,{x:2.5,y:6.5},{x:8.5,y:6.5,angle:Math.PI},{variant:'bloodhound'});
 assert.equal(advance(sim,6),0);
 assert.ok(sim.enemy.x>5.5,'hunter uses the open approach when both shoulder flanks are walls');
 assert.ok(Math.abs(sim.enemy.y-6.5)<.35);
 assert.equal(sim.enemy.mind.token,false);
});

test('backup melee pressure remains reachable through authored entrances on every floor',()=>{
 let lanes=0;
 for(let floor=0;floor<5;floor++){
  const course=makeDungeonCourse(floor);
  for(const opening of course.openings)setDungeonOpeningOpen(course,opening.id,true);
  for(const roomId of course.encounterRoute){
   const candidates=getIngressCandidates(env,course,roomId);
   // Test the final approach into the actual portal, where waiting enemies
   // commonly used to peel away from the fight or flank into a doorway jamb.
   const point=candidates.find(p=>{
    const d=Math.hypot(p.x-p.arrival.x,p.y-p.arrival.y);
    return d>2.5&&d<6&&clearLine(env,course,p.x,p.y,p.arrival.x,p.arrival.y,.18);
   });
   if(!point)continue;
   const target={...point.arrival,angle:Math.atan2(point.y-point.arrival.y,point.x-point.arrival.x)};
   for(const variant of ['stalker','bloodhound']){
    const sim=actor(course,point,target,{variant}),before=Math.hypot(point.x-target.x,point.y-target.y);
    assert.equal(advance(sim,4),0);
    const after=Math.hypot(sim.enemy.x-target.x,sim.enemy.y-target.y);
    assert.ok(after<before-.35,`${roomId}/${variant}: backup closes ${before} -> ${after}`);
   }
   lanes++;
  }
 }
 assert.ok(lanes>=15,`enough authored lanes exercised: ${lanes}`);
});

test('swipe contact stays planted before recovery footwork resumes at every simulation rate',()=>{
 for(const hz of [30,60,120]){
  const sim=actor(makeCourse(),{x:6,y:8.7},{x:6,y:9,angle:-Math.PI/2},{hz});
  const {enemy,ctx}=sim;enemy.mind.justAttacked=true;enemy.mind.token=true;
  for(let i=0;i<Math.ceil(.24*hz);i++){
   enemy.strike=Math.max(.001,.24-i/hz);const before={x:enemy.x,y:enemy.y};
   stepMind(ctx,enemy,sim.target);
   assert.equal(enemy.x,before.x);assert.equal(enemy.y,before.y);assert.equal(enemy.moving,0);assert.equal(enemy.state,'attack');
  }
  enemy.strike=0;const before={x:enemy.x,y:enemy.y};stepMind(ctx,enemy,sim.target);
  assert.equal(enemy.state,'recover');assert.equal(enemy.mind.token,false);assert(Math.hypot(enemy.x-before.x,enemy.y-before.y)>0);
 }
});

test('wandering still finishes new destinations after thirty seconds in the same state',()=>{
 const sim=actor(makeCourse(),{x:6,y:6},{x:100,y:100});
 const {enemy,ctx}=sim;enemy.mind.state='wander';enemy.mind.aware=0;enemy.mind.t=40;enemy.mind.pause=0;enemy.mind.dest={x:6,y:9};enemy.mind.wanderT=0;
 for(let i=0;i<120;i++){enemy.seesTarget=false;stepMind(ctx,enemy,sim.target);}
 assert(enemy.mind.dest,'an old state clock must not immediately abandon a new walk');
 assert(enemy.y>6.4,'the wanderer keeps making visible progress');assert(enemy.moving>.1);
});

test('ranged strafe decisions happen once per beat instead of alternating every frame',()=>{
 const id=Array.from({length:100},(_,i)=>i).find(i=>hash01(i,0)<.3);
 const sim=actor(makeCourse(),{id,x:6,y:6},{x:6,y:8.5},{variant:'caster',hz:120});
 sim.enemy.id=id;sim.ctx.profile={role:'ranged',speed:.3};sim.enemy.mind.orbitDir=1;sim.enemy.mind.orbitBeat=-1;sim.enemy.seesTarget=true;
 const directions=[];for(let i=0;i<24;i++){stepMind(sim.ctx,sim.enemy,sim.target);directions.push(sim.enemy.mind.orbitDir);}
 assert.deepEqual([...new Set(directions)],[-1],'one intentional strafe reversal is stable across the beat');
});
