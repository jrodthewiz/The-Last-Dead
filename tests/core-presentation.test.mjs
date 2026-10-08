import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {coreVisualScale,ProjectileWakes} from '../secondary-vfx.js';
import {OrdnanceDetails,coreCanisterGeometry} from '../combat-detail-v2.js';

const camera=new THREE.Vector3(20,1.6,28);
const core={id:1,x:5,y:7,z:.4,vx:2.8,vy:0,vz:.5,age:.05,life:3,core:true,kind:'core'};

test('eye-spawned core shell and wake stay out of the camera, then ease into a compact canister',()=>{
 const original=structuredClone(core),wakes=new ProjectileWakes(new THREE.Group());
 assert.equal(coreVisualScale(core,camera),0);
 wakes.update([core],false,camera);assert.equal(wakes.mesh.count,0);
 let previous=0;
 for(let distance=.4;distance<=2;distance+=.05){
  const p={...core,x:core.x+distance/4};
  const scale=coreVisualScale(p,camera);assert(scale>=previous-1e-9);assert(scale<=.65);previous=scale;
  // The largest pressure band stays under eight degrees across while emerging.
  assert(2*Math.atan(.119*scale/distance)<THREE.MathUtils.degToRad(8));
 }
 const far={...core,x:core.x+1};
 assert.equal(coreVisualScale(far,camera),.65);
 wakes.update([far],false,camera);assert.equal(wakes.mesh.count,1);
 assert.deepEqual(core,original,'presentation never changes authoritative projectile data');
 const early={...core,x:core.x+.3,age:.09};
 wakes.update([early],false,camera);
 const wakeMatrix=new THREE.Matrix4();wakes.mesh.getMatrixAt(0,wakeMatrix);
 const tail=new THREE.Vector3(0,-1,0).applyMatrix4(wakeMatrix);
 assert(tail.distanceTo(camera)>=.4-1e-6,'the wake tail cannot reach back into the camera');
 const geometry=coreCanisterGeometry();geometry.computeBoundingBox();
 assert(geometry.boundingBox.getSize(new THREE.Vector3()).y*.65<.31);
});

test('pressure bands follow the same bounded instance transform and dead cores leave no wake',()=>{
 const mesh=new THREE.InstancedMesh(coreCanisterGeometry(),new THREE.MeshBasicMaterial(),2);
 const matrix=new THREE.Matrix4().compose(new THREE.Vector3(21,1.7,28),new THREE.Quaternion(),new THREE.Vector3(.65,.65,.65));
 mesh.count=1;mesh.setMatrixAt(0,matrix);
 const details=new OrdnanceDetails(new THREE.Group(),2);details.update(mesh);
 const copied=new THREE.Matrix4();details.bands.getMatrixAt(0,copied);
 assert.deepEqual(copied.elements,Array.from(new Float32Array(matrix.elements)));
 const wakes=new ProjectileWakes(new THREE.Group());
 wakes.update([{...core,x:6,life:0}],false,camera);assert.equal(wakes.mesh.count,0);
 assert.equal(coreVisualScale({...core,life:0},camera),0);
 wakes.update([{...core,x:6,core:false,kind:'hostile'}],false,camera);assert.equal(wakes.mesh.count,1);
});
