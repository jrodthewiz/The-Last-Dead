import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHarborCourse} from '../harbor-course.js';
import {harborLocation,coastalInteriorAt} from '../harbor-navigation.js';
import {createBuildingPlan,createModel} from '../assets/blackwater-kit/architecture.js';
import {createBlackwaterMaterials} from '../assets/blackwater-kit/materials.js';
const course=()=>makeHarborCourse({openWorld:true});
const transform=(b,x,z)=>({x:(b.x+x*Math.cos(b.yaw||0)+z*Math.sin(b.yaw||0))/4,y:(b.z-x*Math.sin(b.yaw||0)+z*Math.cos(b.yaw||0))/4});

test('all 94 entrance plans stay deterministic, within their lot and outside standing portal clearance',()=>{
 const c=course();let house=0,industrial=0,commercial=0;
 for(const b of c.coastal.blackwaterSlice.buildings){
  const p=createBuildingPlan(b),e=p.entrances;assert.deepEqual(e,JSON.parse(JSON.stringify(createBuildingPlan(b).entrances)));
  if(e.theme==='residential')house++;else if(e.theme==='industrial')industrial++;else if(e.theme==='commercial')commercial++;
  assert.equal(e.additionalMaterials,0);assert.equal(e.additionalLights,0);assert.ok(e.modules.length<60);
  const keys=new Set();for(const m of e.modules){
   assert.ok([...m.position,...m.size].every(Number.isFinite));assert.ok(m.size.every(v=>v>0));
   const key=JSON.stringify([m.slot,m.position,m.size]);assert.ok(!keys.has(key));keys.add(key);
   const [x,y,z]=m.position,[w,h,d]=m.size;
   assert.ok(Math.abs(x)+w/2<=b.width/2+.001,m.role+' x');assert.ok(z-d/2>=-b.depth/2-.001,m.role+' rear');
   if(b.kind==='house')assert.ok(z+d/2<=b.depth/2+.001,m.role+' porch');
   if(y-h/2<p.door.height&&y+h/2>.40)assert.ok(x+w/2<=b.doorOffset-2||x-w/2>=b.doorOffset+2,m.role+' clear full 4m passage');
   if(m.surface==='top')assert.ok(y+h/2<=.135,'flush marking adds no standing obstacle');
  }
 }
 assert.ok(house>0&&industrial>0&&commercial>0);assert.equal(house+industrial+commercial,94);
});

test('address digits come from the actual house label and low-detail surfaces preserve the source draw budget',()=>{
 const c=course(),materials=createBlackwaterMaterials();let borrowed=0;for(const m of Object.values(materials))m.addEventListener('dispose',()=>borrowed++);
 try{for(const label of ['18 MAIN STREET','CAPE LODGE 75','HARBOR HARDWARE']){
  const b=c.coastal.blackwaterSlice.buildings.find(b=>b.label===label)||{kind:'house',width:16,depth:16,height:6.4,seed:1410,enterable:true,doorOffset:-2,label};
  const m=createModel({...b,materials});try{
   if(b.kind==='house')assert.equal(m.diagnostics.plan.entrances.address,label.match(/\d+/)[0]);
   const added=Object.entries(m.diagnostics.trianglesPerModule).filter(([r])=>r.startsWith('entry-')).reduce((s,[,n])=>s+n,0);
   assert.ok(added<500);assert.ok(m.diagnostics.drawCalls<=15);assert.ok(m.diagnostics.moduleCounts['entry-address-stencil']||m.diagnostics.moduleCounts['entry-raised-shutter-slat']);
  }finally{m.dispose();m.dispose();}
 }}finally{assert.equal(borrowed,0);materials.dispose();}
});

test('every ground floor identifies its actual address, while the porch and both outside approaches keep district labels',()=>{
 const c=course(),r={course:c,x:0,y:0};
 for(const b of c.coastal.blackwaterSlice.buildings){
  Object.assign(r,transform(b,b.doorOffset,0));assert.equal(coastalInteriorAt(r)?.id,b.id);assert.equal(harborLocation(r),b.label);
  for(const z of [-b.depth/2-1.5,b.depth/2+1.5]){Object.assign(r,transform(b,b.doorOffset,z));assert.notEqual(coastalInteriorAt(r)?.id,b.id);}
  if(b.kind==='house'){Object.assign(r,transform(b,b.doorOffset,b.depth/2-.8));assert.notEqual(coastalInteriorAt(r)?.id,b.id);}
 }
});

test('interior labels handle rotated houses, array replacement, invalid positions and existing separate room priority',()=>{
 const b={id:'rotated',label:'ROTATED HOME',kind:'house',enterable:true,width:12,depth:16,x:30,z:40,yaw:Math.PI/2};
 const c={buildings:[],coastal:{blackwaterSlice:{buildings:[b]},districts:[]}},r={course:c,...transform(b,0,0)};
 assert.equal(harborLocation(r),'ROTATED HOME');Object.assign(r,transform(b,0,7));assert.equal(coastalInteriorAt(r),null);
 c.coastal.blackwaterSlice.buildings=[{...b,label:'UPDATED HOME'}];Object.assign(r,transform(b,0,0));assert.equal(harborLocation(r),'UPDATED HOME');
 r.x=NaN;assert.equal(coastalInteriorAt(r),null);r.x=Infinity;assert.equal(coastalInteriorAt(r),null);
 c.activeInterior={name:'Separate room'};assert.equal(harborLocation(r),'Separate room');
});
