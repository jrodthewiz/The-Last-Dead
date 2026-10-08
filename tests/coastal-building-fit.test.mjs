import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {HarborThaiVisuals} from '../harbor-thai-visuals.js';

test('coastal architecture fills its reserved world footprint at every cardinal facing',()=>{
 const template=new THREE.Group();
 const source=new THREE.Mesh(new THREE.BoxGeometry(10,20,6),new THREE.MeshStandardMaterial());
 source.position.set(2,10,-3);template.add(source);template.updateMatrixWorld(true);
 for(const yaw of [0,Math.PI/2,Math.PI,3*Math.PI/2]){
  const subject={root:new THREE.Group(),diagnostics:{placements:0,coastalDrawCalls:0}};
  const placement={x:100,z:200,y:.13,width:15.3,depth:11.3,height:9,yaw};
  HarborThaiVisuals.prototype.batchCoastal.call(subject,template,[placement]);
  const bounds=new THREE.Box3().setFromObject(subject.root),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  for(const [actual,wanted] of [[size.x,15.3],[size.z,11.3],[size.y,9],[center.x,100],[center.z,200],[bounds.min.y,.13]])assert.ok(Math.abs(actual-wanted)<.0001,`${actual} != ${wanted}`);
  assert.equal(subject.diagnostics.placements,1);assert.equal(subject.diagnostics.coastalDrawCalls,1);
 }
 source.geometry.dispose();source.material.dispose();
});
