import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createCoastalInstances,prepareCoastalInstances} from '../coastal-instancing.js';
import {instance} from '../vendor/three.tsl.js';

test('coastal batches share power-of-two shader capacities but retain exact draw counts',()=>{
 const geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial();
 for(const count of [1,2,3,4,5,7,8,9,31,33,511,513,1025]){
  const mesh=createCoastalInstances(geometry,material,count),capacity=mesh.instanceMatrix.count;
  assert.equal(capacity,2**Math.ceil(Math.log2(count)));assert.equal(mesh.count,count);assert(capacity>=count&&capacity<count*2);
  mesh.dispose();
 }
 geometry.dispose();material.dispose();
});

test('imported coastal instances keep existing colors, active counts and transforms, with repeat-safe preparation',()=>{
 const geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial(),mesh=new THREE.InstancedMesh(geometry,material,7);
 mesh.count=3;mesh.setColorAt(0,new THREE.Color(.2,.4,.6));mesh.setMatrixAt(0,new THREE.Matrix4().makeTranslation(8,3,9));
 const matrices=mesh.instanceMatrix,colors=mesh.instanceColor;
 prepareCoastalInstances(mesh);const view=mesh.geometry;prepareCoastalInstances(mesh);
 assert.equal(mesh.geometry,view);assert.equal(mesh.instanceMatrix,matrices);assert.equal(mesh.instanceColor,colors);
 assert.equal(view.getAttribute('coastalInstanceColor'),colors);assert.equal(mesh.count,3);assert.equal(mesh.userData.coastalInstanceCapacity,7);
 const matrix=new THREE.Matrix4();mesh.getMatrixAt(0,matrix);assert.deepEqual(matrix.elements.slice(12,15),[8,3,9]);
 mesh.dispose();geometry.dispose();material.dispose();
});

test('morphing pools keep their original object-specific shader bindings',()=>{
 const geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial(),mesh=new THREE.InstancedMesh(geometry,material,2);
 mesh.morphTexture={};prepareCoastalInstances(mesh);
 assert.equal(mesh.geometry,geometry);assert.equal(mesh.userData.coastalInstanceCapacity,undefined);
 mesh.morphTexture=null;mesh.dispose();geometry.dispose();material.dispose();
});
test('live outline instances share one upload hook and matrix view with their source',()=>{
 const geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial();
 const source=new THREE.InstancedMesh(geometry,material,3),ink=new THREE.InstancedMesh(geometry,material,0);
 ink.instanceMatrix=source.instanceMatrix;ink.count=source.count;
 prepareCoastalInstances(source);prepareCoastalInstances(ink);
 const sourceData=source.geometry.getAttribute('coastalMatrix0').data,inkData=ink.geometry.getAttribute('coastalMatrix0').data;
 assert.equal(inkData,sourceData);assert.equal(source.instanceMatrix,ink.instanceMatrix);
 source.setMatrixAt(0,new THREE.Matrix4().makeTranslation(4,7,9));source.instanceMatrix.needsUpdate=true;
 assert.equal(sourceData.version,1);assert.equal(source.instanceMatrix.version,1);assert.equal(inkData.array[13],7);
 source.dispose();ink.dispose();geometry.dispose();material.dispose();
});
test('padded matrices cannot expand active batch bounds',()=>{
 const geometry=new THREE.BoxGeometry(2,2,2),material=new THREE.MeshBasicMaterial(),mesh=createCoastalInstances(geometry,material,3),matrix=new THREE.Matrix4();
 for(let i=0;i<3;i++)mesh.setMatrixAt(i,matrix.makeTranslation(100+i*4,0,0));
 mesh.setMatrixAt(3,matrix.makeTranslation(1e6,1e6,1e6));
 mesh.computeBoundingBox();mesh.computeBoundingSphere();
 assert.deepEqual(mesh.boundingBox.min.toArray(),[99,-1,-1]);assert.deepEqual(mesh.boundingBox.max.toArray(),[109,1,1]);
 assert(mesh.boundingSphere.radius<8);assert.equal(mesh.count,3);assert.equal(mesh.instanceMatrix.count,4);
 mesh.dispose();geometry.dispose();material.dispose();
});
test('empty or invalid coastal instance counts cannot allocate zero GPU buffers',()=>{
 for(const count of [0,-1,NaN,Infinity,1.5])assert.throws(()=>createCoastalInstances(null,null,count),RangeError);
});

test('native coastal matrix attributes preserve each buffer without capacity-specific shader uniforms',()=>{
 const geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial();
 for(const count of [1,3,33,513]){
  const mesh=createCoastalInstances(geometry,material,count);
  mesh.setMatrixAt(0,new THREE.Matrix4().makeTranslation(7,2,-3));
  const node=instance(mesh.count,mesh.instanceMatrix);
  node._createInstanceMatrixNode(true,{object:mesh,geometry:mesh.geometry,getUniformBufferLimit:()=>65536});
  assert.equal(node.buffer,null,'named attributes do not retain an object-specific buffer in cached node state');
  const data=mesh.geometry.getAttribute('coastalMatrix0').data;
  assert.equal(data.isInstancedInterleavedBuffer,true);assert.equal(data.array,mesh.instanceMatrix.array);assert.equal(data.stride,16);
  assert.equal(data.array[12],7);assert.equal(data.array[13],2);assert.equal(data.array[14],-3);
  mesh.instanceMatrix.needsUpdate=true;assert.equal(data.version,1);
  assert.equal(mesh.geometry.getAttribute('position'),geometry.getAttribute('position'),'primitive vertex storage is borrowed');
  assert.equal(geometry.hasAttribute('coastalMatrix0'),false,'other bins cannot overwrite the source primitive');
  mesh.dispose();
 }
 const ordinary=new THREE.InstancedMesh(geometry,material,3),node=instance(3,ordinary.instanceMatrix);
 node._createInstanceMatrixNode(true,{object:ordinary,geometry:ordinary.geometry,getUniformBufferLimit:()=>65536});
 assert.equal(node.buffer,null,'other pools retain their existing uniform/morph path');
 ordinary.dispose();geometry.dispose();material.dispose();
});
