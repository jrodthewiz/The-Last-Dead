import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {finalizeStaticWorld} from '../world-static.js';
test('static graph preserves transforms and moving door pivots',()=>{
 const scene=new THREE.Scene(),root=new THREE.Group(),wallGroup=new THREE.Group(),empty=new THREE.Group(),door=new THREE.Group();scene.add(root);root.position.set(3,2,1);root.rotation.y=.4;root.add(wallGroup,empty,door);wallGroup.position.set(2,1,-3);door.position.set(1,0,2);
 const wall=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()),leaf=wall.clone();wallGroup.add(wall);door.add(leaf);wall.position.set(.2,.3,.4);scene.updateMatrixWorld(true);const before=wall.matrixWorld.clone();
 const result=finalizeStaticWorld(root,[door]);scene.updateMatrix();scene.matrixAutoUpdate=false;scene.updateMatrixWorld(true);assert.deepEqual(wall.matrixWorld.elements,before.elements);assert.equal(empty.parent,null);assert.equal(wall.matrixAutoUpdate,false);assert.equal(door.matrixAutoUpdate,true);assert.equal(leaf.matrixAutoUpdate,true);assert.equal(result.pruned,1);
 const old=leaf.getWorldPosition(new THREE.Vector3());door.position.y+=2;scene.updateMatrixWorld();assert.ok(Math.abs(leaf.getWorldPosition(new THREE.Vector3()).y-old.y-2)<1e-8);assert.deepEqual(wall.matrixWorld.elements,before.elements);
});
