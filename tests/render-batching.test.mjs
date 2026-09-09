import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../vendor/three.module.js';
import {batchStaticWorld} from '../world-polish.js';
test('batching preserves transformed vertices, attributes, shadows and animated children',()=>{
 const parent=new THREE.Group(),root=new THREE.Group();parent.position.set(10,3,-5);root.rotation.y=.6;root.scale.setScalar(2);parent.add(root);
 const material=new THREE.MeshStandardMaterial(),meshes=[];
 for(let i=0;i<3;i++){const g=new THREE.BoxGeometry();g.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*3).fill(.5),3));const m=new THREE.Mesh(g,material);m.position.set(i,2,i*2);m.castShadow=true;root.add(m);meshes.push(m);}
 const signal=new THREE.Mesh(new THREE.SphereGeometry(),material);root.add(signal);parent.updateMatrixWorld(true);
 const before=meshes.flatMap(m=>{const g=m.geometry.toNonIndexed();const points=[];for(let i=0;i<g.attributes.position.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(g.attributes.position,i).applyMatrix4(m.matrixWorld));return points;});
 assert.deepEqual(batchStaticWorld(root,[signal]),{removed:3,batches:1});assert.equal(signal.parent,root);
 parent.updateMatrixWorld(true);const batch=root.children.find(m=>m!==signal);assert.equal(batch.material,material);assert.equal(batch.castShadow,true);assert.ok(batch.geometry.attributes.color);
 for(let i=0;i<before.length;i++)assert.ok(before[i].distanceTo(new THREE.Vector3().fromBufferAttribute(batch.geometry.attributes.position,i).applyMatrix4(batch.matrixWorld))<1e-5);
});
