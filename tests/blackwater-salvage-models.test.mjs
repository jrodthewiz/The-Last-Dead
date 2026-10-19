import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {createSalvageMelee} from '../island/salvage-melee.js';
import {animateMeleeWeapon} from '../weapon-melee.js';
import {batchStaticWeaponMeshes} from '../weapon-batching.js';
import {batContactPose} from '../island/melee-presentation.js';

const IDS=['sword','hammer','pipe'];
const finite=v=>v.toArray().every(Number.isFinite);
const meshes=root=>{const result=[];root.traverse(n=>{if(n.isMesh)result.push(n);});return result;};
const near=(a,b,e=1e-5)=>assert(a.distanceTo(b)<e,`${a.toArray()} != ${b.toArray()}`);

for(const id of IDS){
 test(`${id} has finite, nondegenerate, bounded console geometry with correctly sized hand grips`,()=>{
  const root=createSalvageMelee(id),all=meshes(root),bounds=new T.Box3().setFromObject(root,true),size=bounds.getSize(new T.Vector3());
  assert(finite(bounds.min)&&finite(bounds.max));assert(size.z>1.3&&size.z<1.5);assert(size.x<.5&&size.y<.25);
  let triangles=0;const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
  for(const m of all){
   const g=m.geometry,p=g.attributes.position,n=g.attributes.normal,count=g.index?.count??p.count;triangles+=count/3;
   assert(p&&n&&g.attributes.uv,`${m.name} needs explicit position/normal/UV attributes`);
   for(const attr of Object.values(g.attributes))assert([...attr.array].every(Number.isFinite),m.name);
   for(let i=0;i<count;i+=3){a.fromBufferAttribute(p,g.index?g.index.getX(i):i);b.fromBufferAttribute(p,g.index?g.index.getX(i+1):i+1);c.fromBufferAttribute(p,g.index?g.index.getX(i+2):i+2);assert(b.sub(a).cross(c.sub(a)).lengthSq()>1e-20,`degenerate triangle: ${m.name}`);}
   assert(m.material.flatShading);assert.equal(m.material.transparent,false);assert.equal(m.material.map,null);
  }
  assert(triangles<2500,`${triangles} exceeds the authored console budget`);
  for(const [name,expected]of [['grip',[0,-.055,.31]],['supportGrip',[0,-.055,.09]],['impactTip',[0,.015,-.91]]]){
   const socket=root.userData[name];assert(socket?.isObject3D);near(socket.position,new T.Vector3(...expected));assert(socket.userData.viewmodelAnchor&&socket.userData.weaponBatchIgnore);
  }
  // The authored hand sockets must be inside the actual wrapped grip, rather
  // than merely matching a metadata number beside a detached handle.
  for(const name of['grip','supportGrip']){
   const p=root.userData[name].position;assert(all.some(m=>m.name.includes('grip binding')&&new T.Box3().setFromObject(m,true).containsPoint(p)),`${name} is outside the gripping material`);
  }
  assert(bounds.containsPoint(root.userData.impactTip.position));
 });

 test(`${id} preserves bounds, socket identities and contact animation through static batching`,()=>{
  const root=createSalvageMelee(id),before=new T.Box3().setFromObject(root,true),anchors=['grip','supportGrip','impactTip'].map(k=>root.userData[k]);
  const report=batchStaticWeaponMeshes(root),after=new T.Box3().setFromObject(root,true);
  assert(report.meshesAfter<report.meshesBefore);assert(report.meshesAfter<=7);
  near(before.min,after.min);near(before.max,after.max);
  for(const a of anchors){assert.equal(a.parent,root);assert.equal(root.getObjectByName(a.name),a);}
  assert.equal(root.userData.melee.mechanisms.swingPivot.parent,root);assert.equal(root.userData.melee.impactPulse.children.length,0);
  const hold=new T.Group();hold.position.set(.32,-.34,-.85);hold.scale.setScalar(.58);hold.add(root);root.rotation.set(.92,-.32,-.22);
  const rest=root.rotation.clone();const pose=batContactPose(hold.position.x,hold.position.y,hold.scale.x);
  for(const p of[0,.12,.24,.32,.4,.45,.65,.85,1]){
   animateMeleeWeapon(root,{active:true,progress:p,...pose,contact:p===.4?1:0},p,.016);hold.updateWorldMatrix(true,true);
   assert(root.matrixWorld.elements.every(Number.isFinite));assert(finite(root.userData.impactTip.getWorldPosition(new T.Vector3())));
   assert(Number.isFinite(root.userData.melee.materials.glow.emissiveIntensity));
   if(p===.4){const tip=root.userData.impactTip.getWorldPosition(new T.Vector3());assert(Math.abs(tip.x)<1e-5&&Math.abs(tip.y)<1e-5,`contact misses the aiming line: ${tip.toArray()}`);}
  }
  animateMeleeWeapon(root,{active:false},2,.016);
  near(root.position,new T.Vector3());near(new T.Vector3(root.rotation.x,root.rotation.y,root.rotation.z),new T.Vector3(rest.x,rest.y,rest.z));
  assert.equal(root.userData.melee.materials.glow.emissive.getHex(),0,'contact must not invent luminous tool surfaces');
 });
}

test('sword edge, heavy hammer head and hollow bent pipe retain distinct authored silhouettes',()=>{
 const sword=createSalvageMelee('sword'),hammer=createSalvageMelee('hammer'),pipe=createSalvageMelee('pipe');
 const swordBlade=sword.getObjectByName('forged boarding blade spine'),hammerHead=hammer.getObjectByName('repair hammer forged head with eye'),pipeBody=pipe.getObjectByName('bent hollow utility pipe');
 const bladeBounds=new T.Box3().setFromObject(swordBlade,true),headBounds=new T.Box3().setFromObject(hammerHead,true),pipeBounds=new T.Box3().setFromObject(pipeBody,true);
 assert(bladeBounds.getSize(new T.Vector3()).x<.1);assert(bladeBounds.getSize(new T.Vector3()).y>.07,'blade has a raised shoulder and physical section');
 assert(headBounds.getSize(new T.Vector3()).x>.4);assert(headBounds.getSize(new T.Vector3()).z<.19);
 assert(pipeBounds.min.x<-.085,'a straight cylinder must not replace the bent pipe');
 // A ray entering the open pipe end must travel into the bore. Opaque thread
 // cylinders and end caps previously make this plausible-looking detail false.
 pipe.updateWorldMatrix(true,true);const ray=new T.Raycaster(new T.Vector3(0,.015,-1.1),new T.Vector3(0,0,1),0,.21),hits=ray.intersectObject(pipe,true);
 assert.equal(hits.length,0,`utility pipe bore is capped by ${hits.map(h=>h.object.name).join(', ')}`);
 assert(sword.getObjectByName('honed single cutting edge'));assert(hammer.getObjectByName('hammer eye wedge'));assert(pipe.getObjectByName('pipe recessed bore wall'));
});

test('salvage instances reuse static resources and reject unknown IDs',()=>{
 const a=createSalvageMelee('sword'),b=createSalvageMelee('sword'),am=meshes(a),bm=meshes(b);
 for(let i=0;i<am.length;i++){assert.equal(am[i].geometry,bm[i].geometry);assert.equal(am[i].material,bm[i].material);assert(am[i].geometry.userData.sharedAsset);}
 assert.notEqual(a.userData.grip,b.userData.grip);assert.notEqual(a.userData.melee.mechanisms.swingPivot,b.userData.melee.mechanisms.swingPivot);
 assert.throws(()=>createSalvageMelee('unknown'),RangeError);
});
