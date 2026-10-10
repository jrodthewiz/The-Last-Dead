import {historicalRecords,historicalCourtCoastal,assertCourtTerrainTotals} from './coastal-court-history.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {capeGroundHeight} from '../coastal-terrain.js';
import {capeRidgeHabitatFields,CAPE_RIDGE_HABITAT} from '../coastal-ridge-habitat.js';
import {capeGroundHierarchy} from '../coastal-terrain-fields.js';
import {createCoastalUnderstory} from '../coastal-understory.js';
import {understoryClear} from '../coastal-understory-layout.js';
const course=makeHarborCourse({openWorld:true}),c=historicalCourtCoastal(course.coastal),old=c.understoryPlacements.slice(0,4403),added=c.understoryPlacements.filter(p=>p.id.startsWith('ridge-habitat-'));
const hash=p=>createHash('sha256').update(JSON.stringify(p)).digest('hex');

test('new mantle is a declared append; full v41 authoring and solid authority remain exact',()=>{
 assert.equal(hash(old),'44080d9ff7e4c565786c56ac2322ff9be4326e799625fac399d612880447d8dd');
 assert.equal(hash(c.forestPlacements),'deb454baaafd94c95af9233cde7c1a68d7b4b4199ce723acc13de6cc79e36abd');
 assert.equal(c.forestPlacements.length,554);assert.equal(c.understoryPlacements.length,5745);assert.equal(new Set(c.understoryPlacements.map(p=>p.id)).size,5745);
 assert.equal(added.filter(p=>p.kind==='grass').length,1200);assert.equal(added.filter(p=>p.kind==='shrub').length,142);
 for(const p of added){
  const f=capeRidgeHabitatFields(p.x,p.z),envelope=p.scale*(p.kind==='grass'?.26*p.widthScale:.47)+.045;
  assert.equal(p.y,capeGroundHeight(p.x,p.z));assert.ok(f.cover>=.22&&f.accessDistance-envelope>=3);
  assert.ok(!course.obstacles.some(o=>o.id===p.id));assert.ok(understoryClear(c,p.x,p.z,{softShoulder:true}));
  for(const [dx,dz]of [[-envelope,0],[envelope,0],[0,-envelope],[0,envelope]])assert.ok(understoryClear(c,p.x+dx,p.z+dz,{softShoulder:true}));
  for(const t of c.forestPlacements)assert.ok(Math.hypot(t.x-p.x,t.z-p.z)>=t.collisionRadius+envelope+.20);
 }
});

test('joined unequal skirts leave exposed crest and crossing, with sheltered shrubs at the true toe',()=>{
 const connected=[];
 for(let g=0;g<2;g++){
  const q=added.filter(p=>p.kind==='grass'&&p.community===`ridge-habitat-${g}`),seen=new Set();let largest=0;
  for(let k=0;k<q.length;k++)if(!seen.has(k)){
   const todo=[k];seen.add(k);let count=0;
   while(todo.length){const i=todo.pop();count++;for(let j=0;j<q.length;j++)if(!seen.has(j)&&Math.hypot(q[j].x-q[i].x,q[j].z-q[i].z)<1.1){seen.add(j);todo.push(j);}}
   largest=Math.max(largest,count);
  }
  connected.push(largest);assert.ok(largest/q.length>.85,'majority belongs to one continuous low-sward body, not isolated decoration islands');
  const p=CAPE_RIDGE_HABITAT[g];
  assert.ok(capeRidgeHabitatFields(p.x,p.z).tussock>.5);assert.equal(capeRidgeHabitatFields(444,p.z).cover,0);
  const sheltered=added.filter(p=>p.kind==='shrub'&&p.community===`ridge-habitat-${g}`);assert.ok(sheltered.length>50);
  assert.ok(sheltered.every(p=>capeRidgeHabitatFields(p.x,p.z).rootToe>=.3));
  const zSpan=Math.max(...q.map(p=>p.z))-Math.min(...q.map(p=>p.z));if(g===0)assert.ok(zSpan>30);else assert.ok(zSpan>23&&zSpan<34);
 }
 for(const [x,z]of [[384,30],[445,25],[430,66],[335,387]])assert.equal(capeRidgeHabitatFields(x,z).cover,0);
 const centre=capeGroundHierarchy(427,27,{cover:.15,pine:.15}),crest=capeGroundHierarchy(443,27,{}),toe=capeGroundHierarchy(421,27,{cover:.6,pine:.6});
 for(const f of [centre,crest,toe])assert.ok(f.weights.every(Number.isFinite)&&Math.abs(f.weights.reduce((a,b)=>a+b,0)-1)<1e-12);
 assert.ok(centre.weights[2]>crest.weights[2]);assert.ok(toe.weights[0]+toe.weights[1]>centre.weights[0]+centre.weights[1]);
 console.log(JSON.stringify({connectedGrass:connected}));
});

test('anisotropic low cohorts reuse exact resources and preserve every old instance matrix; lifecycle remains unique',()=>{
 const before=createCoastalUnderstory({placements:old}),after=createCoastalUnderstory({placements:c.understoryPlacements});
 try{
  assert.equal(after.diagnostics.batches,before.diagnostics.batches);assert.equal(after.diagnostics.sharedGeometries,3);assert.equal(after.diagnostics.materials,2);assert.equal(after.diagnostics.addedShadowMaps,0);
  let bytes=0;
  for(const mesh of before.root.children){const next=after.root.children.find(n=>n.name===mesh.name);assert.deepEqual([...next.instanceMatrix.array.slice(0,mesh.count*16)],[...mesh.instanceMatrix.array]);}
  for(const mesh of after.root.children){bytes+=mesh.instanceMatrix.array.byteLength+mesh.instanceColor.array.byteLength;assert.equal(mesh.castShadow,false);assert.equal(mesh.receiveShadow,false);assert.ok(Number.isFinite(mesh.boundingSphere.radius));}
  const oldBytes=before.root.children.reduce((sum,m)=>sum+m.instanceMatrix.array.byteLength+m.instanceColor.array.byteLength,0);
  assert.equal(bytes-oldBytes,1342*76);assert.equal(1200*after.diagnostics.grassTriangles+142*after.diagnostics.shrubTriangles,164532);
  const grass=after.root.children.find(m=>m.name==='Understory:grass:6:0'),radius=Math.max(...Array.from({length:grass.geometry.attributes.position.count},(_,i)=>Math.hypot(grass.geometry.attributes.position.getX(i),grass.geometry.attributes.position.getZ(i))));
  assert.ok(added.filter(p=>p.kind==='grass').every(p=>radius*p.scale*p.widthScale>.30&&radius*p.scale*p.widthScale<.53));
  const disposed={geometries:0,materials:0};
  for(const g of new Set(after.root.children.map(m=>m.geometry)))g.addEventListener('dispose',()=>disposed.geometries++);
  for(const m of new Set(after.root.children.map(m=>m.material)))m.addEventListener('dispose',()=>disposed.materials++);
  after.dispose();after.dispose();assert.deepEqual(disposed,{geometries:3,materials:2});assert.equal(after.root.parent,null);
  console.log(JSON.stringify({added:1342,plantCount:5745,addedAllVisibleTriangles:164532,addedInstanceBytes:bytes-oldBytes,bins:after.diagnostics.batches}));
 }finally{before.dispose();after.dispose();}
});
