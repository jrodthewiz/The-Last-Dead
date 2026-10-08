import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {applyBlackwaterGraphicStyle} from '../blackwater-graphic-style.js';
import {buildBlackwaterDistrict} from '../blackwater-district-visuals.js';
import {makeHarborCourse} from '../harbor-course.js';
import {readFileSync} from 'node:fs';

test('graphic adapter bakes nonuniform scale and instancing into bounded ink and restores borrowed materials',()=>{
 const root=new THREE.Group(),source=new THREE.MeshStandardMaterial({color:'#67898f'}),geometry=new THREE.BoxGeometry(1,1,1);
 source.userData.lookRole='metal';const mesh=new THREE.Mesh(geometry,source);mesh.position.set(194,1,72);mesh.scale.set(8,2,.5);root.add(mesh);
 const instances=new THREE.InstancedMesh(geometry,source,2);for(let i=0;i<2;i++)instances.setMatrixAt(i,new THREE.Matrix4().makeTranslation(198+i,1,75));root.add(instances);
 const before=new THREE.Box3().setFromObject(root);let borrowed=0;source.addEventListener('dispose',()=>borrowed++);geometry.addEventListener('dispose',()=>borrowed++);
 const sun=new THREE.DirectionalLight(),fill=new THREE.HemisphereLight(),style=applyBlackwaterGraphicStyle(root,{lightSources:[sun,fill]});assert.equal(style.diagnostics.materialVariants,1);assert.equal(style.diagnostics.inkTriangles,36);assert.ok(style.diagnostics.inkChunks<=2);assert.deepEqual(mesh.material.lightsNode.getLights(),[sun,fill]);
 assert.equal(mesh.material,instances.material);assert.equal(mesh.material.type,'MeshToonNodeMaterial');assert.equal(mesh.material.userData.lookRole,'metal');assert.equal(mesh.geometry,geometry);
 let geometryDisposals=0,materialDisposals=0;
 const hulls=root.children.filter(o=>o.userData.graphicInk);const hullBox=new THREE.Box3();
 for(const ink of hulls){ink.geometry.addEventListener('dispose',()=>geometryDisposals++);ink.geometry.computeBoundingBox();hullBox.union(ink.geometry.boundingBox);for(const attr of Object.values(ink.geometry.attributes))assert.ok(Array.from(attr.array).every(Number.isFinite));}
 assert.ok(hullBox.min.distanceTo(before.min)<1e-6);assert.ok(hullBox.max.distanceTo(before.max)<1e-6);
 mesh.material.addEventListener('dispose',()=>materialDisposals++);style.dispose();style.dispose();
 assert.equal(borrowed,0);assert.equal(geometryDisposals,hulls.length);assert.equal(materialDisposals,1);assert.equal(mesh.material,source);assert.equal(instances.material,source);assert.equal(root.children.length,2);
 instances.dispose();geometry.dispose();source.dispose();
});

test('selected coast shares the game adapter with finite, measured ink and94 enterable buildings',()=>{
 const parent=new THREE.Group(),district=buildBlackwaterDistrict(parent,makeHarborCourse({openWorld:true}).coastal.blackwaterSlice);
 const style=applyBlackwaterGraphicStyle(district.root);
 try{
  assert.equal(style.diagnostics.direction,'graphic-horror');assert.equal(district.diagnostics.enterable.length,94);assert.ok(style.diagnostics.inkChunks<=96);assert.ok(style.diagnostics.inkTriangles<2300000);
  district.root.traverse(o=>{if(o.userData.graphicInk)for(const attr of Object.values(o.geometry.attributes))assert.ok(Array.from(attr.array).every(Number.isFinite));});
 }finally{style.dispose();district.dispose();}
 assert.equal(parent.children.length,0);
});

test('retiring a harbor keeps owned resources alive until a pending compile settles, including rejection',async()=>{
 const source=readFileSync(new URL('../renderer.js',import.meta.url),'utf8'),method='  _buildWorld(course) {';
 const begin=source.indexOf(method)+method.length,end=source.indexOf('    this._enemyVisuals.clear();',begin);
 assert.ok(begin>=method.length&&end>begin);
 // Run the actual retirement path with resource owners and a controlled GPU
 // completion promise. This isolates async lifetime from canvas construction.
 const retire=new Function('course','disposeObject',source.slice(begin,end));
 for(const outcome of ['immediate','resolve','reject']){
  const events=[],world={userData:{}},harbor={dispose(){events.push('harbor');}};let finish;
  const pending=outcome==='immediate'?null:new Promise((resolve,reject)=>{finish=()=>outcome==='reject'?reject(Error('compile failed')):resolve();});
  const state={harborWorld:harbor,worldRoot:world,_warmupPromise:pending,scene:{remove(value){assert.equal(value,world);events.push('removed');}}};
  retire.call(state,{},value=>{assert.equal(value,world);events.push('world');});assert.equal(state.harborWorld,null);
  if(pending){assert.deepEqual(events,['removed'],'retired buffers survive the in-flight shader poll');assert.equal(state._retiredWorlds.size,1);finish();await pending.catch(()=>{});await Promise.resolve();assert.equal(state._retiredWorlds.size,0);assert.deepEqual(events,['removed','harbor','world']);}
  else assert.deepEqual(events,['harbor','removed','world']);
 }
});
