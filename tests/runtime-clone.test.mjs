import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {cloneRuntimeObject,cloneRuntimeMaterial} from '../runtime-clone.js';

test('runtime hierarchy cloning shares GPU resources and remaps cyclic node metadata without exporting images',()=>{
 const texture=new THREE.Texture(),material=new THREE.MeshBasicMaterial(),geometry=new THREE.BoxGeometry();
 texture.toJSON=()=>{throw Error('runtime textures must never be exported');};material.map=texture;
 const root=new THREE.Group(),child=new THREE.Mesh(geometry,material);root.add(child);
 root.userData={runtime:{child,texture,material,geometry},record:{value:3},pivot:new THREE.Vector3(1,2,3)};
 child.userData.owner=root;const original=root.userData;
 const clone=cloneRuntimeObject(root);
 assert.equal(root.userData,original);assert.equal(clone.userData.runtime.child,clone.children[0]);assert.equal(clone.children[0].userData.owner,clone);
 for(const key of ['texture','material','geometry'])assert.equal(clone.userData.runtime[key],root.userData.runtime[key]);
 assert.equal(clone.children[0].material,material);assert.equal(clone.children[0].geometry,geometry);
 clone.userData.record.value=7;clone.userData.pivot.x=8;assert.equal(root.userData.record.value,3);assert.equal(root.userData.pivot.x,1);
});

test('runtime material clones share textures but isolate mutable metadata and preserve material properties',()=>{
 const source=new THREE.MeshStandardMaterial({color:0x123456,roughness:.7}),texture=new THREE.Texture();texture.toJSON=()=>{throw Error('unexpected image export');};
 source.map=texture;source.userData={cleanMap:texture,settings:{value:2}};source.userData.loop=source.userData;const original=source.userData;
 const clone=cloneRuntimeMaterial(source);assert.equal(source.userData,original);assert.equal(clone.map,texture);assert.equal(clone.userData.cleanMap,texture);
 assert.equal(clone.color.getHex(),0x123456);assert.equal(clone.roughness,.7);assert.equal(clone.userData.loop,clone.userData);
 clone.userData.settings.value=5;assert.equal(source.userData.settings.value,2);
});

test('metadata is restored when a clone fails, and instance matrices remain independent',()=>{
 const root=new THREE.Group(),data={value:1};root.userData=data;root.clone=()=>{throw Error('copy failed');};
 assert.throws(()=>cloneRuntimeObject(root),/copy failed/);assert.equal(root.userData,data);
 const source=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial(),2);source.setMatrixAt(0,new THREE.Matrix4().makeTranslation(4,0,0));
 const clone=cloneRuntimeObject(source);assert.notEqual(clone.instanceMatrix.array,source.instanceMatrix.array);assert.equal(clone.count,2);
 const pose=new THREE.Matrix4();clone.getMatrixAt(0,pose);assert.equal(pose.elements[12],4);
});
