import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createBlackwaterBuildingBatches} from '../blackwater-building-batches.js';

test('opaque command bundle keeps exact buffers and flags, excludes transparent, invalidates camera membership and shadows',()=>{
 const root=new THREE.Group(),model=new THREE.Group();root.add(model);
 const opaque=new THREE.MeshStandardMaterial(),glass=new THREE.MeshStandardMaterial({transparent:true,opacity:.4});
 const a=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),opaque),b=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),opaque),c=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),glass);
 a.position.set(0,0,-8);b.position.set(80,0,-8);c.position.set(1,0,-10);for(const m of[a,b,c]){m.castShadow=true;model.add(m);}
 const original=a.geometry.attributes.position.array.slice(),helper=createBlackwaterBuildingBatches(root,[model],{chunkSize:32,nativeBundles:true}),bundle=helper.root.getObjectByName('BlackwaterOpaqueCommands');
 try{
  assert(bundle?.isBundleGroup);assert.equal(helper.bundleDiagnostics.opaqueMeshes,2);assert.equal(helper.meshes.find(m=>m.material===glass).parent,helper.root);
  assert.deepEqual(a.geometry.attributes.position.array,original);assert(helper.meshes.every(m=>m.castShadow));
  const camera=new THREE.PerspectiveCamera(55,1.6,.1,50);camera.updateProjectionMatrix();helper.prepareRenderBundles(camera);assert.equal(helper.bundleDiagnostics.visibleMeshes,1);
  const first=bundle.version;helper.prepareRenderBundles(camera);assert.equal(bundle.version,first,'unchanged command selection reused');
  camera.position.x=80;helper.prepareRenderBundles(camera);assert.equal(helper.bundleDiagnostics.visibleMeshes,1);assert(bundle.version>first,'changed visible mesh identity refreshes, even equal count');
  const shifted=bundle.version;helper.prepareRenderBundles(camera,true);assert.equal(bundle.version,shifted+1,'shadow recenter/vehicle refresh changes cached light camera list');
  camera.layers.set(3);helper.prepareRenderBundles(camera);assert.equal(helper.bundleDiagnostics.visibleMeshes,0);
  camera.layers.set(0);helper.prepareRenderBundles(camera);assert.equal(helper.bundleDiagnostics.visibleMeshes,1);
 }finally{helper.dispose();helper.dispose();assert.equal(a.visible,true);assert.equal(b.visible,true);assert.equal(c.visible,true);for(const m of[a,b,c])m.geometry.dispose();opaque.dispose();glass.dispose();}
});

test('native opaque bundle follows clip-depth ordering and invalidates a reversed view with the same members',()=>{
 const root=new THREE.Group(),model=new THREE.Group();root.add(model);
 const material=new THREE.MeshStandardMaterial();
 const near=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material),far=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material);
 far.position.z=-16;near.position.z=-8;model.add(far,near);
 const helper=createBlackwaterBuildingBatches(root,[model],{chunkSize:4,nativeBundles:true}),bundle=helper.root.getObjectByName('BlackwaterOpaqueCommands');
 try{
  const camera=new THREE.OrthographicCamera(-5,5,5,-5,.1,100);helper.prepareRenderBundles(camera);
  assert.equal(helper.bundleDiagnostics.visibleMeshes,2);assert.equal(bundle.children[0].geometry.boundingSphere.center.z,-8);
  const version=bundle.version;helper.prepareRenderBundles(camera);assert.equal(bundle.version,version);
  camera.position.z=-30;camera.lookAt(0,0,0);helper.prepareRenderBundles(camera);
  assert.equal(helper.bundleDiagnostics.visibleMeshes,2);assert.equal(bundle.children[0].geometry.boundingSphere.center.z,-16);assert(bundle.version>version);
 }finally{helper.dispose();near.geometry.dispose();far.geometry.dispose();material.dispose();}
});

test('off-screen depth crossings retain the exact visible command cache',()=>{
 const root=new THREE.Group(),model=new THREE.Group();root.add(model);
 const material=new THREE.MeshStandardMaterial(),sources=[];
 for(const x of [0,80,90]){const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material);mesh.position.set(x,0,-8);model.add(mesh);sources.push(mesh);}
 const helper=createBlackwaterBuildingBatches(root,[model],{chunkSize:4,nativeBundles:true}),bundle=helper.root.getObjectByName('BlackwaterOpaqueCommands');
 try{
  const camera=new THREE.OrthographicCamera(-5,5,5,-5,.1,100);camera.rotation.y=-.01;helper.prepareRenderBundles(camera);
  assert.equal(helper.bundleDiagnostics.visibleMeshes,1);const version=bundle.version,order=[...bundle.children];
  camera.rotation.y=.01;helper.prepareRenderBundles(camera);
  assert.equal(helper.bundleDiagnostics.visibleMeshes,1);assert.notDeepEqual(bundle.children,order,'full sort really changes');
  assert.equal(bundle.version,version,'only invisible commands crossed');
  helper.prepareRenderBundles(camera,true);assert.equal(bundle.version,version+1,'shadow refresh still invalidates');
  camera.position.x=80;helper.prepareRenderBundles(camera);assert(bundle.version>version+1,'new actual visible member invalidates');
 }finally{helper.dispose();for(const mesh of sources)mesh.geometry.dispose();material.dispose();}
});
