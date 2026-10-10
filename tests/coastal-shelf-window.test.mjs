import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {buildCoastalShorelineArt,coastalShelfWindowRoles,geologicalSample} from '../coastal-shoreline-art.js';
import {shelfGeometrySignature,shelfProtectedColorSignature} from './coastal-shelf-signatures.mjs';

test('wind-scoured shelf roles use actual crest and opposing lee/descent normals within one irregular body',()=>{
 const crest=coastalShelfWindowRoles(336,3.4,424,.97,0),lee=coastalShelfWindowRoles(336,1.9,421,.9,-.3),outer=coastalShelfWindowRoles(331,2.4,430,.8,.35);
 assert.ok(crest.weight>.9&&crest.mineral>.9,'existing high bearing crest owns exposed mineral');
 assert.ok(lee.weight>.7&&lee.lee>.8&&lee.mineral<.1,'lower inward-rising ground retains organic cover');
 assert.ok(outer.weight>0&&outer.loose>0,'one unequal lobe follows the already falling outer face');
 for(const [x,z]of [[340,416],[318,424],[366,424],[340,435],[360,420],[322,419]])assert.equal(coastalShelfWindowRoles(x,3,z,1,0).weight,0);
 assert.equal(coastalShelfWindowRoles(336,-.1,424,1,0).weight,0);
 for(const g of [{height:.001},{jointDepth:.001},{exposedFace:.001},{planeWeight:.001}])assert.equal(coastalShelfWindowRoles(336,3.4,424,1,0,g).weight,0,'earned geology ownership survives');
 assert.equal(coastalShelfWindowRoles(336,3.4,424,1,0,{},.001).weight,0,'existing wrack ground is protected');
});

test('entire frozen v39 shore geometry and protected colors remain exact with unchanged resources and lifecycle',()=>{
 const world={root:new THREE.Group(),materials:{},diagnostics:{}},art=buildCoastalShorelineArt(world);
 try{
  // Captured from the immutable v39 emitted build, not the implementation.
  assert.equal(shelfGeometrySignature(art),'7480e3d7053845710c1877f9cebcefdea0db8742271afd30422464c7a3a0b3db','ALL positions/normals/index/geo/UV/foam/contours/transforms/bounds exact');
  assert.equal(shelfProtectedColorSignature(art),'ba85089239bdbb4b76936c0aed1eeafe9add672c19a09d26e955972c28ed449e','ALL outside/protected/wrack/headland/submerged/foam colors exact');
  assert.equal(art.diagnostics.triangles,42282);assert.equal(art.diagnostics.draws,5);assert.equal(art.diagnostics.edgeUseTriangles,1104);assert.equal(art.diagnostics.rootedSaltgrassTufts,37);
  const materials=new Set(art.root.children.map(o=>o.material));assert.equal(materials.size,2);assert.equal(art.root.children.length,5);
  for(const mesh of art.root.children){assert.equal(mesh.geometry.index,null);for(const value of Object.values(mesh.material))assert.ok(!value?.isTexture,'no new maps');}
  const land=art.root.getObjectByName('ContinuousErodedCoast'),p=land.geometry.attributes.position,n=land.geometry.attributes.normal;
  let active=0,lee=0,mineral=0;
  for(let i=0;i<p.count;i++){
   const role=coastalShelfWindowRoles(p.getX(i),p.getY(i),p.getZ(i),n.getY(i),n.getZ(i),geologicalSample(p.getX(i),p.getZ(i)));
   if(role.weight>.1){active++;if(role.lee>.5)lee++;if(role.mineral>.5)mineral++;}
  }
  assert.ok(active>100&&lee>20&&mineral>20,'emitted vertices resolve both broad crest and inward soil, not fine grain alone');
  let releases=0;for(const o of art.root.children)o.geometry.addEventListener('dispose',()=>releases++);for(const m of materials)m.addEventListener('dispose',()=>releases++);
  art.dispose();art.dispose();assert.equal(releases,7);assert.equal(world.root.children.length,0);
 }finally{art.dispose();}
});
