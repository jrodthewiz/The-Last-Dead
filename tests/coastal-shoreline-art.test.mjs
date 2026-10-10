import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {buildCoastalShorelineArt,shorelineSamples,geologicalRelief,geologicalSample} from '../coastal-shoreline-art.js';

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
  assert.ok(art.root.children.length>=3&&art.root.children.length<=6);
  assert.ok(art.diagnostics.triangles<50000);
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

test('geological noses are connected apron relief with deep oblique faults and no detached panel or scree components',()=>{
 const world={root:new THREE.Group(),materials:{},diagnostics:{}},art=buildCoastalShorelineArt(world);
 try{
  const geometry=art.root.children[0].geometry,p=geometry.attributes.position,n=geometry.attributes.normal;
  const ids=new Map(),parents=[];
  const id=(i)=>{
   const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*10000)).join(',');
   if(!ids.has(key)){ids.set(key,parents.length);parents.push(parents.length);}return ids.get(key);
  };
  const find=(i)=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
  const join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parents[b]=a;};
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let i=0;i<p.count;i+=3){
   const x=id(i),y=id(i+1),z=id(i+2);join(x,y);join(y,z);
   a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1).sub(a);c.fromBufferAttribute(p,i+2).sub(a);
   assert.ok(b.cross(c).length()>.0002,'adaptive joins have no degenerate triangles');
  }
  assert.equal(new Set(parents.map((_,i)=>find(i))).size,3,'one continuous coast/apron plus exactly two sea stacks');
  for(let i=0;i<n.count;i++)assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<.00001,'creased normals remain normalized');
  // Fixed headland camera is on the negative-u/negative-v side. Measure
  // that actual exposed face, not the invisible rear of the geological nose.
  const sample=(q,r)=>{const u=(q+r)*Math.SQRT1_2,v=(q-r)*Math.SQRT1_2;
   return geologicalRelief(316+u*.94-v*.342,-35+u*.342+v*.94);};
  assert.ok(sample(-9,-10)>2&&sample(-9,-10)<4,'inclined lower bearing slab away from rupture');
  assert.ok(sample(1,-10)>7.5&&sample(1,-10)<10,'completed middle slab away from rupture');
  assert.ok(sample(7,15)>14,'unbroken upper slab seals the connected rock cap');
  assert.ok(sample(-9,-10)-sample(-9,2.95)>2,'broad erosion cleft cuts the actual camera-facing lower bed');
  assert.ok(sample(-1.1,10)-sample(-2.6,10)>4,'physical exposed scarp rises across mesh-resolvable spacing');
  assert.ok(sample(-18,2)>.3 && sample(23,2)<.5,'talus is confined to the exposed foot, not a full rubble ring');
  let exposedFaces=0;
  for(let i=0;i<p.count;i++){
   if(p.getX(i)>290 && p.getX(i)<335 && p.getZ(i)<-35 && p.getZ(i)>-60 && p.getY(i)>3 && Math.abs(n.getY(i))<.65)exposedFaces++;
  }
  assert.ok(exposedFaces>60,'actual sampled geometry retains steep foreground faces');
  assert.ok(art.diagnostics.adaptiveColumns>50&&art.diagnostics.adaptiveColumns<500,'extra tessellation stays local to geological noses');
  assert.equal(art.root.children[0].material.userData.coastalRockField.aperiodicBedding,true);
 }finally{art.dispose();}
});


test('mineral zones share actual bed, cleavage, cap erosion and front talus causes without a UV tangent dependency',()=>{
 const sample=(q,r)=>{const u=(q+r)*Math.SQRT1_2,v=(q-r)*Math.SQRT1_2;
  const x=316+u*.94-v*.342,z=-35+u*.342+v*.94,semantic=geologicalSample(x,z);
  assert.equal(semantic.height,geologicalRelief(x,z));return semantic;};
 assert.deepEqual([-9,0,7].map(q=>sample(q,2).bedIndex),[0,1,2],'three physical unequal bearing units');
 assert.ok(sample(-9,2.95).jointDepth>6,'fully eroded cleavage keeps its mineral cause even at zero uplift');
 assert.ok(sample(-18,2).talus>.9 && sample(7,2).talus===0,'talus is below the exposed face');
 assert.ok(sample(7,2).capCover>.5 && sample(0,2).capCover===0,'soil cover is sheltered on upper cap');
 assert.ok(Math.abs(sample(7,2).height-sample(7,10).height)>.4,'cap is physically eroded along strike');
 const art=buildCoastalShorelineArt({root:new THREE.Group(),materials:{}});
 try{
  const material=art.root.children[0].material;
  assert.equal(material.userData.coastalRockField.noisePivot,0,'seam thresholds operate on centered Perlin noise');
  assert.equal(material.normalNode,null,'no UV-less tangent-space normal perturbation');
  assert.equal(art.diagnostics.semanticGeology,true);
  const p=art.root.children[0].geometry.attributes.position,c=art.root.children[0].geometry.attributes.color;
  const sums=[0,0,0],weights=[0,0,0];
  for(let i=0;i<p.count;i++){
   const field=geologicalSample(p.getX(i),p.getZ(i));
   if(p.getZ(i)<0&&field.height>3&&field.capCover<.05&&field.jointDepth<.8){
    sums[field.bedIndex]+=c.getX(i)*.2126+c.getY(i)*.7152+c.getZ(i)*.0722;weights[field.bedIndex]++;
   }
  }
  assert.ok(weights.every(n=>n>0),'rendered vertices carry all bearing units');
  assert.ok(sums[1]/weights[1]>sums[0]/weights[0]*1.5,'middle fresh fractured mineral differs visibly from lower dark bearing slate');
 }finally{art.dispose();}
});


test('physical slab lips are sampled sharply and pass their exposure causes into the material',()=>{
 const art=buildCoastalShorelineArt({root:new THREE.Group(),materials:{}});
 try{
  const geometry=art.root.children[0].geometry,p=geometry.attributes.position,n=geometry.attributes.normal,fields=geometry.attributes.geologicalExposure;
  assert.equal(fields.count,p.count,'material causes follow every geometric vertex');
  assert.ok(fields.array instanceof Uint8Array,'normalized causes use four bytes per vertex');
  assert.equal(fields.normalized,true);
  assert.ok(geometry.userData.semanticQuantizationMaxError<=1/510+1e-12,'all generated geological causes retain bounded precision');
  for(let i=0;i<fields.count;i++)for(const get of ['getX','getY','getZ','getW']){
   const value=fields[get](i);assert.ok(Number.isFinite(value)&&value>=0&&value<=1,'decoded exposure channels are finite normalized causes');
  }
  let sharpFace=false;
  for(let i=0;i<p.count;i++){
   if(p.getZ(i)>=0||p.getX(i)<290||p.getX(i)>335)continue;
   if(p.getY(i)>3 && Math.abs(n.getY(i))<.22 && fields.getX(i)>.8)sharpFace=true;
  }
  assert.ok(geometry.userData.geologicalContourEdges.length>0,'folded bed boundaries retain explicit paired contour edges; their compiled mesh continuity is verified below');
  assert.ok(sharpFace,'steep exposed slab end survives normal construction and drives the weathering channel');
  assert.equal(art.root.children[0].material.userData.coastalRockField.semanticAttribute,'geologicalExposure: actual bearing face, cleavage depth, talus, sheltered cap');
 }finally{art.dispose();}
});


test('bearing ribbons have actual connected undersides and integrated angular foot accumulations',()=>{
 const art=buildCoastalShorelineArt({root:new THREE.Group(),materials:{}});
 try{
  assert.equal(art.diagnostics.foldedBearingLips,true);
  assert.ok(art.diagnostics.triangles<50000,'folded geology stays within bounded coastline budget');
  const p=art.root.children[0].geometry.attributes.position,n=art.root.children[0].geometry.attributes.normal;
  let undersides=false;
  for(let i=0;i<p.count;i++)if(p.getZ(i)<0&&p.getX(i)>290&&p.getX(i)<335&&p.getY(i)>4&&n.getY(i)<-.02)undersides=true;
  assert.ok(undersides,'seaward folded slab lips produce real downward-facing undersides, beyond a single-valued heightfield');
  const sample=(q,r)=>{const u=(q+r)*Math.SQRT1_2,v=(q-r)*Math.SQRT1_2;return geologicalSample(316+u*.94-v*.342,-35+u*.342+v*.94);};
  assert.ok(sample(-9,-10).shiftQ>.6&&sample(1,-10).shiftQ>1.5,'unequal bearing lips accumulate seaward overhang');
  assert.equal(sample(-18,2).shiftQ,0,'talus foot is grounded rather than folded');
  assert.ok(sample(-21,9.55).height>sample(-21,-9).height,'unequal fallen-slab accumulation responds to actual fracture foot');
  assert.ok(sample(11,10).height-sample(11,-10).height>3,'unfractured cap behind rupture terminations retains coherent oblique dip');
 }finally{art.dispose();}
});


test('local strike density and paired physical bed contours prevent unrelated cross-unit fans',()=>{
 const samples=shorelineSamples(),noses=[{x:316,z:-35},{x:90,z:274},{x:262,z:452}];
 let local=false,coarse=false;
 for(let i=0;i<samples.length;i++){
  const a=samples[i],b=samples[(i+1)%samples.length],gap=Math.hypot(a.x-b.x,a.z-b.z);
  const near=noses.some(n=>Math.hypot(a.x+a.nx*a.width*.60-n.x,a.z+a.nz*a.width*.60-n.z)<34);
  if(near){assert.ok(gap<=.65,'actual nose footprints have sub-metre along-strike edges');local=true;}
  if(gap>2)coarse=true;
 }
 assert.ok(local&&coarse,'extra density remains local rather than subdividing the entire island');
 const art=buildCoastalShorelineArt({root:new THREE.Group(),materials:{}});
 try{
  const g=art.root.children[0].geometry,p=g.attributes.position,contours=g.userData.geologicalContourEdges;
  const key=(x,y,z)=>[x,y,z].map(v=>Math.round(v*10000)).join(',');
  const edge=(a,b)=>a<b?a+'|'+b:b+'|'+a,edges=new Set();
  for(let i=0;i<p.count;i+=3){
   const ids=[0,1,2].map(j=>key(p.getX(i+j),p.getY(i+j),p.getZ(i+j)));
   for(let j=0;j<3;j++)edges.add(edge(ids[j],ids[(j+1)%3]));
  }
  assert.ok(contours.length>0,'actual compiled semantic contours are retained for topology validation');
  for(let i=0;i<contours.length;i+=6){
   const a=key(...contours.slice(i,i+3)),b=key(...contours.slice(i+3,i+6));
   assert.ok(edges.has(edge(a,b)),'every paired bed lip remains an explicit triangle edge across adjacent shore columns');
  }
  assert.equal(art.diagnostics.pairedSemanticStrips,true);assert.ok(art.diagnostics.triangles<50000);
 }finally{art.dispose();}
});


test('dominant exposed headland carries angular runout and unequal crossing rupture planes',()=>{
 const sample=(q,r)=>{const u=(q+r)*Math.SQRT1_2,v=(q-r)*Math.SQRT1_2;return geologicalSample(316+u*.94-v*.342,-35+u*.342+v*.94);};
 assert.ok(sample(-9,2.95).jointDepth>6,'deep narrow crossing plane cuts visible bearing body');
 assert.ok(sample(-9,5.58).jointDepth>2&&sample(-9,5.58).jointDepth<4,'adjacent broad plane has unequal depth');
 assert.ok(sample(-21,9.55).height>sample(-21,-9).height+1,'fallen material accumulates beneath the deep planar rupture');
 const art=buildCoastalShorelineArt({root:new THREE.Group(),materials:{}});
 try{assert.equal(art.diagnostics.dominantAngularRupture,true);assert.ok(art.diagnostics.triangles<50000);}finally{art.dispose();}
});


test('central oblique rupture crosses the original headland camera bearing rather than only the accepted left cleft',()=>{
 const sample=(q,r)=>{const u=(q+r)*Math.SQRT1_2,v=(q-r)*Math.SQRT1_2;return geologicalSample(316+u*.94-v*.342,-35+u*.342+v*.94);};
 assert.ok(sample(-13,-15.52).jointDepth>6,'new lower-bed plane intersects fixed-view centreline at negative strike');
 assert.ok(sample(-5,-13.6).jointDepth>6,'same oblique plane breaks the middle bearing face');
 assert.ok(sample(5,-11.2).jointDepth>6,'plane continues through upper bearing body with unequal runout');
 assert.ok(sample(-9,2.95).jointDepth>6,'accepted positive-strike left cleft remains intact');
 assert.ok(sample(-21,-17.44).height>sample(-21,-12).height,'new fragments accumulate at the central fracture foot');
 const art=buildCoastalShorelineArt({root:new THREE.Group(),materials:{}});
 try{assert.equal(art.diagnostics.centralCameraRupture,true);assert.ok(art.diagnostics.triangles<50000);}finally{art.dispose();}
});


test('authored coastal edge uses remain seaward, grouped by exposure and release borrowed-material detail buffers',()=>{
 const art=buildCoastalShorelineArt({root:new THREE.Group(),materials:{}});
 try{
  assert.equal(art.diagnostics.coastalEdgeUses,true);assert.ok(art.diagnostics.edgeUseTriangles<15000);assert.ok(art.diagnostics.draws<=6);
  const roles=new Set(art.edgeRecords.map(p=>p.role));assert.ok(roles.has('rooted-saltgrass')&&roles.has('obsolete-hauling-runner')&&roles.has('storm-wrack-timber'));
  for(const mesh of art.root.children.slice(2)){
   assert.equal(mesh.material,art.root.children[0].material,'detail silhouettes reuse the owned coastal material');
   const p=mesh.geometry.attributes.position;
   for(let i=0;i<p.count;i++)assert.equal(inside(p.getX(i),p.getZ(i)),false,'all coastal uses stay outside playable authority');
  }
  for(const p of art.edgeRecords.filter(p=>p.role==='rooted-saltgrass'))assert.ok(p.field>.20,'saltgrass grows in authored exposure shoulders rather than a continuous row');
 }finally{art.dispose();}
});


test('central bearing face changes macro plane angle instead of adding another depth-only slot',()=>{
 const sample=(q,r)=>{const u=(q+r)*Math.SQRT1_2,v=(q-r)*Math.SQRT1_2;return geologicalSample(316+u*.94-v*.342,-35+u*.342+v*.94);};
 assert.ok(sample(-5.6,-15).exposedFace>.8,'central middle slab has a broad sloping bearing face rather than a half-metre upright rib');
 assert.ok(sample(-19,-12.8).height>sample(-19,-8).height,'a related broad fallen slab lies below the changed central bearing plane');
 const art=buildCoastalShorelineArt({root:new THREE.Group(),materials:{}});
 try{assert.equal(art.diagnostics.centralUnequalBearingPlanes,true);}finally{art.dispose();}
});


test('original headland camera hits unequal inclined bearing planes in the actual visible middle bands',()=>{
 const art=buildCoastalShorelineArt({root:new THREE.Group(),materials:{}});
 try{
  const mesh=art.root.children[0],camera=new THREE.PerspectiveCamera(75,1280/800,.05,1800);
  camera.position.set(285,16,-65);camera.lookAt(317,7,4);camera.updateMatrixWorld(true);mesh.updateMatrixWorld(true);
  const hit=(x,y)=>{const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(x/640-1,1-y/400),camera);const result=ray.intersectObject(mesh)[0];assert.ok(result,'fixed original-view ray intersects actual cliff');return result;};
  const middle=hit(400,420),lower=hit(400,440),other=hit(260,420),otherUpper=hit(260,400);
  assert.ok(middle.face.normal.y>.25&&lower.face.normal.y>.25,'dominant middle face is visibly inclined instead of an upright flute');
  assert.ok(middle.face.normal.dot(lower.face.normal)>.995,'a substantial visible bearing region holds one actual planar orientation');
  assert.ok(other.face.normal.dot(otherUpper.face.normal)>.995,'neighboring block also holds a broad flat bearing orientation');
  assert.ok(middle.face.normal.dot(other.face.normal)<.92,'neighboring large block has an unequal face orientation');
  const strike=p=>{const dx=p.x-316,dz=p.z+35,u=dx*.94+dz*.342,v=-dx*.342+dz*.94;return(u-v)*Math.SQRT1_2;};
  assert.ok(strike(middle.point)>0&&strike(middle.point)<4,'repair occupies the rendered middle band, not just target centreline/far-right face');
  assert.ok(strike(other.point)>8&&strike(other.point)<12,'second block occupies the other rendered dominant band');
  assert.equal(art.diagnostics.visiblePlanarBearingBlocks,true);
 }finally{art.dispose();}
});
