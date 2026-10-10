import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeBlackwaterDistrict} from '../blackwater-district-layout.js';
import {makeCoastalNeighborhoods} from '../coastal-neighborhood-layout.js';
import {createBuildingPlan,createModel} from '../assets/blackwater-kit/architecture.js';
import {createBlackwaterMaterials} from '../assets/blackwater-kit/materials.js';
import {compileCape75Structure,solidBounds} from '../assets/blackwater-kit/cape75-structure.js';
import {getCottageDiscovery} from '../assets/blackwater-kit/cottage-authored.js';
import {serializeStructure,supportAt,canStandStructure,traceStructureSegment} from '../coastal-structures.js';

const cottage=()=>makeBlackwaterDistrict(makeCoastalNeighborhoods()).buildings.find(b=>b.label==='CAPE LODGE 75');
const hit=(model,origin,direction,far=20)=>new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(...direction),0,far).intersectObject(model.root,true)[0];
const intersects=(a,b)=>a.min.every((v,i)=>v<b.max[i]-1e-7&&a.max[i]>b.min[i]+1e-7);
const horizontalDistance=(bounds,x,z)=>Math.hypot(Math.max(bounds.min[0]-x,0,x-bounds.max[0]),Math.max(bounds.min[2]-z,0,z-bounds.max[2]));
const toCourse=(building,p)=>{const c=Math.cos(building.yaw||0),s=Math.sin(building.yaw||0);return{x:(building.x+p[0]*c+p[2]*s)/4,y:(building.z-p[0]*s+p[2]*c)/4,z:((building.y??.13)+p[1])/4};};

test('only Cape75 has a deterministic, serializable finite two-storey plan',()=>{
 const buildings=makeBlackwaterDistrict(makeCoastalNeighborhoods()).buildings;
 const plans=buildings.map(b=>createBuildingPlan(b)).filter(p=>p.structure);
 assert.equal(plans.length,1);assert.equal(plans[0].settings.label,'CAPE LODGE 75');
 const p=plans[0],s=p.structure;
 assert.equal(s.coordinateSystem,'local-three-metres');assert.deepEqual(JSON.parse(JSON.stringify(s)),s);
 assert.deepEqual(createBuildingPlan(cottage()).structure,s);
 assert.deepEqual(createBuildingPlan({...cottage(),seed:1043}).structure,s,'structural travel does not vary with cloth seed');
 assert.deepEqual(s.diagnostics.duplicateIds,[]);
 const ids=new Set();
 for(const solid of s.solids){
  assert.ok(!ids.has(solid.id));ids.add(solid.id);
  assert.ok(solid.position.every(Number.isFinite)&&solid.size.every(v=>Number.isFinite(v)&&v>0),solid.id);
  assert.equal(typeof solid.support,'boolean');
  assert.equal(solid.support,['floor','slab','tread','landing'].includes(solid.kind)||solid.id==='cape75-upper-bedroom-rug',`${solid.id}: support ownership is explicit`);
 }
 assert.equal(s.solids.filter(s=>s.kind==='lower-furniture').length,12);
 assert.equal(s.solids.some(s=>s.furnitureId==='room-partition-0'),false,'the obsolete divider is absent from finite gameplay');
 const discovery=getCottageDiscovery(p.settings),dresser=s.solids.find(s=>s.furnitureId===discovery.supportId),desk=s.solids.find(s=>s.furnitureId==='resident-work-station');
 assert.deepEqual(desk.position,[-4.05,.51,4.75]);assert.deepEqual(discovery.position,[-3.55,1.11,-1.30]);
 assert.ok(dresser.render===false,'detailed lower furnishings retain their authored meshes');
});

test('rendered structure comes from finite boxes and explicitly linked sloped grips, with no sealed replacement slab',()=>{
 const model=createModel(cottage()),s=model.diagnostics.plan.structure;
 try{
  const compiled=[];compileCape75Structure({box:(slot,position,size,rotation,role)=>compiled.push({slot,position,size,rotation,role})},s);
  assert.deepEqual(compiled,[...s.solids.filter(s=>s.render!==false).map(s=>({slot:s.slot,position:s.position,size:s.size,rotation:[0,0,0],role:`cape75-structure-${s.kind}`})),...s.railGrips.map(g=>({slot:g.slot,position:g.position,size:g.size,rotation:g.rotation,role:'cape75-structure-rail-grip'}))]);
  const actualTriangles=Object.entries(model.diagnostics.trianglesPerModule).filter(([role])=>role.startsWith('cape75-structure-')).reduce((n,[,tris])=>n+tris,0);
  assert.equal(actualTriangles,s.diagnostics.renderedTriangles);
  assert.equal(model.diagnostics.moduleCounts['sealed-house-ground-floor-ceiling'],undefined);
  assert.equal(model.diagnostics.moduleCounts['walkable-living-wood-floor'],undefined);
  assert.equal(model.diagnostics.moduleCounts['walkable-kitchen-linoleum-floor'],undefined);
  assert.equal(model.diagnostics.moduleCounts['wall-infill'],undefined,'the original opaque facade boxes are replaced');
  model.root.updateMatrixWorld(true);
  for(const solid of s.solids.filter(s=>s.support)){
   // Probe bare floor next to the thin woven center runner, not its finish.
   const b=solidBounds(solid),origin=[solid.kind==='floor'?1.10:solid.position[0],b.max[1]+.025,solid.position[2]],rendered=hit(model,origin,[0,-1,0],.05);
   assert.ok(rendered,`${solid.id} has a rendered support top`);
   assert.ok(Math.abs(rendered.point.y-b.max[1])<2e-5,`${solid.id} mesh and finite support top agree`);
  }
 }finally{model.dispose();}
});

test('two continuous flights fit player and enemy, with a real upper slab opening and standing headroom',()=>{
 const s=createBuildingPlan(cottage()).structure,{stairs,opening}=s,treads=s.solids.filter(s=>s.kind==='tread');
 assert.equal(treads.length,14);assert.ok(stairs.rise<=.18);assert.ok(stairs.run>=.26);assert.ok(stairs.clearWidth>=1.60);
 const ordered=[...treads].sort((a,b)=>solidBounds(a).max[1]-solidBounds(b).max[1]);
 let previous=s.floors[0].top;
 for(const tread of ordered){const top=solidBounds(tread).max[1];assert.ok(Math.abs(top-previous-stairs.rise)<1e-10);previous=top;}
 assert.ok(Math.abs(previous-s.floors[1].top)<1e-10);
 assert.ok(Math.abs(previous+.13-2.6475)<1e-10,'world support height uses the agreed .13m building root');
 const slabs=s.solids.filter(s=>s.kind==='slab');
 const hole={min:[opening.x[0],opening.bottom,opening.z[0]],max:[opening.x[1],opening.top,opening.z[1]]};
 for(const slab of slabs)assert.equal(intersects(solidBounds(slab),hole),false,`${slab.id} leaves the stair opening genuinely empty`);
 // This is a volume/headroom check, not a centerline-only screenshot claim.
 // The full enemy radius is reserved around every prescribed travel point.
 for(const point of s.stairPath){
  const [x,feet,z]=point;
  for(const solid of s.solids){
   const b=solidBounds(solid);
   if(horizontalDistance(b,x,z)>=.64-1e-7)continue;
   if(b.min[1]>=feet-.00001&&b.max[1]>feet+.18&&solid.kind!=='tread'){
    assert.ok(b.min[1]-feet>=1.85-1e-7,`${solid.id} violates headroom at ${point}`);
   }
  }
 }
 const landing=s.solids.find(s=>s.kind==='landing'),bounds=solidBounds(landing);
 assert.ok(bounds.max[2]-bounds.min[2]>=1.60&&bounds.max[0]-bounds.min[0]>=3.46);
 for(const x of [-2.88,-4.58])assert.ok(horizontalDistance(bounds,x,.15)===0);
 // Rails, including caps, cannot steal the nominal 1.60m clear tread width.
 for(const tread of treads){const tb=solidBounds(tread);for(const rail of s.solids.filter(s=>s.kind==='rail')){
  const rb=solidBounds(rail);
  if(rb.min[1]<=tb.max[1]+.01&&rb.max[1]>=tb.max[1]+.1&&rb.min[2]<tb.max[2]&&rb.max[2]>tb.min[2])assert.equal(intersects({min:[tb.min[0],tb.max[1]+.01,tb.min[2]],max:[tb.max[0],tb.max[1]+.90,tb.max[2]]},rb),false,`${rail.id} invades tread width`);
 }}
});

test('ground-floor through-route and repair approach stay clear while upper exterior portals are closed',()=>{
 const p=createBuildingPlan(cottage()),s=p.structure,model=createModel(cottage());
 try{
  model.root.updateMatrixWorld(true);
  for(const x of [-1.90,-.60,0,.60,1.90])for(const y of [.20,1.40,2.10])assert.equal(hit(model,[x,y,9],[0,0,-1],18),undefined,`4m rendered ground portal at ${x},${y}`);
  for(const solid of s.solids){
   const b=solidBounds(solid);
   if(b.max[1]<=.15||b.min[1]>=2.305)continue;
   const route={min:[-2,.15,-7.5],max:[2,2.10,6.20]};
   assert.equal(intersects(b,route),false,`${solid.id} intrudes into the lower 4m passage`);
  }
  for(const direction of [-1,1])for(const x of [-1.90,-.60,0,.60,1.90]){
   const upperHit=hit(model,[x,3.30,direction*9],[0,0,-direction],4);
   assert.ok(upperHit,`upper exterior closes the lower doorway at x${x}, side${direction}`);
  }
  const d=getCottageDiscovery(p.settings);
  for(const solid of s.solids){const b=solidBounds(solid);if(b.max[1]<=.07||b.min[1]>=.07+1.84)continue;assert.ok(horizontalDistance(b,...d.approach)>=.64-1e-7,`${solid.id} blocks the repair-kit standing approach`);}
  const floorHit=hit(model,[d.position[0],d.position[1]+.04,d.position[2]],[0,-1,0],.07);
  assert.ok(floorHit&&Math.abs(floorHit.point.y-d.position[1])<2e-5,'the repair kit still sits on the actual dresser top');
  const room=s.rooms.find(r=>r.id==='upper-lodger-bedroom');
  assert.ok(hit(model,[0,room.floor+.04,-5],[0,-1,0],.10),'upper room has a floor below its usable central space');
  assert.equal(hit(model,[0,room.floor+.90,-1],[0,0,-1],2),undefined,'upper room has a real open internal doorway');
 }finally{model.dispose();}
});

test('existing enemy radius has a real circular lateral entry beside the unchanged radio desk',()=>{
 const p=createBuildingPlan(cottage()),s=p.structure,[start,end]=s.stairPath,radius=.64,feet=.07,height=1.84;
 assert.deepEqual(start,[-1.30,feet,3.50]);assert.deepEqual(end,[-2.88,feet,3.50]);
 const firstRails=s.solids.filter(s=>s.kind==='rail'&&s.starter);
 assert.equal(firstRails.length,8,'two four-piece starter newels');
 for(const rail of firstRails)assert.ok(solidBounds(rail).max[2]<=2.84+1e-10,'the actual first rail and its cap return behind the starter tread');
 for(const rail of s.solids.filter(s=>s.kind==='rail'&&s.flight==='lower'))assert.ok(solidBounds(rail).max[2]<=2.84+1e-10,'the continuous grip proxies also stay behind the starter return');
 const obstacles=s.solids.filter(s=>!s.support).filter(s=>{const b=solidBounds(s);return b.max[1]>feet&&b.min[1]<feet+height;});
 let minimum=Infinity;
 for(let fraction=0;fraction<=1;fraction+=.01){
  const x=start[0]+(end[0]-start[0])*fraction,z=start[2];
  for(const solid of obstacles){
   const distance=horizontalDistance(solidBounds(solid),x,z);minimum=Math.min(minimum,distance);
   assert.ok(distance>=radius+.015,`${solid.id} blocks the expanded circular approach at ${x},${z}`);
  }
 }
 assert.ok(minimum>=.659&&minimum<=.661,'the desk and returned rail leave the verified physical .66m approach margin');
 const desk=s.solids.find(s=>s.furnitureId==='resident-work-station');assert.deepEqual(desk.position,[-4.05,.51,4.75]);
 const starter=s.solids.find(s=>s.id==='cape75-lower-tread-1');assert.deepEqual(starter.size,[1.60,s.stairs.rise,.30],'the solid starter tread remains intact');
});

test('the physical 13mm bedroom rug is a reachable support rather than a foot-level obstruction',()=>{
 const building=cottage(),p=createBuildingPlan(building),s=p.structure,rug=s.solids.find(s=>s.id==='cape75-upper-bedroom-rug'),b=solidBounds(rug);
 assert.equal(rug.kind,'finish');assert.equal(rug.support,true);
 assert.ok(Math.abs(b.max[1]-s.floors[1].top-.013)<1e-10,'rug mesh retains its real 13mm raised top');
 const serialized=serializeStructure(building,p),course={coastal:{structures:[serialized]}},solid=serialized.solids.find(s=>s.id===rug.id),floor=(.13+s.floors[1].top)/4;
 const x=(solid.minX+solid.maxX)/2,y=(solid.minY+solid.maxY)/2;
 const support=supportAt(course,x,y,floor,{radius:.10});
 assert.equal(support.id,rug.id);assert.ok(Math.abs(support.height-floor-.013/4)<1e-10);
 for(const radius of [.10,.16]){
  assert.equal(canStandStructure(course,x,y,radius,floor),true,'the ordinary bounded step accepts the raised rug without shrinking actor radius');
  assert.equal(canStandStructure(course,x,y,radius,support.height),true,'the actor stands on the actual rug top');
 }
});

test('open baluster gaps pass visible and finite shot rays while each slender post remains solid',()=>{
 const building=cottage(),p=createBuildingPlan(building),s=p.structure,model=createModel(building),serialized=serializeStructure(building,p),course={coastal:{structures:[serialized]}};
 const probes=[];
 for(const flight of s.stairs.flights)for(const sign of [-1,1]){
  const shafts=s.solids.filter(v=>v.kind==='rail'&&v.flight===flight.id&&v.guardId===`cape75-${flight.id}-${sign}`&&v.id.endsWith('-shaft')).sort((a,b)=>a.position[2]-b.position[2]);
  const a=shafts[2],b=shafts[3],z=(a.position[2]+b.position[2])/2,y=Math.max(solidBounds(a).min[1],solidBounds(b).min[1])+.30;
  probes.push({id:`${flight.id}-${sign}`,from:[flight.x,y,z],to:[a.position[0]+sign*.023,y,z],post:a,sign});
 }
 for(const id of ['landing-rear-guard','upper-opening-inner-guard','upper-opening-rear-guard','upper-opening-front-guard']){
  const shafts=s.solids.filter(v=>v.guardId===`cape75-${id}`&&v.id.endsWith('-shaft')),a=shafts[2],b=shafts[3],axis=id.includes('inner')?0:2,p=a.position.map((v,i)=>(v+b.position[i])/2),from=[...p],to=[...p];
  from[axis]+=.22;to[axis]-=.22;probes.push({id,from,to,post:a,axis});
 }
 try{
  model.root.updateMatrixWorld(true);
  assert.equal(probes.length,8);
  for(const probe of probes){
   const d=new THREE.Vector3(...probe.to).sub(new THREE.Vector3(...probe.from)),length=d.length();
   assert.equal(hit(model,probe.from,d.normalize().toArray(),length),undefined,`${probe.id}: authored mesh leaves a real shot gap`);
   assert.equal(traceStructureSegment(course,toCourse(building,probe.from),toCourse(building,probe.to)),null,`${probe.id}: finite collision leaves the same shot gap`);
   const axis=probe.axis??0,from=[...probe.post.position],to=[...probe.post.position];
   if(probe.sign){from[axis]-=probe.sign*.10;to[axis]+=probe.sign*.023;}else{from[axis]+=.18;to[axis]-=.18;}
   const obstruction=traceStructureSegment(course,toCourse(building,from),toCourse(building,to));
   assert.ok(obstruction&&obstruction.solidId===probe.post.id,`${probe.id}: the baluster is physically solid`);
  }
 }finally{model.dispose();}
});

test('continuous sloped grips own only thin finite proxy slices with less than 3cm corner slack',()=>{
 const s=createBuildingPlan(cottage()).structure;
 assert.equal(s.railGrips.length,4);
 const rotationAxis=new THREE.Vector3(1,0,0);
 for(const grip of s.railGrips){
  const proxies=s.solids.filter(v=>v.visibleGripId===grip.id);
  assert.ok(proxies.length>=29,'long slope never uses a single enclosing wall');
  let previous=0;
  for(const proxy of proxies){
   assert.equal(proxy.render,false);assert.equal(proxy.kind,'rail');assert.equal(proxy.support,false);
   assert.ok(Math.abs(proxy.segment[0]-previous)<1e-12,'slope proxy intervals are contiguous');previous=proxy.segment[1];
   assert.ok(proxy.horizontalSpan<=.05+1e-12&&proxy.size[2]<=.10,'every collision slice stays below 10cm horizontal extent');
   for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
    const p=new THREE.Vector3(x*proxy.size[0]/2,y*proxy.size[1]/2,z*proxy.size[2]/2).applyAxisAngle(rotationAxis,-grip.rotation[0]);
    const distance=Math.hypot(Math.max(0,Math.abs(p.y)-grip.size[1]/2),Math.max(0,Math.abs(p.z)-grip.size[2]/proxies.length/2));
    assert.ok(distance<=.030,`${proxy.id}: AABB corner slack ${distance} exceeds 3cm`);
   }
  }
  assert.ok(Math.abs(previous-1)<1e-12,'all of the visible slope is owned by finite collision');
 }
 const panels=s.solids.filter(v=>v.kind==='rail'&&v.size[1]>.30&&Math.max(v.size[0],v.size[2])>.12);
 assert.deepEqual(panels,[],'no full-height guard panel survives behind the open balustrade');
});

test('every existing upper bay gets interior construction depth and exactly one evacuation sash',()=>{
 const s=createBuildingPlan(cottage()).structure;
 assert.equal(s.upperWindows.length,18);
 assert.equal(s.upperWindows.filter(b=>b.variant==='evacuated-sash').length,1);
 for(const bay of s.upperWindows){
  const glass=s.solids.find(v=>v.id===bay.closedGlassId),frame=s.solids.filter(v=>v.id.startsWith(`${bay.id}-interior-`));
  assert.equal(glass.kind,'window');assert.equal(glass.slot,'glass');assert.notEqual(glass.render,false);
  assert.equal(frame.length,7,`${bay.id}: jamb pair/header/projecting sill/apron/mullion/sash`);
  assert.ok(frame.every(v=>v.kind==='window-frame'&&v.support===false));
  const axis=['front','back'].includes(bay.side)?2:0,sill=frame.find(v=>v.id.endsWith('-interior-sill'));
  assert.ok(sill.size[axis]>=.15,'the sill has real construction depth');
  assert.ok(Math.abs(sill.position[axis]-glass.position[axis])>.04,'the sill is offset from the closed pane');
 }
});

test('finite upper structure retains material batching, a bounded triangle cost and disposal ownership',()=>{
 const source=cottage(),shared=createBlackwaterMaterials({loadTextures:false});let borrowedDisposals=0;
 for(const m of Object.values(shared))m.addEventListener('dispose',()=>borrowedDisposals++);
 const model=createModel({...source,materials:shared});let geometryDisposals=0;
 const meshes=model.root.children.filter(c=>c.isMesh);
 for(const mesh of meshes)mesh.geometry.addEventListener('dispose',()=>geometryDisposals++);
 try{
  assert.ok(model.diagnostics.triangleCount<=45000,'the full source model stays within the iteration 10 triangle budget');
  assert.ok(model.diagnostics.drawCalls<=15,'the structure reuses all existing material submissions');
  assert.ok(model.diagnostics.plan.structure.diagnostics.renderedTriangles<8000,'constructed upper shell and open guards stay bounded');
  for(const mesh of meshes)for(const attr of Object.values(mesh.geometry.attributes))assert.ok(attr.array.every(Number.isFinite));
 }finally{model.dispose();model.dispose();}
 assert.equal(geometryDisposals,meshes.length,'merged geometry is released exactly once');
 assert.equal(borrowedDisposals,0);shared.dispose();assert.equal(borrowedDisposals,Object.keys(shared).length);
});
