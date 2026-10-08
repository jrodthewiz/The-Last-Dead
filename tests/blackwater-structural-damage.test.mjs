import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createModel,architectureColliders} from '../assets/blackwater-kit/architecture.js';
import {createBlackwaterMaterials} from '../assets/blackwater-kit/materials.js';

const pharmacy={kind:'shop',width:16,depth:12,height:11,seed:1405,enterable:true,doorOffset:2,label:'BELL PHARMACY'};

test('Bell collapse has true two-storey room depth from front and original street camera',()=>{
 const model=createModel(pharmacy);
 try{
  model.root.updateMatrixWorld(true);
  for(const [x,y]of [[-1.6,5.4],[-1.6,8.5],[-2,6.4],[-1,9.2]]){
   const ray=new THREE.Raycaster(new THREE.Vector3(x,y,7),new THREE.Vector3(0,0,-1),0,12),hit=ray.intersectObject(model.root,true)[0];
   assert.ok(hit,'a real inner room wall closes the upper floor');
   assert.ok(hit.point.z<3&&hit.point.z>2.4,'ray crosses more than three metres of cavity before reaching wall');
   assert.notEqual(hit.object.material,model.materials.dark,'no flush opaque recess fills the scar');
  }
  const origin=new THREE.Vector3(19,1.62,20),direction=new THREE.Vector3(-1.6,5.4,5.75).sub(origin).normalize();
  const hit=new THREE.Raycaster(origin,direction,0,40).intersectObject(model.root,true)[0];
  assert.ok(hit.point.z<5,'the actual downtown hero camera also sees inward room depth');
  const groundCeiling=new THREE.Raycaster(new THREE.Vector3(2,1.75,-2),new THREE.Vector3(0,1,0),0,10).intersectObject(model.root,true)[0];
  assert.ok(groundCeiling.point.y>3.3&&groundCeiling.point.y<3.5,'continuous shop ceiling keeps upper floor inaccessible');
 }finally{model.dispose();}
});

test('collapse cuts a readable roof silhouette while the neighboring roof remains intact',()=>{
 const model=createModel(pharmacy);
 try{
  model.root.updateMatrixWorld(true);
  const topAt=x=>new THREE.Raycaster(new THREE.Vector3(x,14,5.7),new THREE.Vector3(0,-1,0),0,14).intersectObject(model.root,true)[0].point.y;
  assert.ok(topAt(-1.6)<7,'roof and cornice are genuinely missing above the focal opening');
  assert.ok(topAt(-6.4)>11,'neighboring façade/parapet remains an intact mass');
  const depths=model.diagnostics.structuralDamageBounds;
  assert.ok(depths['collapse-surviving-intermediate-slab']);assert.ok(depths['collapse-exposed-roof-joist']);
  assert.ok(depths['collapse-fractured-left-pier'].max[0]<depths['collapse-fractured-right-pier'].min[0]-4,'scar has a broad clear centre');
 }finally{model.dispose();}
});

test('one upper side plaster tear reveals neutral structure while lower and rear finishes remain',()=>{
 const model=createModel(pharmacy);
 try{
  model.root.updateMatrixWorld(true);
  const sideAt=(y,z)=>new THREE.Raycaster(new THREE.Vector3(-1.6,y,z),new THREE.Vector3(-1,0,0),0,5).intersectObject(model.root,true)[0];
  const exposed=sideAt(8.5,4.9),lower=sideAt(5.4,4.9),rear=sideAt(8.5,3.0);
  assert.equal(exposed.object.material,model.materials.masonry,'upper front cheek exposes its neutral structural layer');
  assert.equal(lower.object.material,model.materials.render,'lower interior plaster stays attached');
  assert.equal(rear.object.material,model.materials.render,'upper plaster is localized to the rear of the wall');
  assert.ok(lower.point.x>exposed.point.x+.025,'plaster has real thickness in front of its substrate');
 }finally{model.dispose();}
});

test('focal structural modules remain inside original lots with finite geometry and fixed batch budget',()=>{
 for(const [width,depth,height,seed]of [[16,12,11,1405],[16,16,11,1405],[12,10,7,1404],[16,16,15,1406]]){
  const model=createModel({...pharmacy,width,depth,height,seed});
  try{
   for(const bounds of Object.values(model.diagnostics.structuralDamageBounds)){
    assert.ok(bounds.min[0]>=-width/2-.00001&&bounds.max[0]<=width/2+.00001);
    assert.ok(bounds.min[2]>=-depth/2-.00001&&bounds.max[2]<=depth/2+.00001);
    assert.ok(bounds.min[1]>=3.49,'new structural debris stays above playable ground');
   }
   model.root.traverse(mesh=>{if(mesh.isMesh)for(const attribute of Object.values(mesh.geometry.attributes))assert.ok(attribute.array.every(Number.isFinite));});
   assert.ok(model.diagnostics.drawCalls<=11);
   const focalTris=Object.entries(model.diagnostics.trianglesPerModule).filter(([role])=>role.startsWith('collapse-')).reduce((n,[,count])=>n+count,0);
   assert.ok(focalTris>1000&&focalTris<6000);
  }finally{model.dispose();}
 }
});

test('focal damage is label-specific and preserves gameplay plans and shared material ownership',()=>{
 const shared=createBlackwaterMaterials({loadTextures:false}),focal=createModel({...pharmacy,materials:shared}),control=createModel({...pharmacy,label:'CONTROL PHARMACY',materials:shared});
 let borrowed=0,geometryDisposals=0,meshCount=0;
 for(const material of Object.values(shared))material.addEventListener('dispose',()=>borrowed++);
 try{
  assert.equal(control.diagnostics.plan.focalCollapse,null);
  assert.deepEqual(focal.colliders,control.colliders);assert.deepEqual(focal.colliders,architectureColliders(pharmacy));
  assert.deepEqual(focal.diagnostics.plan.door,control.diagnostics.plan.door);
  assert.deepEqual(focal.diagnostics.materialSlots.toSorted(),control.diagnostics.materialSlots.toSorted());
  assert.equal(focal.diagnostics.drawCalls,control.diagnostics.drawCalls);
  assert.ok(focal.diagnostics.triangleCount-control.diagnostics.triangleCount<6000);
  for(const model of [focal,control])model.root.traverse(mesh=>{if(mesh.isMesh){meshCount++;mesh.geometry.addEventListener('dispose',()=>geometryDisposals++);}});
 }finally{focal.dispose();focal.dispose();control.dispose();control.dispose();}
 assert.equal(borrowed,0);assert.equal(geometryDisposals,meshCount);
 shared.dispose();assert.equal(borrowed,Object.keys(shared).length);
});
