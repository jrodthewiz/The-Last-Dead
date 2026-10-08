import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {instanceHarborStaticDetails,isStaticHarborDetail} from '../harbor-static-details.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);

test('static instance views preserve nested world transforms, shared UVs, normals and material groups',()=>{
 const parent=new THREE.Group(),root=new THREE.Group();parent.add(root);root.position.set(12,0,-4);root.rotation.y=.2;
 const g=new THREE.BoxGeometry(),a=new THREE.MeshStandardMaterial(),b=new THREE.MeshStandardMaterial();
 const meshes=[];
 for(let i=0;i<3;i++){const nested=new THREE.Group();nested.position.set(2+i*3,1,4);nested.rotation.y=i*.3;root.add(nested);const m=new THREE.Mesh(g,[a,b,a,b,a,b]);m.scale.set(1+i,2,.6);m.receiveShadow=true;m.name=`part${i}`;nested.add(m);meshes.push(m);}
 root.updateMatrixWorld(true);const expected=meshes.map(m=>m.matrixWorld.clone());
 const batch=instanceHarborStaticDetails(root,{eligible:()=>true});assert.equal(batch.meshes.length,1);
 const inst=batch.meshes[0],matrix=new THREE.Matrix4();root.updateMatrixWorld(true);
 for(let i=0;i<3;i++){inst.getMatrixAt(i,matrix);matrix.premultiply(inst.matrixWorld);expected[i].elements.forEach((v,k)=>close(matrix.elements[k],v));assert.equal(meshes[i].visible,false);}
 assert.equal(inst.geometry.getAttribute('normal'),g.getAttribute('normal'));assert.equal(inst.geometry.getAttribute('uv'),g.getAttribute('uv'));
 assert.deepEqual(inst.geometry.groups,g.groups);assert.equal(inst.material,meshes[0].material);
 assert.equal(batch.diagnostics.sourceDraws,18);assert.equal(batch.diagnostics.instanceDraws,6);
 let borrowedDisposals=0,viewDisposals=0;g.addEventListener('dispose',()=>borrowedDisposals++);a.addEventListener('dispose',()=>borrowedDisposals++);inst.geometry.addEventListener('dispose',()=>viewDisposals++);
 batch.setEnabled(false);assert.ok(meshes.every(m=>m.visible));assert.equal(inst.visible,false);
 batch.setEnabled(true);batch.dispose();batch.dispose();assert.ok(meshes.every(m=>m.visible));assert.equal(inst.parent,null);
 assert.equal(borrowedDisposals,0);assert.equal(viewDisposals,1);g.dispose();a.dispose();b.dispose();
});

test('protected visibility, unique materials, large slabs, opposite winding and animated hooks stay original',()=>{
 const root=new THREE.Group(),g=new THREE.BoxGeometry(),m=new THREE.MeshStandardMaterial();
 const add=(x)=>{const o=new THREE.Mesh(g,m);o.position.x=x;root.add(o);return o;};
 add(1);add(3);add(65);add(67);
 const hidden=new THREE.Group();hidden.visible=false;root.add(hidden);const h=add(2);hidden.add(h);
 const protectedGroup=new THREE.Group();protectedGroup.userData.noBatch=true;root.add(protectedGroup);const p=add(2);protectedGroup.add(p);
 const negative=add(4);negative.scale.x=-1;const huge=add(4);huge.scale.x=100;
 const hook=add(4);hook.onBeforeRender=()=>{};const unique=add(4);unique.material=m.clone();
 const batch=instanceHarborStaticDetails(root,{eligible:()=>true});assert.equal(batch.meshes.length,2);
 for(const o of [h,p,negative,huge,hook,unique])assert.equal(o.visible,true);
 assert.equal(hidden.visible,false);assert.ok(batch.meshes.every(o=>o.boundingSphere.radius<3));batch.dispose();g.dispose();m.dispose();unique.material.dispose();
});

test('caller admits legacy static placements and direct boxes while excluding truck and room ownership',()=>{
 const root=new THREE.Group(),thaiRoot=new THREE.Group(),unitBox=new THREE.BoxGeometry(),world={root,unitBox,thaiWorld:{root:thaiRoot}};root.add(thaiRoot);
 const direct=new THREE.Mesh(unitBox),placement=new THREE.Group(),part=new THREE.Mesh(new THREE.BoxGeometry());thaiRoot.add(placement);placement.add(part);root.add(direct);
 const truck=new THREE.Group(),room=new THREE.Group(),truckPart=new THREE.Mesh(unitBox),roomPart=new THREE.Mesh(unitBox);root.add(truck,room);truck.add(truckPart);room.add(roomPart);
 assert.equal(isStaticHarborDetail(direct,world),true);assert.equal(isStaticHarborDetail(part,world),true);
 assert.equal(isStaticHarborDetail(truckPart,world),false);assert.equal(isStaticHarborDetail(roomPart,world),false);unitBox.dispose();part.geometry.dispose();
});
