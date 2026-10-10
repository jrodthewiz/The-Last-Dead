import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../vendor/three.module.js';
const source=readFileSync(new URL('../renderer.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('export function disposeObject('),source.indexOf('function lineGeometry(')).replace('export function','function');
const context=vm.createContext({});vm.runInContext(code,context);const disposeObject=context.disposeObject;

test('area disposal preserves borrowed attributes and live materials while freeing owned geometry',()=>{
 const active=new THREE.Group(),retired=new THREE.Group(),deferred=new Set(),base=new THREE.BoxGeometry(),view=new THREE.BufferGeometry();
 view.index=base.index;view.attributes={...base.attributes};
 const material=new THREE.MeshBasicMaterial(),texture=new THREE.Texture();material.map=texture;
 active.add(new THREE.Mesh(base,material));retired.add(new THREE.Mesh(view,material));
 const owned=new THREE.BoxGeometry(),ownedMaterial=new THREE.MeshBasicMaterial();retired.add(new THREE.Mesh(owned,ownedMaterial));
 const counts={base:0,view:0,owned:0,material:0,texture:0,ownedMaterial:0};
 for(const [key,object]of Object.entries({base,view,owned,material,texture,ownedMaterial}))object.addEventListener('dispose',()=>counts[key]++);
 disposeObject(retired,false,active,deferred);
 assert.equal(counts.view,0,'a geometry view must not destroy buffers used by the active scene');assert.equal(counts.base,0);
 assert.equal(counts.owned,1);assert.equal(counts.ownedMaterial,1);assert.equal(counts.material,0);assert.equal(counts.texture,0);assert.equal(deferred.size,1);
 disposeObject(active);for(const geometry of deferred)geometry.dispose();
 assert.equal(counts.view,1);assert.equal(counts.base,1);assert.equal(counts.material,1);assert.equal(counts.texture,1);
});
test('interleaved views preserve the shared backing buffer even with different attribute wrappers',()=>{
 const data=new THREE.InterleavedBuffer(new Float32Array(24),6),a=new THREE.BufferGeometry(),b=new THREE.BufferGeometry();
 a.setAttribute('position',new THREE.InterleavedBufferAttribute(data,3,0));b.setAttribute('position',new THREE.InterleavedBufferAttribute(data,3,0));
 const live=new THREE.Group(),retired=new THREE.Group(),material=new THREE.MeshBasicMaterial(),deferred=new Set();
 live.add(new THREE.Mesh(a,material));retired.add(new THREE.Mesh(b,material));let disposed=0;b.addEventListener('dispose',()=>disposed++);
 disposeObject(retired,false,live,deferred);assert.equal(disposed,0);assert.ok(deferred.has(b));
 disposeObject(live);for(const g of deferred)g.dispose();assert.equal(disposed,1);
});
