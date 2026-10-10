import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {canStand} from '../engine.js';
import {capeGroundHeight,capePathMask,capeStreamZ,capeStreamWidth} from '../coastal-terrain.js';
import {capeSurfaceFields,capeBiomeWeights,capeTrailSurfaceMask,capeTrailCentreDistance,makeCapeRootShoulders,capeRootShoulderField} from '../coastal-terrain-fields.js';
import {createCapeGroundAtlas} from '../assets/forest-kit/ground-atlas.js';
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
  assert.ok(capeSurfaceFields(327,384).exposedStone>.9,'explicit rock knob owns bedrock');
  assert.equal(capeSurfaceFields(415,386).exposedStone,0,'wooded hill slopes do not become pale stone sheets');
  for(const point of [[415,386],[327,384],[340,376],[171,384]]){
    const weights=capeBiomeWeights(...point);assert.equal(weights.length,4);
    assert.ok(weights.every(w=>Number.isFinite(w)&&w>=0&&w<=1));
    assert.ok(Math.abs(weights.reduce((a,b)=>a+b,0)-1)<1e-8,'joined material roles partition the terrain surface');
  }
  assert.ok(capeBiomeWeights(340,376)[3]>.65&&capeBiomeWeights(340,376)[0]>.2,'compacted path retains washed grit and modest pressed organic residue');
  for(let z=370;z<400;z+=.5){
    assert.equal(capeTrailSurfaceMask(340,z),1);assert.equal(capeTrailSurfaceMask(339,z),1,'two metre visual footfall centre');
    assert.equal(capeTrailSurfaceMask(337.7,z),0,'needle and moss shoulders enter the broad physical corridor');
    assert.ok(capeBiomeWeights(337.7,z)[1]>.15,'ecological shoulder has moss material rather than grit pavement');
  }
  assert.ok(RUNTIME_FILES.includes('coastal-terrain-fields.js'));
});

test('bank detail has a bounded cost, grounded vertices and clear bridge/path corridors',()=>{
  const c=makeHarborCourse({openWorld:true}),material=new THREE.MeshBasicMaterial();
  const art=buildCapeBankDetail({forest:c.coastal.forestPlacements,material});
  try{
    assert.ok(art.diagnostics.plates>200);assert.ok(art.diagnostics.roots>100);
    assert.ok(art.diagnostics.duffFragments>1000,'pine needles and birch leaf drifts share the existing grounded detail budget');
    assert.equal(art.diagnostics.fallenBranches,8,'readable forked windfall ribbons flank clear paths and eastern groves');
    assert.ok(art.diagnostics.triangles<=60000);assert.ok(art.diagnostics.sourceTriangles<=15000,'original details plus bounded connected shoulder surfaces');assert.ok(art.diagnostics.batches<=44);
    assert.equal(art.diagnostics.mineralPockets,2,'two connected-strike residential slate exposures reuse shared detail material');
    assert.equal(art.diagnostics.addedMaterials,0);assert.equal(art.diagnostics.addedTextures,0);assert.equal(art.diagnostics.addedShadowMaps,0);
    let raisedRootVertices=0;
    art.root.traverse(o=>{if(!o.isMesh)return;assert.equal(o.material,material);assert.equal(o.castShadow,false);
      const p=o.geometry.attributes.position;
      for(let i=0;i<p.count;i++){
        const x=p.getX(i),z=p.getZ(i),relief=p.getY(i)-capeGroundHeight(x,z,{bridges:false});
        const roles=o.geometry.attributes.capeBiome,bed=roles.getX(i)+roles.getY(i)+roles.getZ(i)+roles.getW(i)>.99;
        assert.ok(relief>(bed?-.0001:.005)&&relief<.101,`low grounded root volume ${relief}`);
        if(capePathMask(x,z)>.015){assert.ok(capeTrailCentreDistance(x,z)>=1.5-1e-5,'soft detail preserves the full three metre travel surface');assert.ok(makeCapeRootShoulders(c.coastal.forestPlacements).some(t=>Math.abs(z-t.treeZ)<8&&Math.abs(x-t.treeX)<7),'old blanket clearance is used only inside the bounded connected root habitat');}
        if(relief>.06){raisedRootVertices++;assert.ok(c.coastal.forestPlacements.some(tree=>Math.hypot(tree.x-x,tree.z-z)<1.1),'raised flare stays connected to an actual trunk footing');}
        for(const bx of [222,340])assert.ok(Math.abs(x-bx)>=3.1||Math.abs(z-capeStreamZ(bx))>=12);
      }
      // Wide shelves must conform between their vertices too. Allow sub-2 mm
      // embedding, but reject floating facets over the bank's physical triangles.
      for(let i=0;i<p.count;i+=3)for(const weights of [[1/3,1/3,1/3],[.5,.5,0],[0,.5,.5],[.5,0,.5]]){
        let x=0,y=0,z=0;for(let j=0;j<3;j++){x+=p.getX(i+j)*weights[j];y+=p.getY(i+j)*weights[j];z+=p.getZ(i+j)*weights[j];}
        const relief=y-capeGroundHeight(x,z,{bridges:false});assert.ok(relief>-.002&&relief<.105,`conforming triangle interior ${relief}`);
      }
    });
    assert.ok(raisedRootVertices>500,'root flares have actual volume above the former flat ribbons');
    for(const x of [222,340])for(let z=314;z<406;z+=.5)assert.equal(canStand(c,x/4,z/4,.16),true);
  }finally{art.dispose();material.dispose();}
});

test('terrain detail is culled, exposes every cause and releases only owned resources once',()=>{
  const c=makeHarborCourse({openWorld:true}),world={course:c,root:new THREE.Group(),materials:{},diagnostics:{},box(){}};
  const art=buildCapeTerrain(world),camera=new THREE.PerspectiveCamera(),counts=new Map();
  const resources=new Set();art.root.traverse(o=>{if(o.isMesh){resources.add(o.geometry);resources.add(o.material);}});
  resources.add(art.atlas.albedo);resources.add(art.atlas.normal);
  for(const r of resources)r.addEventListener('dispose',()=>counts.set(r,(counts.get(r)||0)+1));
  camera.position.set(340,1.7,350);art.update(2,camera);assert.ok(art.detail.diagnostics.visibleBatches>0);
  camera.position.set(-2000,1.7,-2000);art.update(3,camera);assert.equal(art.detail.diagnostics.visibleBatches,0);
  assert.deepEqual(Object.keys(world.diagnostics.terrain.fields.ranges).sort(),Object.keys(capeSurfaceFields(280,350)).sort());
  assert.equal(world.diagnostics.terrain.chunks,63); // Original54, eight front-coast chunks, one genuine court-ground extension.
  art.dispose();art.dispose();for(const r of resources)assert.equal(counts.get(r),1);assert.equal(world.root.children.length,0);
});

test('authored forest atlas has deterministic joined material channels and bounded owned textures',()=>{
 const a=createCapeGroundAtlas(),b=createCapeGroundAtlas();
 try {
  assert.equal(a.diagnostics.textures,2);assert.ok(a.diagnostics.bytesWithMipmaps<=11*1024*1024);
  assert.deepEqual(a.albedo.image.data,b.albedo.image.data);assert.deepEqual(a.normal.image.data,b.normal.image.data);
  assert.equal(a.albedo.colorSpace,THREE.SRGBColorSpace);assert.equal(a.normal.colorSpace,THREE.NoColorSpace);
  for(const texture of [a.albedo,a.normal]){assert.ok(texture.generateMipmaps);assert.equal(texture.minFilter,THREE.LinearMipmapLinearFilter);}
  const c=a.albedo.image.data,n=a.normal.image.data;
  // Exact opposite-edge copies catch the native square-repeat seam, including
  // normal/roughness channels. Cropping a periodic tile cannot satisfy this.
  for(const map of [c,n])for(let role=0;role<4;role++)for(let edge=0;edge<448;edge+=7)for(let depth=0;depth<32;depth++){
    const at=(x,y)=>((y+32+(role>>1)*512)*1024+x+32+(role%2)*512)*4;
    for(const [x,y,sx,sy]of [[-1-depth,edge,447-depth,edge],[448+depth,edge,depth,edge],[edge,-1-depth,edge,447-depth],[edge,448+depth,edge,depth]]){
      assert.deepEqual(map.slice(at(x,y),at(x,y)+4),map.slice(at(sx,sy),at(sx,sy)+4),'wrapped gutters reproduce exact material channels');
    }
  }
  let raised=0,roughMin=255,roughMax=0;
  for(let i=3;i<c.length;i+=4){if(c[i]>25)raised++;roughMin=Math.min(roughMin,n[i]);roughMax=Math.max(roughMax,n[i]);}
  assert.ok(raised>50000,'actual layered leaf, needle and aggregate features');assert.ok(roughMax-roughMin>25,'cause-derived joined roughness');
 } finally {a.dispose();a.dispose();b.dispose();}
});

test('habitat polish preserves exact placement roots and all four existing plant quotas',()=>{
  const c=makeHarborCourse({openWorld:true}),p=makeCoastalUnderstory(c.coastal);
  assert.equal(p.filter(p=>!p.habitatExpansion).length,2433);assert.deepEqual(p,c.coastal.understoryPlacements.filter(p=>!p.courtExpansion));
  const limits={'building-verge':500,'forest-floor':1600,'river-bank':350,'eastern-slope':150};
  for(const [zone,cap]of Object.entries(limits))assert.ok(p.filter(p=>!p.habitatExpansion&&p.zone===zone).length<=cap);
  for(const item of p){assert.ok(item.tint>=0&&item.tint<=1);assert.equal(item.y,item.zone==='building-verge'?Math.max(capeGroundHeight(item.x,item.z),.135):capeGroundHeight(item.x,item.z));}
  assert.ok(p.filter(p=>p.zone==='river-bank'&&p.kind==='fern').length>70);
  const pine=p.filter(p=>p.habitat==='pine-hollow'),birch=p.filter(p=>p.habitat==='sheltered-birch');
  assert.ok(pine.length>250&&birch.length>250,'both sheltered habitats retain meaningful communities');
  assert.ok(birch.filter(p=>p.kind==='fern').length/birch.length>pine.filter(p=>p.kind==='fern').length/pine.length,
    'sheltered birch has a stronger fern layer than the drier pine floor');
  const beds=p.filter(p=>p.community?.startsWith('slope-bed-'));
  assert.equal(beds.length,400);assert.equal(new Set(beds.map(p=>p.community)).size,10);
  assert.ok(beds.filter(p=>p.kind==='fern').length>250,'sheltered slope breaks have dense fern hearts');
  for(const item of beds){assert.ok(capePathMask(item.x,item.z)<=.025);assert.equal(item.y,capeGroundHeight(item.x,item.z));}
});
