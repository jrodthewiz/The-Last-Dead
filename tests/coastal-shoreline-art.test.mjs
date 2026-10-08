import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {buildCoastalShorelineArt,shorelineSamples} from '../coastal-shoreline-art.js';

const inside=(x,z)=>x>0&&x<448&&z>0&&z<416&&(x>128||z<120);
test('sculpted coast stays seaward, preserves harbor and has an asymmetric cape',()=>{
  const samples=shorelineSamples();
  for(const s of samples){
    for(const offset of [.48,s.width*.18+.5,s.width*1.22+.5])assert.equal(inside(s.x+s.nx*offset,s.z+s.nz*offset),false);
    if(s.x<=128&&s.z<=120)assert.equal(s.width,2.2,'only the original working harbor is narrow');
  }
  const cape=samples.filter(s=>s.z>180);
  assert.ok(Math.max(...cape.map(s=>s.width))>50,'cape apron must read at thumbnail scale');
  assert.ok(Math.max(...cape.map(s=>s.width))-Math.min(...cape.map(s=>s.width))>25,'strong headlands and recessed coves');
  const townCoast=samples.filter(s=>s.z===0&&s.x>180);
  assert.ok(Math.max(...townCoast.map(s=>s.width))>45,'long southern grass-board edge gets a visible headland');
  assert.ok(Math.max(...townCoast.map(s=>s.width))-Math.min(...townCoast.map(s=>s.width))>25);
});
test('shore meshes face upward, fit budget and release owned resources once',()=>{
  const world={root:new THREE.Group(),materials:{},diagnostics:{}};
  const art=buildCoastalShorelineArt(world);
  assert.equal(art.root.children.length,2);
  assert.ok(art.diagnostics.triangles<25000);
  assert.ok(art.diagnostics.highestCliff>10);
  assert.equal(art.diagnostics.geologicalNoses,3);
  assert.equal(art.diagnostics.integratedBeddingField,true);
  assert.equal(art.diagnostics.featheredSurf,true);
  const geometry=art.root.children[0].geometry,p=geometry.attributes.position,n=geometry.attributes.normal;
  for(let i=0;i<p.count;i++){assert.ok(Number.isFinite(p.getY(i)));assert.equal(inside(p.getX(i),p.getZ(i)),false);}
  let upperCapeVertices=0;
  for(let i=0;i<p.count;i++)if(p.getZ(i)>180&&p.getY(i)>1)upperCapeVertices++;
  assert.ok(upperCapeVertices>1000,'upper apron mass stays visibly above water');
  assert.ok(n.getY(0)>.1,'inner top ring is visible from above');
  const surf=art.root.children[1],alpha=surf.geometry.attributes.surfOpacity;
  assert.equal(alpha.count,surf.geometry.attributes.position.count);
  let transparentEdges=0,visibleCenters=0;
  for(let i=0;i<alpha.count;i++){
    const a=alpha.getX(i);assert.ok(a>=0&&a<=.261);
    if(a===0)transparentEdges++;else visibleCenters++;
  }
  assert.ok(transparentEdges>visibleCenters,'both surf edges feather to transparent');
  assert.ok(visibleCenters>0);
  assert.ok(surf.material.opacityNode,'native material reads the per-vertex feather field');
  let released=0;
  geometry.addEventListener('dispose',()=>released++);
  art.dispose();art.dispose();assert.equal(released,1);assert.equal(world.root.children.length,0);
});
