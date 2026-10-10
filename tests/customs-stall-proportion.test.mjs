import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {makeHarborThaiLayout} from '../harbor-thai-layout.js';
import {makeHarborThaiLayout as acceptedLayout} from '../output/qa-runtime/island-environment-v56/harbor-thai-layout.js';
import {HarborThaiVisuals} from '../harbor-thai-visuals.js';

const course=makeHarborCourse(),accepted=acceptedLayout(course),candidate=makeHarborThaiLayout(course);
test('only Customs stall proportion changes; occupied footprints and interactions stay exact',()=>{
 const comparison=structuredClone(candidate);
 comparison.props.find(p=>p.id==='market-canopy').height=accepted.props.find(p=>p.id==='market-canopy').height;
 assert.deepEqual(comparison,accepted);
 assert.deepEqual(candidate.colliders,accepted.colliders);
 for(const file of ['coastal-basement-visuals.js','coastal-customs-gallery.js'])
  assert.equal(readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),readFileSync(new URL(`../output/qa-runtime/island-environment-v56/${file}`,import.meta.url),'utf8'));
});

test('actual placement loader retains service parts beneath a subordinate roof with standing clearance',async()=>{
 const load=async(layout)=>{
  const p=layout.props.find(p=>p.id==='market-canopy'),owner=new HarborThaiVisuals(new THREE.Group(),{buildings:[],props:[p]});
  await owner.ready;assert.deepEqual(owner.diagnostics.errors,[]);owner.root.updateMatrixWorld(true);
  return {owner,pivot:owner.root.children[0],model:owner.root.children[0].children[0]};
 };
 const old=await load(accepted),next=await load(candidate);
 const oldBounds=new THREE.Box3().setFromObject(old.pivot),bounds=new THREE.Box3().setFromObject(next.pivot);
 assert.ok(bounds.max.y<2.83,'stall ridge remains below the Customs stair sign');
 assert.ok(Math.abs(oldBounds.max.y-bounds.max.y-.55)<1e-6);
 assert.ok(Math.abs(bounds.min.y-.14)<1e-6,'feet stay on the same pavement');
 const meshes=m=>Object.entries(m.userData.sculptRuntime.byId.meshes);
 assert.equal(meshes(next.model).length,3);
 for(const [id,mesh] of meshes(next.model)){
  const original=old.model.userData.sculptRuntime.byId.meshes[id];
  assert.equal(mesh.geometry.getAttribute('position').count,original.geometry.getAttribute('position').count);
  for(const [key,attr]of Object.entries(mesh.geometry.attributes))assert.deepEqual(attr.array,original.geometry.attributes[key].array);
  assert.equal(mesh.material.type,original.material.type);
  assert.equal(mesh.castShadow,original.castShadow);
 }
 const awning=next.model.userData.sculptRuntime.byId.meshes.awning;
 assert.ok(new THREE.Box3().setFromObject(awning).min.y>2.2,'lowest valance clears standing service use');
 const fit=next.model.scale.y;
 const counterTop=.892*fit+next.model.position.y+next.pivot.position.y;
 assert.ok(counterTop>1.28&&counterTop<1.33,'counter retains service scale');
 const bags=next.model.userData.sculptRuntime.byId.meshes.bags;
 assert.ok(new THREE.Box3().setFromObject(bags).min.y>1.8,'condiment bags remain above the counter');
 assert.ok(bounds.getSize(new THREE.Vector3()).x<oldBounds.getSize(new THREE.Vector3()).x);
 old.owner.dispose();next.owner.dispose();
});
