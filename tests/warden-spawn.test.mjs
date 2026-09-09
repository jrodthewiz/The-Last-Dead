import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createWarden} from '../npc-warden.js';

test('warden clones reuse normalized bounds without visiting every vertex on spawn',()=>{
 const template=new THREE.Group();
 template.add(new THREE.Mesh(new THREE.BoxGeometry(1,3,1),new THREE.MeshStandardMaterial()));
 const original=THREE.Mesh.prototype.getVertexPosition;let vertices=0;
 THREE.Mesh.prototype.getVertexPosition=function(...args){vertices++;return original.apply(this,args);};
 try {
  const first=createWarden(template,[],0);assert.ok(vertices>0);
  vertices=0;const second=createWarden(template,[],0),heavy=createWarden(template,[],2);
  assert.equal(vertices,0,'cached clones must not reskin vertices to calculate bounds');
  assert.equal(second.userData.warden.normalization,first.userData.warden.normalization);
  assert.ok(Math.abs(heavy.userData.warden.normalization*3-2.2)<1e-8);
  assert.notEqual(first.userData.warden.materials[0],second.userData.warden.materials[0],'hit flashes remain per enemy');
 } finally {THREE.Mesh.prototype.getVertexPosition=original;}
});
