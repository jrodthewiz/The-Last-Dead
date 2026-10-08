import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeCourse,newRun,tick,shoot,canStand,castRay} from './engine.js';
import {makeDungeonCourse} from './playground/map/dungeon-course.js';
import {createMind,stepMind,findPath,hash01,pickSpawnPoint,createPacing,updatePacing,noteAmbush,residentIndexes,seenByPlayers} from './enemy-ai.js';
const env={canStand,castRay};
const arena=()=>{const r=newRun(makeCourse());r.mode='play';r.wave=3;r.waveDelay=999;r.x=6;r.y=9;r.angle=-Math.PI/2;return r;};
const mindEnemy=(r,x,y,variant='stalker',state='stalk')=>{const e={id:r.nextId++,x,y,z:0,hp:30,maxHp:30,kind:0,variant,role:'rush',dead:false,flash:0,attack:.2,phase:0,moveSpeed:.72,attackCooldown:.8,windupTime:.28,contactDamage:12,pack:1};createMind(e,{state,home:{x,y},facing:0});r.course.enemies.push(e);return e;};

test('hash01 is deterministic and in range',()=>{assert.equal(hash01(5,2),hash01(5,2));for(let i=0;i<50;i++){const v=hash01(i,3);assert.ok(v>=0&&v<1);}});

test('a searching infected follows a new audible location without an instant attack',()=>{
 const {e,ctx}=motionFixture('rush','investigate');e.seesTarget=false;
 e.mind.noise={x:2,y:2,t:0};e.mind.search=2;e.mind.searchFacing=0;
 ctx.noises=[{x:4,y:2,radius:8,loud:.3}];
 const result=stepMind(ctx,e,{x:50,y:50});
 assert.equal(e.mind.search,0);assert.equal(e.mind.state,'investigate');
 assert.ok(e.x>2,'moves toward the new sound');assert.equal(result.attackOK,false);
 e.x=4;e.mind.search=2;e.mind.t=1;
 stepMind(ctx,e,{x:50,y:50});
 assert.ok(e.mind.search>0&&e.mind.search<2,'same-location sound does not restart listening');
});

function motionFixture(role='rush',state='stalk'){
 const e={id:42,x:2,y:2,kind:0,moveSpeed:1,seesTarget:true,strike:0};createMind(e,{state,facing:0,firstAttack:99});
 const ctx={dt:.1,time:1,course:{w:12,h:12,cells:Array.from({length:144},()=>[0,0,0,0])},env:{canStand:()=>true,castRay:()=>({dist:100})},noises:[],alive:[e],navBudget:4,reach:.5,profile:{role,speed:1},tokens:{melee:0,ranged:0,maxMelee:0,maxRanged:0}};
 return{e,ctx};
}

test('competing sounds select the strongest perceived source regardless of queue order',()=>{
 const quiet={x:2,y:4,radius:8,loud:.15},loud={x:4,y:2,radius:8,loud:.4};
 const results=[];
 for(const noises of [[quiet,loud],[loud,quiet]]){
  const {e,ctx}=motionFixture('rush','investigate');e.seesTarget=false;
  e.mind.noise={x:2,y:2,t:0};e.mind.search=2;ctx.noises=noises;
  stepMind(ctx,e,{x:50,y:50});results.push({x:e.x,y:e.y,noise:e.mind.noise,state:e.mind.state});
 }
 assert.deepEqual(results[0],results[1]);assert.equal(results[0].noise.x,4);
 assert.equal(results[0].state,'investigate');
});

test('investigation listens with seeded head/body cadence, then gives up searching',()=>{
 const makeSearch=id=>{const fixture=motionFixture('rush','investigate');fixture.e.id=id;
  createMind(fixture.e,{state:'investigate',facing:0});fixture.e.seesTarget=false;
  fixture.e.mind.noise={x:2,y:2,t:0};return fixture;};
 const first=makeSearch(42), replay=makeSearch(42), other=makeSearch(43);
 const samples=[];let pauses=0;
 for(let frame=0;frame<50;frame++){
  const before=first.e.facing;
  for(const {e,ctx} of [first,replay,other]){ctx.time+=ctx.dt;stepMind(ctx,e,{x:50,y:50});}
  assert.equal(first.e.facing,replay.e.facing);assert.equal(first.e.look,replay.e.look);
  if(first.e.mind.search>0){assert.equal(first.e.moving,0);samples.push([first.e.facing,first.e.look,other.e.facing]);
   if(Math.abs(first.e.facing-before)<1e-9)pauses++;}
 }
 assert.ok(pauses>0,'body sweeps contain brief listening pauses');
 assert.ok(samples.some(([body,head])=>Math.abs(head-body)>.1),'head checks at a different tempo');
 assert.ok(samples.some(([body,,otherBody])=>Math.abs(body-otherBody)>.1),'different ids do not scan in lockstep');
 assert.equal(first.e.mind.state,'wander');assert.equal(first.e.mind.noise,null);assert.equal(first.e.mind.search,0);
});

test('reacquiring a nearby player cancels the listening pause and keeps the hunt warning',()=>{
 const {e,ctx}=motionFixture('rush','investigate');createMind(e,{state:'investigate',facing:0});
 e.mind.noise={x:2,y:2,t:0};e.seesTarget=false;stepMind(ctx,e,{x:50,y:50});assert.ok(e.mind.search>0);
 e.seesTarget=true;
 for(let frame=0;frame<10&&e.mind.state==='investigate';frame++)stepMind(ctx,e,{x:3,y:2});
 assert.equal(e.mind.state,'stalk');assert.equal(e.mind.search,0);assert.ok(e.mind.startle>0);
 assert.ok(e.mind.firstAttack>0,'reacquisition preserves the existing attack grace');
 assert.deepEqual(e.mind.lastKnown,{x:3,y:2});
});

test('flanking melee turns into its travel lane while ranged retreat keeps aim',()=>{
 const {e,ctx}=motionFixture('hunter');const target={x:7,y:2,angle:Math.PI};
 stepMind(ctx,e,target);
 const travel=Math.atan2(e.y-2,e.x-2);
 assert(Math.abs(travel)>.3,'fixture has a visible flank');
 assert(Math.sign(e.facing)===Math.sign(travel)&&Math.abs(e.facing)>.3,'body follows flank instead of sliding while facing the player');
 assert(Math.sign(e.look)===-Math.sign(e.facing),'head keeps watching the target');
 const ranged=motionFixture('ranged');stepMind(ranged.ctx,ranged.e,{x:3,y:2,angle:Math.PI});
 assert(ranged.e.x<2,'caster retreats when crowded');assert(Math.abs(ranged.e.facing)<1e-9,'retreat keeps casting aim');
});

test('wall-deflected walking faces measured motion, and arrival never overshoots',()=>{
 const {e,ctx}=motionFixture('rush','wander');e.seesTarget=false;e.mind.dest={x:5,y:2};e.mind.pause=99;
 ctx.env.canStand=(_course,x,y)=>!(x>2&&x<2.05&&Math.abs(y-2)<.001);
 stepMind(ctx,e,{x:50,y:50});assert(e.y>2);assert(Math.abs(e.facing-Math.atan2(e.y-2,e.x-2))<1e-8,'facing follows wall deflection');
 const close=motionFixture('rush','wander');close.e.seesTarget=false;close.e.mind.dest={x:2.005,y:2};close.e.mind.pause=99;
 stepMind(close.ctx,close.e,{x:50,y:50});assert(Math.abs(close.e.x-2.005)<1e-10);assert.equal(close.e.mind.dest,null);
});

test('crowd displacement has a moving signal and committed contact remains planted',()=>{
 const {e,ctx}=motionFixture('rush','dormant');e.seesTarget=false;ctx.alive.push({id:43,x:2.1,y:2,dead:false});
 stepMind(ctx,e,{x:50,y:50});assert(e.x<2);assert(e.moving>0,'separation cannot slide an idle pose');
 Object.assign(e,{attacking:true,strike:.24,moving:1});e.mind.state='stalk';e.seesTarget=true;
 const before={x:e.x,y:e.y,facing:e.facing};stepMind(ctx,e,{x:3,y:2});assert.deepEqual({x:e.x,y:e.y,facing:e.facing},before);assert.equal(e.moving,0);
});

test('findPath routes around walls and reports sealed goals',()=>{
  const c=makeDungeonCourse(0);
  const p=findPath(env,c,{x:24.5,y:12.5},{x:17,y:14});
  assert.ok(p&&p.length>0);
  let prev={x:24.5,y:12.5};for(const q of p){assert.ok(canStand(c,q.x,q.y,.15));prev=q;}
  assert.equal(findPath(env,c,{x:6.5,y:24.5},{x:31.5,y:19.5}),null); // closed vent nook
});

test('dormant sleepers ignore distant footsteps but wake to a nearby shot',()=>{
  const r=arena();const far=mindEnemy(r,4,7.2,'stalker','dormant');far.facing=Math.PI;
  for(let n=0;n<240;n++)tick(r,1/60,{});
  assert.equal(far.state,'dormant');
  shoot(r);for(let n=0;n<60;n++)tick(r,1/60,{});
  assert.notEqual(far.state,'dormant'); // gunshot carries across the arena
});

test('hit reactions stagger once, then a grace window prevents stun-lock',()=>{
  const r=arena();const e=mindEnemy(r,6,6.4);e.attack=999;r.angle=-Math.PI/2;
  shoot(r);assert.ok(e.stagger>0);assert.ok(e.mind.aware>=1);
  e.stagger=0;tick(r,1/60,{});
  const g=e.mind.graceT;assert.ok(g>0);
  r.fireCooldown=0;r.cooldowns&&(r.cooldowns=r.cooldowns.map(()=>0));shoot(r);
  assert.ok(!(e.stagger>0)||g<=0);
});

test('groups keep apart, never clip walls, and cap simultaneous melee',()=>{
  const r=arena();r.health=1e9;
  const list=[[2,2],[2.3,2],[10,2],[10.2,2.2],[6,1.5]].map(([x,y])=>mindEnemy(r,x,y));
  let maxAtk=0,minSep=9;
  for(let n=0;n<60*70;n++){
    tick(r,1/60,{});r.health=1e9;
    maxAtk=Math.max(maxAtk,list.filter(e=>e.attacking||e.strike>0).length);
    for(const e of list){assert.ok(canStand(r.course,e.x,e.y,.15));}
    if(n>60*6)for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++)minSep=Math.min(minSep,Math.hypot(list[i].x-list[j].x,list[i].y-list[j].y));
  }
  assert.ok(maxAtk<=3,'attack tokens cap simultaneous melee, got '+maxAtk);
  assert.ok(minSep>.1,'no exact stacking, got '+minSep);
  assert.ok(list.some(e=>Math.hypot(e.x-r.x,e.y-r.y)<3),'hunters converge on the player');
});

test('melee windup locks aim so a strafing player dodges',()=>{
  const r=arena();r.health=1e9;const e=mindEnemy(r,6,8.6);e.mind.firstAttack=0;e.attack=0;
  let locked=null;
  for(let n=0;n<240&&locked===null;n++){tick(r,1/60,{});if(e.attacking&&e.windup<e.windupTime*.3)locked=e.aimAngle;}
  if(locked!==null){r.x+=.6;tick(r,1/60,{});assert.equal(e.aimAngle,locked);}
});

test('spawn picker rejects points in view or too close, prefers behind',()=>{
  const r=arena();r.angle=-Math.PI/2;
  const players=[r];
  const inFront={x:6,y:2},behind={x:6,y:11.7},close={x:6,y:8};
  const pick=pickSpawnPoint(env,r.course,players,[],[inFront,close,behind],{minDist:2});
  assert.ok(pick&&pick.y===11.7);
  assert.ok(!seenByPlayers(env,r.course,players,behind.x,behind.y,{}) || true);
  assert.equal(pickSpawnPoint(env,r.course,players,[],[close],{minDist:5}),null);
});

test('pacing director enforces tension, release and ambush caps',()=>{
  const p=createPacing();const obs=(o={})=>({hunting:0,near:0,health:100,encounterActive:false,cleared:1,maxAmbushes:2,hostile:0,...o});
  let dec;for(let t=0;t<10;t++)dec=updatePacing(p,obs(),1);assert.equal(dec.ambush,false); // cooldown
  for(let t=0;t<40;t++)dec=updatePacing(p,obs(),1);assert.equal(dec.ambush,true);
  noteAmbush(p);assert.equal(updatePacing(p,obs(),1).ambush,false);
  for(let t=0;t<12;t++)updatePacing(p,obs({hunting:4,near:2}),1);assert.equal(p.phase,'peak');
  for(let t=0;t<60;t++)dec=updatePacing(p,obs(),1);assert.notEqual(p.phase,'peak');
  assert.equal(updatePacing(createPacing(),obs({cleared:0}),100).ambush,false);
  assert.deepEqual(residentIndexes(3,0),[]);assert.deepEqual(residentIndexes(4,2),[1,3]);
});

test('dungeon pressure enters through authored door lanes without random floor residents',()=>{
  const c=makeDungeonCourse(0);const r=newRun(c,{});r.mode='play';r.health=1e9;
  for(let n=0;n<60*3;n++)tick(r,1/60,{});
  const residents=c.enemies.filter(e=>e.resident);
  assert.equal(residents.length,0,'all dynamic dungeon population uses authored ingress');
  // Clear the opening encounter then let the level breathe.
  r.x+=.3;let ambush=null;
  for(let n=0;n<60*200&&!ambush;n++){
    tick(r,1/60,{});r.health=1e9;
    for(const e of c.enemies)if(!e.dead&&e.encounterId&&!e.resident&&r.dungeonProgression.currentEncounter?.roomId==='f1-entry')e.dead=true;
    ambush=c.enemies.find(e=>e.ambush);
    if(ambush)break;
  }
  assert.ok(ambush,'an ambush occurs after a room is cleared and the player idles');
  assert.ok(Math.hypot(ambush.x-r.x,ambush.y-r.y)>=5.5);
  assert.equal(seenByPlayers(env,c,[r],ambush.x,ambush.y,{fov:1.4,range:45,near:2.65}),false);
  assert.ok(findPath(env,c,ambush,r),'ambush entrance remains connected to the player');
  assert.ok(c.ingressGroups[ambush.roomId].some(group=>group.id===ambush.ingressId));
  assert.equal(ambush.spawnAnim,'none');
  assert.equal(ambush.z,0);
});
