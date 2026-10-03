import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createCoastalInstances} from '../coastal-instancing.js';

test('coastal batches share power-of-two shader capacities but retain exact draw counts',()=>{
 const geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial();
 for(const count of [1,2,3,4,5,7,8,9,31,33,511,513,1025]){
  const mesh=createCoastalInstances(geometry,material,count),capacity=mesh.instanceMatrix.count;
  assert.equal(capacity,2**Math.ceil(Math.log2(count)));assert.equal(mesh.count,count);assert(capacity>=count&&capacity<count*2);
  mesh.dispose();
 }
 geometry.dispose();material.dispose();
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
