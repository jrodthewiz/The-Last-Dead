import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {canStand} from '../engine.js';
import {capeGroundHeight,capePathMask} from '../coastal-terrain.js';
import {makeCapeRootShoulders,capeRootShoulderField,capeTrailCentreDistance,createCapeSurfaceUnderlay} from '../coastal-terrain-fields.js';
import {buildCapeBankDetail} from '../assets/forest-kit/bank-detail.js';
import {CAPE_ROOT_FOOTING,capeRootFootingFields} from '../coastal-root-footing.js';

test('connected root shoulders join real footings, atlas beds and clear traversable trail centres',()=>{
 const course=makeHarborCourse({openWorld:true}),forest=course.coastal.forestPlacements,shoulders=makeCapeRootShoulders(forest);
 assert.equal(shoulders.length,3);assert.deepEqual(shoulders,makeCapeRootShoulders(forest));
 for(const p of shoulders){
  const tree=forest.find(t=>t.id===p.treeId);assert.equal(tree.x,p.treeX);assert.equal(tree.z,p.treeZ);
  assert.ok(capeRootShoulderField(tree.x,tree.z,shoulders).cover>.9,'accumulation contacts its actual trunk');
  for(let t=0;t<=1;t+=.1){const x=tree.x*(1-t)+(p.pathX+p.side*2.55)*t;assert.ok(capeRootShoulderField(x,tree.z,shoulders).cover>.35,'bed is connected from footing to sheltered margin');}
  for(let z=p.treeZ-6;z<=p.treeZ+6;z+=.5){
   for(const dx of [-1.5,0,1.5]){assert.equal(capeRootShoulderField(p.pathX+dx,z,shoulders).cover,0);assert.equal(canStand(course,(p.pathX+dx)/4,z/4,.16),true);}
  }
 }
 const material=new THREE.MeshBasicMaterial(),base={color:[.31,.39,.22],biome:[.2,.3,.1,.4]},art=buildCapeBankDetail({forest,material,underlayAt:()=>base});
 try{
  assert.equal(art.diagnostics.shoulderBeds,3);assert.ok(art.diagnostics.shoulderFaces>1200&&art.diagnostics.shoulderFaces<2500);
  assert.ok(art.diagnostics.triangles<60000);assert.equal(art.diagnostics.batches,43);
  assert.equal(art.diagnostics.addedMaterials,0);assert.equal(art.diagnostics.addedTextures,0);assert.equal(art.diagnostics.addedShadowMaps,0);
  let bedVertices=0,unusedShoulderVertices=0,contourVertices=0;
  for(const mesh of art.root.children){
   assert.equal(mesh.material,material);const p=mesh.geometry.attributes.position,b=mesh.geometry.attributes.capeBiome;
   for(let i=0;i<p.count;i++){
    const weights=[b.getX(i),b.getY(i),b.getZ(i),b.getW(i)],sum=weights.reduce((a,v)=>a+v,0);assert.ok(weights.every(v=>Number.isFinite(v)&&v>=0));
    assert.ok(sum===0||Math.abs(sum-1)<1e-6,'old neutral details and new atlas beds have explicit valid roles');
    if(sum===0)continue;
    const x=p.getX(i),z=p.getZ(i),field=capeRootShoulderField(x,z,shoulders),relief=p.getY(i)-capeGroundHeight(x,z,{bridges:false});
    assert.ok(capeTrailCentreDistance(x,z)>=1.5-1e-5);assert.ok(relief>=-.0001&&relief<=.035,'duff tapers into ground contact instead of raised plates');
    assert.ok(field.cover>=.06-2e-5,'no whole square survives outside the real ecological contour');
    const blend=THREE.MathUtils.smoothstep(field.cover,.06,.85)*.65;
    assert.ok(Math.abs(weights[1]-(base.biome[1]*(1-blend)+field.moss*blend))<2e-5,'field strength blends from the underlay rather than normalizing tiny coverage to full material');
    if(field.cover<.06002){contourVertices++;assert.ok(Math.abs(relief)<.0001);for(let k=0;k<4;k++)assert.ok(Math.abs(weights[k]-base.biome[k])<1e-5);const color=mesh.geometry.attributes.color;for(let k=0;k<3;k++)assert.ok(Math.abs(color.array[i*3+k]-base.color[k])<1e-5,'contour matches underlying terrain albedo');}
    bedVertices++;if(capePathMask(x,z)>.015)unusedShoulderVertices++;
   }
  }
  assert.equal(bedVertices,art.diagnostics.shoulderFaces*3);assert.ok(unusedShoulderVertices>1200,'prototype materially occupies unused shoulders rather than distant scenery');
  assert.ok(contourVertices>100,'irregular boundary is actually clipped and feathered');
 }finally{art.dispose();material.dispose();}
});

test('temporary terrain underlay follows exact rendered triangle diagonals for color and role continuity',()=>{
 const lattice=createCapeSurfaceUnderlay();for(const [x,z,n]of [[200,380,0],[201,380,1],[200,381,2],[201,381,4]])lattice.set(x,z,[n,n*.5,n*.25],[.2+n*.02,.3,.1,.4-n*.02]);
 for(const [x,z,expected]of [[200.25,380.25,.75],[200.75,380.75,2.75],[200.8,380.2,1.2]]){
  const sample=lattice.sample(x,z);assert.ok(Math.abs(sample.color[0]-expected)<1e-6);assert.ok(Math.abs(sample.biome.reduce((a,b)=>a+b,0)-1)<1e-6);
 }
 assert.equal(lattice.sample(205,380),null);assert.ok(lattice.bytes<3*1024*1024,'build-time CPU underlay adds no retained GPU resources');
});

test('root habitat follows measured footing slope with uphill litter and sheltered lower moss',()=>{
 const course=makeHarborCourse({openWorld:true}),s=makeCapeRootShoulders(course.coastal.forestPlacements);
 for(const p of s){
  assert.ok(p.gradient>.015);assert.ok(Math.abs(Math.hypot(p.upX,p.upZ)-1)<1e-12);
  const up=capeRootShoulderField(p.treeX+2*p.upX,p.treeZ+2*p.upZ,s),down=capeRootShoulderField(p.treeX-2*p.upX,p.treeZ-2*p.upZ,s);
  assert.ok(down.moss>up.moss+.4,'moss follows lower sheltered soil rather than unrelated sine stripes');
  assert.ok(up.litter>down.litter+.4,'raised root catches hold the uphill litter');
  assert.ok(up.surfaceCover>up.cover+.1,'surface habitat extends beyond the narrow original plant ribbon');
  const angle=p.side===-1?0:Math.PI,x=p.treeX+Math.cos(angle),z=p.treeZ+Math.sin(angle),cross=capeRootShoulderField(x,z,s);
  if(p.treeId===CAPE_ROOT_FOOTING.treeId){const f=CAPE_ROOT_FOOTING;assert.ok(capeRootFootingFields(f.x+.1*f.upX-.85*f.upZ,f.z+.1*f.upZ+.85*f.upX).mineral>.6,'the sculpted footing exposes its actual camera-facing convex flank');}
  else assert.ok(cross.mineral>.2,'other footings retain mineral attached to their original root arms');
  for(let dx=-6;dx<=6;dx+=.5)for(let dz=-6;dz<=6;dz+=.5){
   const f=capeRootShoulderField(p.treeX+dx,p.treeZ+dz,s);
   assert.ok([f.cover,f.surfaceCover,f.moss,f.mineral,f.litter].every(v=>Number.isFinite(v)&&v>=0&&v<=1));
   assert.ok(Math.abs(f.litter+f.moss+f.mineral-1)<1e-12);
  }
  for(let dz=-6;dz<=6;dz+=.5)for(const dx of [-1.5,0,1.5])assert.equal(capeRootShoulderField(p.pathX+dx,p.treeZ+dz,s).surfaceCover,0,'material community never covers the clear three metre route');
 }
});
