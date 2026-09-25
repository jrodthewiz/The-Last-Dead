import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {RifleCasings} from '../weapon-casings.js';

test('sustained rifle fire keeps casings in one bounded draw and releases them',()=>{
  const root=new THREE.Group(),casings=new RifleCasings(root);
  const point=new THREE.Vector3(.3,-.2,-.45);
  for(let shot=1;shot<=120;shot++){
    casings.spawn(point,shot,shot%3?4:5);
    casings.update(1/120);
    assert.ok(casings.mesh.count<=24);
  }
  assert.equal(root.children.length,1,'casings use one shared draw');
  assert.ok(casings.mesh.count>0);
  for(let frame=0;frame<180;frame++)casings.update(1/120);
  assert.equal(casings.mesh.count,0,'expired casings leave the view');
  casings.spawn(point,121);
  casings.update(1/120);
  assert.equal(casings.mesh.count,1,'the pool can fire again after it empties');
});
