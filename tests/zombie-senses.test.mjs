import test from 'node:test';
import assert from 'node:assert/strict';
import {createMind,stepMind,collectNoises,isHunting} from '../enemy-ai.js';
import {makeCourse,newRun,tick,addPeer} from '../engine.js';
import {makeHarborCourse} from '../harbor-course.js';
import {actorGroundAt} from '../coastal-structures.js';
import {sensedLocation} from '../zombie-behavior.js';

function fixture(variant='stalker',state='wander',id=42){
 const e={id,kind:0,variant,x:2,y:2,moveSpeed:1,dead:false,strike:0,attacking:false,seesTarget:true};
 createMind(e,{state,facing:0,firstAttack:0});e.mind.pause=999;
 const ctx={time:0,dt:1/60,alive:[e],course:{w:32,h:32,cells:Array.from({length:1024},()=>[0,0,0,0])},
  env:{canStand:()=>true,castRay:()=>({dist:100})},profile:{role:'rush',speed:1},reach:.4,
  noises:[],navBudget:4,tokens:{melee:0,maxMelee:2,ranged:0,maxRanged:2}};
 return {e,ctx};
}
function advance(f,target,frames=1){let result;for(let i=0;i<frames;i++){f.ctx.time+=f.ctx.dt;f.ctx.navBudget=4;result=stepMind(f.ctx,f.e,target);}return result;}

test('distant recognition stops, looks first, then turns and commits without an early attack',()=>{
 const f=fixture(),target={x:2+Math.cos(.7)*6,y:2+Math.sin(.7)*6};
 advance(f,target,20);
 assert.equal(f.e.state,'notice');assert.equal(f.e.motionIntent,'watch');assert.equal(f.e.moving,0);
 assert.equal(f.e.facing,0,'body holds while the head recognizes');assert(f.e.look>.25);
 assert.equal(f.e.mind.token,false);assert.equal(f.e.burst,0);assert.equal(f.e.nav.path,null);
 assert.equal(f.e.mind.sighting.confirmed,false,'uncertain sight is not a horde alarm');
 let noticeFrames=0;
 while(!isHunting(f.e)&&noticeFrames++<240){const result=advance(f,target);assert.equal(result.attackOK,false);}
 assert(isHunting(f.e));assert(noticeFrames>30);assert(f.e.moving>0);
 assert(f.e.mind.sighting.confirmed);assert(f.e.mind.firstAttack>0);
});

test('runner recognition is shorter while crawler and shambler retain their stillness',()=>{
 const times=[];
 for(const variant of ['bloodhound','skitter','stalker']){
  const f=fixture(variant);const target={x:8,y:2};let firstNotice=null,committed=null;
  for(let i=0;i<300;i++){advance(f,target);if(f.e.state==='notice'&&firstNotice===null)firstNotice=f.ctx.time;if(isHunting(f.e)){committed=f.ctx.time;break;}}
  assert(firstNotice!==null&&committed!==null);times.push(committed-firstNotice);
 }
 assert(times[0]<times[1]&&times[0]<times[2]);
});

test('breaking distant sight debounces, then searches the observed point instead of the hidden player',()=>{
 const a=fixture(),b=fixture(),seen={x:8,y:2};advance(a,seen,30);advance(b,seen,30);
 a.e.seesTarget=b.e.seesTarget=false;
 advance(a,{x:20,y:20},20);advance(b,{x:1,y:20},20);
 assert.equal(a.e.state,'notice');assert.deepEqual(a.e,b.e);
 advance(a,{x:20,y:20},25);advance(b,{x:1,y:20},25);
 assert.equal(a.e.state,'investigate');assert.deepEqual(a.e,b.e);
 assert.deepEqual(a.e.mind.lastKnown,seen);assert.equal(a.e.mind.noise.type,'lost-sight');
});

test('an alerted hunter cannot see a player behind its body and head',()=>{
 const f=fixture('stalker','stalk');f.e.mind.lastKnown={x:8,y:2};
 advance(f,{x:0,y:2});assert.equal(f.e.mind.senses.visible,false);
 assert.deepEqual(f.e.mind.lastKnown,{x:8,y:2});assert.equal(f.e.mind.sighting,null);
 assert(f.e.x>2,'moves to actual memory rather than the unseen player');
});

test('a loud unseen sound drives urgent investigation and never creates a visual sighting',()=>{
 const f=fixture('stalker','dormant');f.e.seesTarget=false;
 f.ctx.noises=[{x:4,y:2,radius:15,loud:1,type:'shot'}];const result=advance(f,{x:25,y:25});
 assert.equal(f.e.state,'investigate');assert.equal(f.e.mind.lastKnown,null);assert.equal(f.e.mind.sighting,null);
 assert(f.e.mind.noise.power>.55);assert.equal(f.e.mind.noise.type,'shot');assert(f.e.x>2);
 assert.equal(result.attackOK,false);assert(f.e.mind.aware<1);
});

test('visible prey wins over a louder distraction; lost prey can be replaced by fresh noise evidence',()=>{
 const seen=fixture('stalker','stalk');seen.ctx.noises=[{x:2,y:3,radius:15,loud:1,type:'shot'}];
 advance(seen,{x:7,y:2});assert.deepEqual(seen.e.mind.lastKnown,{x:7,y:2});assert.equal(seen.e.mind.noise,null);
 const lost=fixture('stalker','stalk');lost.e.seesTarget=false;lost.e.mind.lastKnown={x:7,y:2};
 lost.ctx.noises=[{x:2,y:4,radius:15,loud:1,type:'shot'}];advance(lost,{x:25,y:25});
 assert.equal(lost.e.state,'investigate');assert(lost.e.y>2);assert.deepEqual(lost.e.mind.lastKnown,{x:7,y:2});
});

test('uncertain distant sight does not wake a local horde before recognition completes',()=>{
 const f=fixture(),listener=fixture('stalker','dormant',43).e;listener.x=4;listener.seesTarget=false;f.ctx.alive.push(listener);
 const target={x:8,y:2};
 for(let i=0;i<35;i++){advance(f,target);stepMind(f.ctx,listener,{x:30,y:30});}
 assert.equal(listener.mind.socialPending,null);assert.equal(listener.mind.aware,0);
 for(let i=0;i<200&&listener.mind.aware<1;i++){advance(f,target);stepMind(f.ctx,listener,{x:30,y:30});}
 assert.equal(listener.mind.aware,1);assert.equal(listener.mind.sighting.hops,1);
});

test('quiet walking is local, sprint footsteps are stronger, and co-op shots survive event-array reuse',()=>{
 const r={x:2,y:2,z:0,health:100,speed:1,time:0,events:[],peer:{x:8,y:8,z:0,health:100,speed:0,events:[{type:'shot',x:8,y:8}]}};
 const first=collectNoises(r);assert(first.some(n=>n.type==='shot'&&n.x===8));
 const quiet=first.find(n=>n.type==='steps');assert(quiet&&quiet.radius<2);
 assert.equal(collectNoises(r).length,0,'neither events nor footfalls repeat in the same instant');
 r.peer.events.length=0;r.peer.events.push({type:'shot',x:9,y:8});
 assert(collectNoises(r).some(n=>n.type==='shot'&&n.x===9));
 r.speed=3;r.time=1;const loud=collectNoises(r).find(n=>n.type==='steps');assert(loud.radius>quiet.radius&&loud.loud>quiet.loud);
 r.z=.5;r.time=2;assert(!collectNoises(r).some(n=>n.type==='steps'),'airborne players do not make ground footfalls');
});

test('occlusion attenuates sound and a completed search clears stale certainty',()=>{
 const open=fixture('stalker','dormant'),blocked=fixture('stalker','dormant');
 for(const f of [open,blocked]){f.e.seesTarget=false;f.ctx.noises=[{x:6,y:2,radius:10,loud:.4,type:'steps'}];}
 blocked.ctx.env.castRay=()=>({dist:.1});advance(open,{x:30,y:30});advance(blocked,{x:30,y:30});
 assert(open.e.mind.noise);assert.equal(blocked.e.mind.noise,null);
 const f=fixture('stalker','investigate');f.e.seesTarget=false;f.e.mind.noise={x:2,y:2,t:0};f.e.mind.lastKnown={x:2,y:2};
 advance(f,{x:30,y:30},300);assert.equal(f.e.state,'wander');assert.equal(f.e.mind.lastKnown,null);assert(f.e.aware<.3);
});

test('recognition and sensory decisions survive a host snapshot at 30/60/120 Hz',()=>{
 for(const hz of [30,60,120]){
  const f=fixture();f.ctx.dt=1/hz;const target={x:8,y:2};advance(f,target,Math.round(hz*.5));
  const copy=JSON.parse(JSON.stringify(f.e));Object.defineProperty(copy,'nav',{value:structuredClone(f.e.nav),writable:true,configurable:true});
  const replay=fixture();replay.e=copy;replay.ctx.dt=f.ctx.dt;replay.ctx.time=f.ctx.time;replay.ctx.alive=[copy];
  for(let i=0;i<hz*3;i++){advance(f,target);advance(replay,target);assert.deepEqual(JSON.parse(JSON.stringify(f.e)),JSON.parse(JSON.stringify(copy)));}
  assert(isHunting(f.e));
 }
});

test('the authoritative co-op tick notices a visible farther player over a nearer player behind it',()=>{
 const r=newRun(makeCourse());r.mode='play';r.wave=3;r.waveDelay=999;r.x=6;r.y=9;
 const p=addPeer(r);p.x=6;p.y=4;
 const e={id:42,kind:0,variant:'stalker',x:6,y:6,z:0,hp:100,maxHp:100,attack:99,phase:0,flash:0,moveSpeed:.4,dead:false};
 createMind(e,{state:'wander',facing:Math.PI/2});e.mind.pause=999;r.course.enemies=[e];
 tick(r,1/60,{});
 assert(e.mind.senses.visible);assert.equal(e.mind.sighting.key,'host');
 assert.deepEqual(e.mind.lastKnown,{x:6,y:9,z:0});
});

test('floor observations survive sight, sound and memory while stair motion keeps the mind advancing',()=>{
 const course=makeHarborCourse({openWorld:true});course.enemies=[];course.harbor=false;
 const structure=course.coastal.structures.find(s=>s.id==='coast-lot-4-0-0-0');assert(structure);
 const path=structure.stairPath,from=path[0],to=path.at(-1);
 const r=newRun(course);r.mode='play';r.waveDelay=999;r.lowTide=null;r.vehicle=null;
 // Stay outside the house and out of sight; the zombie has only the earlier
 // upstairs observation, not the player's current location.
 Object.assign(r,{x:6,y:6,z:0,vx:0,vy:0,vz:0});
 const e={id:42,kind:0,variant:'stalker',x:from.x,y:from.y,z:0,supportZ:from.z,groundZ:from.z,structureId:structure.id,
  hp:100,maxHp:100,attack:99,phase:0,flash:0,moveSpeed:.8,dead:false};
 createMind(e,{state:'stalk',facing:Math.atan2(to.y-from.y,to.x-from.x)});
 const observed={x:to.x,y:to.y,z:0,supportZ:to.z,structureId:structure.id};e.mind.lastKnown=sensedLocation(observed);course.enemies=[e];
 const start={x:e.x,y:e.y};let highest=from.z,walked=false;
 for(let i=0;i<600&&highest<to.z-.025;i++){
  tick(r,1/120,{});highest=Math.max(highest,actorGroundAt(course,e));walked ||= e.moving>0;
  assert.equal(e.mind.senses.visible,false);assert.deepEqual(e.mind.lastKnown,observed);
 }
 assert(highest>=to.z-.03,`actual support climbs both flights to the observed floor: ${highest}`);
 assert(walked);assert(e.mind.t>1,'stairs do not freeze perception/state clocks');
 assert(Math.hypot(e.x-start.x,e.y-start.y)>.3);assert(e.lookPitch===0);
 const noisy={...observed,health:100,speed:1,time:0,events:[{type:'shot',x:to.x,y:to.y}]};
 const sound=collectNoises(noisy).find(n=>n.type==='shot');
 assert.equal(sound.supportZ,to.z);assert.equal(sound.structureId,structure.id);
 assert(collectNoises({...noisy,time:1,events:[]}).some(n=>n.type==='steps'),'upstairs walking uses height above support, not absolute world height');
 const f=fixture();f.e.x=to.x-3;f.e.y=to.y;advance(f,observed);assert.deepEqual(f.e.mind.lastKnown,observed);
 assert(f.e.lookPitch>0,'visible upstairs observation raises attention');
});
