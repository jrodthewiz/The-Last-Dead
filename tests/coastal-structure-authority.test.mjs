import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHarborCourse} from '../harbor-course.js';
import {newRun,tickPlayer,tick,eye,canStand,shoot} from '../engine.js';
import {actorGroundAt,supportAt,traceStructureSegment,STRUCTURE_BODY_HEIGHT} from '../coastal-structures.js';

const setup=()=>{
 const course=makeHarborCourse({openWorld:true});course.enemies=[];
 const structure=course.coastal.structures.find(p=>p.id==='coast-lot-4-0-0-0');assert.ok(structure);
 const run=newRun(course);run.mode='play';run.waveDelay=999;run.lowTide=null;run.vehicle=null;
 return{course,structure,run};
};
const pose=(run,p)=>Object.assign(run,{x:p.x,y:p.y,z:0,vx:0,vy:0,vz:0,supportZ:p.z,supportId:null,structureId:'coast-lot-4-0-0-0',_supportX:p.x,_supportY:p.y});
function walk(run,points,{forward=1,dash=false}={}){
 const trace=[];
 for(const target of points){
  let reached=false;
  for(let frame=0;frame<1800;frame++){
   const distance=Math.hypot(target.x-run.x,target.y-run.y);
   if(distance<.027&&Math.abs(actorGroundAt(run.course,run)-target.z)<.06){reached=true;break;}
   run.angle=Math.atan2(target.y-run.y,target.x-run.x);
   tickPlayer(run,1/120,{forward,dash:dash&&frame===0});
   assert.ok(Number.isFinite(eye(run)));assert.equal(run.course.activeInterior??null,null);
   if(frame%15===0)trace.push({x:run.x,y:run.y,z:actorGroundAt(run.course,run)+run.z});
  }
  assert.ok(reached,`actual input stuck toward ${JSON.stringify(target)} at ${JSON.stringify({x:run.x,y:run.y,z:actorGroundAt(run.course,run)+run.z,support:run.supportId,vx:run.vx,vy:run.vy})}`);
 }
 return trace;
}

test('real forward input enters, climbs both flights, crosses upstairs, descends and exits without teleport',()=>{
 const {run,structure}=setup(),path=structure.stairPath;assert.ok(path.length>14);
 pose(run,{x:158/4,y:237/4,z:0});run.structureId=null;
 const trace=walk(run,[{x:158/4,y:241.6/4,z:.05},...path]);
  assert.ok(actorGroundAt(run.course,run)>.65);assert.equal(run.z,0);
  assert.ok(trace.some(p=>p.z>.3&&p.z<.5),'actual movement visits intermediate stair/landing heights');
  walk(run,[{x:158/4,y:252.5/4,z:.661875}]);
  assert.ok(actorGroundAt(run.course,run)-.661875<.005,'the upstairs bedroom rug is a reachable thin floor surface');
  walk(run,[{x:160.35/4,y:252.5/4,z:.661875},{x:160.35/4,y:253.7/4,z:.661875},
   {x:160.35/4,y:252.5/4,z:.661875},{x:156.25/4,y:252.5/4,z:.661875},{x:158/4,y:252.5/4,z:.661875}]);
  walk(run,[path.at(-1)]);
 walk(run,[...path].reverse());walk(run,[{x:158/4,y:241.6/4,z:.05},{x:158/4,y:237/4,z:0}]);
 assert.ok(Math.abs(actorGroundAt(run.course,run))<1e-7);assert.equal(run.course.activeInterior??null,null);
});

test('stationary support cannot ratchet across radius-overlapped stairs; actors can share X/Y on separate floors',()=>{
 const {run,course,structure}=setup();
 for(const tread of structure.solids.filter(s=>s.kind==='tread')){
  const p={x:(tread.minX+tread.maxX)/2,y:(tread.minY+tread.maxY)/2,z:tread.maxZ};pose(run,p);
  for(let i=0;i<120;i++)tickPlayer(run,1/120,{});
  assert.ok(Math.abs(actorGroundAt(course,run)+run.z-p.z)<.005,'feet remain within two centimetres of real tread top');
 }
 const lower={x:158/4,y:248/4,z:0,supportZ:.05,structureId:structure.id},upper={...lower,supportZ:.661875};
 assert.ok(canStand(course,lower.x,lower.y,.1,actorGroundAt(course,lower)));
 assert.ok(canStand(course,upper.x,upper.y,.1,actorGroundAt(course,upper)));
 assert.ok(actorGroundAt(course,upper)-actorGroundAt(course,lower)>.6);
  assert.equal(supportAt(course,lower.x,lower.y,.05).height,.05);
  const first=structure.solids.find(s=>s.id==='cape75-lower-tread-1');
  pose(run,{x:(first.minX+first.maxX)/2,y:(first.minY+first.maxY)/2,z:.661875});
  for(let i=0;i<300;i++)tickPlayer(run,1/120,{});
  assert.ok(Math.abs(actorGroundAt(course,run)+run.z-first.maxZ)<1e-6,'a player dropped through the real slab opening lands on the lower tread');
});

test('actual jump hits the slab underside and rifle, shotgun and rocket contacts share finite slab authority',()=>{
 const {run,course,structure}=setup();pose(run,{x:158/4,y:248/4,z:.05});
 const slab=structure.solids.find(s=>s.kind==='slab'&&run.x>=s.minX&&run.x<=s.maxX&&run.y>=s.minY&&run.y<=s.maxY);assert.ok(slab);
 let maxHead=0;for(let i=0;i<150;i++){tickPlayer(run,1/120,{jump:i===0});maxHead=Math.max(maxHead,actorGroundAt(course,run)+run.z+STRUCTURE_BODY_HEIGHT);}
 assert.ok(maxHead<=slab.minZ+1e-6);assert.ok(maxHead>slab.minZ-.02);assert.equal(run.z,0);
 for(const weapon of [4,1]){
  run.weapon=weapon;run.cooldowns[weapon]=0;run.pitch=1.20;run.angle=0;run.tracers=[];
  assert.equal(shoot(run),true);assert.ok(run.tracers.length);
  for(const ray of run.tracers){assert.equal(ray.surface,'floor');assert.ok(Math.abs(ray.tz-slab.minZ)<1e-6);assert.equal(ray.normal.z,-1);}
 }
 run.weapon=3;run.cooldowns[3]=0;assert.equal(shoot(run),true);const rocket=run.projectiles.at(-1);
 for(let i=0;i<120&&rocket.life>0;i++)tick(run,1/120,{});
 assert.ok(rocket.life<=0);assert.ok(Math.abs(rocket.z-slab.minZ)<1e-6);
 const opening=structure.stairPath.find(p=>p.z>.30&&p.z<.4);
 assert.equal(traceStructureSegment(course,{x:opening.x,y:opening.y,z:slab.minZ-.01},{x:opening.x,y:opening.y,z:slab.maxZ+.01}),null,'actual opening passes a short slab-height segment');
});

test('dash and diagonal input remain bounded through both flights and their turning landing',()=>{
 const {run,structure}=setup();pose(run,structure.stairPath[0]);
 walk(run,structure.stairPath,{dash:true});assert.ok(actorGroundAt(run.course,run)>.65);
 walk(run,[...structure.stairPath].reverse(),{dash:true});assert.ok(Math.abs(actorGroundAt(run.course,run)-.05)<1e-6);
});

const enemyAt=(p,structure)=>({id:991,x:p.x,y:p.y,z:0,groundZ:p.z,supportZ:p.z,structureId:structure.id,meleeZ:0,hp:100,maxHp:100,kind:0,variant:'stalker',phase:0,attack:100,flash:0,strike:0,stagger:0,biteCooldown:100,moveSpeed:.4,state:'hunt',dead:false,mind:null});
test('existing enemy movement climbs and descends the shared stair links instead of snapping to terrain',()=>{
 const {run,structure,course}=setup();course.harbor=false;
 const e=enemyAt({x:158/4,y:237/4,z:0},structure);e.supportZ=null;e.structureId=null;course.enemies=[e];pose(run,structure.stairPath.at(-1));
 for(let i=0;i<4800&&e.groundZ<.65;i++)tick(run,1/120,{});
 assert.ok(e.groundZ>.65,`enemy stuck downstairs: ${JSON.stringify({x:e.x,y:e.y,base:e.groundZ,index:e.stairIndex})}`);
 pose(run,structure.stairPath[0]);
 for(let i=0;i<4800&&e.groundZ>.07;i++)tick(run,1/120,{});
 assert.ok(e.groundZ<.07,`enemy stuck upstairs: ${JSON.stringify({x:e.x,y:e.y,base:e.groundZ,index:e.stairIndex})}`);
});

test('blood, pools, detached limbs and loose gore retain separate floors and blasts cannot cross a slab',()=>{
 const {run,structure,course}=setup();course.harbor=false;pose(run,{x:158/4,y:248/4,z:.05});
 const heights=[.05,.661875];run.blood=heights.map((z,i)=>({id:i+1,x:run.x,y:run.y,z,size:.1}));
 run.pools=heights.map((z,i)=>({id:i+10,x:run.x+.15,y:run.y,z,life:10,pulse:0,radius:.1,damage:0}));
 run.gore=heights.map((z,i)=>({id:i+20,x:run.x,y:run.y,z:z+.15,vx:0,vy:0,vz:-4,life:10,size:.02}));
 run.limbs=heights.map((z,i)=>({id:i+30,x:run.x+.2,y:run.y,z:z+.15,vx:0,vy:0,vz:-4,life:10,kind:'arm',spin:0,rest:false}));
 for(let i=0;i<120;i++)tick(run,1/120,{});
 for(const collection of [run.blood,run.pools,run.gore,run.limbs])for(let i=0;i<2;i++)assert.ok(Math.abs(collection[i].z-heights[i])<.003,'floor-specific deposited effects stay within 12mm');
 const e=enemyAt({x:run.x,y:run.y,z:heights[1]},structure);course.enemies=[e];run.weapon=3;run.cooldowns[3]=0;run.angle=0;run.pitch=1.20;
 assert.equal(shoot(run),true);const rocket=run.projectiles.at(-1);for(let i=0;i<120&&rocket.life>0;i++)tick(run,1/120,{});
 assert.equal(e.hp,100,'the intermediate slab blocks an otherwise in-range blast');
});
