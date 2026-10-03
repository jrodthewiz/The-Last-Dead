import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { AfterlifeLighting, selectPracticalCues } from '../afterlife-lighting.js';
import {Renderer} from '../renderer.js';

test('native shadow invalidation is consumed once and lamp movement does not redraw the sun',()=>{
 const scene=new THREE.Scene(),lighting=new AfterlifeLighting(scene),camera=new THREE.PerspectiveCamera();
 const sun=new THREE.DirectionalLight();sun.castShadow=true;scene.add(sun);
 const native={isWebGPURenderer:true,shadowMap:{needsUpdate:true},render(){for(const light of [sun,lighting.lantern])light.shadow.needsUpdate=false;}};
 const r=Object.create(Renderer.prototype);Object.assign(r,{scene,camera,renderer:native});
 lighting.update(camera,native,0);r._renderScene();
 assert.equal(native.shadowMap.needsUpdate,false);
 for(let t=50;t<=1000;t+=50){lighting.update(camera,native,t);r._renderScene();}
 assert.equal(lighting.shadowUpdates,1);
 camera.position.x=1;lighting.update(camera,native,1100);
 assert.equal(lighting.lantern.shadow.needsUpdate,true);assert.equal(sun.shadow.needsUpdate,false);
 assert.equal(native.shadowMap.needsUpdate,false);
 native.shadowMap.needsUpdate=true;let refreshed=false;native.render=()=>{refreshed=sun.shadow.needsUpdate;};r._renderScene();
 assert.equal(refreshed,true);assert.equal(native.shadowMap.needsUpdate,false);lighting.dispose();
});

test('practical pool stays bounded across map rebuilds and preserves objective lights', () => {
  const scene = new THREE.Scene(), world = new THREE.Group(), lighting = new AfterlifeLighting(scene);
  for (let i = 0; i < 40; i++) {
    const light = new THREE.PointLight(0xffffff, 2, 16);
    light.name = 'AuthoredZoneLight_' + i; light.userData.baseIntensity = 2;
    light.position.set(i * 4, 3, 0); world.add(light);
  }
  const objective = new THREE.PointLight(0xffcc44, 1, 5); world.add(objective);
  lighting.rebuild(world);
  const camera = new THREE.PerspectiveCamera(); camera.position.set(10, 1.6, 4);
  camera.updateMatrixWorld(); lighting.update(camera, null, 1000, true);
  assert.equal(lighting.pools.length, 6);
  assert.equal(world.children.filter(o => o.visible).length, 1);
  assert.equal(objective.visible, true);
  assert.ok(lighting.pools.every(o => o.intensity > 0));
  lighting.rebuild(new THREE.Group()); lighting.update(camera, null, 2000);
  assert.ok(lighting.pools.every(o => o.intensity === 0));
  assert.ok(lighting.pools.every(o => !o.visible),'a course without practical cues omits zero-output lights');
  lighting.rebuild(world);assert.ok(lighting.pools.every(o=>o.visible),'authored courses restore the pool before preparation');
  lighting.dispose(); assert.equal(scene.children.length, 0);
});

test('six-light budget reserves corridor fixtures ahead of nearby lamps behind the camera', () => {
  const position = new THREE.Vector3(), direction = new THREE.Vector3(0, 0, -1);
  const cues = [...Array.from({ length: 6 }, (_, i) => ({ position: new THREE.Vector3(i, 3, 3), isZone: true })),
    { position: new THREE.Vector3(0, 3, -22), isZone: true }, { position: new THREE.Vector3(2, 3, -32), isZone: true }];
  for (const cue of cues) cue.score = cue.distanceSquared = cue.position.lengthSq();
  cues.sort((a, b) => a.score - b.score);
  const selected = selectPracticalCues(cues, position, direction);
  assert.equal(selected.length, 6);
  assert.equal(new Set(selected).size, 6);
  assert.equal(selected.filter(cue => cue.position.z < 0).length, 2);
});

test('lantern depth cache skips idle flicker and refreshes movement, doors and floor rebuilds', () => {
  const lighting = new AfterlifeLighting(new THREE.Scene()), camera = new THREE.PerspectiveCamera();
  const renderer = { shadowMap: { needsUpdate: false } };
  const consume = () => { renderer.shadowMap.needsUpdate = false; lighting.lantern.shadow.needsUpdate = false; };
  lighting.update(camera, renderer, 0); consume();
  for (let now = 50; now <= 1000; now += 50) lighting.update(camera, renderer, now);
  assert.equal(lighting.shadowUpdates, 1, 'stationary lamp reuses its depth map despite intensity flicker');
  camera.position.x = .005; lighting.update(camera, renderer, 1050);
  assert.equal(lighting.shadowUpdates, 1, 'tiny idle motion keeps cached depth');
  camera.position.x = .08; lighting.update(camera, renderer, 1100); consume();
  assert.equal(lighting.shadowUpdates, 2);
  camera.rotation.y = .1; lighting.update(camera, renderer, 1150); consume();
  assert.equal(lighting.shadowUpdates, 3, 'turning refreshes the shadow');
  renderer.shadowMap.needsUpdate = true; lighting.update(camera, renderer, 1151); consume();
  assert.equal(lighting.shadowUpdates, 4, 'a changed door invalidates immediately');
  lighting.rebuild(new THREE.Group()); lighting.update(camera, renderer, 1152);
  assert.equal(lighting.shadowUpdates, 5, 'a new floor cannot reuse old shadows');
  lighting.dispose();
});
