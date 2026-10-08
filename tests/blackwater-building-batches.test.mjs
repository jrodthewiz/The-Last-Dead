import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createBlackwaterBuildingBatches} from '../blackwater-building-batches.js';
import {shareBlackwaterOwnedMaterials} from '../blackwater-material-sharing.js';
import {createModel} from '../assets/blackwater-kit/architecture.js';
import {createBlackwaterMaterials} from '../assets/blackwater-kit/materials.js';
import {makeBlackwaterDistrict} from '../blackwater-district-layout.js';
import {makeCoastalNeighborhoods} from '../coastal-neighborhood-layout.js';

const close=(a,b,tolerance=.0001)=>assert.ok(Math.abs(a-b)<tolerance,`${a} ~= ${b}`);
function synthetic(material){
 const root=new THREE.Group(),models=[0,1].map(i=>({root:new THREE.Group(),colliders:[{id:`fixture-${i}`,x:i}]}));
 models.forEach((model,i)=>{model.root.name=`lot-${i}`;model.root.userData.blackwaterPlacement=model.root.name;model.root.position.set(6+i*5,.13,8);root.add(model.root);});
 return{root,models,add(model,index=0){const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,1,3),material);mesh.name=`architecture-${index}`;mesh.userData.blackwaterSlot='brick';mesh.castShadow=true;mesh.receiveShadow=true;model.root.add(mesh);return mesh;}};
}

test('static building batches preserve local bounds, normals, exact materials, model metadata and ownership',()=>{
 const material=new THREE.MeshStandardMaterial(),hook=()=>{};material.onBeforeCompile=hook;
 const {root,models,add}=synthetic(material),a=add(models[0]),b=add(models[1]);
 const signMaterial=material.clone(),sign=new THREE.Mesh(new THREE.BoxGeometry(.6,.2,.05),signMaterial);sign.userData.blackwaterSlot='sign';models[0].root.add(sign);
 root.position.set(50,4,-30);root.rotation.y=.33;root.scale.set(1.3,.9,.7);
 models[0].root.rotation.y=.47;b.scale.set(1.6,.55,.8);b.rotation.set(.12,-.32,.09);
 root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),expected=new THREE.Box3(),sourcePositions=a.geometry.attributes.position.array.slice(),colliders=JSON.stringify(models.map(m=>m.colliders));
 for(const source of [a,b,sign]){const geometry=source.geometry.clone().applyMatrix4(inverse.clone().multiply(source.matrixWorld));geometry.computeBoundingBox();expected.union(geometry.boundingBox);geometry.dispose();}
 let sourceDisposals=0,materialDisposals=0,batchDisposals=0;
 for(const source of [a,b,sign])source.geometry.addEventListener('dispose',()=>sourceDisposals++);
 for(const source of [material,signMaterial])source.addEventListener('dispose',()=>materialDisposals++);
 const batches=createBlackwaterBuildingBatches(root,models,{downtownBuildingIds:['lot-0']});
 try{
  assert.equal(batches.diagnostics.sourceDraws,3);assert.equal(batches.diagnostics.batchedDraws,2);
  assert.equal(batches.diagnostics.triangles,batches.diagnostics.mergedTriangles);
  const brick=batches.meshes.find(m=>m.material===material);assert.ok(brick);assert.equal(brick.material.onBeforeCompile,hook);
  assert.deepEqual(brick.userData.sourceBuildingIds,['lot-0','lot-1']);assert.deepEqual(brick.userData.downtownBuildingIds,['lot-0']);
  assert.ok(batches.meshes.some(m=>m.material===signMaterial),'unique sign identity remains separate');
  assert.equal(root.getObjectByName('lot-0'),models[0].root);assert.equal(models[0].root.visible,true);assert.equal(a.visible,false);assert.equal(b.visible,false);
  assert.deepEqual(a.geometry.attributes.position.array,sourcePositions);assert.equal(JSON.stringify(models.map(m=>m.colliders)),colliders);
  for(let i=0;i<3;i++){close(batches.diagnostics.bounds.min[i],expected.min.getComponent(i));close(batches.diagnostics.bounds.max[i],expected.max.getComponent(i));}
  const normal=brick.geometry.attributes.normal;for(let i=0;i<normal.count;i++)close(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i)),1);
  assert.equal(brick.castShadow,true);assert.equal(brick.receiveShadow,true);
  for(const mesh of batches.meshes)mesh.geometry.addEventListener('dispose',()=>batchDisposals++);
 }finally{batches.dispose();batches.dispose();}
 assert.equal(a.visible,true);assert.equal(b.visible,true);assert.equal(sign.visible,true);assert.equal(batches.root.parent,null);assert.equal(batchDisposals,2);assert.equal(sourceDisposals,0);assert.equal(materialDisposals,0);
 for(const source of [a,b,sign])source.geometry.dispose();material.dispose();signMaterial.dispose();
});

test('explicit protected, animated, instanced and initially hidden sources retain their original state',()=>{
 const material=new THREE.MeshStandardMaterial(),{root,models,add}=synthetic(material),plain=add(models[0]),protectedMesh=add(models[0],1),hidden=add(models[0],2);
 protectedMesh.userData.noBatch=true;hidden.visible=false;
 const moving=new THREE.Group();moving.userData.dynamic=true;models[1].root.add(moving);const child=new THREE.Mesh(new THREE.BoxGeometry(),material);moving.add(child);
 const instances=new THREE.InstancedMesh(new THREE.BoxGeometry(),material,1);models[1].root.add(instances);
 const hooked=add(models[1],3);hooked.onBeforeRender=()=>{};
 const shadowHooked=add(models[1],4);shadowHooked.onBeforeShadow=()=>{};
 const customShadow=add(models[1],5);customShadow.customDepthMaterial=new THREE.MeshDepthMaterial();
 const batch=createBlackwaterBuildingBatches(root,models);
 try{
  assert.equal(batch.diagnostics.mergedSourceDraws,1);assert.equal(batch.diagnostics.protectedDraws,6);assert.equal(batch.diagnostics.hiddenSources,1);
  assert.equal(batch.diagnostics.batchedDraws,7);assert.equal(plain.visible,false);
  for(const mesh of [protectedMesh,child,instances,hooked,shadowHooked,customShadow])assert.equal(mesh.visible,true);
  assert.equal(hidden.visible,false);
 }finally{batch.dispose();batch.dispose();root.traverse(o=>{if(o.isMesh)o.geometry.dispose();});customShadow.customDepthMaterial.dispose();material.dispose();}
 assert.equal(plain.visible,true);assert.equal(hidden.visible,false);
});

test('bounded vertex groups split without changing geometry or merging incompatible state',()=>{
 const material=new THREE.MeshStandardMaterial(),root=new THREE.Group(),model={root:new THREE.Group()};root.add(model.root);
 const sources=Array.from({length:5},(_,i)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(),material);m.position.set(3+i,0,2);model.root.add(m);return m;});
 const layered=new THREE.Mesh(new THREE.BoxGeometry(),material);layered.layers.set(1);layered.position.set(4,0,2);model.root.add(layered);
 const batches=createBlackwaterBuildingBatches(root,[model],{maxVertices:48});
 try{
  assert.equal(batches.diagnostics.sourceDraws,6);assert.equal(batches.diagnostics.batchedDraws,4);assert.equal(batches.diagnostics.triangles,72);assert.equal(batches.diagnostics.mergedTriangles,72);
  assert.ok(batches.diagnostics.batches.every(b=>b.vertices<=48));assert.equal(batches.meshes.filter(m=>m.layers.mask===2).length,1);
 }finally{batches.dispose();for(const m of [...sources,layered])m.geometry.dispose();material.dispose();}
});

test('baked negative scale retains outward triangle winding and normals',()=>{
 const material=new THREE.MeshStandardMaterial(),root=new THREE.Group(),model={root:new THREE.Group()},geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute([0,0,1,0,0,1,0,0,1],3));
 geometry.setAttribute('tangent',new THREE.Float32BufferAttribute([1,0,0,1,1,0,0,1,1,0,0,1],4));
 const source=new THREE.Mesh(geometry,material);source.scale.x=-1;model.root.add(source);root.add(model.root);
 const batches=createBlackwaterBuildingBatches(root,[model]);
 try{
  const g=batches.meshes[0].geometry,p=g.attributes.position,index=g.index;
  const points=[0,1,2].map(i=>new THREE.Vector3().fromBufferAttribute(p,index.getX(i))),cross=points[1].sub(points[0]).cross(points[2].sub(points[0]));
  assert.ok(cross.z>0);assert.equal(g.attributes.normal.getZ(0),1);assert.equal(g.attributes.tangent.getW(0),-1);assert.equal(geometry.attributes.tangent.getW(0),1);
 }finally{batches.dispose();geometry.dispose();material.dispose();}
});

test('owned material sharing preserves different maps, hooks, Cartesian values, signs and unknown objects',()=>{
 const seed=new THREE.MeshStandardMaterial({color:0x9b7754,roughness:.94});seed.name='blackwater-commercial-furnitureWood';seed.userData={lookRole:'furnitureWood',textureMeters:2};
 const hook=()=>{};seed.onBeforeCompile=hook;
 const equivalent=seed.clone();equivalent.onBeforeCompile=hook;
 const differentHook=seed.clone();differentHook.onBeforeCompile=()=>{};
 const differentEuler=seed.clone();differentEuler.onBeforeCompile=hook;differentEuler.envMapRotation.y=.2;
 const differentScale=seed.clone();differentScale.onBeforeCompile=hook;differentScale.normalScale.x=2;
 const mapA=seed.clone(),mapB=seed.clone();mapA.onBeforeCompile=mapB.onBeforeCompile=hook;mapA.map=new THREE.Texture();mapB.map=mapA.map.clone();
 const unknownA=seed.clone(),unknownB=seed.clone();unknownA.onBeforeCompile=unknownB.onBeforeCompile=hook;unknownA.customObject={sameValue:1};unknownB.customObject={sameValue:1};
 const sign=seed.clone();sign.name='blackwater-sign-unique';sign.onBeforeCompile=hook;
 const sourceMaterials=[seed,equivalent,differentHook,differentEuler,differentScale,mapA,mapB,unknownA,unknownB,sign],root=new THREE.Group();
 const meshes=sourceMaterials.map(material=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(),material);root.add(mesh);return mesh;});
 let disposals=0;const sharing=shareBlackwaterOwnedMaterials([{root}]);for(const material of sourceMaterials)material.addEventListener('dispose',()=>disposals++);
 try{
  assert.equal(meshes[1].material,seed);assert.equal(sharing.diagnostics.aliasedSlots,1);
  for(let i=2;i<meshes.length;i++)assert.equal(meshes[i].material,sourceMaterials[i]);
  assert.equal(seed.onBeforeCompile,hook);assert.equal(seed.userData.textureMeters,2);
 }finally{sharing.restore();sharing.restore();}
 for(let i=0;i<meshes.length;i++)assert.equal(meshes[i].material,sourceMaterials[i]);assert.equal(disposals,0);
 for(const mesh of meshes)mesh.geometry.dispose();mapA.map.dispose();mapB.map.dispose();for(const material of sourceMaterials)material.dispose();
});

test('all94 static models retain geometry and collision while32/48/64m chunks reduce source submissions',t=>{
 const slice=makeBlackwaterDistrict(makeCoastalNeighborhoods()),materials=createBlackwaterMaterials(),root=new THREE.Group(),models=[],measurements=[];
 for(const [i,b]of slice.buildings.entries()){const model=createModel({...b,seed:1400+i,materials});model.root.position.set(b.x,.13,b.z);model.root.rotation.y=b.yaw;model.root.userData.blackwaterPlacement=b.id;root.add(model.root);models.push(model);}
 const plans=JSON.stringify(models.map(m=>m.colliders)),originals=[];for(const model of models)model.root.traverse(o=>{if(o.isMesh)originals.push([o,o.material]);});
 const sharing=shareBlackwaterOwnedMaterials(models);assert.equal(sharing.diagnostics.aliasedSlots,197);assert.equal(sharing.diagnostics.sharedOwnedVariants,8);
 try{
  for(const chunkSize of [32,48,64]){
   const helper=createBlackwaterBuildingBatches(root,models,{chunkSize,downtownBuildingIds:slice.downtownBuildingIds});
   try{
    const d=helper.diagnostics;assert.equal(d.sourceDraws,1283);assert.equal(d.protectedDraws,0);assert.ok(d.triangles<2100000,'whole-coast source geometry retains the shared 2.1M triangle budget');assert.equal(d.mergedTriangles,d.triangles);assert.ok(d.batchedDraws<d.sourceDraws*.65);
    assert.ok(d.batchedDraws<=({32:762,48:484,64:358})[chunkSize]+32,'entrance surfaces and three district roof materials stay within thirty-two extra spatial batches');if(chunkSize===48)assert.ok(d.batchedDraws<d.sourceDraws*.40);
    assert.ok(d.batches.every(b=>b.vertices<=256000));assert.equal(JSON.stringify(models.map(m=>m.colliders)),plans);
    const cameras=[['downtown',[219,1.75,62],[196,2.7,46]],['apartments',[250,1.75,6],[250,2,17]],['works',[166,1.75,118],[164,2.3,130]],['cape',[158,1.75,238],[158,2.3,252]]];
    root.updateMatrixWorld(true);const views={};
    for(const [name,from,to]of cameras){const camera=new THREE.PerspectiveCamera(55,1.6,.1,120);camera.position.fromArray(from);camera.lookAt(...to);camera.updateMatrixWorld(true);const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));const visible=helper.meshes.filter(m=>frustum.intersectsObject(m));views[name]={draws:visible.length,triangles:visible.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0)};}
    measurements.push({chunkSize,sourceDraws:d.sourceDraws,batchedDraws:d.batchedDraws,chunks:d.chunkCount,largestVertices:Math.max(...d.batches.map(b=>b.vertices)),views});
   }finally{helper.dispose();}
   for(const model of models)model.root.traverse(o=>{if(o.isMesh)assert.equal(o.visible,true);});
  }
  t.diagnostic(JSON.stringify(measurements));
 }finally{sharing.restore();for(const[o,material]of originals)assert.equal(o.material,material);models.forEach(m=>m.dispose());materials.dispose();}
});
