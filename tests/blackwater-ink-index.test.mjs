import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {applyBlackwaterGraphicStyle} from '../blackwater-graphic-style.js';

const bits=a=>new Uint32Array(a.buffer,a.byteOffset,a.length);
const source=readFileSync(new URL('../blackwater-graphic-style.js',import.meta.url),'utf8');
const begin=source.indexOf('function indexInkCorners('),end=source.indexOf('\n// Ground,',begin);
const indexInk=new Function('THREE',source.slice(begin,end)+'\nreturn indexInkCorners;')(THREE);

test('ink indexing reconstructs every corner bit, keeps signed zeros and normal seams, and selects index width',()=>{
 const p=new Float32Array([0,0,0, 1,0,0, 0,1,0, 0,0,0, 1,0,0, 0,1,0, -0,0,0, 1,0,0, 0,1,0]);
 const n=new Float32Array(Array.from({length:9},(_,i)=>i===7?[0,1,0]:[0,0,1]).flat());
 const g=indexInk(p,n);assert.equal(g.index.count,9);assert.equal(g.attributes.position.count,5);assert.ok(g.index.array instanceof Uint16Array);
 for(const [name,original]of [['position',p],['normal',n]])for(let i=0;i<g.index.count;i++)for(let k=0;k<3;k++)assert.equal(bits(g.attributes[name].array)[g.index.getX(i)*3+k],bits(original)[i*3+k]);
 g.dispose();
 const largeP=new Float32Array(65537*3),largeN=new Float32Array(largeP.length);for(let i=0;i<65537;i++){largeP[i*3]=i;largeN[i*3+2]=1;}
 const large=indexInk(largeP,largeN);assert.ok(large.index.array instanceof Uint32Array);assert.equal(large.index.getX(65536),65536);large.dispose();
});

test('actual ink preserves transformed triangle order, bounds, borrowed resources and its native ground guard',()=>{
 const root=new THREE.Group(),geometry=new THREE.BoxGeometry(2,3,4),material=new THREE.MeshStandardMaterial();
 const mesh=new THREE.Mesh(geometry,material);mesh.position.set(4,2,5);mesh.scale.set(1.3,.7,1.8);mesh.rotation.y=.3;root.add(mesh);root.updateMatrixWorld(true);
 const expected=geometry.toNonIndexed().applyMatrix4(mesh.matrixWorld);expected.computeBoundingBox();expected.computeBoundingSphere();
 const native=material.clone();native.userData.nativeTerrainPBR=true;const nativeMesh=new THREE.Mesh(geometry,native);nativeMesh.position.set(30,0,0);root.add(nativeMesh);
 let borrowed=0;for(const resource of [geometry,material,native])resource.addEventListener('dispose',()=>borrowed++);
 const style=applyBlackwaterGraphicStyle(root),ink=root.children.find(m=>m.userData.graphicInk);assert.ok(ink.geometry.index);assert.equal(style.diagnostics.inkTriangles,12);assert.equal(ink.geometry.index.count,36);assert.equal(ink.geometry.attributes.position.count,24);assert.equal(nativeMesh.material,native);
 for(const name of ['position','normal'])for(let i=0;i<36;i++)for(let k=0;k<3;k++)assert.equal(bits(ink.geometry.attributes[name].array)[ink.geometry.index.getX(i)*3+k],bits(expected.attributes[name].array)[i*3+k]);
 assert.deepEqual(ink.geometry.boundingBox,expected.boundingBox);assert.deepEqual(ink.geometry.boundingSphere,expected.boundingSphere);
 let released=0;ink.geometry.addEventListener('dispose',()=>released++);style.dispose();style.dispose();assert.equal(released,1);assert.equal(borrowed,0);assert.equal(mesh.material,material);
 expected.dispose();geometry.dispose();material.dispose();native.dispose();
});
