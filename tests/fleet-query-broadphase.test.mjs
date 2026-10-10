import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createVehicleFleet,createVehiclePhysicsContext} from '../harbor-vehicle-fleet.js';

// Independent pre-change scalar semantics, deliberately without broadphase.
function oldFoot(v,x,y,r,feet,height,ignore){
 for(const p of v){if(p.id===ignore)continue;const bottom=p.type==='helicopter'?p.altitudeM:(p.groundM||0);if(bottom+(p.heightM||2.8)<=feet+.02||bottom>=feet+height)continue;
  const c=Math.cos(p.angle),s=Math.sin(p.angle),dx=x-p.x,dy=y-p.y;if(Math.abs(dx*c+dy*s)<(p.halfLength||.65)+r&&Math.abs(-dx*s+dy*c)<(p.halfWidth||.3)+r)return false;
 }return true;
}
function oldRay(v,x,y,angle,max,z,slope,ignore){
 let hit=null;const dx=Math.cos(angle),dy=Math.sin(angle);
 for(const p of v){if(p.id===ignore)continue;const c=Math.cos(p.angle),s=Math.sin(p.angle),ox=(x-p.x)*c+(y-p.y)*s,oy=-(x-p.x)*s+(y-p.y)*c,vx=dx*c+dy*s,vy=-dx*s+dy*c;let near=0,far=max;
  for(const[o,d,size]of[[ox,vx,p.halfLength||.65],[oy,vy,p.halfWidth||.3]])if(Math.abs(d)<1e-10){if(Math.abs(o)>size){far=-1;break;}}else{let a=(-size-o)/d,b=(size-o)/d;if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);}
  if(far<near||far<0||near>max)continue;const dist=Math.max(.02,near),h=z+slope*dist*4,bottom=p.type==='helicopter'?p.altitudeM:(p.groundM||0);if(h<bottom||h>bottom+(p.heightM||2.8))continue;
  if(!hit||dist<hit.dist)hit={dist,side:0,u:0,obstacleId:p.id,dynamicVehicle:true};
 }return hit;
}
const course={obstacles:[]},fleet=createVehicleFleet(course,null);
fleet.vehicles=Array.from({length:18},(_,i)=>({id:'v'+i,x:10+(i%6)*4,y:10+Math.floor(i/6)*5,angle:i*.37,halfLength:.3+i*.06,halfWidth:.15+i*.02,groundM:i%3*.2,heightM:1.7+i%4*.3,type:i===17?'helicopter':'car',altitudeM:6}));
const context=createVehiclePhysicsContext(course,fleet,{canStand:()=>true,castRay:(_c,_x,_y,_a,max)=>({dist:max,side:0,u:0}),groundAt:()=>0});
const report={scope:'CPU oracle and operation counts, no native FPS claim',footComparisons:0,rayComparisons:0};
const check=(x,y,r=.12,z=.4,a=0,max=20,slope=0,ignore)=>{
 assert.equal(context.stand(x,y,r,z, .43,ignore),oldFoot(fleet.vehicles,x,y,r,z*4,1.72,ignore));report.footComparisons++;
 const expected=oldRay(fleet.vehicles,x,y,a,max,z*4,slope,ignore),actual=context.ray(x,y,a,max,z,slope,ignore);
 if(expected&&expected.dist<max)assert.deepEqual(actual,expected);else assert.deepEqual(actual,{dist:max,side:0,u:0});report.rayComparisons++;
};
test('rotated padding edges, inside rays, parallel slabs, height and self-ignore match old semantics',()=>{
 for(const v of fleet.vehicles)for(const padding of[0,.12,.4])for(const eps of[-1e-9,0,1e-9])for(const sign of[-1,1]){
  const c=Math.cos(v.angle),s=Math.sin(v.angle),dx=(v.halfLength+padding+eps)*sign,dy=v.halfWidth*.6;
  const x=v.x+dx*c-dy*s,y=v.y+dx*s+dy*c;
  for(const z of[0,.4,1.5,2.0])check(x,y,padding,z,v.angle,3,.03);
 }
 for(const v of fleet.vehicles)for(const max of[0,.01,.02,4])for(const a of[v.angle,v.angle+Math.PI/2,v.angle+1e-12]){check(v.x,v.y,.12,.4,a,max);check(v.x,v.y,.12,.4,a,max,0,v.id);}
});
test('bounded deterministic distant and intersecting queries preserve exact nearest hit and slope',()=>{
 let seed=71003;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<6000;i++)check(rand()*45,rand()*35,rand()*.3,rand()*2.5,rand()*Math.PI*2,rand()*35,(rand()-.5)*.5,i%9===0?'v'+i%18:undefined);
});
test('same-tick direct position, angle, size and height mutations update without revision',()=>{
 const v=fleet.vehicles[0],before={...v},revision=fleet.revision;
 check(v.x,v.y);v.x+=7;v.y-=2;v.angle+=.81;v.halfLength+=.5;v.halfWidth+=.2;v.groundM=3;
 check(before.x,before.y);check(v.x,v.y,.12,.4);check(v.x,v.y,.12,1);assert.equal(fleet.revision,revision);
 Object.assign(v,before);check(v.x,v.y);fleet.vehicles[17].altitudeM=0;check(fleet.vehicles[17].x,fleet.vehicles[17].y);fleet.vehicles[17].altitudeM=6;
});
test('18 distant vehicles reject all repeated foot/ray narrow phases while refreshing trig once per pose',()=>{
 const before={...fleet.diagnostics};for(let i=0;i<10701;i++)context.stand(-100,-100,.12);for(let i=0;i<153;i++)context.ray(-100,-100,.3,5,.4);
 const delta=Object.fromEntries(Object.keys(before).map(k=>[k,fleet.diagnostics[k]-before[k]]));
 assert.equal(delta.dynamicFootNarrow,0);assert.equal(delta.dynamicRayNarrow,0);assert.equal(delta.dynamicBoundsRejected,delta.dynamicCandidates);assert.equal(delta.dynamicTrigRefreshes,0);
 report.distant={queries:{feet:10701,rays:153},delta,formerEligibleNarrowChecks:delta.dynamicCandidates,formerRayAxisArrays:153*18*3};
 fs.writeFileSync('output/island-fleet-query-broadphase-census.json',JSON.stringify(report,null,2)+'\n');context.dispose();
});
