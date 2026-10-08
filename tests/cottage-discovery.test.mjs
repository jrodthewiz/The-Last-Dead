import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {canStand,newRun,tick} from '../engine.js';
import {actorGroundAt} from '../coastal-structures.js';
import {getCottageDiscovery} from '../assets/blackwater-kit/cottage-authored.js';
import {collectScavengerPickup,createScavengerPack,MAX_SCAVENGER_CACHES} from '../scavenger-pack.js';
import {ScavengerCaches} from '../scavenger-pack-ui.js';
const course=makeHarborCourse({openWorld:true});
const building=course.coastal.blackwaterSlice.buildings.find(p=>p.label==='CAPE LODGE 75');
const discovery=getCottageDiscovery(building),item=course.scavengerPickups.find(p=>p.id===discovery.id);
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);

test('one supported cottage discovery survives world serialization, yaw and cache limits',()=>{
 assert.ok(item);assert.ok(course.scavengerPickups.filter(p=>p.visualKind!=='supply-case').length<=MAX_SCAVENGER_CACHES);
 // Other buildings may now have supported repair supplies. The authored
 // cottage still owns exactly one case; its route booklet is a separate item.
 assert.equal(course.scavengerPickups.filter(p=>p.roomId===building.id&&p.discoveryLabel&&p.visualKind!=='route-folio').length,1);
 const [x,y,z]=discovery.position,c=Math.cos(building.yaw),s=Math.sin(building.yaw);
 close(item.x*4,building.x+x*c+z*s);close(item.y*4,building.z-x*s+z*c);
 close(item.visualBaseY+.03,building.y+y);assert.equal(item.visualYaw,building.yaw);
 assert.deepEqual(JSON.parse(JSON.stringify(item)),item);
 assert.equal(getCottageDiscovery({...building,label:'CAPE LODGE 76'}),null);
 assert.equal(getCottageDiscovery({...building,enterable:false}),null);
});

test('real pooled case sits on the dresser and disappears after collection without new draws',()=>{
 const parent=new THREE.Group(),pool=new ScavengerCaches(parent,course),index=pool.caseItems.indexOf(item),m=new THREE.Matrix4();
 assert.equal(pool.meshes.length,3);pool.meshes[0].getMatrixAt(index,m);
 const bottom=new THREE.Vector3(0,.03,0).applyMatrix4(m);
 close(bottom.y,building.y+discovery.position[1]);close(bottom.x,item.x*4);close(bottom.z,item.y*4);
 const expected=new THREE.Matrix4().makeRotationY(building.yaw);close(m.elements[0],expected.elements[0]);
 pool.update([item.id]);assert.equal(pool.meshes[0].count,pool.caseItems.length-1);
 pool.dispose();
});

test('reachable cabinet approach yields four useful fittings once; full pack preserves the case',()=>{
 assert.ok(canStand(course,item.approach.x,item.approach.y,.16),'64 cm player radius clears authoritative furniture');
 assert.ok(Math.hypot(item.approach.x-item.x,item.approach.y-item.y)<=.55);
 const run={course,mode:'play',health:100,z:0,...item.approach,events:[],backpack:createScavengerPack({scrap:12})};
 assert.equal(collectScavengerPickup(run,item.id).reason,'full');assert.ok(!run.backpack.collected.includes(item.id));
 run.backpack.scrap=0;const result=collectScavengerPickup(run,item.id);
 assert.equal(result.ok,true);assert.equal(run.backpack.scrap,4);assert.equal(result.event.discoveryLabel,discovery.label);close(result.event.z,item.itemZ);
 assert.equal(collectScavengerPickup(run,item.id).reason,'collected');assert.equal(run.backpack.scrap,4);
 // The rear yard is close enough in plan to some house props, but not this cache.
 Object.assign(run,{x:building.x/4,y:(building.z+building.depth/2+1)/4});
 run.backpack=createScavengerPack();assert.equal(collectScavengerPickup(run,item.id).reason,'out-of-reach');
});

test('actual forward movement reaches the repair case from the street around the constructed stair railing',()=>{
 const actual=makeHarborCourse({openWorld:true});actual.enemies=[];
 const cache=actual.scavengerPickups.find(p=>p.id===item.id),run=newRun(actual);
 Object.assign(run,{mode:'play',x:158/4,y:237/4,z:0,vx:0,vy:0,vz:0,supportZ:null,supportId:null,structureId:null,waveDelay:999,lowTide:null,vehicle:null});
 assert.equal(run.backpack.scrap,0);
 for(const target of [{x:158/4,y:241.6/4,z:.05},{x:158/4,y:cache.approach.y,z:.05},{...cache.approach,z:.05}]){
  let reached=false;
  for(let i=0;i<1800;i++){
   if(Math.hypot(target.x-run.x,target.y-run.y)<.027&&Math.abs(actorGroundAt(actual,run)-target.z)<.06){reached=true;break;}
   run.angle=Math.atan2(target.y-run.y,target.x-run.x);tick(run,1/120,{forward:1});
  }
  assert.ok(reached,`hall route stops at ${run.x*4},${run.y*4}`);
 }
 assert.equal(run.backpack.scrap,4);assert.ok(run.backpack.collected.includes(cache.id));
 assert.equal(run.course.activeInterior??null,null);assert.equal(run.mode,'play');
});
