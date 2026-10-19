import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {createSalvageMelee} from '../island/salvage-melee.js';
import {batchStaticWeaponMeshes} from '../weapon-batching.js';
import {animateSalvageMelee,salvageFraming} from '../island/salvage-motion.js';
import {WEAPONS} from '../island/armory-state.js';
import {createMeleeWeapon} from '../weapon-melee.js';
import {fitRipperControl} from '../island/ripper-presentation.js';
import {SALVAGE_RESPONSE,salvageMotionAge} from '../island/salvage-response.js';

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
  for(const [name,expected]of [['grip',[0,-.055,.31]],['supportGrip',[0,-.055,.09]],['impactTip',id==='sword'?[.031,.015,-.73]:id==='hammer'?[.227,.015,-.86]:[-.0675,.015,-.858]]]){
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
  const w=WEAPONS.find(w=>w.id===id);animateSalvageMelee(root,{id,age:0,contact:w.contact,duration:w.interval,active:false,group:hold,aspect:1.6});const rest=root.quaternion.clone();
  for(const p of[0,.12,.24,.32,.4,.45,.65,.85,1]){
   const age=p<=.4?p/.4*w.contact:w.contact+(p-.4)/.6*(w.interval-w.contact);animateSalvageMelee(root,{id,age,contact:w.contact,duration:w.interval,active:true,group:hold,aspect:1.6});hold.updateWorldMatrix(true,true);
   assert(root.matrixWorld.elements.every(Number.isFinite));assert(finite(root.userData.impactTip.getWorldPosition(new T.Vector3())));
   assert(Number.isFinite(root.userData.melee.materials.glow.emissiveIntensity));
   if(p===.4){const tip=root.userData.impactTip.getWorldPosition(new T.Vector3());assert(Math.abs(tip.x)<1e-5&&Math.abs(tip.y)<1e-5,`contact misses the aiming line: ${tip.toArray()}`);}
  }
  animateSalvageMelee(root,{id,age:2,contact:w.contact,duration:w.interval,active:false,group:hold,aspect:1.6});
  near(root.position,new T.Vector3());assert.ok(root.quaternion.angleTo(rest)<1e-7);
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

test('all working contact anchors sit on the real outward surface, including the hammer face',()=>{
 for(const id of IDS){const root=createSalvageMelee(id),p=root.userData.impactTip.position.clone(),normal=new T.Vector3(...root.userData.salvageMelee.contactNormal);root.updateWorldMatrix(true,true);
  const ray=new T.Raycaster(p.clone().addScaledVector(normal,.02),normal.clone().negate(),0,.04),hit=ray.intersectObject(root,true)[0];assert.ok(hit,id+' anchor has no working geometry');assert.ok(Math.abs(hit.distance-.02)<.002,id+' anchor floats off its surface');assert.ok(hit.face.normal.dot(normal)>.5,id+' anchor is on a trailing surface');
 }
});

test('dedicated cuts have distinct physical directions and keep the leading face on the aiming line',()=>{
 for(const aspect of [1.6,390/844,844/390])for(const id of IDS){const root=createSalvageMelee(id),group=new T.Group(),camera=new T.PerspectiveCamera(74,aspect,.02,100),f=salvageFraming(id,aspect,{}),w=WEAPONS.find(w=>w.id===id);group.position.set(f.x,f.y,f.z);group.scale.setScalar(f.scale);group.add(root);camera.add(group);
  const sample=age=>{animateSalvageMelee(root,{id,age,contact:w.contact,duration:w.interval,active:true,group,aspect});camera.updateWorldMatrix(true,true);return root.userData.impactTip.getWorldPosition(new T.Vector3());};
  const before=sample(w.contact-.001),after=sample(w.contact+.001),velocity=after.sub(before).normalize();sample(w.contact);const projected=root.userData.impactTip.getWorldPosition(new T.Vector3()).project(camera),normal=new T.Vector3(...root.userData.salvageMelee.contactNormal).applyQuaternion(root.getWorldQuaternion(new T.Quaternion()));
  assert.ok(Math.hypot(projected.x,projected.y)<1e-6,id+' missed camera ray');assert.ok(normal.dot(velocity)>.94,id+' working face trails its motion');
  if(id==='sword')assert.ok(velocity.x<-.3&&velocity.y<-.6,'sword must cut diagonally');
  if(id==='hammer')assert.ok(velocity.y<-.99&&Math.abs(velocity.x)<.1,'hammer must strike downward');
  if(id==='pipe')assert.ok(velocity.x<-.98&&Math.abs(velocity.y)<.16,'pipe must strike laterally');
  let last=sample(0);for(let i=1;i<=240;i++){const p=sample(i/240*w.interval);assert.ok(p.distanceTo(last)<.06,id+' discontinuous working surface');assert.ok(root.matrixWorld.elements.every(Number.isFinite));last=p;}
  const endP=root.position.clone(),endQ=root.quaternion.clone();animateSalvageMelee(root,{id,age:w.interval+1,contact:w.contact,duration:w.interval,active:false,group,aspect});assert.ok(root.position.distanceTo(endP)<1e-7);assert.ok(root.quaternion.angleTo(endQ)<1e-7,id+' recovery snaps into ready');
 }
});

test('Ripper rear control moves its real handle, guard, throttle and hand socket as one mounted kit',()=>{
 const root=createMeleeWeapon({variant:'chainsaw'}),meta=root.userData.melee,cap=root.getObjectByName('fuel-cap'),capPosition=cap.position.clone(),grip=meta.sockets.grip.position.clone(),guard=meta.parts['chainsaw-trigger-guard'],throttle=root.getObjectByName('throttle-trigger');
 fitRipperControl(root);root.updateWorldMatrix(true,true);near(meta.sockets.grip.position,grip.add(new T.Vector3(0,-.10,.09)));
 assert.ok(new T.Box3().setFromObject(meta.parts['chainsaw-rear-grip'],true).containsPoint(meta.sockets.grip.position));assert.equal(throttle.parent,guard);near(guard.position,new T.Vector3(0,-.10,.09));near(cap.position,capPosition);
 const lug=root.getObjectByName('Ripper cast rear throttle mounting lug'),body=root.getObjectByName('motor-casing');assert.ok(new T.Box3().setFromObject(lug,true).intersectsBox(new T.Box3().setFromObject(body,true)),'grip mounting lug must seat into solid casing');
 fitRipperControl(root);near(meta.sockets.grip.position,grip);const before=meta.sockets.grip.position.clone();batchStaticWeaponMeshes(root);near(meta.sockets.grip.position,before);assert.ok(meta.chainLoop.userData.teethMesh.parent,'moving chain survives presentation batching');
});

test('contact resistance preserves miss timing and settles before the original next legal swing',()=>{
 for(const id of IDS){const w=WEAPONS.find(w=>w.id===id),r=SALVAGE_RESPONSE[id];
  assert.equal(salvageMotionAge(id,w.contact-.025,w.contact,w.interval,'body',true),w.contact,'authoritative event must render contact even when the presentation clock is one frame behind');
  for(const kind of ['body','wall']){let last=w.contact;
   for(let i=0;i<=1000;i++){const age=w.contact+(w.interval-w.contact)*i/1000,t=salvageMotionAge(id,age,w.contact,w.interval,kind);assert.ok(t>=last-1e-10&&t<=w.interval);last=t;}
   assert.equal(last,w.interval);assert.equal(salvageMotionAge(id,w.contact+r.hold*.8,w.contact,w.interval,kind),w.contact);
  }
  for(const age of [0,w.contact/2,w.contact,w.interval])assert.equal(salvageMotionAge(id,age,w.contact,w.interval,''),age);
 }
 assert.ok(SALVAGE_RESPONSE.hammer.hold>SALVAGE_RESPONSE.pipe.hold&&SALVAGE_RESPONSE.pipe.hold>SALVAGE_RESPONSE.sword.hold);
});

test('hit, wall and miss paths return without a pop at minimum repeat cadence',()=>{
 for(const aspect of [1.6,390/844,844/390])for(const id of IDS)for(const hit of ['','body','wall']){
  const model=createSalvageMelee(id),group=new T.Group(),w=WEAPONS.find(w=>w.id===id),f=salvageFraming(id,aspect,{});group.position.set(f.x,f.y,f.z);group.scale.setScalar(f.scale);group.add(model);
  const pose=age=>{animateSalvageMelee(model,{id,age,contact:w.contact,duration:w.interval,active:age<w.interval,group,aspect,hit:age>=w.contact?hit:''});group.updateWorldMatrix(true,true);return {p:model.userData.impactTip.getWorldPosition(new T.Vector3()),q:model.getWorldQuaternion(new T.Quaternion())};};
  const last=pose(w.interval-1/30),ready=pose(w.interval);assert.ok(last.p.distanceTo(ready.p)<.025,id+' working end snaps at repeat');assert.ok(last.q.angleTo(ready.q)<.07,id+' rotation snaps at repeat');
  const at=pose(w.contact);assert.ok(Math.hypot(at.p.x,at.p.y)<1e-7);
 }
});
