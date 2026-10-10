import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {createCoastalUnderstory} from '../coastal-understory.js';
import {capeTrailPeatField,capeBiomeWeights,capeTrailSurfaceMask} from '../coastal-terrain-fields.js';

test('grass has connected folded growth cohorts inside the retained rooted route envelope',()=>{
 const course=makeHarborCourse({openWorld:true}),art=createCoastalUnderstory({placements:course.coastal.understoryPlacements});
 try{
  const mesh=art.root.children.find(m=>m.name.startsWith('Understory:grass:')),g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,c=g.attributes.color;
  assert.equal(art.diagnostics.grassTriangles,108);assert.equal(art.diagnostics.sharedGeometries,3);assert.equal(art.diagnostics.materials,2);assert.equal(mesh.material.vertexColors,true);
  assert.equal(course.coastal.understoryPlacements.filter(p=>!p.coastalExpansion&&!p.courtExpansion).length,3114);assert.equal(course.coastal.forestPlacements.length,524);
  const point=i=>new THREE.Vector3().fromBufferAttribute(p,i),normals=new Set(),skirts=[],inner=[];
  for(let blade=0;blade<18;blade++){
   const i=blade*18;for(const j of [0,3,5,6,9,11]){assert.equal(p.getY(i+j),0);assert.ok(Math.hypot(p.getX(i+j),p.getZ(i+j))<.08);}
   for(const [a,b]of [[0,3],[5,6],[6,9],[1,12],[2,4],[2,7],[7,15],[8,17],[13,16]])assert.ok(point(i+a).distanceTo(point(i+b))<1e-8,'folded ribbon faces share actual growth joints');
   assert.ok(p.getY(i+2)>p.getY(i+1)+.009,'blade has a real folded central ridge');
   const mid=p.getY(i+2),tip=p.getY(i+13);
   if(blade%3===0){assert.ok(tip<mid*.8,'retained outer blades droop into a low skirt');skirts.push(tip);}
   if(blade%3===2){assert.ok(tip>mid,'inner growth remains upright');inner.push(tip);}
  }
  assert.ok(Math.max(...skirts)<Math.min(...inner),'unequal growth layers avoid an identical fan silhouette');
  for(let i=0;i<p.count;i++){assert.ok(p.getY(i)>=0&&p.getY(i)<.55);assert.ok(Math.hypot(p.getX(i),p.getZ(i))<.25);for(const v of [n.getX(i),n.getY(i),n.getZ(i)])assert.ok(Number.isFinite(v));assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5);normals.add([n.getX(i),n.getY(i),n.getZ(i)].map(v=>v.toFixed(2)).join('/'));}
  assert.ok(normals.size>40);assert.ok(Math.max(...c.array)-Math.min(...c.array)>.25,'older skirts and fresh inner blades retain distinct muted tissue colors');
  const clocks=new Set();mesh.material.positionNode.traverse(node=>{if(node.isUniformNode&&typeof node.value==='number')clocks.add(node);});assert.equal(clocks.size,1);const camera=new THREE.PerspectiveCamera();camera.position.set(-2000,1.6,-2000);art.update(camera,8);assert.equal(art.diagnostics.visibleBatches,0);assert.equal([...clocks][0].value,8);
 }finally{art.dispose();art.dispose();}
});

test('compacted trail material responds to real canopy shelter without narrowing the travel surface',()=>{
 const sheltered=capeTrailPeatField(340,376),exposed=capeTrailPeatField(340,314);
 assert.ok(sheltered>exposed+.05);assert.ok(sheltered>.2&&sheltered<.35);
 for(let z=370;z<=399;z+=.5){assert.equal(capeTrailSurfaceMask(340,z),1);assert.equal(capeTrailSurfaceMask(339,z),1);const w=capeBiomeWeights(340,z);assert.ok(Math.abs(w.reduce((a,b)=>a+b,0)-1)<1e-8);assert.ok(w[0]>.2&&w[0]<.35&&w[3]>.65,'compacted grit dominates footfall while modest organic residue follows shelter');}
});
