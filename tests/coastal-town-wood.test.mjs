import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createTownWoodMaterial,evaluateTownWood,townWoodPieceParameters,evaluateTownWoodLatewood,TOWN_WOOD_LATEWOOD_MEAN} from '../coastal-town-wood.js';
import {buildCoastalTownDetails} from '../coastal-town-details.js';
import {makeHarborCourse} from '../harbor-course.js';

test('physical grain coordinates follow each piece axis, dimension and rigid pose',()=>{
 const a=evaluateTownWood({localPosition:[.2,.1,.3],localNormal:[1,0,0],dimensions:[2,.12,.15],seed:.4});
 const b=evaluateTownWood({localPosition:[.1,.2,.3],localNormal:[0,1,0],dimensions:[.12,2,.15],seed:.4});
 assert.equal(a.axis,0);assert.equal(b.axis,1);assert.equal(a.phase,b.phase);assert.equal(a.end,b.end);
 assert.notEqual(evaluateTownWood({localPosition:[.2,.1,.3],localNormal:[1,0,0],dimensions:[2,.12,.15],seed:.8}).phase,a.phase,'piece seed changes one shared growth origin');
 const c=evaluateTownWood({localPosition:[.4,.1,.3],localNormal:[1,0,0],dimensions:[1,.12,.15],seed:.4});assert.equal(c.phase,a.phase,'same physical point under different primitive scale');
 const pose=new THREE.Matrix4().compose(new THREE.Vector3(327,.96,168),new THREE.Quaternion().setFromEuler(new THREE.Euler(.3,1.2,.4)),new THREE.Vector3(2,.12,.15));
 const point=new THREE.Vector3(.2,.1,.3).applyMatrix4(pose).applyMatrix4(pose.clone().invert());
 assert.ok(point.distanceTo(new THREE.Vector3(.2,.1,.3))<1e-12,'rigid/world pose never changes untransformed primitive coordinates');
 assert.ok(Math.abs(evaluateTownWood({localPosition:point.toArray(),localNormal:[1,0,0],dimensions:[2,.12,.15],seed:.4}).phase-a.phase)<1e-10);
 const end=evaluateTownWood({localPosition:[.2,.1,.3],localNormal:[1,0,0],dimensions:[2,.12,.15],seed:.4}),side=evaluateTownWood({localPosition:[.2,.1,.3],localNormal:[0,1,0],dimensions:[2,.12,.15],seed:.4});
 assert.equal(end.ring,side.ring);assert.ok(end.dry>side.dry&&end.roughness>side.roughness&&end.shade<side.shade,'cut surface shares growth cause but dries/darkens');
});

test('finite response and minification eliminate unresolved grain without normal perturbation',()=>{
 for(const seed of [0,.4,.999])for(const dimensions of [[2,.1,.2],[.1,2,.2],[.1,.2,2]])for(const pixelMetres of [0,.001,.01,.1,1]){
  const f=evaluateTownWood({localPosition:[-.5,.1,.5],localNormal:[0,1,0],dimensions,seed,pixelMetres});
  assert.ok(Object.values(f).every(Number.isFinite));assert.ok(f.roughness>=.82&&f.roughness<=.98);
  if(pixelMetres>=.1){assert.ok(f.ring===0);assert.ok(f.fibre===0);}
 }
 assert.throws(()=>evaluateTownWood({localPosition:[NaN,0,0],localNormal:[1,0,0],dimensions:[1,1,1]}),/Finite/);
 assert.throws(()=>townWoodPieceParameters({size:[1,0,1]}),/Positive/);
 const m=createTownWoodMaterial();try{assert.equal(m.type,'MeshStandardNodeMaterial');assert.ok(m.colorNode&&m.roughnessNode);assert.equal(m.normalNode,null);assert.equal(m.userData.microNormalStrength,0);assert.equal(m.map,null);assert.equal(m.metalness,0);}finally{m.dispose();}
});

test('asymmetric latewood preserves its exact average under minification and jointly darkens/roughens growth',()=>{
 const samples=32768;let mean=0,filteredMean=0,dense=0;
 for(let i=0;i<samples;i++){
  const phase=(i+.5)/samples*Math.PI*2,band=evaluateTownWoodLatewood(phase);
  mean+=band;filteredMean+=evaluateTownWoodLatewood(phase,1.1);if(band>.5)dense++;
  assert.equal(evaluateTownWoodLatewood(phase,2),TOWN_WOOD_LATEWOOD_MEAN);
 }
 assert.ok(Math.abs(mean/samples-TOWN_WOOD_LATEWOOD_MEAN)<1e-10);assert.ok(Math.abs(filteredMean/samples-TOWN_WOOD_LATEWOOD_MEAN)<1e-10);
 assert.ok(dense/samples>.28&&dense/samples<.36,'latewood occupies less than half a growth cycle');
 const values=[];for(let i=0;i<300;i++)values.push(evaluateTownWood({localPosition:[.1,i/1000-.15,.2],localNormal:[0,0,1],dimensions:[2,.2,.2],seed:.4}));
 const early=values.reduce((a,b)=>a.latewood<b.latewood?a:b),late=values.reduce((a,b)=>a.latewood>b.latewood?a:b);
 assert.ok(late.shade<early.shade&&late.roughness>early.roughness,'same denser growth bands darken and roughen');
 const sideContrast=Math.max(...values.map(v=>v.shade))-Math.min(...values.map(v=>v.shade));
 assert.ok(sideContrast>.15&&sideContrast<.25,'resolved longitudinal response remains restrained');
 // Compare identical physical samples with only cut-face classification changed.
 let cutMin=Infinity,cutMax=-Infinity;
 for(let i=0;i<300;i++){const f=evaluateTownWood({localPosition:[.1,i/1000-.15,.2],localNormal:[1,0,0],dimensions:[2,.2,.2],seed:.4});cutMin=Math.min(cutMin,f.shade);cutMax=Math.max(cutMax,f.shade);}
 assert.ok(cutMax-cutMin>sideContrast&&cutMax-cutMin<=.25,'cut ends carry stronger coherent rings, not extra waves');
 for(const seed of [0,.5,.9]){
  const far=evaluateTownWood({localPosition:[.2,.1,.3],localNormal:[0,1,0],dimensions:[2,.12,.15],seed,pixelMetres:.1});
  assert.equal(far.latewood,TOWN_WOOD_LATEWOOD_MEAN);assert.equal(far.dry,.32);assert.equal(far.shade,1);assert.equal(far.roughness,.84+.32*.09);
 }
});

test('one static dimension/seed stream preserves all plans and batches with borrowed resources intact',()=>{
 const course=makeHarborCourse({openWorld:true}),before=JSON.stringify(course),box=new THREE.BoxGeometry(),rust=new THREE.MeshStandardMaterial(),dark=new THREE.MeshStandardMaterial();
 const world={course,root:new THREE.Group(),unitBox:box,materials:{rust,dark},diagnostics:{}},art=buildCoastalTownDetails(world);
 const counts={wood:0,bytes:0},versions=[],disposed={box:0,rust:0,dark:0,wood:0,green:0};
 for(const [name,resource]of Object.entries({box,rust,dark}))resource.addEventListener('dispose',()=>disposed[name]++);
 const owned=new Set();for(const mesh of art.root.children){
  if(mesh.material.userData.nativeTownWood){owned.add(mesh.material);counts.wood+=mesh.count;const attr=mesh.geometry.attributes.townWoodPiece;assert.ok(attr.isInstancedBufferAttribute);assert.equal(attr.count,mesh.instanceMatrix.count);counts.bytes+=attr.array.byteLength;versions.push(attr.version);}
 }
 assert.equal(owned.size,1);assert.ok(new Set(art.root.children.filter(m=>m.material.userData.nativeTownWood).map(m=>m.instanceMatrix.count)).size>1,'one named-attribute graph spans multiple bin capacities');for(const m of owned)m.addEventListener('dispose',()=>disposed.wood++);
 const green=art.root.children.find(m=>m.material!==rust&&m.material!==dark&&!m.material.userData.nativeTownWood).material;green.addEventListener('dispose',()=>disposed.green++);
 assert.equal(art.diagnostics.parts,590);assert.equal(art.diagnostics.colliders,15);assert.equal(art.diagnostics.draws,29);assert.equal(art.diagnostics.ownedMaterials,2);assert.equal(art.diagnostics.ownedPrimitives,5);
 assert.equal(counts.wood,course.coastal.townDetails.parts.filter(p=>p.slot==='wood').length);assert.equal(counts.bytes,art.diagnostics.woodPieceAttributeBytes);assert.ok(versions.every(v=>v===0));assert.equal(JSON.stringify(course),before);assert.equal(box.hasAttribute('townWoodPiece'),false);
 console.log(JSON.stringify({scope:'construction-only static wood attribute',...counts,parts:art.diagnostics.parts,draws:art.diagnostics.draws,triangles:art.diagnostics.triangles}));
 art.dispose();art.dispose();assert.deepEqual(disposed,{box:0,rust:0,dark:0,wood:1,green:1});assert.equal(world.root.children.length,0);box.dispose();rust.dispose();dark.dispose();
});
