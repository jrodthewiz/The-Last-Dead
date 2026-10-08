import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createModel,architectureColliders} from '../assets/blackwater-kit/architecture.js';
import {civicSkylinePlan} from '../assets/blackwater-kit/skyline.js';
import {makeBlackwaterDistrict} from '../blackwater-district-layout.js';
import {makeCoastalNeighborhoods} from '../coastal-neighborhood-layout.js';

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
