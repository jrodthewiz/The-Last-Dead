import test from 'node:test';
import assert from 'node:assert/strict';
import {createMind,stepMind,wakeEnemy,hash01,clearLine} from '../enemy-ai.js';
import {noteSighting,hordeFrame,hearHorde,hordeSteering,gaitSpeed,interceptGoal,motionIntent} from '../zombie-behavior.js';
import {traceEnemyBody} from '../enemy-anatomy.js';
import {makeCourse,newRun,tick,shoot,switchWeapon,eye} from '../engine.js';
import {makeHarborCourse} from '../harbor-course.js';

const openCourse=()=>({w:24,h:24,cells:Array.from({length:576},()=>[0,0,0,0])});
function zombie(id=1,variant='stalker',x=2,y=2,state='stalk'){
  const e={id,variant,x,y,kind:0,moveSpeed:1,attack:99,hp:100,maxHp:100,dead:false,seesTarget:false,strike:0,facing:0};
  createMind(e,{state,firstAttack:99,facing:0});return e;
}
function context(enemies,extra={}){
  return {time:0,dt:1/60,alive:enemies,course:openCourse(),env:{canStand:()=>true,castRay:()=>({dist:100})},
    noises:[],navBudget:4,profile:{role:'rush',speed:1},reach:.34,tokens:{melee:0,maxMelee:0,ranged:0,maxRanged:0},...extra};
}
const json=e=>JSON.parse(JSON.stringify(e));

test('natural archetypes and injury crawl remain deterministic and distinct',()=>{
  const shambler=zombie(17),runner=zombie(17,'bloodhound'),crawler=zombie(17,'skitter');
  assert.equal(shambler.locomotion,'shambler');assert.equal(runner.locomotion,'runner');assert.equal(crawler.locomotion,'crawler');
  assert.deepEqual(crawler.mind.gait,zombie(17,'skitter').mind.gait);
  const injured=zombie(3);injured.locomotion='crawl';createMind(injured);assert.equal(injured.locomotion,'crawl');
});

test('horde awareness waits for a local visible relay and preserves its observed location',()=>{
  const witness=zombie(1,'stalker',2,2),listener=zombie(2,'skitter',5,2,'dormant'),ctx=context([witness,listener]);
  noteSighting(ctx,witness,{x:3,y:3,playerId:'host'});hearHorde(ctx,listener,hash01);
  assert(listener.mind.socialPending);assert.equal(listener.mind.aware,0);assert.equal(listener.mind.lastKnown,null);
  ctx.time=.25;hearHorde(ctx,listener,hash01);assert.equal(listener.mind.aware,0);
  ctx.time=.7;hearHorde(ctx,listener,hash01);
  assert.equal(listener.mind.aware,1);assert.deepEqual(listener.mind.lastKnown,{x:3,y:3});
  assert.equal(listener.mind.sighting.hops,1);assert(listener.mind.firstAttack>=.7);
});

test('walls and prop sight blockers stop social alerts even for members of the same pack',()=>{
  for(const blocked of [true,false]){
    const a=zombie(1,'stalker',2,2),b=zombie(2,'stalker',5,2,'dormant');a.pack=b.pack=1;
    const ctx=context([a,b],{env:{canStand:()=>true,castRay:()=>({dist:blocked?1:100})}});
    noteSighting(ctx,a,{x:3,y:3});hearHorde(ctx,b,hash01);
    assert.equal(!!b.mind.socialPending,!blocked);
  }
});

test('a sighting cannot cascade through a chain in one tick or more than two relays',()=>{
  const actors=[zombie(1,'stalker',2,2),zombie(2,'stalker',6.5,2,'dormant'),zombie(3,'stalker',11,2,'dormant'),zombie(4,'stalker',15.5,2,'dormant')];
  const ctx=context(actors);hordeFrame(ctx);noteSighting(ctx,actors[0],{x:3,y:3});
  for(const actor of actors.slice(1))hearHorde(ctx,actor,hash01);
  assert.equal(actors[1].mind.socialPending,null,'snapshot precedes the new sighting');
  for(let i=1;i<=150;i++){ctx.time=i/60;for(const actor of actors.slice(1))hearHorde(ctx,actor,hash01);}
  assert.equal(actors[1].mind.sighting.hops,1);assert.equal(actors[2].mind.sighting.hops,2);
  assert.equal(actors[3].mind.sighting,null);assert.equal(actors[3].mind.aware,0);
});

test('unseen live player movement cannot change relentless pursuit, facing, or head look',()=>{
  const a=zombie(9),b=zombie(9),ca=context([a]),cb=context([b]);
  for(const e of [a,b])e.mind.lastKnown={x:8,y:3};
  for(let i=0;i<120;i++){
    ca.time=cb.time=i/60;stepMind(ca,a,{x:10,y:8});stepMind(cb,b,{x:1,y:20});
    assert.deepEqual([a.x,a.y,a.facing,a.look,a.state],[b.x,b.y,b.facing,b.look,b.state]);
  }
  assert.deepEqual(a.mind.lastKnown,{x:8,y:3});
});

test('an open sight ray beyond sensory range cannot reveal a distant current player position',()=>{
  const e=zombie(9),ctx=context([e]);e.seesTarget=true;e.mind.lastKnown={x:8,y:3};
  stepMind(ctx,e,{x:100,y:100});assert.deepEqual(e.mind.lastKnown,{x:8,y:3});assert.equal(e.mind.sighting,null);
});

test('delayed room wake uses the original observation after the player moves unseen',()=>{
  const e=zombie(3,'stalker',2,2,'dormant'),ctx=context([e]);wakeEnemy(e,{x:5,y:2},.2);
  for(let i=0;i<20;i++){ctx.time+=ctx.dt;stepMind(ctx,e,{x:20,y:20});}
  assert.deepEqual(e.mind.lastKnown,{x:5,y:2});assert(e.x>2);assert(Math.abs(e.y-2)<1e-9);
});

test('authored ingress advances through its portal without acquiring an unseen player position',()=>{
  const e=zombie(6),ctx=context([e]);e.ingressRoute=[{x:3,y:2},{x:4,y:2}];e.ingressTotal=2;
  for(let frame=0;frame<180 && e.ingressRoute.length;frame++){ctx.time=frame/60;stepMind(ctx,e,{x:18,y:18});}
  assert.equal(e.ingressRoute.length,0);assert(e.x>3.7);assert(Math.abs(e.y-2)<1e-9);assert.equal(e.mind.lastKnown,null);
  assert.equal(e.mind.state,'wander','the actor searches locally until it senses evidence');
});

test('runners telegraph bursts and recover while crawlers stalk below shambler pace',()=>{
  const samples={};
  for(const variant of ['stalker','bloodhound','skitter']){
    const e=zombie(17,variant),ctx=context([e]),out=[];e.mind.startle=0;
    for(let frame=0;frame<600;frame++){ctx.time=frame*ctx.dt;out.push(gaitSpeed(ctx,e,true,variant==='skitter'?3:6,hash01));assert(e.burst>=0&&e.burst<=1);}
    samples[variant]=out;
  }
  const avg=values=>values.reduce((a,b)=>a+b,0)/values.length;
  assert(Math.max(...samples.bloodhound)>1.7,'runner reaches a readable fast rush');
  assert(Math.min(...samples.bloodhound)<.7,'runner has a real recovery beat');
  assert(avg(samples.skitter)<avg(samples.stalker)*.8,'low stalking stays slower on average');
  assert(Math.max(...samples.skitter)>Math.min(...samples.skitter)*2,'crawler has short surges');
});

test('runner interception uses only observed velocity, stays bounded, and rejects blocked lanes',()=>{
  const e=zombie(4,'bloodhound'),ctx=context([e]),target={x:5,y:2,playerId:'host'};
  noteSighting(ctx,e,target);ctx.time=.1;target.y=2.25;noteSighting(ctx,e,target);
  const goal=interceptGoal(ctx,e,target,clearLine);assert(goal.y>target.y);assert(Math.hypot(goal.x-target.x,goal.y-target.y)<=1.1);
  ctx.env.canStand=()=>false;assert.equal(interceptGoal(ctx,e,target,clearLine),target);
  ctx.env.canStand=()=>true;ctx.time=1;assert.equal(interceptGoal(ctx,e,target,clearLine),target,'stale velocity expires');
});

test('neighbor caches share six voices and one visibility result per pair each tick',()=>{
  const e=zombie(1),neighbors=Array.from({length:20},(_,i)=>zombie(i+2,'stalker',3+i*.04,2));let casts=0;
  const ctx=context([e,...neighbors],{env:{canStand:()=>true,castRay:()=>{casts++;return{dist:100};}}});
  for(const o of neighbors)noteSighting(ctx,o,{x:4,y:3});
  hearHorde(ctx,e,hash01);hordeSteering(ctx,e);const first=casts;hordeSteering(ctx,e);
  assert.equal(hordeFrame(ctx).neighbors.get(e.id).length,6);assert(first<=6);assert.equal(casts,first);
});

test('natural crawler head and torso are targetable at visible low heights with real rifle authority',()=>{
  const crawler=zombie(10,'skitter',6,6);crawler.facing=Math.PI/2;
  assert.equal(traceEnemyBody(crawler,{x:6,y:7,z:.19},{x:0,y:-1,z:0},2)?.part,'head');
  assert.equal(traceEnemyBody(crawler,{x:7,y:6,z:.15},{x:-1,y:0,z:0},2)?.part,'torso');
  assert.equal(traceEnemyBody(crawler,{x:6,y:7,z:.42},{x:0,y:-1,z:0},2),null,'no invisible upright head');
  crawler.strike=.1;assert.equal(traceEnemyBody(crawler,{x:6,y:7,z:.42},{x:0,y:-1,z:0},2)?.part,'head','authored contact rises into a targetable original swipe');
  for(const height of [.15,.19]){
    const run=newRun(makeCourse()),e=zombie(10,'skitter',6,6.5);e.facing=Math.PI/2;
    Object.assign(run,{mode:'play',x:6,y:7,angle:-Math.PI/2,pitch:Math.atan2(height-eye(run),.5),waveDelay:999});run.course.enemies=[e];
    switchWeapon(run,5);shoot(run);assert(e.hp<100,`rifle hits low crawler at ${height}`);
  }
});

test('host snapshot preserves gait/social memory and continues deterministic decisions',()=>{
  const first=zombie(21,'bloodhound'),ctx=context([first]);first.seesTarget=true;
  for(let frame=0;frame<60;frame++){ctx.time=frame/60;stepMind(ctx,first,{x:7,y:2,angle:0,playerId:'host'});}
  const copy=json(first);Object.defineProperty(copy,'nav',{value:JSON.parse(JSON.stringify(first.nav)),writable:true,configurable:true});
  const copiedCtx=context([copy]);
  for(let frame=60;frame<180;frame++){
    ctx.time=copiedCtx.time=frame/60;stepMind(ctx,first,{x:7,y:2,angle:0,playerId:'host'});stepMind(copiedCtx,copy,{x:7,y:2,angle:0,playerId:'host'});
    assert.deepEqual(json(first),json(copy));
  }
});

test('current harbor population includes runners and low crawlers while explicit variants win',()=>{
  const course=makeHarborCourse(makeCourse());course.harborSpawns[0].variant='skitter';
  const run=newRun(course);run.mode='play';tick(run,1/60);
  assert.equal(course.enemies[0].variant,'skitter');assert(course.enemies.some(e=>e.locomotion==='runner'));assert(course.enemies.some(e=>e.locomotion==='crawler'));
});

test('stationary contortion rises and falls smoothly and moving/attack intent suppresses it',()=>{
  const id=Array.from({length:100},(_,i)=>i).find(i=>hash01(i,81)<.38),e=zombie(id,'skitter'),ctx=context([e]);let previous=0,max=0,min=1;
  for(let frame=0;frame<800;frame++){
    ctx.time=frame/60;e.moving=0;motionIntent(e,ctx);assert(e.contortion>=0&&e.contortion<=1);assert(Math.abs(e.contortion-previous)<.06);previous=e.contortion;max=Math.max(max,e.contortion);if(frame>60)min=Math.min(min,e.contortion);
  }
  assert(max>.3&&min<.05);
  for(let frame=0;frame<120;frame++){e.moving=1;e.attacking=true;motionIntent(e,ctx);}
  assert(e.contortion<.01);assert.equal(e.motionIntent,'crawl');
});
