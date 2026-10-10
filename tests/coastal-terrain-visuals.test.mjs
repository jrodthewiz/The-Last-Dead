import {historicalRecords,historicalCourtCoastal,assertCourtTerrainTotals} from './coastal-court-history.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {canStand} from '../engine.js';
import {capeGroundHeight,capeStreamZ,capeStreamLevel,capePathMask,capeMeadowField,capeWoodlandRelief,capeCoastalGladeClear} from '../coastal-terrain.js';
import {understoryClear} from '../coastal-understory-layout.js';
import {makeCapeWoodlandGround,buildCapeWoodlandGround} from '../coastal-woodland-ground.js';
import {buildCapeTerrain} from '../coastal-terrain-visuals.js';
import {capeResidentialCoastFields} from '../coastal-terrain-fields.js';

test('terrain buffers match gameplay samples and stay separate from level building/road floors',()=>{
 const c=makeHarborCourse({openWorld:true}),world={course:c,root:new THREE.Group(),materials:{},diagnostics:{},box(){}};
 const terrain=buildCapeTerrain(world);let checked=0;
 try{
  terrain.root.traverse(o=>{if(!o.name.startsWith('CapeTerrain:'))return;
   const p=o.geometry.attributes.position;
   for(let i=0;i<p.count;i++){assert.ok(Number.isFinite(p.getY(i)));assert.ok(Math.abs(p.getY(i)-capeGroundHeight(p.getX(i),p.getZ(i),{bridges:false}))<1e-6);checked++;}
  });
  assert.ok(checked>40000);assert.ok(capeGroundHeight(410,386)>5);
  for(const b of c.coastal.buildings)for(const x of [b.x-b.width/2,b.x,b.x+b.width/2])for(const z of [b.z-b.depth/2,b.z,b.z+b.depth/2])assert.equal(capeGroundHeight(x,z),0);
  for(const r of c.coastal.roads)assert.equal(capeGroundHeight(r.x,r.z),0);
  for(const x of [222,340])assert.equal(capeGroundHeight(x,capeStreamZ(x)),capeStreamLevel(x)+.65);
  assert.ok(capeGroundHeight(280,capeStreamZ(280))<capeStreamLevel(280)-.6);
 }finally{terrain.dispose();}assert.equal(world.root.children.length,0);
});

test('salt meadow follows connected lee communities and worn traces in the residential extension',()=>{
 const c=makeHarborCourse({openWorld:true}),p=historicalRecords(c.coastal,'understoryPlacements');
 const meadow=p.filter(p=>p.habitat==='coastal-meadow');
 assert.equal(p.filter(p=>!p.habitatExpansion).length,2433,'retain every existing plant while adding distinct habitat growth');
 assert.equal(meadow.length,320);assert.equal(new Set(meadow.map(p=>p.community)).size,8);
 for(const plant of meadow){
  assert.ok(plant.x>390&&plant.x<442&&plant.z>3&&plant.z<120);
  assert.equal(plant.y,capeGroundHeight(plant.x,plant.z));
  const field=capeResidentialCoastFields(plant.x,plant.z);assert.ok(field.scrub>=.16);assert.ok(field.trace<=.04);assert.ok(field.bedrock<=.2);
  assert.ok(understoryClear(c.coastal,plant.x,plant.z),'existing road, portal, river and footpath clearances');
 }
 assert.equal(capeMeadowField(418,60),0,'wind-scoured gap between communities');
 assert.ok(meadow.filter(p=>p.kind==='grass'&&p.scale>1.25).length>100,'readable coastal grass band');
 assert.equal(p.filter(p=>p.kind!=='shrub'&&!p.softShoulder&&p.x>=315&&p.x<=355&&p.z>=370&&p.z<=400).length,268,'every existing fixed woodland floor plant is retained');
 assert.equal(p.filter(p=>p.kind!=='shrub'&&!p.softShoulder&&p.z>324&&p.zone==='forest-floor').length,1003,'bilberry allocation does not deplete old woodland');
 const trees=c.coastal.forestPlacements.filter(p=>p.community?.startsWith('residential-saltwood'));
 assert.equal(c.coastal.forestPlacements.length,562);assert.equal(trees.length,32);
 assert.equal(new Set(trees.map(p=>p.community)).size,2,'two young woodland height masses');
 for(const tree of trees){
  assert.ok(tree.x>395&&tree.x<425&&tree.z>9&&tree.z<88);
  assert.ok(tree.height>=5.5&&tree.height<=9);assert.equal(tree.y,capeGroundHeight(tree.x,tree.z));
  assert.equal(canStand(c,tree.x/4,tree.z/4,.1),false,'relocation updates authoritative trunk obstacles');
 }
 for(const z of [56,112])for(let x=376;x<=397;x+=.5)assert.ok(canStand(c,x/4,z/4,.16),'open road endpoint and shoulder');
});

test('seeded forest clears building approaches, footpaths and stream banks with solid trunk proxies',()=>{
 const a=makeHarborCourse({openWorld:true}),b=makeHarborCourse({openWorld:true});
 const forest=historicalRecords(a.coastal,'forestPlacements').filter(p=>p.id.startsWith('cape-forest-'));
 assert.deepEqual(a.coastal.forestPlacements,b.coastal.forestPlacements);assert.ok(forest.length>300);
 for(const p of forest){
  assert.equal(p.y,capeGroundHeight(p.x,p.z));assert.ok(capePathMask(p.x,p.z)<=.02);const live=a.coastal.forestPlacements.find(t=>t.id===p.id);assert.equal(canStand(a,live.x/4,live.z/4,.1),false,'every retained historical tree has a solid proxy at its actual final position');
  for(const lot of a.coastal.buildings)assert.ok(Math.abs(p.x-lot.x)>=lot.width/2+4||Math.abs(p.z-lot.z)>=lot.depth/2+4);
 }
 for(const x of [222,340])for(let z=314;z<=406;z+=.5)assert.ok(canStand(a,x/4,z/4,.16),`open forest path ${x},${z}`);
});

test('woodland forms layered irregular groves within the shared pooled tree budget',()=>{
 const c=makeHarborCourse({openWorld:true}),all=historicalRecords(c.coastal,'forestPlacements');
 const trees=all.filter(p=>p.id.startsWith('cape-forest-'));
 assert.ok(all.length<=554);assert.ok(trees.length>=420,'substantial canopy rather than sparse street-tree spacing');
 assert.ok(trees.filter(p=>p.habitat==='young-edge'&&p.height<10).length>80);
 assert.ok(trees.filter(p=>p.habitat==='mature-grove'&&p.height>=13).length>180);
 assert.ok(trees.filter(p=>p.habitat==='emergent-canopy'&&p.height>=20).length>40);
 assert.ok(trees.filter(p=>p.z>360).length>150,'northern woodland');
 assert.ok(trees.filter(p=>p.x>385&&p.z<324).length>100,'eastern woodland');
 for(let i=0;i<trees.length;i++){
  const p=trees[i];assert.ok(((p.x-294)/13)**2+((p.z-391)/9)**2>=1,'sheltered meadow stays open');
  for(let j=0;j<i;j++)assert.ok(Math.hypot(p.x-trees[j].x,p.z-trees[j].z)>=4.2,'ground-level gaps between solid trunks');
 }
 assert.ok(new Set(trees.map(p=>Math.round(p.x*10))).size>trees.length*.8,'placements do not retain plantation columns');
 const conifers=trees.filter(p=>p.species==='conifer').length;
 assert.ok(conifers>trees.length*.35&&conifers<trees.length*.75,'mixed broadleaf and conifer canopy');
 assert.ok(trees.filter(p=>p.groveStrength>.45).length>300,'canopy concentrates in three broad grove interiors');
 for(const grove of [0,1,2])assert.ok(trees.filter(p=>p.grove===grove).length>80,'each grove retains a substantial cohort');
 assert.ok(trees.filter(p=>p.grove===3).length>=30,'new physical eastern headland retains a coherent canopy around the salt-wind glade');
 assert.ok(trees.filter(p=>p.grove===3&&p.y>12).length>=16,'canopy roots follow the raised headland rather than the old flat lawn');
 assert.ok(trees.every(p=>!capeCoastalGladeClear(p.x,p.z)),'open headland hollow and saddle retain a useful coastline sightline');
 const west=trees.filter(p=>p.grove===0),north=trees.filter(p=>p.grove===1);
 assert.ok(west.filter(p=>p.species==='deciduous').length>west.length*.6,'western hollow is broadleaf');
 assert.ok(north.filter(p=>p.species==='conifer').length>north.length*.6,'northern ridge is evergreen');
 const communities=c.coastal.understoryPlacements.filter(p=>p.community);
 assert.ok(communities.length>650,'existing plant quota forms grounded grove communities');
 assert.ok(communities.filter(p=>p.kind==='fern'&&p.scale>1).length>300,'readable shaded fern layer');
});

test('wooded headland relief preserves routes and real windfall obstacles match visible ground timber',()=>{
 const c=makeHarborCourse({openWorld:true});
 assert.ok(capeGroundHeight(410,382)>20,'substantial wooded headland');
 assert.ok(capeGroundHeight(323,388)>9,'ordinary woodland view sees a physical ridge');
 for(const x of [222,340])for(let z=314;z<=406;z+=.5){
  assert.equal(capeWoodlandRelief(x,z),0,'existing walking path receives no added rise');
  assert.ok(canStand(c,x/4,z/4,.16));
 }
 const props=makeCapeWoodlandGround(c.coastal);assert.equal(props.length,8);
 for(const p of props){
  assert.equal(p.y,capeGroundHeight(p.x,p.z));
  assert.ok(c.obstacles.some(o=>o.id===p.id),'solid timber has actual authoritative obstacle');
  assert.equal(canStand(c,p.x/4,p.z/4,.16),false);
 }
 const material=new THREE.MeshBasicMaterial(),art=buildCapeWoodlandGround({placements:props,material});
 try {
  assert.ok(art.diagnostics.triangles<2000);assert.ok(art.diagnostics.batches<=8);
  assert.equal(art.diagnostics.addedMaterials,0);assert.equal(art.diagnostics.addedTextures,0);
  const point=new THREE.PerspectiveCamera();point.position.set(340,1.6,376);art.update(point);assert.ok(art.diagnostics.visibleBatches>0);
  point.position.set(-2000,0,-2000);art.update(point);assert.equal(art.diagnostics.visibleBatches,0);
 } finally {art.dispose();art.dispose();material.dispose();}
 const pockets=c.coastal.understoryPlacements.filter(p=>p.habitat==='heath-pocket');
 assert.ok(pockets.length>=150);assert.ok(new Set(pockets.map(p=>p.community)).size>=15);
 for(const p of pockets){assert.equal(p.y,capeGroundHeight(p.x,p.z));assert.ok(understoryClear(c.coastal,p.x,p.z));}
});
