import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createBlackwaterBuildingBatches} from '../blackwater-building-batches.js';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);
const sameMatrix=(a,b)=>a.elements.forEach((n,i)=>close(n,b.elements[i]));
test('baked leaves avoid repeated composition while moving parent, near/far culling and ownership match automatic leaves',()=>{
 const ancestor=new THREE.Group(),root=new THREE.Group(),material=new THREE.MeshStandardMaterial();ancestor.add(root);
 root.position.set(4,.3,-8);root.rotation.set(.1,.4,-.05);root.scale.set(.8,1.2,1.1);
 const sources=[0,1].map(i=>{
  const model=new THREE.Group();model.name=`lot-${i}`;model.position.set(i*64,.13,9);model.rotation.y=.23;
  const source=new THREE.Mesh(new THREE.BoxGeometry(4,7,5),material);source.userData.blackwaterSlot='brick';source.castShadow=source.receiveShadow=true;model.add(source);root.add(model);
  return{root:model,source};
 });
 const batches=createBlackwaterBuildingBatches(root,sources),baselineRoot=new THREE.Group();root.add(baselineRoot);
 const baseline=batches.meshes.map(mesh=>{const copy=mesh.clone(false);copy.matrixAutoUpdate=true;baselineRoot.add(copy);return copy;});
 const originalBounds=batches.meshes.map(mesh=>mesh.geometry.boundingBox.clone());
 let optimizedComposes=0,baselineComposes=0,ownedDisposals=0,sourceDisposals=0,materialDisposals=0;
 batches.meshes.forEach(mesh=>{
  assert.equal(mesh.matrixAutoUpdate,false);assert.equal(mesh.matrixWorldAutoUpdate,true);
  const update=mesh.updateMatrix;mesh.updateMatrix=function(){optimizedComposes++;return update.call(this);};
  mesh.geometry.addEventListener('dispose',()=>ownedDisposals++);
 });
 baseline.forEach(mesh=>{const update=mesh.updateMatrix;mesh.updateMatrix=function(){baselineComposes++;return update.call(this);};});
 sources.forEach(p=>p.source.geometry.addEventListener('dispose',()=>sourceDisposals++));material.addEventListener('dispose',()=>materialDisposals++);
 const cameras=[new THREE.PerspectiveCamera(60,1.6,.1,150),new THREE.PerspectiveCamera(60,1.6,.1,2400)],frustum=new THREE.Frustum(),projection=new THREE.Matrix4();
 cameras[0].position.set(8,2,15);cameras[0].lookAt(10,3,0);cameras[1].position.set(25,210,-30);cameras[1].lookAt(225,0,200);cameras.forEach(c=>c.updateMatrixWorld(true));
 try{
  for(let frame=0;frame<120;frame++){
   ancestor.position.set(frame*.7,Math.sin(frame*.1)*3,-frame*.25);ancestor.rotation.set(frame*.002,frame*.005,-frame*.001);ancestor.scale.set(1+frame*.002,.7+frame*.001,1.4-frame*.002);
   batches.meshes.forEach((mesh,i)=>{mesh.visible=(frame+i)%7!==0;baseline[i].visible=mesh.visible;});
   ancestor.updateMatrixWorld(true);
   batches.meshes.forEach((mesh,i)=>{
    const other=baseline[i];sameMatrix(mesh.matrixWorld,other.matrixWorld);
    assert.deepEqual(mesh.geometry.boundingBox,originalBounds[i]);
    assert.deepEqual(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld),other.geometry.boundingBox.clone().applyMatrix4(other.matrixWorld));
    assert.deepEqual(mesh.geometry.boundingSphere.clone().applyMatrix4(mesh.matrixWorld),other.geometry.boundingSphere.clone().applyMatrix4(other.matrixWorld));
    assert.equal(mesh.visible,other.visible);assert.equal(mesh.castShadow,other.castShadow);assert.equal(mesh.receiveShadow,other.receiveShadow);assert.equal(mesh.material,other.material);
    for(const camera of cameras){frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));assert.equal(frustum.intersectsObject(mesh),frustum.intersectsObject(other));}
   });
  }
  assert.equal(optimizedComposes,0);assert.equal(baselineComposes,120*baseline.length);
  console.log(JSON.stringify({frames:120,leaves:baseline.length,automaticLocalCompositions:baselineComposes,immutableLocalCompositions:optimizedComposes,scope:'CPU work counts; moving-parent matrix/bounds and near/far culling parity; no render/FPS benchmark'}));
 }finally{batches.dispose();batches.dispose();baselineRoot.removeFromParent();}
 assert.equal(ownedDisposals,batches.meshes.length);assert.equal(sourceDisposals,0);assert.equal(materialDisposals,0);assert.equal(batches.root.parent,null);
 sources.forEach(p=>{assert.equal(p.source.visible,true);p.source.geometry.dispose();});material.dispose();
});
