import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createHarborShadowCoverage} from '../harbor-shadow-coverage.js';
test('cached sunlight contains downtown, distant cottage and forest without changing direction or allocating maps',()=>{
 const light=new THREE.DirectionalLight();light.position.set(155,70,38);light.target.position.set(185,0,56);
 Object.assign(light.shadow.camera,{left:-60,right:60,top:60,bottom:-60,near:1,far:180});light.shadow.mapSize.set(2048,2048);light.shadow.autoUpdate=false;
 const offset=light.position.clone().sub(light.target.position),shadow=light.shadow,coverage=createHarborShadowCoverage(light);
 for(const [x,z]of [[219,62],[158,248],[340,382]]){
  assert.equal(coverage.update(x,0,z),true);assert.equal(light.shadow,shadow);assert.equal(light.shadow.needsUpdate,true);
  assert.ok(light.position.clone().sub(light.target.position).distanceTo(offset)<1e-9);
  light.shadow.updateMatrices(light);const p=new THREE.Vector3(x,1.6,z).applyMatrix4(light.shadow.matrix);
  assert.ok(p.x>.15&&p.x<.85&&p.y>.15&&p.y<.85&&p.z>0&&p.z<1,'player location is in the actual shadow projection');
  const d=coverage.diagnostics();assert.ok(Math.abs(d.committedLightCenter[0]/d.worldTexel[0]-Math.round(d.committedLightCenter[0]/d.worldTexel[0]))<1e-8);
  assert.ok(Math.abs(d.committedLightCenter[1]/d.worldTexel[1]-Math.round(d.committedLightCenter[1]/d.worldTexel[1]))<1e-8);
  light.shadow.needsUpdate=false;assert.equal(coverage.update(x+.01,0,z+.01),false);assert.equal(light.shadow.needsUpdate,false);
 }
 assert.equal(coverage.diagnostics().updates,3);assert.equal(coverage.update(NaN,0,0),false);light.dispose();
});

test('aerial shadows cover the island and restore the local map without new shadow resources',()=>{
 const light=new THREE.DirectionalLight();light.position.set(155,52,15);light.target.position.set(185,0,56);
 Object.assign(light.shadow.camera,{left:-60,right:60,top:60,bottom:-60,near:1,far:180});light.shadow.mapSize.set(2048,2048);
 const shadow=light.shadow,direction=light.position.clone().sub(light.target.position).normalize();
 const coverage=createHarborShadowCoverage(light);
 assert.equal(coverage.update(224,0,208,640),true);light.shadow.updateMatrices(light);
 for(const [x,z]of [[0,0],[448,0],[448,416],[128,416]])for(const y of [0,35]){
  const p=new THREE.Vector3(x,y,z).applyMatrix4(light.shadow.matrix);
  assert.ok(p.x>0&&p.x<1&&p.y>0&&p.y<1&&p.z>0&&p.z<1,'coast and skyline fit aerial shadow projection');
 }
 assert.equal(light.shadow,shadow);assert.deepEqual(light.shadow.mapSize.toArray(),[2048,2048]);
 assert.ok(light.position.clone().sub(light.target.position).normalize().distanceTo(direction)<1e-9);
 assert.equal(coverage.update(224,0,208,640),false);
 assert.equal(coverage.update(220,0,62),true);assert.equal(light.shadow.camera.far,180);
 assert.deepEqual(coverage.diagnostics().footprint,[120,120]);
 assert.equal(coverage.update(220,0,62,2000),false);light.dispose();
});
