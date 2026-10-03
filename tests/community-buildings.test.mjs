import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createHarborTenement} from '../community-buildings.js';
function dispose(root){root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
test('community building variants stay within geometry and draw budgets',()=>{
 for(const seed of [.28,.43,.71])for(const floors of [1,2,3]){
  const root=createHarborTenement({seed,floors});
  assert.equal(root.children.length,4);assert.ok(root.userData.triangles<6500);
  let triangles=0;
  root.traverse(o=>{if(!o.isMesh)return;triangles+=o.geometry.index.count/3;for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v));o.geometry.computeBoundingSphere();assert.ok(o.geometry.boundingSphere.radius>0);});
  assert.equal(triangles,root.userData.triangles);
  const size=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());assert.ok(size.x<14&&size.y<22&&size.z<16);
  dispose(root);
 }
});
test('building generation is deterministic and rejects unbounded input',()=>{
 const a=createHarborTenement(),b=createHarborTenement();
 assert.deepEqual(a.children[0].geometry.attributes.position.array,b.children[0].geometry.attributes.position.array);
 for(const options of [{width:Infinity},{width:200},{floors:99},{floors:1.5},{seed:NaN}])assert.throws(()=>createHarborTenement(options),RangeError);
 dispose(a);dispose(b);
});
