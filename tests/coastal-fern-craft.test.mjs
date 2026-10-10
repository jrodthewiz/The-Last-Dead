import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {createCoastalUnderstory,FERN_FROND_TABLE} from '../coastal-understory.js';

test('folded fern fronds have rooted bowed spines, attached pinnae and bounded instanced cost',()=>{
 const course=makeHarborCourse({openWorld:true}),art=createCoastalUnderstory({placements:course.coastal.understoryPlacements});
 try {
  const mesh=art.root.children.find(m=>m.name.startsWith('Understory:fern:')),g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal;
  assert.equal(g.userData.fronds,6);assert.equal(g.userData.foldedPinnae,60);
  assert.equal(art.diagnostics.fernTriangles,504);
  const population=course.coastal.understoryPlacements.filter(p=>p.kind==='fern').length;
  assert.ok(population*art.diagnostics.fernTriangles<=600000);
  g.computeBoundingBox();assert.equal(g.boundingBox.min.y,0);assert.ok(g.boundingBox.max.y>.65&&g.boundingBox.max.y<.9);
  const normals=new Set();
  for(let i=0;i<p.count;i++){
   for(const value of [p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i)])assert.ok(Number.isFinite(value));
   assert.ok(Math.hypot(p.getX(i),p.getZ(i))<1.2);assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5);
   normals.add(`${n.getX(i).toFixed(2)}/${n.getY(i).toFixed(2)}/${n.getZ(i).toFixed(2)}`);
  }
  assert.ok(normals.size>100,'folded wing faces and midribs provide actual three dimensional light response');
  // Every frond has 24 spine faces followed by 60 leaflet faces. Each leaflet
  // base lies exactly on its frond centreline, not on a disconnected float card.
  for(const [f,frond]of FERN_FROND_TABLE.entries()){
   const offset=f*84*3,{angle,length,height:h,curve,tip,emergence}=frond,rx=Math.cos(angle),rz=Math.sin(angle);
   for(let i=0;i<5;i++)for(let side=0;side<2;side++){
    const vertex=offset+24*3+(i*2+side)*6*3,t=.105+i*.157+(side===1?.012:0)+(f%3)*.006,section=Math.floor(t*6),u=t*6-section;
    const y=h*(Math.sin(section/6*Math.PI*curve)*(1-u)+Math.sin((section+1)/6*Math.PI*curve)*u)+tip*t,lateral=Math.sin(t*Math.PI)*emergence;
    const run=length*(1-(Math.cos(section/6*Math.PI*.5)*(1-u)+Math.cos((section+1)/6*Math.PI*.5)*u));
    assert.ok(Math.abs(p.getX(vertex)-(rx*run-rz*lateral))<1e-6);assert.ok(Math.abs(p.getZ(vertex)-(rz*run+rx*lateral))<1e-6);assert.ok(Math.abs(p.getY(vertex)-y)<1e-6);
   }
   assert.ok(p.getY(offset+24*3)<h*.4,'lower pinnae cover the basal arch instead of leaving a long naked stalk');
   const tipVertex=offset+20*3+1;if(f<3)assert.ok(p.getY(tipVertex)<h*.4,'old outer frond tip droops below its bowed shoulder');
   if(f===5)assert.ok(p.getY(tipVertex)>h*.85,'short inner new growth stays upright');
   const firstShoulder=offset+1;
   assert.ok(Math.hypot(p.getX(firstShoulder),p.getZ(firstShoulder))<length*.08,'basal stalk rises within the crown before spreading outward');
  }
  assert.ok(FERN_FROND_TABLE.slice(0,3).every(f=>f.length>.9&&f.height<.5));assert.ok(FERN_FROND_TABLE[5].length<.4,'outer and inner cohorts have distinct growth roles');
  assert.ok(mesh.material.isMeshStandardNodeMaterial);assert.ok(mesh.material.emissiveIntensity>0&&mesh.material.emissiveIntensity<.4);
  assert.equal(mesh.material.side,THREE.DoubleSide);assert.equal(art.diagnostics.sharedGeometries,3);assert.equal(art.diagnostics.materials,2);
  assert.ok(art.diagnostics.batches<=80);assert.equal(art.diagnostics.addedShadowMaps,0);
  const clocks=new Set();mesh.material.positionNode.traverse(node=>{if(node.isUniformNode&&typeof node.value==='number')clocks.add(node);});
  assert.equal(clocks.size,1,'one shared wind clock drives rooted deformation');
  const clock=[...clocks][0],camera=new THREE.PerspectiveCamera();camera.position.set(-2000,1.6,-2000);art.update(camera,7);assert.equal(art.diagnostics.visibleBatches,0);
  assert.equal(clock.value,7);art.update(camera,9);assert.equal(clock.value,9,'wind keeps advancing through stationary culling');
  const roots=[];for(let i=0;i<p.count;i++)if(p.getY(i)===0)roots.push(i);
  assert.ok(roots.length>=24);assert.ok(roots.every(i=>Math.hypot(p.getX(i),p.getZ(i))<.02),'all wind-locked footings stay inside the actual fern crown');
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),aspects=new Set();
  for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);aspects.add((scale.x/scale.y).toFixed(3));}
  assert.ok(aspects.size>2,'seeded growth proportions vary between retained shared instances');
 } finally {art.dispose();art.dispose();}
});
