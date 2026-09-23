import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { AfterlifeLighting } from '../afterlife-lighting.js';

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
  lighting.dispose(); assert.equal(scene.children.length, 0);
});
