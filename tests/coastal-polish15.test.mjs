import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {canStand} from '../engine.js';
import {capeGroundHeight,capePathMask,capeStreamZ,capeStreamWidth} from '../coastal-terrain.js';
import {capeSurfaceFields} from '../coastal-terrain-fields.js';
import {buildCapeTerrain} from '../coastal-terrain-visuals.js';
import {buildCapeBankDetail} from '../assets/forest-kit/bank-detail.js';
import {makeCoastalUnderstory} from '../coastal-understory-layout.js';
import {RUNTIME_FILES} from '../build.mjs';

test('surface causes stay finite, deterministic and tied to the unchanged collision ground',()=>{
  for(let x=130;x<448;x+=7)for(let z=316;z<414;z+=3){
    const f=capeSurfaceFields(x,z);assert.deepEqual(f,capeSurfaceFields(x,z));
    assert.equal(f.height,capeGroundHeight(x,z,{bridges:false}));
    for(const [name,value]of Object.entries(f)){assert.ok(Number.isFinite(value),name);if(!['height','bankDistance'].includes(name))assert.ok(value>=0&&value<=1,name);}
  }
  const x=280,z=capeStreamZ(x),w=capeStreamWidth(x);
  assert.ok(capeSurfaceFields(x,z+w+.8).wetness>capeSurfaceFields(x,z+w+7).wetness);
  assert.ok(capeSurfaceFields(x,z+w+2).bank>.7);
  assert.equal(capeSurfaceFields(222,330).path,1);
  assert.ok(RUNTIME_FILES.includes('coastal-terrain-fields.js'));
});

test('bank detail has a bounded cost, grounded vertices and clear bridge/path corridors',()=>{
  const c=makeHarborCourse({openWorld:true}),material=new THREE.MeshBasicMaterial();
  const art=buildCapeBankDetail({forest:c.coastal.forestPlacements,material});
  try{
    assert.ok(art.diagnostics.plates>200);assert.ok(art.diagnostics.roots>100);
    assert.ok(art.diagnostics.triangles<=14000);assert.ok(art.diagnostics.batches<=40);
    assert.equal(art.diagnostics.addedMaterials,0);assert.equal(art.diagnostics.addedTextures,0);assert.equal(art.diagnostics.addedShadowMaps,0);
    art.root.traverse(o=>{if(!o.isMesh)return;assert.equal(o.material,material);assert.equal(o.castShadow,false);
      const p=o.geometry.attributes.position;
      for(let i=0;i<p.count;i++){
        const x=p.getX(i),z=p.getZ(i),relief=p.getY(i)-capeGroundHeight(x,z,{bridges:false});
        assert.ok(relief>.005&&relief<.035,`low grounded relief ${relief}`);assert.ok(capePathMask(x,z)<=.015);
        for(const bx of [222,340])assert.ok(Math.abs(x-bx)>=3.1||Math.abs(z-capeStreamZ(bx))>=12);
      }
      // Wide shelves must conform between their vertices too. Allow sub-2 mm
      // embedding, but reject floating facets over the bank's physical triangles.
      for(let i=0;i<p.count;i+=3)for(const weights of [[1/3,1/3,1/3],[.5,.5,0],[0,.5,.5],[.5,0,.5]]){
        let x=0,y=0,z=0;for(let j=0;j<3;j++){x+=p.getX(i+j)*weights[j];y+=p.getY(i+j)*weights[j];z+=p.getZ(i+j)*weights[j];}
        const relief=y-capeGroundHeight(x,z,{bridges:false});assert.ok(relief>-.002&&relief<.04,`conforming triangle interior ${relief}`);
      }
    });
    for(const x of [222,340])for(let z=314;z<406;z+=.5)assert.equal(canStand(c,x/4,z/4,.16),true);
  }finally{art.dispose();material.dispose();}
});

test('terrain detail is culled, exposes every cause and releases only owned resources once',()=>{
  const c=makeHarborCourse({openWorld:true}),world={course:c,root:new THREE.Group(),materials:{},diagnostics:{},box(){}};
  const art=buildCapeTerrain(world),camera=new THREE.PerspectiveCamera(),counts=new Map();
  const resources=new Set();art.root.traverse(o=>{if(o.isMesh){resources.add(o.geometry);resources.add(o.material);}});
  for(const r of resources)r.addEventListener('dispose',()=>counts.set(r,(counts.get(r)||0)+1));
  camera.position.set(340,1.7,350);art.update(2,camera);assert.ok(art.detail.diagnostics.visibleBatches>0);
  camera.position.set(-2000,1.7,-2000);art.update(3,camera);assert.equal(art.detail.diagnostics.visibleBatches,0);
  assert.deepEqual(Object.keys(world.diagnostics.terrain.fields.ranges).sort(),Object.keys(capeSurfaceFields(280,350)).sort());
  assert.equal(world.diagnostics.terrain.chunks,54); // Same disjoint physical grid.
  art.dispose();art.dispose();for(const r of resources)assert.equal(counts.get(r),1);assert.equal(world.root.children.length,0);
});

test('habitat polish preserves exact placement roots and all four existing plant quotas',()=>{
  const c=makeHarborCourse({openWorld:true}),p=makeCoastalUnderstory(c.coastal);
  assert.equal(p.length,2433);assert.deepEqual(p,c.coastal.understoryPlacements);
  const limits={'building-verge':1300,'forest-floor':800,'river-bank':350,'eastern-slope':150};
  for(const [zone,cap]of Object.entries(limits))assert.ok(p.filter(p=>p.zone===zone).length<=cap);
  for(const item of p){assert.ok(item.tint>=0&&item.tint<=1);assert.equal(item.y,item.zone==='building-verge'?Math.max(capeGroundHeight(item.x,item.z),.135):capeGroundHeight(item.x,item.z));}
  assert.ok(p.filter(p=>p.zone==='river-bank'&&p.kind==='fern').length>70);
});
