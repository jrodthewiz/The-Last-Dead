import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';

// Exercise the production rig's lighting setup without constructing DOM/audio.
const source=readFileSync(new URL('../renderer.js',import.meta.url),'utf8');
const start=source.indexOf('    const viewFill = new THREE.HemisphereLight(');
const end=source.indexOf('    this.muzzleFlash = new THREE.Group();',start);
assert.ok(start>0&&end>start);
const setup=new Function('THREE',source.slice(start,end));

test('first-person keys retain camera-space directions through town, forest, turns and elevation',()=>{
 const camera=new THREE.PerspectiveCamera(),weaponRig=new THREE.Group();camera.add(weaponRig);
 const state={weaponRig};setup.call(state,THREE);
 const directions=[];
 for(const [x,y,z,yaw,pitch]of [[0,1.6,0,0,0],[206,1.6,56,Math.PI,0],[340,7.3,382,-.9,.25]]){
  camera.position.set(x,y,z);camera.rotation.set(pitch,yaw,0);camera.updateMatrixWorld(true);
  const inverseRotation=new THREE.Matrix3().setFromMatrix4(camera.matrixWorld.clone().invert());
  const current=[state.viewmodelKey,state.viewmodelRim].map(light=>{
   assert.equal(light.target.parent,weaponRig);
   return light.target.getWorldPosition(new THREE.Vector3()).sub(light.getWorldPosition(new THREE.Vector3())).applyMatrix3(inverseRotation).normalize();
  });
  if(directions.length)current.forEach((v,i)=>assert(v.distanceTo(directions[i])<1e-12));
  else directions.push(...current);
 }
});
