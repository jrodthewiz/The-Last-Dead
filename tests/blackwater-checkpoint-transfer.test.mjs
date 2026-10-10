import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {buildBlackwaterDistrict,BLACKWATER_CHECKPOINT_CASE_POSES as poses} from '../blackwater-district-visuals.js';
import {canStand} from '../engine.js';
const course=makeHarborCourse({openWorld:true,cityLootSeed:7317}),source=course.coastal.blackwaterSlice,
 prop=source.props.find(p=>p.id==='blackwater-checkpoint-bags'),snapshot=structuredClone(source.props),obstacles=structuredClone(course.obstacles),
 slice={...source,buildings:[]},parent=new THREE.Group(),old=buildBlackwaterDistrict(parent,slice,{failedClosure:false,failedTransfer:false}),art=buildBlackwaterDistrict(parent,slice,{failedClosure:false}),
 origin=new THREE.Object3D();origin.position.set(prop.x,.15,prop.z);origin.rotation.y=prop.yaw||0;origin.updateMatrix();
const inverse=origin.matrix.clone().invert(),matrix=new THREE.Matrix4(),point=new THREE.Vector3(),
 meshes=a=>a.root.children.filter(m=>m.isInstancedMesh),records=a=>meshes(a).flatMap(mesh=>Array.from({length:mesh.count},(_,index)=>{mesh.getMatrixAt(index,matrix);return{mesh,index,matrix:matrix.clone(),local:matrix.clone().premultiply(inverse)};})),
 near=r=>{const e=r.local.elements;return Math.abs(e[12])<prop.width/2&&Math.abs(e[14])<prop.depth/2&&e[13]>=0&&e[13]<1;},
 current=records(art),cases=current.filter(r=>r.mesh.material.name.startsWith('blackwater-evacuation-case-')&&near(r)),
 report={scope:'CPU actual district street instance buffers and bevel geometry; no visual gain claim',prop:structuredClone(prop),poses,bounds:[],route:[]};
function closeMatrix(a,b,label){for(let i=0;i<16;i++)assert(Math.abs(a.elements[i]-b.elements[i])<2e-5,label+' matrix '+i);}
function partMatrix(p,position,size,rotation=[0,0,0]){const base=new THREE.Object3D(),part=new THREE.Object3D(),pitch=p.pitch||0,half=(Math.abs(Math.cos(pitch))*(Math.abs(Math.cos(p.roll))*p.height+Math.abs(Math.sin(p.roll))*p.width)+Math.abs(Math.sin(pitch))*p.depth)*.53;base.position.set(p.x,half+.018,p.z);base.rotation.set(pitch,p.yaw,p.roll,'YXZ');base.updateMatrix();part.position.set(...position);part.scale.set(...size);part.rotation.set(...rotation);part.updateMatrix();return base.matrix.clone().multiply(part.matrix);}
function actualBounds(r){r.mesh.geometry.computeBoundingBox();return r.mesh.geometry.boundingBox.clone().applyMatrix4(r.local);}
test('four committed case matrices use actual bevel extents and remain inside source envelope',()=>{
 assert(prop);assert.equal(prop.width,2.3);assert.equal(prop.depth,1.1);assert.equal(cases.length,4);assert.equal(poses.filter(p=>Math.abs(p.pitch||0)>1).length,1);
 for(const [i,p]of poses.entries()){
  const expected=partMatrix(p,[0,0,0],[p.width,p.height,p.depth]),r=cases.find(r=>Math.abs(r.local.elements[12]-p.x)<1e-5&&Math.abs(r.local.elements[14]-p.z)<1e-5);assert(r);closeMatrix(r.local,expected,'case '+i);
  const bounds=actualBounds(r);assert(bounds.min.x>=-prop.width/2&&bounds.max.x<=prop.width/2);assert(bounds.min.z>=-prop.depth/2&&bounds.max.z<=prop.depth/2);
  assert(bounds.min.y>=.018-1e-5&&bounds.min.y<.04,'beveled case grounded with bounded contact offset');
  const g=r.mesh.geometry.boundingBox;assert(Math.abs(g.max.y-.5)<1e-6);assert(Math.abs(g.max.z-.5)<1e-6);report.bounds.push({case:i,min:bounds.min.toArray(),max:bounds.max.toArray(),verticalBodyHeight:bounds.max.y-bounds.min.y});
 }
});
test('dropped case presents its actual broad face horizontally with shallow grounded body',()=>{
 const r=cases.find(r=>Math.abs(r.local.elements[12]-poses[2].x)<1e-5),b=actualBounds(r),normal=new THREE.Vector3(0,0,1).transformDirection(r.local);
 assert(Math.abs(Math.abs(normal.y)-1)<1e-6,'actual broad-face normal vertical');assert(Math.hypot(normal.x,normal.z)<1e-6);
 assert(Math.abs(b.max.y-b.min.y-.28)<1e-5,'actual bevel depth becomes vertical body height');
 for(const upright of cases.filter(q=>q!==r)){const u=actualBounds(upright);assert(u.max.y-u.min.y>=.35-1e-5);assert(b.max.y-b.min.y<u.max.y-u.min.y-.06);}
 report.broadFace={normal:normal.toArray(),bodyHeight:b.max.y-b.min.y,groundGap:b.min.y,sourcePitch:poses[2].pitch};
});
test('handles, bindings, clasps and the dropped-case tag inherit each actual case transform',()=>{
 const expected=[];for(const p of poses){expected.push(partMatrix(p,[0,p.height/2+.018,0],[.19,.035,.025]));for(const sign of[-1,1])expected.push(partMatrix(p,[sign*p.width*.28,0,0],[.025,p.height*1.025,p.depth*1.05]));for(const sign of[-1,1])expected.push(partMatrix(p,[sign*p.width*.26,p.height*.23,p.depth/2+.01],[.035,.05,.025]));}
 expected.push(partMatrix(poses[2],[.055,poses[2].height/2+.036,0],[.13,.006,.09],[0,.08,0]));
 const accessories=current.filter(r=>near(r)&&!r.mesh.material.name.startsWith('blackwater-evacuation-case-')&&r.mesh.geometry.index?.count===36);
 for(const [i,e]of expected.entries()){const found=accessories.find(r=>r.local.elements.every((v,k)=>Math.abs(v-e.elements[k])<2e-5));assert(found,'attached accessory '+i);const b=actualBounds(found);assert(b.min.x>=-prop.width/2&&b.max.x<=prop.width/2&&b.min.z>=-prop.depth/2&&b.max.z<=prop.depth/2);assert(b.min.y>=0);}
 assert.equal(expected.length,21);report.attachedAccessories=expected.length;
});
const geometryHashes=new WeakMap();
function geometryHash(g){if(geometryHashes.has(g))return geometryHashes.get(g);const h=createHash('sha256');for(const [key,v]of Object.entries(g.attributes).filter(([key])=>!key.startsWith('coastal'))){h.update(key);h.update(Buffer.from(v.array.buffer,v.array.byteOffset,v.array.byteLength));}if(g.index)h.update(Buffer.from(g.index.array.buffer,g.index.array.byteOffset,g.index.array.byteLength));const result=h.digest('hex');geometryHashes.set(g,result);return result;}
function unaffected(a){return records(a).filter(r=>!near(r)).map(r=>JSON.stringify({geometry:geometryHash(r.mesh.geometry),material:{name:r.mesh.material.name,color:r.mesh.material.color?.getHex(),roughness:r.mesh.material.roughness},matrix:Array.from(r.matrix.elements)})).sort();}
test('all other street instances and source props/colliders remain byteexact against false option',()=>{
 const now=unaffected(art),before=unaffected(old),added=now.filter(v=>!before.includes(v)),removed=before.filter(v=>!now.includes(v));assert.equal(added.length+removed.length,0,JSON.stringify({added:added.slice(0,3).map(v=>JSON.parse(v)),removed:removed.slice(0,3).map(v=>JSON.parse(v))}));assert.deepEqual(source.props,snapshot);assert.deepEqual(course.obstacles,obstacles);
 for(const [x,z]of[[185,55],[190,55],[196,55],[202,55],[207,55],[212,55]]){const before=canStand({...course,obstacles},x/4,z/4,.16),after=canStand(course,x/4,z/4,.16);assert.equal(after,before);report.route.push({x,z,canStand:after});}
});
test('static instance buffers stay unchanged and district disposal releases owned geometry once',()=>{
 const versions=meshes(art).map(m=>m.instanceMatrix.version),geometry=cases[0].mesh.geometry;let disposed=0;geometry.addEventListener('dispose',()=>disposed++);
 art.root.updateMatrixWorld(true);assert.deepEqual(meshes(art).map(m=>m.instanceMatrix.version),versions);art.dispose();art.dispose();assert.equal(disposed,1);old.dispose();assert.equal(parent.children.length,0);
 fs.writeFileSync('output/blackwater-checkpoint-transfer-census.json',JSON.stringify(report,null,2)+'\n');
});




