import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createModel,createBuildingPlan,architectureColliders} from '../assets/blackwater-kit/architecture.js';
import {civicSkylinePlan} from '../assets/blackwater-kit/skyline.js';
import {makeBlackwaterDistrict} from '../blackwater-district-layout.js';
import {makeCoastalNeighborhoods} from '../coastal-neighborhood-layout.js';
import {makeHarborCourse} from '../harbor-course.js';

test('district uses produce different roof anatomy and real upper facade relief',()=>{
 const specs=[['EAST WORKS / WAREHOUSE','factory-sawtooth-roof'],['EAST WORKS / WORKSHOP','workshop-ridge-monitor'],['EAST WORKS / CLINIC','setback-roof-pavilion'],['SALTWIND / APARTMENTS','apartment-balcony-return']];
 const models=specs.map(([label])=>createModel({label,kind:'shop',width:20,depth:16,height:12,seed:1400,enterable:true,doorOffset:0}));
 try{
  for(const [index,model]of models.entries()){
   assert.ok(model.diagnostics.moduleCounts[specs[index][1]]>0);
   assert.ok(model.diagnostics.triangleCount<26000);
   const {min,max}=model.diagnostics.bounds;
   assert.ok(min[0]>=-10.001&&max[0]<=10.001);
   assert.ok(min[2]>=-8.001&&max[2]<=8.87);
   const industrial=index<2;
   assert.ok(max[1]>(industrial?18:13.5)&&max[1]<(industrial?18.6:15.4));
   for(const mesh of model.root.children.filter(o=>o.isMesh))for(const attribute of Object.values(mesh.geometry.attributes))assert.ok(attribute.array.every(Number.isFinite));
  }
  assert.equal(new Set(models.map(m=>m.diagnostics.plan.anatomy.family)).size,4);
 }finally{models.forEach(m=>m.dispose());}
});

test('civic clock tower and mansard roofs remain decorative above playable portals',()=>{
 for(const [label,seed,role]of [['EVACUATION OFFICE',1402,'civic-clock-tower'],['SALTWIND / APARTMENTS',1402,'apartment-mansard'],['TERMINUS CAFE',1402,'merchant-hipped-roof']]){
  const options={label,seed,kind:'shop',width:20,depth:16,height:18,enterable:true,doorOffset:0};
  const model=createModel(options);
  try{
   assert.ok(model.diagnostics.moduleCounts[role]>0,`${label} has its authored skyline`);
   assert.ok(model.diagnostics.triangleCount<36000);
   assert.deepEqual(model.colliders,architectureColliders(options));
   model.root.updateMatrixWorld(true);
   const ray=new THREE.Raycaster(new THREE.Vector3(0,1.4,10),new THREE.Vector3(0,0,-1),0,20);
   assert.equal(ray.intersectObject(model.root,true).length,0,`${label} doorway stays open`);
   if(label==='EVACUATION OFFICE'){
    assert.equal(model.diagnostics.moduleCounts['civic-clock-face'],4);
    assert.ok(model.diagnostics.bounds.max[1]>30);
   }
  }finally{model.dispose();}
 }
});

test('waterside foundry has a large asymmetric skyline within its original lot and door plan',()=>{
 const options={label:'EAST WORKS 55 / WAREHOUSE',kind:'shop',width:24,depth:16,height:9,seed:1455,enterable:true,doorOffset:-2};
 const model=createModel(options);
 try{
  const d=model.diagnostics;
  assert.equal(d.moduleCounts['foundry-gantry-leg'],4);
  assert.equal(d.moduleCounts['foundry-monumental-stack'],2);
  assert.equal(d.moduleCounts['foundry-raised-furnace-house'],1);
  assert.equal(d.moduleCounts['foundry-continuous-gantry-bearing'],4);
  assert.ok(d.moduleCounts['works-hall-bearing-pier']>=12);
  assert.ok(d.moduleCounts['works-hall-broad-glazing']>0);
  assert.equal(d.moduleCounts['floor-belt'],undefined,'foundry reads as a tall structural hall');
  assert.ok(d.bounds.max[1]>33&&d.bounds.max[1]<34);
  assert.ok(d.bounds.min[0]>=-12&&d.bounds.max[0]<=12);
  assert.ok(d.bounds.min[2]>=-8&&d.bounds.max[2]<=8.87);
  assert.ok(d.triangleCount<36000);
  assert.deepEqual(model.colliders,architectureColliders(options));
  model.root.updateMatrixWorld(true);
  for(const x of [-3.5,-2,-.5]){
   const ray=new THREE.Raycaster(new THREE.Vector3(x,1.4,10),new THREE.Vector3(0,0,-1),0,20);
   assert.equal(ray.intersectObject(model.root,true).length,0,'foundry ground floor remains traversable');
  }
 }finally{model.dispose();}
});

test('actual evacuation hall forms a broad stepped civic mass with clear ground portals and exposed wing roofs',()=>{
 const district=makeBlackwaterDistrict(makeCoastalNeighborhoods()),index=district.buildings.findIndex(b=>b.label==='EVACUATION OFFICE');
 const options={...district.buildings[index],seed:1400+index},model=createModel(options);
 try{
  const p=civicSkylinePlan(model.diagnostics.plan.settings),d=model.diagnostics;
  assert.equal(p.tiers.length,2);
  assert.ok(p.tiers[0].width>11&&p.tiers[0].depth>10,'bearing mass occupies most of the civic hall');
  assert.ok(p.tiers[1].width>8&&p.tiers[1].width<p.tiers[0].width,'belfry has a substantial setback');
  assert.equal(p.tiers[1].y,p.tiers[0].y+p.tiers[0].height,'tiers have continuous bearing');
  for(const wing of p.wings){
   assert.ok(wing.width>0&&wing.depth>0);
   const outsideX=wing.x-wing.width/2>=p.x+p.tiers[0].width/2;
   const outsideZ=wing.z-wing.depth/2>=p.z+p.tiers[0].depth/2;
   assert.ok(outsideX||outsideZ,'wing roof terminates outside the bearing tower');
  }
  assert.equal(d.moduleCounts['civic-clock-face'],4);
  assert.equal(d.moduleCounts['civic-hall-tall-glazing'],16);
  assert.equal(d.moduleCounts['floor-belt'],undefined,'civic tall order replaces apartment-like grid');
  assert.equal(d.moduleCounts['roof-vent'],undefined,'no hidden generic rooftop fittings');
  assert.ok(d.bounds.max[1]>50&&d.bounds.max[1]<50.1);
  assert.ok(d.bounds.min[0]>=-8&&d.bounds.max[0]<=8);
  assert.ok(d.bounds.min[2]>=-8&&d.bounds.max[2]<=8.87);
  assert.ok(d.triangleCount<11000,'civic replacement has fewer triangles than the former 19,750-triangle hall');
  assert.equal(d.drawCalls,14,'existing office material submissions stay fixed');
  assert.deepEqual(model.colliders,architectureColliders(options));
  model.root.updateMatrixWorld(true);
  for(const x of [-3.6,-2,-.4])for(const height of [.65,1.4,2.2]){
   const ray=new THREE.Raycaster(new THREE.Vector3(x,height,10),new THREE.Vector3(0,0,-1),0,20);
   assert.equal(ray.intersectObject(model.root,true).length,0,'front and rear civic portals remain clear');
  }
 }finally{model.dispose();}
});

test('three selected works lofts occupy the roof and preserve the ground-floor routes',()=>{
 for(const [number,width,depth,height,rise]of [[49,20,12,9,6.2],[58,24,12,9,8.2],[67,20,16,15,7.4]]){
  const options={label:`EAST WORKS ${number} / WAREHOUSE`,kind:'shop',width,depth,height,seed:1400+number,enterable:true,doorOffset:-2};
  const model=createModel(options);
  try{
   const d=model.diagnostics;
   assert.equal(d.moduleCounts['works-hangar-roof-slope'],2);
   assert.equal(d.moduleCounts['works-hangar-triangular-end'],2);
   assert.equal(d.moduleCounts['factory-sawtooth-roof'],undefined,'small sawtooth roof is replaced');
   assert.ok(d.moduleCounts['works-hall-broad-glazing']>0);
   assert.ok(d.moduleCounts['works-hall-louver']>0);
   assert.equal(d.moduleCounts['wall-infill'],undefined,'upper apartment-like window grid is replaced');
   assert.ok(d.bounds.max[1]>height+rise);
   assert.ok(d.bounds.min[0]>=-width/2&&d.bounds.max[0]<=width/2);
   assert.ok(d.triangleCount<36000);
   assert.deepEqual(model.colliders,architectureColliders(options));
   model.root.updateMatrixWorld(true);
   const ray=new THREE.Raycaster(new THREE.Vector3(-2,1.4,depth/2+2),new THREE.Vector3(0,0,-1),0,depth+4);
   assert.equal(ray.intersectObject(model.root,true).length,0);
   if(number===67)assert.equal(d.moduleCounts['works-hangar-monitor-glazing'],2);
  }finally{model.dispose();}
 }
});

test('new district silhouettes preserve playable portals and collider plans',()=>{
 for(const label of ['WAREHOUSE','WORKSHOP','CLINIC','APARTMENTS']){
  const options={label,kind:'shop',width:20,depth:16,height:12,seed:1400,enterable:true,doorOffset:0},model=createModel(options);
  try{
   assert.deepEqual(model.colliders,architectureColliders(options));
   model.root.updateMatrixWorld(true);
   for(const x of [-1.6,0,1.6])for(const y of [.65,1.4,2.2]){
    const ray=new THREE.Raycaster(new THREE.Vector3(x,y,10),new THREE.Vector3(0,0,-1),0,20);
    assert.equal(ray.intersectObject(model.root,true).length,0,`${label} portal at ${x},${y}`);
   }
  }finally{model.dispose();}
 }
});

test('authored residential ridge and works halls survive course projection and produce nested upper terraces',()=>{
 const district=makeBlackwaterDistrict(makeCoastalNeighborhoods()),course=makeHarborCourse({openWorld:true});
 const actual=course.coastal.blackwaterSlice.buildings;
 for(const b of district.buildings){
  const projected=actual.find(p=>p.id===b.id);
  assert.equal(projected.districtProfile,b.districtProfile,`${b.label} profile reaches the runtime and collision plan`);
  assert.equal(projected.height,b.height);
  assert.deepEqual(architectureColliders(projected),architectureColliders(b));
 }
 assert.equal(district.buildings.filter(b=>b.districtProfile==='works-bearing-hall').length,31);
 for(const profile of ['corner-step','terraced-court','low-gable']){
  const b=district.buildings.find(p=>p.districtProfile===profile),model=createModel({...b,seed:1400+district.buildings.indexOf(b)});
  try{
   const p=model.diagnostics.plan.upperMassPlan;
   assert.equal(p.profile,profile);assert.deepEqual(JSON.parse(JSON.stringify(p)),p);
   for(const [index,level]of p.levels.entries()){
    const parent=index?p.levels[index-1]:{width:b.width,depth:b.depth,x:0,z:0};
    assert.ok(level.width>0&&level.depth>0&&level.height>0);
    assert.ok(level.x-level.width/2>=parent.x-parent.width/2-.00001);
    assert.ok(level.x+level.width/2<=parent.x+parent.width/2+.00001);
    assert.ok(level.z-level.depth/2>=parent.z-parent.depth/2-.00001);
    assert.ok(level.z+level.depth/2<=parent.z+parent.depth/2+.00001);
   }
   assert.equal(model.diagnostics.moduleCounts['setback-roof-pavilion'],undefined,'tiers replace the generic box plus rooftop box');
   if(profile!=='low-gable')assert.ok(model.diagnostics.moduleCounts['district-exposed-terrace-deck']>0);
   else assert.ok(model.diagnostics.moduleCounts['district-broad-hip-roof']>0);
   assert.ok(model.diagnostics.moduleCounts['district-storey-bearing-band']>0);
   model.root.updateMatrixWorld(true);
   for(const y of [.65,1.4,2.2]){
    const ray=new THREE.Raycaster(new THREE.Vector3(b.doorOffset,y,b.depth/2+2),new THREE.Vector3(0,0,-1),0,b.depth+4);
    assert.equal(ray.intersectObject(model.root,true).length,0);
   }
  }finally{model.dispose();}
 }
});

test('adjacent Saltwind addresses have different construction envelopes and one reserved pergola',()=>{
 const district=makeBlackwaterDistrict(makeCoastalNeighborhoods());
 const profiles=[['SALTWIND 31 / APARTMENTS','stucco-bay','district-stucco-hip-roof'],['SALTWIND 32 / APARTMENTS','brick-mansard','district-long-mansard-roof'],['SALTWIND 34 / APARTMENTS','terraced-court','district-top-parapet']];
 const pergolas=district.buildings.filter(b=>createBuildingPlan(b).upperMassPlan?.roofFeature==='pergola');
 assert.deepEqual(pergolas.map(b=>b.label),['SALTWIND 12 / APARTMENTS']);
 for(const [label,profile,roof]of profiles){
  const b=district.buildings.find(p=>p.label===label),model=createModel({...b,seed:1400+district.buildings.indexOf(b)});
  try{
   const plan=model.diagnostics.plan,p=plan.upperMassPlan;
   assert.equal(p.profile,profile);assert.ok(model.diagnostics.moduleCounts[roof]>0);
   assert.equal(model.diagnostics.moduleCounts['district-roof-pergola-post'],undefined);
   if(profile==='brick-mansard'){
    assert.ok(p.levels.every(level=>level.width===b.width&&level.depth===b.depth),'long brick block bears continuously below its mansard');
    assert.equal(model.diagnostics.moduleCounts['district-exposed-terrace-deck'],undefined);
   }
   if(profile==='stucco-bay'){
    assert.equal(plan.anatomy.wall,'render');
    assert.ok(model.diagnostics.moduleCounts['stucco-oriel-bearing-cheek']>0);
    assert.ok(model.diagnostics.moduleCounts['stucco-oriel-continuous-sill']>0);
    assert.ok(model.diagnostics.bounds.max[2]<=b.depth/2+.861,'oriels stay within the existing canopy envelope above head height');
   }
   assert.deepEqual(model.colliders,architectureColliders(b));
  }finally{model.dispose();}
 }
});

test('actual coastal addresses retain the four landmark heights and distinct oldtown construction',()=>{
 const course=makeHarborCourse({openWorld:true}),buildings=course.coastal.blackwaterSlice.buildings;
 for(const [number,height]of [[49,9],[55,9],[58,9],[67,15]]){
  const b=buildings.find(p=>p.label===`EAST WORKS ${number} / WAREHOUSE`);
  assert.ok(b,`actual landmark ${number} exists`);assert.equal(b.height,height,`actual address ${number}, not zero-based neighbour`);
 }
 for(const [label,facade,role]of [['EAST END LAUNDRY','laundry-order','laundry-continuous-bearing-pilaster'],['LAST STOP GROCER','grocer-arches','grocer-stone-arch-voussoir']]){
  const b=buildings.find(p=>p.label===label),model=createModel({...b,seed:1400+buildings.indexOf(b)});
  try{
   assert.equal(model.diagnostics.plan.anatomy.facade,facade);assert.ok(model.diagnostics.moduleCounts[role]>0);
   assert.ok(model.diagnostics.moduleCounts['oldtown-deep-entry-bearing-jamb']>0);
   assert.deepEqual(model.colliders,architectureColliders(b));
   if(facade==='grocer-arches'){
    model.root.updateMatrixWorld(true);
    const h=model.diagnostics.plan.upperFloorHeight,spring=3.5+h*.65;
    const brick=model.root.children.filter(m=>m.isMesh&&m.userData.blackwaterSlot==='brick');
    const through=new THREE.Raycaster(new THREE.Vector3(0,spring+.55,b.depth/2+2),new THREE.Vector3(0,0,-1),0,3);
    assert.equal(through.intersectObjects(brick,false).length,0,'arched glass has a real curved void in the wall behind it');
    const above=new THREE.Raycaster(new THREE.Vector3(0,spring+1.10,b.depth/2+2),new THREE.Vector3(0,0,-1),0,3);
    assert.ok(above.intersectObjects(brick,false).length>0,'load-bearing infill closes the wall above the arch');
   }
  }finally{model.dispose();}
 }
});


test('actual Saltwind32 loggia removes upper street wall and bears covered walks behind an intact ground route',()=>{
 const course=makeHarborCourse({openWorld:true}),b=course.coastal.blackwaterSlice.buildings.find(b=>b.label==='SALTWIND 32 / APARTMENTS');
 const model=createModel({...b,seed:1400});
 try{
  const plan=createBuildingPlan({...b,seed:1400}),loggia=plan.upperMassPlan.loggia;
  assert.equal(b.id,'coast-lot-1-1-0-2');assert.equal(loggia.recess,1.4);
  assert.equal(plan.upperMassPlan.roof,'mansard');
  assert.equal(model.diagnostics.moduleCounts['loggia-deep-bearing-return'],10);
  assert.equal(model.diagnostics.moduleCounts['loggia-continuous-bearing-pier'],5);
  assert.deepEqual(model.colliders,architectureColliders({...b,seed:1400}));
  model.root.updateMatrixWorld(true);
  const ray=(p,d,length)=>new THREE.Raycaster(new THREE.Vector3(...p),new THREE.Vector3(...d),0,length).intersectObject(model.root,true);
  for(const level of plan.upperMassPlan.levels){
   const y=level.y+1.45;
   for(const x of [.45,2.75]){
    const hits=ray([x,y,9],[0,0,-1],4);
    assert.ok(hits.length>0,'inset glazed dwelling wall closes rear of covered walk');
    assert.ok(hits[0].point.z<6.65 && hits[0].point.z>6,'no intact front wall or false dark patch fills the loggia');
    assert.equal(ray([x,y,7.25],[0,0,1],1.1).length,0,'walk has genuine open volume above the guard');
    assert.ok(ray([x,y,7.25],[0,-1,0],1.5).length>0,'solid bearing floor beneath the walk');
    assert.ok(ray([x,y,7.25],[0,1,0],1.5).length>0,'actual covered soffit overhead');
   }
  }
  for(const x of [-3.6,-2,-.4])for(const y of [.65,1.4,2.2])assert.equal(ray([x,y,10],[0,0,-1],20).length,0,'ground front-to-rear portal remains clear');
 }finally{model.dispose();}
});
