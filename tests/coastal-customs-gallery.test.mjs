import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {buildCustomsServiceGallery,customsGalleryParts} from '../coastal-customs-gallery.js';
import {createModel as createCustoms} from '../assets/thai-kit/bangkok-hospital-clinic-building.js';
import {instanceHarborStaticDetails,isStaticHarborDetail} from '../harbor-static-details.js';

const fixture=()=>({root:new THREE.Group(),thaiWorld:{root:new THREE.Group()},course:{harbor:true,coastal:{},basementPortal:{x:10.5,y:7}},diagnostics:{},materials:Object.fromEntries(['dark','rust','concrete'].map(slot=>[slot,new THREE.MeshStandardMaterial()])),unitBox:new THREE.BoxGeometry(1,1,1)});

test('corrected gallery retains preflight bounds and capsule/portal clearance with three borrowed-material submissions',()=>{
 const world=fixture(),before=Object.fromEntries(Object.entries(world.materials).map(([slot,m])=>[slot,JSON.stringify(m.toJSON())])),course=JSON.stringify(world.course);
 const gallery=buildCustomsServiceGallery(world);assert.equal(JSON.stringify(world.course),course);
 assert.equal(gallery.diagnostics.triangles,228);assert.equal(gallery.diagnostics.colourSubmissions,3);assert.equal(gallery.diagnostics.shadowSubmissions,1);
 assert.equal(gallery.root.children.length,3);
 for(const mesh of gallery.root.children){const slot=mesh.name.split(':')[1];assert.equal(mesh.material,world.materials[slot]);assert.equal(JSON.stringify(mesh.material.toJSON()),before[slot]);assert.equal(mesh.castShadow,slot==='dark');assert.ok(mesh.receiveShadow);assert.ok(mesh.geometry.attributes.normal&&mesh.geometry.attributes.uv);assert.equal(mesh.matrixAutoUpdate,false);assert.ok(mesh.matrix.equals(new THREE.Matrix4()));}
 const bounds=new THREE.Box3().setFromObject(gallery.root);
 assert.ok(Math.abs(bounds.min.x-34.41)<.001&&Math.abs(bounds.max.x-41.24)<.001);
 assert.ok(Math.abs(bounds.min.z-30.99)<.001&&Math.abs(bounds.max.z-36.91)<.001);
 assert.ok(Math.abs(bounds.max.y-4.508834531)<.001);
 assert.ok(bounds.min.y>=2.319&&bounds.min.z-28>=2.989);
 const lane=new THREE.Box3(new THREE.Vector3(42.52,.1,27.12),new THREE.Vector3(44.28,2.4,44.88));
 assert.equal(bounds.intersectsBox(lane),false);assert.ok(Math.abs(lane.min.x-bounds.max.x-1.28)<.001);
 const batched=instanceHarborStaticDetails(world.root,{eligible:o=>isStaticHarborDetail(o,world)});
 assert.equal(batched.diagnostics.instanceMeshes,0,'owned merged buffers cannot silently split into unitBox chunk batches');assert.equal(gallery.root.children.length,3);
 world.root.position.set(7,2,-3);world.root.updateMatrixWorld(true);
 const shifted=new THREE.Box3().setFromObject(gallery.root);
 assert.ok(shifted.min.distanceTo(bounds.min.clone().add(new THREE.Vector3(7,2,-3)))<.001);
 for(const mesh of gallery.root.children)assert.ok(mesh.matrixWorld.equals(world.root.matrixWorld),'frozen identity leaves still inherit parent transforms');
 batched.dispose();gallery.dispose();
});

test('gallery triangles bear on actual fitted Customs framing/cladding, never glass or collision-grid boundary',()=>{
 const customs=createCustoms();customs.updateMatrixWorld(true);
 const source=new THREE.Box3().setFromObject(customs),size=source.getSize(new THREE.Vector3());
 const fit=Math.min(23.3/size.x,16/size.y,23.3/size.z);customs.scale.multiplyScalar(fit);customs.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(customs),centre=bounds.getCenter(new THREE.Vector3());customs.position.sub(new THREE.Vector3(centre.x,bounds.min.y,centre.z));
 const pivot=new THREE.Group();pivot.add(customs);pivot.position.set(24,.13,28);pivot.updateMatrixWorld(true);
 for(const z of [32,33.5,35.5])for(const y of [2.4,3.18,4.30]){
  const hit=new THREE.Raycaster(new THREE.Vector3(36,y,z),new THREE.Vector3(-1,0,0),0,3).intersectObject(pivot,true)[0];assert.ok(hit);
  assert.match(hit.object.name,/Shopfront framing and door bay|White cladding block/);assert.ok(hit.point.x>=34.41&&hit.point.x<=34.67);
 }
 const parts=customsGalleryParts(),knees=parts.filter(p=>p.name==='triangle-knee');assert.equal(knees.length,3);
 for(const knee of knees){const quaternion=new THREE.Quaternion().fromArray(knee.quaternion),centre=new THREE.Vector3(...knee.position),axis=new THREE.Vector3(0,1,0).applyQuaternion(quaternion).multiplyScalar(knee.size[1]/2),lower=centre.clone().sub(axis),upper=centre.clone().add(axis);
  assert.ok(lower.distanceTo(new THREE.Vector3(34.54,2.4,knee.position[2]))<1e-9);
  assert.ok(upper.distanceTo(new THREE.Vector3(39.8,3.765,knee.position[2]))<1e-9);
  const rafterHeight=3.96-Math.tan(.1)*(upper.x-37.85);assert.ok(Math.abs(upper.y-rafterHeight)<.001,'diagonal reaches the actual sloping rafter');
 }
});

test('temporary buffers and world-owned merged geometry dispose once; materials remain borrowed',()=>{
 const world=fixture(),counts=new Map(),originalDispose=THREE.BufferGeometry.prototype.dispose;
 let materialDisposals=0;for(const m of Object.values(world.materials))m.addEventListener('dispose',()=>materialDisposals++);
 THREE.BufferGeometry.prototype.dispose=function(){counts.set(this,(counts.get(this)||0)+1);return originalDispose.call(this);};
 try{
  const gallery=buildCustomsServiceGallery(world);assert.equal(counts.size,19,'all nineteen temporary boxes are released after merge');
  const owned=gallery.root.children.map(m=>m.geometry);
  // Mirrors the ordinary world owner's deduplicated geometry traversal.
  for(const geometry of new Set(owned))geometry.dispose();
  gallery.dispose();gallery.dispose();assert.equal(counts.size,22);for(const count of counts.values())assert.equal(count,1);
  assert.equal(materialDisposals,0);assert.equal(world.root.children.length,0);
 }finally{THREE.BufferGeometry.prototype.dispose=originalDispose;}
});
