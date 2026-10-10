import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {instanceHarborStaticDetails,isFixedHarborDetail,isStaticHarborDetail} from '../harbor-static-details.js';
import {harborMooring} from '../harbor-detail.js';

test('fixed-name merge preserves every transformed vertex, UV, normal and borrowed owner',()=>{
 const parent=new THREE.Group(),root=new THREE.Group();parent.add(root);root.position.set(3,0,-5);root.rotation.y=.2;
 const material=new THREE.MeshStandardMaterial(),sources=[];let borrowedDisposals=0;
 for(let i=0;i<3;i++){const m=new THREE.Mesh(new THREE.CylinderGeometry(.055,.07,2+i*.25,8),material);m.name='SignMount';m.position.set(i*2,1,4);m.rotation.y=i*.12;m.scale.set(1,1+i*.15,.8);m.receiveShadow=true;m.layers.set(2);root.add(m);sources.push(m);m.geometry.addEventListener('dispose',()=>borrowedDisposals++);}
 root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),expected=sources.map(m=>m.geometry.clone().applyMatrix4(inverse.clone().multiply(m.matrixWorld)));
 const world={root,unitBox:new THREE.BoxGeometry(),thaiWorld:{root:new THREE.Group()}},art=instanceHarborStaticDetails(root,{eligible:o=>isStaticHarborDetail(o,world),mergeEligible:o=>isFixedHarborDetail(o,world)});
 assert.equal(art.meshes.length,1);assert.equal(art.diagnostics.mergedMeshes,1);assert.equal(art.diagnostics.sourceDraws,3);assert.equal(art.diagnostics.instanceDraws,1);
 const merged=art.meshes[0];assert.equal(merged.material,material);assert.equal(merged.layers.mask,4);assert.equal(merged.receiveShadow,true);assert.equal(merged.matrixAutoUpdate,false);
 for(const key of ['position','normal','uv'])assert.deepEqual(Array.from(merged.geometry.attributes[key].array),expected.flatMap(g=>Array.from(g.attributes[key].array)));
 let offset=0,indices=[];for(const g of expected){indices.push(...Array.from(g.index.array,n=>n+offset));offset+=g.attributes.position.count;}assert.deepEqual(Array.from(merged.geometry.index.array),indices);
 let ownedDisposals=0;merged.geometry.addEventListener('dispose',()=>ownedDisposals++);material.addEventListener('dispose',()=>borrowedDisposals++);
 art.setEnabled(false);assert(sources.every(m=>m.visible));assert.equal(merged.visible,false);art.setEnabled(true);assert(sources.every(m=>!m.visible));
 art.dispose();art.dispose();assert.equal(ownedDisposals,1);assert.equal(borrowedDisposals,0);assert(sources.every(m=>m.visible));expected.forEach(g=>g.dispose());
});

test('actual mooring source retains silhouettes and reduces fixed submissions without changing triangle population',()=>{
 const root=new THREE.Group(),world={root,materials:{rust:new THREE.MeshStandardMaterial(),signal:new THREE.MeshStandardMaterial()},unitBox:new THREE.BoxGeometry(),thaiWorld:{root:new THREE.Group()}};
 for(const x of [5,13,21,37,45,53])harborMooring(world,x,119.3);
 const triangleCount=()=>{let n=0;root.traverseVisible(o=>{if(o.isMesh)n+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);});return n;};
 const before=triangleCount(),art=instanceHarborStaticDetails(root,{eligible:o=>isStaticHarborDetail(o,world),mergeEligible:o=>isFixedHarborDetail(o,world)});
 assert.equal(art.diagnostics.sourceDraws,12);assert.equal(art.diagnostics.instanceDraws,4);assert.equal(triangleCount(),before);assert.deepEqual(art.diagnostics.sourceNames,{CastMooringBollard:6,MooringReflectiveBand:6});art.dispose();assert.equal(triangleCount(),before);
});

test('named eligibility cannot cross moving/toggled ownership; hooks, partial buffers and fences stay original',()=>{
 const root=new THREE.Group(),world={root,unitBox:new THREE.BoxGeometry(),thaiWorld:{root:new THREE.Group()}},material=new THREE.MeshStandardMaterial();
 const add=(name,parent=root)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(),material);m.name=name;parent.add(m);return m;};
 const entry=new THREE.Group();entry.name='HarborEntrance:actual';root.add(entry);const structural=add('EntranceJamb',entry);assert(isFixedHarborDetail(structural,world));
 const protectedObjects=[add('EntranceDoor',entry),add('EntrancePull',entry),add('GraphicInk'),add('BlackwaterBuildingBatch')];
 const moving=new THREE.Group();moving.userData.dynamic=true;root.add(moving);protectedObjects.push(add('SignMount',moving));
 const partial=add('SignMount');partial.geometry.setDrawRange(0,3);protectedObjects.push(partial);
 const hooked=add('SignMount');hooked.onBeforeShadow=()=>{};protectedObjects.push(hooked);
 const fence=new THREE.InstancedMesh(new THREE.BoxGeometry(),material,3);fence.name='ThaiKitBoundaryFence';root.add(fence);protectedObjects.push(fence);
 const hidden=add('SignMount');hidden.visible=false;const art=instanceHarborStaticDetails(root,{eligible:o=>isStaticHarborDetail(o,world),mergeEligible:o=>isFixedHarborDetail(o,world)});
 for(const m of protectedObjects)assert.equal(m.visible,true,m.name);assert.equal(hidden.visible,false);assert.equal(art.diagnostics.sourceMeshes,0);art.dispose();
});
