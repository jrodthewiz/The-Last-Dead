import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeHarborCourse} from '../output/qa-runtime/island-environment-v81/harbor-course.js';
import {makeCoastalCityLife,cityLifeSiteClear} from '../coastal-city-life-layout.js';
import {makeCoastalCityLife as makeBaselineCityLife} from '../output/qa-runtime/island-environment-v81/coastal-city-life-layout.js';
import {canStand} from '../engine.js';
import {registerImmutablePropObstacles} from '../harbor-collision.js';
import {capeGroundHeight} from '../coastal-terrain.js';
import * as THREE from '../vendor/three.module.js';
import {buildCoastalCityLife} from '../coastal-city-life-visuals.js';
import {castRay} from '../engine.js';

const prior=makeHarborCourse({openWorld:true,cityLootSeed:7317}),old=prior.coastal.cityLife,
 clean={...prior,obstacles:prior.obstacles.filter(p=>!p.id?.startsWith('city-life-'))},
 data=makeCoastalCityLife(clean,{burntDrain:false,seed:7317,extraExclusions:[{minX:85,maxX:108,minZ:100,maxZ:119}]}),
 extension=data.communities.find(p=>p.story==='abandoned-workshop-frontage'),own=data.parts.filter(p=>p.community===extension?.id),
 world={...clean,coastal:{...clean.coastal,cityLife:data},obstacles:[...clean.obstacles,...data.obstacles]},
 report={scope:'Prepared source-only ninth community acceptance; no native visibility or FPS claim',diagnostics:data.diagnostics,community:extension,parts:own};
registerImmutablePropObstacles(world);
test('append preserves all existing eight communities, ordered parts and solid colliders exactly',()=>{
 assert(extension,'real selected workshop supports a legal narrow seam');assert.equal(data.communities.length,9);
 assert.deepEqual(data.communities.slice(0,8),old.communities);assert.deepEqual(data.parts.filter(p=>p.community!==extension.id),old.parts);assert.deepEqual(data.obstacles,old.obstacles);
 assert.equal(extension.authority.wall.maxX,224);assert.equal(extension.authority.wall.maxZ,224);assert.equal(extension.authority.curbX,226);
 assert.equal(extension.grass,100);assert.deepEqual(extension.catches.map(p=>p.grass),[56,28,16]);assert(extension.props<=8);assert(own.filter(p=>p.shape!=='grass'&&p.role!=='fallen-failed-closure-paper').length<=6);assert(own.filter(p=>p.role==='fallen-failed-closure-paper').length<=2);
 assert(data.diagnostics.grass<=543&&data.diagnostics.props<=133);assert(data.diagnostics.grass<=544&&data.diagnostics.props<=136);
});
test('actual wall catches remain rooted and leave a real visually empty1.8m sidewalk',()=>{
 const owner=clean.coastal.buildings.find(p=>p.id===extension.address),seamView={...clean,coastal:{...clean.coastal,buildings:clean.coastal.buildings.filter(p=>p!==owner)}},lane=extension.authority.sidewalkLane;
 assert(lane.maxX-lane.minX>=1.8-1e-9);
 for(const p of own){const radius=p.shape==='grass'?Math.max(p.width,p.depth)/2:Math.hypot(p.width,p.depth)/2;
  if(p.shape==='grass'){
   assert(p.x-p.width/2>owner.collision.maxX);assert(p.x+p.width/2<lane.minX);assert(p.z-p.depth/2>=lane.minZ&&p.z+p.depth/2<=lane.maxZ);
   assert(cityLifeSiteClear(seamView,p.x,p.z,radius));assert.equal(p.y,Math.max(.135,capeGroundHeight(p.x,p.z)));assert(p.height>=.32&&p.height<=.66);
  }else if(p.role==='fallen-failed-closure-paper'){assert(p.z-p.depth/2>owner.collision.maxZ&&p.z+p.depth/2<owner.collision.maxZ+.18);assert(cityLifeSiteClear(seamView,p.x,p.z,radius));assert(Math.abs(p.y-p.height/2-Math.max(.135,capeGroundHeight(p.x,p.z)))<1e-9);
  }else{assert(cityLifeSiteClear(clean,p.x,p.z,radius));assert(p.x-radius>extension.authority.passageLane.maxX);assert(Math.abs(p.y-p.height/2-Math.max(.135,capeGroundHeight(p.x,p.z)))<1e-9);}
 }
 let samples=0;for(let z=lane.minZ;z<=lane.maxZ;z+=.2)for(const x of[lane.minX+.075,(lane.minX+lane.maxX)/2,lane.maxX-.075]){assert(canStand(world,x/4,z/4,.018),'actual sidewalk '+x+','+z);samples++;}report.sidewalkSamples=samples;
 const passage=extension.authority.passageLane;let passageSamples=0;const inheritedBlocked=[];
 for(let z=passage.minZ+.2;z<passage.maxZ-.2;z+=.2)for(const x of[passage.minX+.08,(passage.minX+passage.maxX)/2,passage.maxX-.08]){
  const baseline=canStand(prior,x/4,z/4,.018),current=canStand(world,x/4,z/4,.018);assert.equal(current,baseline,'new stock cannot change inherited passage authority');
  if(!current)inheritedBlocked.push({x,z,obstacleIds:world.obstacles.filter(o=>x/4>=o.minX-.018&&x/4<=o.maxX+.018&&z/4>=o.minY-.018&&z/4<=o.maxY+.018).map(o=>o.id)});passageSamples++;
 }report.passage={samples:passageSamples,inheritedBlocked,scope:'New stock keeps central1.8m envelope clear; original passage obstacles remain and are not claimed passable'};
});
test('all100 actual grass instances borrow green material and have rooted finite matrices',()=>{
 const box=new THREE.BoxGeometry(1,1,1),green=new THREE.MeshStandardMaterial({color:0x686e4c,roughness:1}),materials={coastGrass:green};
 for(const k of['wood','dark','paper','rust','fabric'])materials[k]=new THREE.MeshBasicMaterial();
 const art=buildCoastalCityLife({course:world,unitBox:box,materials}),bin=art.root.children.find(m=>m.name==='grass:foliage:3:3'),expected=data.parts.filter(p=>p.shape==='grass'&&Math.floor(p.x/64)===3&&Math.floor(p.z/64)===3);
 assert(bin);assert.equal(bin.count,expected.length);assert.equal(bin.material,green);assert(green.color.g>green.color.r&&green.color.g>green.color.b);
 const matrix=new THREE.Matrix4();let verified=0;for(const p of own.filter(p=>p.shape==='grass')){
  const i=expected.findIndex(q=>q.id===p.id);assert(i>=0);bin.getMatrixAt(i,matrix);assert([...matrix.elements].every(Number.isFinite));
  assert(Math.abs(matrix.elements[12]-p.x)<1e-4&&Math.abs(matrix.elements[13]-p.y)<1e-6&&Math.abs(matrix.elements[14]-p.z)<1e-4);verified++;
 }assert.equal(verified,100);report.renderSource={greenInstances:verified,materialColor:green.color.getHexString(),bins:art.diagnostics.bins,ownedTemplates:art.diagnostics.ownedGeometries,visibility:'Actual native street visibility still pending'};
 art.dispose();box.dispose();for(const m of new Set(Object.values(materials)))m.dispose();
});
test('original street camera has unobstructed real sight to the three wall catches',()=>{
 let visible=0;const player={x:232/4,y:232/4,z:1.6/4};
 for(const p of own.filter(p=>p.shape==='grass')){
  const dx=p.x/4-player.x,dy=p.z/4-player.y,d=Math.hypot(dx,dy),target=(p.y+p.height*.6)/4,
   ray=castRay(world,player.x,player.y,Math.atan2(dy,dx),d+.025,player.z,(target-player.z)/d);
  if(ray.dist>=d-.01)visible++;
 }assert.equal(visible,100,'all source roots have a true clear ray from the unchanged original street camera');report.clearStreetSight=visible;
});
test('seeds respect original total ceilings and independent100/6 stock plus2 paper extension budget',()=>{
 report.seedSweep=[];for(const seed of[1,71003,7317,8319,17031]){
  const next=makeCoastalCityLife(clean,{burntDrain:false,seed,extraExclusions:[{minX:85,maxX:108,minZ:100,maxZ:119}]}),ninth=next.communities.find(p=>p.story==='abandoned-workshop-frontage'),before=makeBaselineCityLife(clean,{seed,extraExclusions:[{minX:85,maxX:108,minZ:100,maxZ:119}]});
  assert(next.diagnostics.grass<=544);assert(next.diagnostics.props<=136);assert((ninth?.grass||0)<=100);assert((ninth?.props||0)<=8);assert(next.parts.filter(p=>p.community===ninth?.id&&p.shape!=='grass'&&p.role!=='fallen-failed-closure-paper').length<=6);assert(next.parts.filter(p=>p.role==='fallen-failed-closure-paper').length<=2);assert.deepEqual(next.obstacles,before.obstacles,'ninth scene adds no collider for any seed');
  assert.deepEqual(next.communities.filter(c=>c.story!=='abandoned-workshop-frontage'),before.communities);
  assert.deepEqual(next.parts.filter(p=>p.community!==ninth?.id),before.parts,'all eight original ordered records are byteexact for every seed');
  assert.deepEqual(next,makeCoastalCityLife(clean,{burntDrain:false,seed,extraExclusions:[{minX:85,maxX:108,minZ:100,maxZ:119}]}));report.seedSweep.push({seed,...next.diagnostics,ninth:ninth&&{grass:ninth.grass,props:ninth.props}});
 }
});
test('save rooted frontage source evidence only',()=>fs.writeFileSync('output/island-workshop-frontage-density-census.json',JSON.stringify(report,null,2)+'\n'));


