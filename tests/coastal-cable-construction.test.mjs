import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../output/qa-runtime/island-environment-v77/harbor-course.js';
import {makeCoastalCityLife} from '../coastal-city-life-layout.js';
import {buildCoastalCityLife} from '../coastal-city-life-visuals.js';
import {capeGroundHeight} from '../coastal-terrain.js';

const prior=makeHarborCourse({openWorld:true,cityLootSeed:7317}),old=prior.coastal.cityLife,
 clean={...prior,obstacles:prior.obstacles.filter(p=>!p.id?.startsWith('city-life-'))},
 data=makeCoastalCityLife(clean,{burntDrain:false,seed:7317,extraExclusions:[{minX:85,maxX:108,minZ:100,maxZ:119}]}),
 group=data.communities.find(c=>c.story==='interrupted-cable-service').id,
 parts=data.parts.filter(p=>p.community===group),box=new THREE.BoxGeometry(1,1,1),
 materials=Object.fromEntries(['foliage','wood','dark','paper','rust','fabric'].map(k=>[k,new THREE.MeshBasicMaterial()])),
 visuals=buildCoastalCityLife({course:{...clean,coastal:{...clean.coastal,cityLife:data}},unitBox:box,materials}),
 report={scope:'CPU construction/resource evidence only; original native cameras remain acceptance gates',diagnostics:data.diagnostics,visual:visuals.diagnostics,parts};

test('constructed kit preserves other seven addresses and every prior solid collider exactly',()=>{
 const original=new Set(old.communities.map(c=>c.id));
 assert.deepEqual(data.parts.filter(p=>p.community!==group&&original.has(p.community)),old.parts.filter(p=>p.community!==group));
 assert.deepEqual(data.communities.filter(p=>p.id!==group&&original.has(p.id)),old.communities.filter(p=>p.id!==group));
 assert.deepEqual(data.obstacles,old.obstacles);
 assert.equal(parts.filter(p=>p.shape==='crate').length,4);assert.equal(parts.filter(p=>p.shape==='coil').length,1);assert.equal(parts.filter(p=>p.shape==='stencil').length,1);
 for(const role of ['cable-service-carried-load','unequal-splice-parts-load'])for(const p of parts.filter(p=>p.role===role)){
  const q=old.parts.find(q=>q.id===p.id);assert.deepEqual({...p,shape:q.shape},q,'only crate topology changes at existing footprint');
 }
 assert.equal(data.parts.filter(p=>p.shape!=='grass'&&original.has(p.community)).length,125);assert(data.diagnostics.props<=136);assert(data.diagnostics.grass<=544);
});

test('coil is grounded in the staging gap and stencil belongs to its actual board',()=>{
 const coil=parts.find(p=>p.shape==='coil');assert(Math.abs(coil.y-coil.height/2-Math.max(.135,capeGroundHeight(coil.x,coil.z)))<1e-9);
 const board=parts.find(p=>p.role==='fallen-cable-maintenance-board'),mark=parts.find(p=>p.shape==='stencil');
 assert.equal(mark.x,board.x);assert.equal(mark.z,board.z);assert.equal(mark.yaw,board.yaw);
 assert(mark.y>board.y+board.height/2&&mark.y-(board.y+board.height/2)<.003);
 assert(mark.width<board.width&&mark.depth<board.depth);
 for(const p of parts.filter(p=>p.shape!=='grass'))assert(p.x-Math.hypot(p.width,p.depth)/2>=292,'full four metre receiving passage remains clear');
 for(const p of parts.filter(p=>p.shape==='crate'))assert(Math.hypot(coil.x-p.x,coil.z-p.z)>(coil.width+p.width)/2,'grounded spare does not overlap a crate');
});

test('shared crate has an actual cavity and open gaps, coil a central hole, stencil upward faces',()=>{
 const meshFor=shape=>visuals.root.children.find(m=>m.name.startsWith(shape+':')),
  crate=meshFor('crate'),coil=meshFor('coil'),stencil=meshFor('stencil'),probe=new THREE.Mesh(crate.geometry,materials.wood);
 probe.updateMatrixWorld();
 const floor=new THREE.Raycaster(new THREE.Vector3(0,2,.08),new THREE.Vector3(0,-1,0)).intersectObject(probe);
 assert(floor.length>0);assert(Math.abs(floor[0].point.y+.41)<1e-6,'open top exposes only plank floor below');
 assert.equal(new THREE.Raycaster(new THREE.Vector3(0,.25,-2),new THREE.Vector3(0,0,1)).intersectObject(probe).length,0,'side-board gap is actual empty geometry');
 assert(new THREE.Raycaster(new THREE.Vector3(.455,.25,-2),new THREE.Vector3(0,0,1)).intersectObject(probe).length>0,'corner post remains solid');
 const ring=new THREE.Mesh(coil.geometry,materials.dark);ring.updateMatrixWorld();
 assert.equal(new THREE.Raycaster(new THREE.Vector3(0,2,0),new THREE.Vector3(0,-1,0)).intersectObject(ring).length,0,'spare coil keeps a true central hole');
 assert([...stencil.geometry.attributes.normal.array].every((v,i)=>Math.abs(v-(i%3===1?1:0))<1e-6));
 report.templates=Object.fromEntries([crate,coil,stencil].map(m=>[m.name.split(':')[0],{triangles:(m.geometry.index?.count||m.geometry.attributes.position.count)/3,vertices:m.geometry.attributes.position.count}]));
 report.newKitVisibleTriangles=parts.filter(p=>['crate','coil','stencil'].includes(p.shape)).reduce((n,p)=>n+report.templates[p.shape].triangles,0);
 assert(report.newKitVisibleTriangles<=1536,'including all four crate instances, not just template triangles');
 for(const m of[crate,coil,stencil])for(const a of Object.values(m.geometry.attributes))assert([...a.array].every(Number.isFinite));
 assert(visuals.diagnostics.newTemplateTriangles<=1536);assert.equal(visuals.diagnostics.ownedGeometries,7);
});

test('new kit uses static spatial bins and disposal releases views without borrowed materials or unit box',()=>{
 const versions=visuals.root.children.map(m=>[m.instanceMatrix.version,m.geometry.attributes.position.version]);
 for(const m of visuals.root.children){assert.equal(m.matrixAutoUpdate,false);assert(m.boundingSphere||m.geometry.boundingSphere);}
 assert.deepEqual(visuals.root.children.map(m=>[m.instanceMatrix.version,m.geometry.attributes.position.version]),versions);
 let boxDisposed=0,materialDisposed=0,viewsDisposed=0;
 box.addEventListener('dispose',()=>boxDisposed++);for(const m of Object.values(materials))m.addEventListener('dispose',()=>materialDisposed++);
 const count=visuals.root.children.length;for(const mesh of visuals.root.children)mesh.geometry.addEventListener('dispose',()=>viewsDisposed++);
 visuals.dispose();assert.equal(viewsDisposed,count);assert.equal(boxDisposed,0);assert.equal(materialDisposed,0);assert.equal(visuals.root.parent,null);
 report.disposal={ownedViewsReleased:viewsDisposed,borrowedBoxReleased:false,borrowedMaterialsReleased:false};
 fs.writeFileSync('output/island-cable-service-construction-census.json',JSON.stringify(report,null,2)+'\n');
 box.dispose();for(const m of Object.values(materials))m.dispose();
});

