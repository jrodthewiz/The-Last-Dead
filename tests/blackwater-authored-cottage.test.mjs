import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {makeBlackwaterDistrict} from '../blackwater-district-layout.js';
import {makeCoastalNeighborhoods} from '../coastal-neighborhood-layout.js';
import {createModel,createBuildingPlan,architectureColliders} from '../assets/blackwater-kit/architecture.js';
import {getCottageDiscovery,primitiveBounds,coversAuthoredCottageCurtainWindow} from '../assets/blackwater-kit/cottage-authored.js';
import {createBlackwaterMaterials} from '../assets/blackwater-kit/materials.js';
import {canStand,castRay} from '../engine.js';

const cottage=()=>makeBlackwaterDistrict(makeCoastalNeighborhoods()).buildings.find(b=>b.label==='CAPE LODGE 75');
const world=(building,x,z)=>({x:building.x+x*Math.cos(building.yaw)+z*Math.sin(building.yaw),z:building.z-x*Math.sin(building.yaw)+z*Math.cos(building.yaw)});
const ray=(model,origin,direction,far=20)=>new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(...direction),0,far).intersectObject(model.root,true);
// The verified07 capture used10,018 triangles for these named lower art roles.
// Preserve its5,000-triangle upgrade allowance independently of later floors.
const lowerArtTriangles=model=>[...new Set(model.diagnostics.plan.authoredCottage.placements.map(p=>p.role))].reduce((n,role)=>n+(model.diagnostics.trianglesPerModule[role]||0),0);

test('only the storm retreat receives authored evacuation modules and seed variants remain serializable',()=>{
 const slice=makeBlackwaterDistrict(makeCoastalNeighborhoods());
 const authored=slice.buildings.map(b=>createBuildingPlan(b)).filter(p=>p.authoredCottage);
 assert.equal(authored.length,1);assert.equal(authored[0].settings.label,'CAPE LODGE 75');
 assert.equal(getCottageDiscovery({...authored[0].settings,enterable:false}),null);
 const a=createBuildingPlan({...cottage(),seed:1042}),b=createBuildingPlan({...cottage(),seed:1042}),c=createBuildingPlan({...cottage(),seed:1043});
 assert.deepEqual(a,b);assert.deepEqual(JSON.parse(JSON.stringify(a)),a);
 assert.notDeepEqual(a.authoredCottage.placements,c.authoredCottage.placements,'cloth-fold phase and pillow handling are constrained deterministic variants');
 assert.deepEqual(a.furniture,c.furniture,'the variants preserve authoritative solid footprints');
 assert.equal(a.authoredCottage.diagnostics.duplicateOwners.length,0,'the compiler reports actual exact primitive ownership duplicates');
 assert.equal(new Set(a.authoredCottage.placements.map(p=>p.id)).size,a.authoredCottage.placements.length);
 for(const p of a.authoredCottage.placements){const {min,max}=primitiveBounds(p);assert.ok([...min,...max].every(Number.isFinite));assert.ok(min[0]>=-6&&max[0]<=6&&min[2]>=-8&&max[2]<=6.35,`${p.id} stays inside the building shell`);}
 for(const [role,bounds]of Object.entries(a.authoredCottage.diagnostics.moduleBounds))assert.ok(bounds.min.every((value,i)=>value<=bounds.max[i]),`${role} has inspected module bounds`);
});

test('supported contents touch real furniture surfaces and the discovery top stays clear',()=>{
 const plan=createBuildingPlan(cottage()),a=plan.authoredCottage,supports=new Map(a.supports.map(s=>[s.id,s]));
 for(const p of a.placements.filter(p=>p.supportId)){
  const support=supports.get(p.supportId),bounds=primitiveBounds(p);
  assert.ok(support,`${p.id} owns a real support`);
  assert.ok(Math.abs(bounds.min[1]-support.top)<=.005,`${p.id} rests within 5 mm of ${support.id}`);
  for(const [axis,index]of [['x',0],['z',2]])assert.ok(bounds.min[index]>=support.bounds[axis][0]-.005&&bounds.max[index]<=support.bounds[axis][1]+.005,`${p.id} is contained by its ${axis} support footprint`);
 }
 const model=createModel(cottage());
 try{
  model.root.updateMatrixWorld(true);const d=a.discovery;
  const top=ray(model,[d.position[0],d.position[1]+.08,d.position[2]],[0,-1,0],.2)[0];
  assert.ok(top,'the kit support exists as rendered geometry');assert.ok(Math.abs(top.point.y-d.position[1])<.00001,'local anchor is on the actual cabinet top');
  const probe=[d.position[0],d.position[1]+.035,d.position[2]],side=ray(model,probe,[1,0,0],.20);
  assert.equal(side.length,0,'case volume is clear above the cabinet');
  const kitchen=plan.furniture.find(p=>p.id==='kitchen-worktop'),sinkX=kitchen.position[0]-kitchen.size[0]*.25;
  const sink=ray(model,[sinkX+.15,1.10,kitchen.position[2]],[0,-1,0],.30)[0];
  assert.ok(sink&&Math.abs(sink.point.y-.9435)<.00001,'the sink opening exposes its physically lowered bowl, not a solid counter under painted darkness');
 }finally{model.dispose();}
});

test('both rendered portals and the engine preserve the full through-route and reachable repair-kit approach',()=>{
 const source=cottage(),model=createModel(source),course=makeHarborCourse({openWorld:true}),plan=model.diagnostics.plan;
 try{
  model.root.updateMatrixWorld(true);
  for(const x of [-1.90,-.60,0,.60,1.90])for(const y of [.20,1.40,2.10]){
   assert.equal(ray(model,[x,y,source.depth/2+1],[0,0,-1],source.depth+2).length,0,`authored forms retain the 4 m door band at ${x},${y}`);
   assert.equal(ray(model,[x,y,-source.depth/2-1],[0,0,1],source.depth+2).length,0,'reverse route has no hidden back faces across its doorway');
  }
  for(const collider of architectureColliders(source)){
   assert.ok(collider.x+collider.width/2<=-2.75||collider.x-collider.width/2>=2.75,`${collider.id} preserves 0.75 m approach shoulders`);
  }
  for(let z=-10;z<=10;z+=.1){const p=world(source,0,z);assert.ok(canStand(course,p.x/4,p.z/4,.16),`native route remains walkable at ${z}`);}
  const d=plan.authoredCottage.discovery,approach=world(source,...d.approach),anchor=world(source,d.position[0],d.position[2]);
  assert.ok(canStand(course,approach.x/4,approach.z/4,.16),'the player capsule can stand at the kit approach');
  assert.ok(Math.hypot(approach.x-anchor.x,approach.z-anchor.z)<=2.2,'case is within the existing collection reach');
  const drawer=course.coastal.structures.find(s=>s.id===source.id).solids.find(s=>s.id==='cape75-lower-bedroom-dresser'),probe=world(source,-4.05,-.73);
  assert.equal(canStand(course,probe.x/4,probe.z/4,.05),false,'pulled drawer is included in the actual course obstruction');
  const shot=castRay(course,approach.x/4,approach.z/4,Math.atan2(anchor.z-approach.z,anchor.x-approach.x),2,(drawer.minZ+drawer.maxZ)/2);
  assert.equal(shot.solidId,drawer.id,'the visible cabinet receives the engine bullet ray at its actual height');
 }finally{model.dispose();}
});

test('close inspection finds folded cloth and rich construction without adding draw submissions or borrowed-material disposal',()=>{
 const shared=createBlackwaterMaterials({loadTextures:false}),source=cottage();let borrowedDisposals=0;
 for(const material of Object.values(shared))material.addEventListener('dispose',()=>borrowedDisposals++);
 const model=createModel({...source,materials:shared}),baseline=createModel({...source,label:'CAPE LODGE 76',materials:shared});
 try{
  assert.deepEqual(new Set(model.diagnostics.materialSlots),new Set(baseline.diagnostics.materialSlots),'authored detail compiles into existing material slots');
  assert.equal(model.diagnostics.drawCalls,baseline.diagnostics.drawCalls);
   const lowerArt=lowerArtTriangles(model);
   assert.ok(lowerArt>5000&&lowerArt<=15018,`${lowerArt} lower-room triangles retain the verified07 allowance independently of the new upper floor`);
   assert.ok(model.diagnostics.triangleCount<45000,'the single two-storey authored house has a separate bounded whole-model allowance');
  for(const role of ['bed-gravity-side-drape','dresser-pulled-drawer-bottom','kitchen-lowered-sink-bowl','kitchen-upper-storage','radio-supported-repair-circuit-board','framed-scene-lighthouse','curtain-sewn-pleated-panel'])assert.ok(model.diagnostics.trianglesPerModule[`cape75-${role}`]>0,`${role} is compiled render geometry`);
  model.root.updateMatrixWorld(true);const bed=model.diagnostics.plan.furniture.find(p=>p.id==='bedroom-bed'),heights=[];
  for(let x=-.75;x<=.75;x+=.15)for(let z=-.10;z<=.9;z+=.2){
   const hit=ray(model,[bed.position[0]+x,.80,bed.position[2]+z],[0,-1,0],.4)[0];assert.ok(hit);heights.push(hit.point.y);
  }
  assert.ok(Math.max(...heights)-Math.min(...heights)>.082,'blanket has broad 8 cm-plus fold elevation under a physical ray probe');
  for(const mesh of model.root.children.filter(child=>child.isMesh))for(const attribute of Object.values(mesh.geometry.attributes))assert.ok(attribute.array.every(Number.isFinite));
 }finally{model.dispose();model.dispose();baseline.dispose();}
 assert.equal(borrowedDisposals,0);shared.dispose();assert.equal(borrowedDisposals,Object.keys(shared).length);
});

test('major cloth shape survives standing 320 px projection and only four duplicated curtain windows are replaced',()=>{
 const source=cottage(),plan=createBuildingPlan(source),a=plan.authoredCottage;
 const blanket=a.diagnostics.moduleBounds['cape75-bed-draped-creased-blanket'],drape=a.diagnostics.moduleBounds['cape75-bed-gravity-side-drape'];
 const creaseHeight=blanket.max[1]-blanket.min[1],focalPixels=200/(2*Math.tan(75*Math.PI/360)),standingDistance=5.3;
 assert.ok(creaseHeight>=.095&&creaseHeight<=.145,'major blanket crests have a deliberate readable physical height');
 assert.ok(creaseHeight*focalPixels/standingDistance>=2.3,'crest projects beyond two pixels at the farther standing 320×200 view');
 assert.ok(drape.max[1]-drape.min[1]>.40,'side cloth falls around the rail rather than forming a straight slab edge');
 const bed=plan.furniture.find(p=>p.id==='bedroom-bed'),railOuter=bed.position[0]+bed.size[0]/2+.035,clothVertices=a.placements.filter(p=>p.role==='cape75-bed-gravity-side-drape').flatMap(p=>p.points);
 for(const point of clothVertices.filter(p=>p[1]<=.445&&p[1]>=.285))assert.ok(point[0]>railOuter,'the drape turns outside the timber rail before it falls alongside it');
 assert.ok(drape.max[0]<=bed.position[0]+bed.collisionSize[0]/2,'exaggerated gravity cloth remains inside the conservative bed footprint');
 const panels=a.placements.filter(p=>p.role==='cape75-curtain-sewn-pleated-panel');
 const right=panels.filter(p=>p.points.every(point=>point[0]>0)),xs=right.flatMap(p=>p.points.map(point=>point[0]));
 const depth=Math.max(...xs)-Math.min(...xs);
 assert.ok(depth>=.10&&depth<=.12,'curtain pleats own ten centimetres of construction depth');
 assert.ok(depth*focalPixels/4>=3.2,'pleat depth is larger than three pixels at a four-metre 320×200 inspection');
 for(const window of a.curtainWindows){
  const center=[window.center[0],window.center[1],window.center[2]+.825];
  assert.equal(coversAuthoredCottageCurtainWindow(plan,center),true);
  assert.equal(coversAuthoredCottageCurtainWindow(plan,[center[0],center[1]+plan.upperFloorHeight,center[2]]),false,'upper-floor panel ownership is untouched');
 }
 let replaced=0;const span=source.depth-1.85,bay=span/5;
 for(const side of [-1,1])for(let i=0;i<5;i++)if(coversAuthoredCottageCurtainWindow(plan,[side*5.8,plan.upperFloorHeight*.51,-span/2+bay*(i+.5)]))replaced++;
 assert.equal(replaced,4,'the exclusion covers exactly the authored four side windows');
 assert.equal(coversAuthoredCottageCurtainWindow(createBuildingPlan({...source,label:'CAPE LODGE 76'}),[-5.8,plan.upperFloorHeight*.51,-2.83]),false,'other cottages retain their generic curtains');
 const model=createModel(source),baseline=createModel({...source,label:'CAPE LODGE 76'});
 try{
  assert.equal(model.diagnostics.moduleCounts['interior-curtain-rod'],baseline.diagnostics.moduleCounts['interior-curtain-rod'],'every original curtain rod remains');
  const removed=baseline.diagnostics.moduleCounts['gathered-window-curtain']-model.diagnostics.moduleCounts['gathered-window-curtain'];
  assert.ok(removed>=4&&removed<=8,'only covered old panels are absent, including boarded-window single panels');
  assert.equal(model.diagnostics.moduleCounts['curtain-fold'],model.diagnostics.moduleCounts['gathered-window-curtain'],'duplicate flat folds are excluded with their parent panels');
  assert.ok(lowerArtTriangles(model)<=15018,'the lower radio/appliance art stays within5,000 triangles above the verified07 named-role baseline');
  assert.equal(model.diagnostics.drawCalls,15);assert.equal(a.diagnostics.duplicateOwners.length,0);
 }finally{model.dispose();baseline.dispose();}
});

test('actual standing rays find contrasting radio controls, supported repair parts and a genuine open storage cavity',()=>{
 const source=cottage(),model=createModel(source),plan=model.diagnostics.plan,a=plan.authoredCottage;
 try{
  model.root.updateMatrixWorld(true);
  assert.equal(model.diagnostics.moduleCounts['dispatch-radio-body'],undefined,'this address has no generic solid radio behind the authored controls');
  assert.equal(model.diagnostics.moduleCounts['fridge-enamel-shell'],undefined,'the refrigerator uses the authored layered assembly');
  const standing=new THREE.Vector3(-2.25,1.60,3.0);
  for(const [feature,position]of [['speaker',a.workstation.radio.speaker],['dial',a.workstation.radio.dial]]){
   const target=new THREE.Vector3(...position);if(feature==='dial')target.y-=.025;
   const direction=target.clone().sub(standing).normalize(),hit=new THREE.Raycaster(standing,direction,0,5).intersectObject(model.root,true)[0];
   assert.ok(hit,`the actual standing direction sees the ${feature}`);
   assert.equal(hit.object.userData.blackwaterSlot,'pale',`${feature} contrasts against its dark cavity instead of presenting a generic metal back`);
   assert.ok(hit.point.z<a.workstation.radio.center[2]-.15,'the visible feature is on the player-facing −Z face');
   assert.ok(hit.point.distanceTo(target)<.035,`${feature} is the first physical surface from the current approach`);
  }
  for(const role of ['radio-contrasting-enamel-bezel','radio-big-tuning-dial','radio-recognizable-carry-handle','radio-telescopic-aerial-tip','radio-exposed-rear-coil','radio-supported-repair-circuit-board','radio-readable-repair-transformer','repair-recognizable-plier-handle','fridge-stepped-enamel-door','fridge-hinge-pin','fridge-rear-condenser-fin','kitchen-beveled-door-rail','upper-storage-beveled-door-rail'])assert.ok(model.diagnostics.trianglesPerModule[`cape75-${role}`]>0,`${role} is real geometry in the compiled model`);
  const k=plan.furniture.find(p=>p.id==='kitchen-worktop'),x=k.position[0]+k.size[0]*.25,front=k.position[2]-k.size[2]/2+.32;
  const shelf=ray(model,[x,1.96,front+.10],[0,0,-1],.5)[0];
  assert.ok(shelf,'storage cavity has a backing');assert.equal(shelf.object.userData.blackwaterSlot,'dark');
  assert.ok(front-shelf.point.z>.24,'the open shelf has more than24cm of real depth, with no former solid carcass across the opening');
  const reserve=a.workstation.taskLightBase;
  for(const p of a.placements.filter(p=>/^cape75-(radio|repair)-/.test(p.role))){
   const bounds=primitiveBounds(p);if(bounds.min[1]>reserve.center[1]+.075)continue;
   const nearestX=Math.max(bounds.min[0],Math.min(reserve.center[0],bounds.max[0])),nearestZ=Math.max(bounds.min[2],Math.min(reserve.center[2],bounds.max[2]));
   assert.ok(Math.hypot(nearestX-reserve.center[0],nearestZ-reserve.center[2])>=reserve.radius-.001,`${p.id} keeps the actual task-light base clear`);
  }
  const fridge=plan.furniture.find(p=>p.id==='kitchen-fridge');
  for(const [role,bounds]of Object.entries(a.diagnostics.moduleBounds).filter(([role])=>role.startsWith('cape75-fridge-'))){
   for(const index of [0,2])assert.ok(bounds.min[index]>=fridge.position[index]-fridge.collisionSize[index]/2-.00001&&bounds.max[index]<=fridge.position[index]+fridge.collisionSize[index]/2+.00001,`${role} fits the unchanged solid proxy`);
  }
  assert.equal(model.colliders.length,13);assert.deepEqual(a.discovery.position,[-3.55,1.11,-1.30]);
  assert.ok(lowerArtTriangles(model)<=15018);assert.equal(model.diagnostics.drawCalls,15);
 }finally{model.dispose();}
});
