import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {propCanStand,propRay,propSegmentClear,registerImmutablePropObstacles,setPropCollisionMeasurement,propCollisionDiagnostics} from '../harbor-collision.js';
import {makeHarborCourse} from '../harbor-course.js';
import {vehicleCanStand} from '../harbor-vehicle.js';
import {newRun,tick,canStand} from '../engine.js';

const coastal=makeHarborCourse({openWorld:true});
const mutable=()=>({...coastal,obstacles:coastal.obstacles.map(b=>({...b}))});
const box=(minX=0,maxX=1,minY=0,maxY=1)=>({minX,maxX,minY,maxY});
const snapshot=r=>JSON.stringify(r,(k,v)=>k==='course'||k==='world'?undefined:v);
test('registration freezes final native authority without changing identity or values',()=>{
 assert.ok(Object.isFrozen(coastal.obstacles));assert.ok(coastal.obstacles.every(Object.isFrozen));
 assert.equal(coastal.obstacles.filter(b=>b.id?.startsWith('customs-service-stair-')).length,3);
 const array=coastal.obstacles,first=array[0],value=JSON.stringify(array);
 registerImmutablePropObstacles(coastal);
 assert.equal(coastal.obstacles,array);assert.equal(coastal.obstacles[0],first);assert.equal(JSON.stringify(array),value);
 assert.throws(()=>{array.push(box());},TypeError);assert.throws(()=>{first.minX++;},TypeError);
 console.log(JSON.stringify({indexResources:propCollisionDiagnostics(coastal)}));
});
test('failed registration validates every record before freezing anything',()=>{
 const first=box(),bad={...box(),maxX:NaN},c={coastal:{},obstacles:[first,bad]};
 assert.throws(()=>registerImmutablePropObstacles(c),TypeError);
 assert.equal(Object.isFrozen(first),false);assert.equal(Object.isFrozen(c.obstacles),false);
 for(const bad of [{...box(),minX:2},Object.defineProperty(box(),'minX',{get(){return 0;}}),{...box(),maxY:Infinity}]){
  const good=box(),c={coastal:{},obstacles:[good,bad]};assert.throws(()=>registerImmutablePropObstacles(c));assert.equal(Object.isFrozen(good),false);
 }
 const c2={coastal:{},obstacles:[box(-1e8,1e8)]};assert.throws(()=>registerImmutablePropObstacles(c2),RangeError);assert.equal(Object.isFrozen(c2.obstacles[0]),false);
});
test('dense seeded native queries, all obstacle faces/corners/tangents and unusual parameters match linear authority',()=>{
 const linear=mutable();let state=872123;
 const random=()=>((state=Math.imul(state,1664525)+1013904223>>>0)/4294967296);
 for(let i=0;i<15000;i++){
  const x=random()*116-2,y=random()*108-2,r=[0,.075,.085,.1,.16,.2,.5,1.1][i%8];
  assert.equal(propCanStand(coastal,x,y,r),propCanStand(linear,x,y,r),`seeded ${i}`);
 }
 for(const b of coastal.obstacles)for(const r of [0,.085,.16]){
  const x=(b.minX+b.maxX)/2,y=(b.minY+b.maxY)/2;
  for(const p of [[b.minX-r,y],[b.maxX+r,y],[x,b.minY-r],[x,b.maxY+r],[b.minX,b.minY],[b.maxX,b.maxY],[b.minX-r,y+1e-9],[b.maxX+r-1e-9,y]])assert.equal(propCanStand(coastal,...p,r),propCanStand(linear,...p,r));
 }
 for(const x of [NaN,Infinity,-Infinity,-1e100,1e100,10])for(const y of [NaN,Infinity,-Infinity,10])for(const r of [NaN,Infinity,-Infinity,-.2,-0,0,4,100,'0.2',null])assert.equal(propCanStand(coastal,x,y,r),propCanStand(linear,x,y,r));
});
test('mutable unregistered in-place edits and registered replacement use original linear authority',()=>{
 const c={obstacles:[box()]};assert.equal(propCanStand(c,.5,.5),false);c.obstacles[0].minX=2;assert.equal(propCanStand(c,.5,.5),true);c.obstacles.push(box());assert.equal(propCanStand(c,.5,.5),false);
 const indexed={coastal:{},obstacles:[box()]};registerImmutablePropObstacles(indexed);indexed.obstacles=[box(2,3,2,3)];
 assert.equal(propCollisionDiagnostics(indexed).registered,false);assert.equal(propCanStand(indexed,.5,.5),true);
 indexed.obstacles[0].minX=0;indexed.obstacles[0].minY=0;assert.equal(propCanStand(indexed,.5,.5),false);
 assert.equal(registerImmutablePropObstacles({obstacles:[box()]}),false);
});
test('vehicle 45-point rotated footprints, rays and navigation segments retain exact native outcomes',()=>{
 const linear=mutable(),v={halfLength:.65,halfWidth:.3};
 for(const [x,y] of [[55,15],[10.5,7],[39.5,60],[85,94],[107,95],[72,48]])for(const angle of [0,.3,Math.PI/4,Math.PI/2,Math.PI]){
  assert.equal(vehicleCanStand(coastal,v,x,y,angle,canStand),vehicleCanStand(linear,v,x,y,angle,canStand));
  assert.deepEqual(propRay(coastal,x,y,angle,20),propRay(linear,x,y,angle,20));
  assert.equal(propSegmentClear(coastal,x,y,x+Math.cos(angle)*3,y+Math.sin(angle)*3,.16),propSegmentClear(linear,x,y,x+Math.cos(angle)*3,y+Math.sin(angle)*3,.16));
 }
});
test('simulation authority parity, actual visit reduction and CPU-only tick benchmark',async()=>{
 const linear=mutable(),indexed={...coastal,enemies:[]};registerImmutablePropObstacles(indexed);
 linear.enemies=[];
 const a=newRun(linear),b=newRun(indexed);
 for(const r of [a,b])Object.assign(r,{mode:'play',health:100000,waveDelay:999,lowTide:null,vehicle:null,x:55,y:15,angle:0});
 const wa=setPropCollisionMeasurement(linear),wb=setPropCollisionMeasurement(indexed);
 for(let i=0;i<240;i++){
  const input={forward:i<120?.4:-.4,strafe:i%60<30?.1:-.1,jump:i===100};
  tick(a,1/120,input);tick(b,1/120,input);assert.equal(snapshot(a),snapshot(b),`simulation tick ${i}`);
 }
 assert.equal(wa.queries,wb.queries);assert.ok(wb.narrowVisits<wa.narrowVisits*.1,'actual movement narrow phase visits reduced over 90%');
 const visits={linear:{...wa},indexed:{...wb}};
 setPropCollisionMeasurement(linear,false);setPropCollisionMeasurement(indexed,false);
 const times={linear:[],indexed:[]};
 // Alternate run order, 120 warmup ticks each, 12 batches of 240 real updates.
 for(const r of [a,b])for(let i=0;i<120;i++)tick(r,1/120,{forward:.15});
 for(let batch=0;batch<12;batch++)for(const kind of batch%2?['indexed','linear']:['linear','indexed']){
  const run=kind==='linear'?a:b,t=performance.now();
  for(let i=0;i<240;i++)tick(run,1/120,{forward:(batch%2?-.15:.15),strafe:.05});
  times[kind].push((performance.now()-t)/240);
 }
 assert.equal(snapshot(a),snapshot(b));
 const stats=values=>{values.sort((a,b)=>a-b);return{medianMsPerTick:values[Math.floor(values.length/2)],p95MsPerTick:values[Math.floor(values.length*.95)]};};
 const report={scope:'CPU-only actual engine.tick walking, empty-enemy coastal road; no renderer/GPU/FPS measurement',obstacles:indexed.obstacles.length,parityTicks:240,visits,resources:propCollisionDiagnostics(indexed),timing:{linear:stats(times.linear),indexed:stats(times.indexed)},batches:12,ticksPerBatch:240};
 await mkdir(new URL('../output/performance/',import.meta.url),{recursive:true});await writeFile(new URL('../output/performance/harbor-collision-broadphase.json',import.meta.url),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
});
