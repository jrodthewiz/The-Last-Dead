import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {anatomyRegion,meshAnatomyRegions,createAnatomyFragments,biteEnvelope,reachBiteArm,PlayerInjuryVisuals} from '../player-injury-visuals.js';

function survivor() {
  const actor=new THREE.Group(),geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-.2,0,0,-.1,0,0,-.15,.8,0,.1,0,0,.2,0,0,.15,.8,0,-.2,.8,0,.2,.8,0,0,1.5,0],3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(18).fill(.5),2));
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute([0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0],4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(Array.from({length:9},()=>[1,0,0,0]).flat(),4));
  geometry.setIndex([0,1,2,3,4,5,6,7,8]);geometry.computeVertexNormals();
  const source=new THREE.SkinnedMesh(geometry,new THREE.MeshStandardMaterial());source.name='TLD_Local_Torso_Legs';
  const bones=['LeftUpLeg','RightUpLeg','Spine02'].map(name=>{const b=new THREE.Bone();b.name=name;source.add(b);return b;});
  source.bind(new THREE.Skeleton(bones));actor.add(source);actor.userData={source:'meshy-v02',body:source};actor.updateMatrixWorld(true);
  return actor;
}
function renderer() {
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),cameraRig=new THREE.Group(),weaponRig=new THREE.Group();
  cameraRig.add(camera);scene.add(cameraRig);cameraRig.position.y=1.6;
  const body=survivor();scene.add(body);
  return {scene,camera,cameraRig,weaponRig,weaponGroups:[],_survivors:{local:body,viewSleeves:0},_enemyVisuals:new Map(),settings:{gore:true,reducedMotion:false}};
}

test('anatomical partition preserves original survivor triangles and UV coordinates',()=>{
  const body=survivor(),regions=meshAnatomyRegions(body.userData.body),fragments=createAnatomyFragments(body);
  assert.deepEqual([...regions],[1,1,1,2,2,2,0,0,0]);
  assert.equal(fragments.length,3);assert.equal(fragments.reduce((n,f)=>n+f.mesh.geometry.index.count,0),9);
  assert.ok(fragments.every(f=>f.mesh.geometry.attributes.uv.count===f.ids.length));
  assert.equal(anatomyRegion('LeftForeArm'),3);assert.equal(anatomyRegion('RightFoot'),2);
});

test('bite presentation envelope enters and releases continuously',()=>{
  assert.equal(biteEnvelope({phase:'idle'}),0);assert.equal(biteEnvelope({phase:'windup',elapsed:.325}),.5);
  assert.equal(biteEnvelope({phase:'held'}),1);assert.equal(biteEnvelope({phase:'released',elapsed:.55}),0);
});

test('neck presentation restores the actual enemy transform before normal animation resumes',()=>{
  const r=renderer(),enemy=new THREE.Group(),head=new THREE.Bone();head.name='Head';head.position.y=1.6;enemy.add(head);enemy.position.set(3,0,-2);r.scene.add(enemy);r._enemyVisuals.set(2,{root:enemy});
  const original=enemy.position.clone(),visuals=new PlayerInjuryVisuals(r);
  const run={x:0,y:0,health:100,bite:{phase:'held',enemyId:2,sequence:1,side:'left'},playerWounds:{}};
  visuals.applyCamera(run,100);
  const before=r.camera.worldToLocal(head.getWorldPosition(new THREE.Vector3()));
  visuals.update(run,100,.016);
  const after=r.camera.worldToLocal(head.getWorldPosition(new THREE.Vector3()));
  assert.ok(enemy.position.distanceTo(original)>.1&&enemy.position.distanceTo(original)<.8);
  assert.ok(Math.abs(Math.atan2(before.x,-before.z)-Math.atan2(after.x,-after.z))<.01,'neck reach preserves real attacker bearing');
  visuals.beginFrame();assert.ok(enemy.position.distanceTo(original)<1e-6);
  visuals.dispose();
});

test('survivable leg sever uses one posed fragment, fatal uses the remaining body, revival restores visibility',()=>{
  const r=renderer(),visuals=new PlayerInjuryVisuals(r),run={x:0,y:0,health:45,bite:{phase:'held',sequence:1,damageStage:2},playerWounds:{leftLeg:'severed'}};
  visuals.update(run,0,.016);assert.equal(visuals.fragments.filter(f=>f.active).length,1);assert.equal(r._survivors.local.visible,true);
  run.health=0;run.bite.phase='terminal';visuals.update(run,20,.016);
  assert.equal(visuals.fragments.filter(f=>f.active).length,3);assert.equal(r._survivors.local.visible,false);assert.ok(visuals.blood.count<=36);
  run.health=50;run.bite.phase='idle';run.playerWounds={};visuals.update(run,40,.016);
  assert.equal(visuals.fatal,false);assert.equal(r._survivors.local.visible,true);assert.equal(visuals.fragments.filter(f=>f.active).length,0);
  visuals.dispose();
});

test('gore-disabled terminal falls as a whole corpse with no blood or anatomical fragments',()=>{
  const r=renderer();r.settings.gore=false;r.settings.reducedMotion=true;
  const visuals=new PlayerInjuryVisuals(r),run={x:0,y:0,health:0,bite:{phase:'terminal',elapsed:.6,sequence:1},playerWounds:{leftLeg:'severed'}};
  visuals.applyCamera(run,0);visuals.update(run,0,.016);
  for(let frame=1;frame<90;frame++)visuals.update(run,frame*1000/60,1/60);
  assert.equal(visuals.blood.count,0);assert.equal(visuals.fragments.filter(f=>f.active).length,0);assert.equal(r._survivors.local.visible,false);
  assert.equal(visuals.intactCorpse.visible,true);
  assert.ok(Math.abs(new THREE.Vector3(0,1,0).applyQuaternion(visuals.intactCorpse.quaternion).y)<.15);
  visuals.intactCorpse.updateMatrixWorld(true);assert.ok(new THREE.Box3().setFromObject(visuals.intactCorpse).min.y>=.04);
  r.settings.gore=true;visuals.update(run,1600,.016);assert.equal(visuals.intactCorpse.visible,false);assert.ok(visuals.fragments.some(f=>f.active));
  run.health=50;run.bite.phase='idle';visuals.update(run,1700,.016);assert.equal(visuals.intactCorpse.visible,false);assert.equal(r._survivors.local.visible,true);
  visuals.dispose();
});

test('same-run floor or sector replacement clears surviving sever debris and wound spray',()=>{
  const r=renderer(),visuals=new PlayerInjuryVisuals(r);
  const run={course:{},x:0,y:0,health:30,bite:{phase:'released',sequence:2,damageStage:3},playerWounds:{leftLeg:'severed'}};
  visuals.update(run,0,.016);
  assert.equal(visuals.fragments.filter(f=>f.active).length,1);
  assert.ok(visuals.blood.count>0);
  run.course={};run.bite={phase:'idle',sequence:0,damageStage:0};run.playerWounds={};
  visuals.update(run,20,.016);
  assert.equal(visuals.fragments.filter(f=>f.active||f.mesh.visible).length,0);
  assert.equal(visuals.blood.count,0);assert.equal(visuals.residue.count,0);
  assert.equal(visuals.entrails.count,0);assert.equal(r._survivors.local.visible,true);
  assert.equal(visuals.uniforms.a.value.y,0);
  visuals.dispose();
});

test('bite arm reaches a shoulder target without changing rig segment lengths at different import scales',()=>{
  for(const scale of [1,.01]){
    const root=new THREE.Group(),upper=new THREE.Bone(),lower=new THREE.Bone(),hand=new THREE.Bone();
    root.scale.setScalar(scale);root.rotation.y=.7;root.add(upper);upper.add(lower);lower.add(hand);
    lower.position.y=-.4/scale;hand.position.y=-.35/scale;root.updateMatrixWorld(true);
    const target=new THREE.Vector3(.3,-.3,-.3),pole=new THREE.Vector3(.6,-.5,0);
    assert.equal(reachBiteArm(upper,lower,hand,target,pole),true);
    assert.ok(hand.getWorldPosition(new THREE.Vector3()).distanceTo(target)<.001,'world-space contact survives centimetre-scale rigs');
    assert.equal(lower.position.y,-.4/scale);assert.equal(hand.position.y,-.35/scale);
  }
});

test('fatal backward fall stops before the actual wall instead of crossing into it',()=>{
  const r=renderer(),visuals=new PlayerInjuryVisuals(r);
  const run={x:.05,y:.5,angle:0,health:0,course:{w:1,h:1,cells:[[1,1,1,1]]},bite:{phase:'terminal',elapsed:1.3,sequence:1}};
  r.cameraRig.position.set(.2,1.6,2);visuals.applyCamera(run,0);
  assert.equal(visuals.deathBack,0);assert.equal(r.cameraRig.position.x,.2);
  assert.ok(r.cameraRig.position.y>.6,'floor view retains enough height to read authentic limbs');
  visuals.dispose();
});

test('torso fatality has a bounded organic strand pool that obeys gore toggle and revival',()=>{
  const r=renderer(),visuals=new PlayerInjuryVisuals(r);
  const run={x:0,y:0,angle:0,health:0,bite:{phase:'terminal',reason:'torso',sequence:1},playerWounds:{eviscerated:true,torso:3}};
  visuals.update(run,0,.016);assert.equal(visuals.entrails.count,3);assert.equal(visuals.entrails.visible,true);
  assert.ok(visuals.entrails.geometry.index.count*3/3<2500,'bounded torso strand topology');
  r.settings.gore=false;visuals.update(run,100,.016);assert.equal(visuals.entrails.visible,false);
  run.health=50;run.bite.phase='idle';run.playerWounds={};visuals.update(run,200,.016);assert.equal(visuals.entrails.count,0);
  visuals.dispose();
});

test('player wound materials never mutate an enemy sharing the survivor source material',()=>{
  const r=renderer(),peer=survivor(),source=peer.userData.body.material;
  const enemy=new THREE.Mesh(peer.userData.body.geometry,source);r.scene.add(peer,enemy);r._survivors.peer=peer;
  const originalKey=source.customProgramCacheKey(),positions=[...enemy.geometry.attributes.position.array];
  const visuals=new PlayerInjuryVisuals(r);
  visuals.update({x:0,y:0,health:40,bite:{phase:'released'},playerWounds:{leftArm:'severed'},peer:{playerWounds:{}}},0,.016);
  assert.equal(enemy.material,source);assert.equal(enemy.material.customProgramCacheKey(),originalKey);
  assert.notEqual(peer.userData.body.material,source);assert.deepEqual([...enemy.geometry.attributes.position.array],positions);
  assert.equal(visuals.peerUniforms.a.value.w,0);assert.equal(visuals.uniforms.a.value.w,1);
  visuals.dispose();
});

test('fatal collapse releases only the fatal region early and never launches body pieces upward',()=>{
  const r=renderer(),visuals=new PlayerInjuryVisuals(r);
  const run={x:0,y:0,angle:0,health:0,bite:{phase:'terminal',reason:'limb',limb:'leftLeg',sequence:1},playerWounds:{leftLeg:'severed',rightLeg:'severed'}};
  visuals.update(run,0,.016);
  const torso=visuals.fragments.find(f=>f.region===0),leg=visuals.fragments.find(f=>f.region===1),other=visuals.fragments.find(f=>f.region===2);
  const torsoPosition=torso.mesh.position.clone(),otherPosition=other.mesh.position.clone();
  assert.equal(leg.delay,0);assert.ok(torso.delay>=.3&&other.delay>=.3);
  assert.ok(visuals.fragments.every(f=>f.velocity.y<=0&&Math.hypot(f.velocity.x,f.velocity.z)<.2));
  visuals.update(run,100,.1);
  assert.deepEqual(torso.mesh.position,torsoPosition);assert.deepEqual(other.mesh.position,otherPosition);
  visuals.update(run,400,.3);assert.ok(torso.mesh.position.y<torsoPosition.y);
  assert.ok(visuals.fragments.every(f=>f.mesh.material.roughness>=.88));
  visuals.dispose();
});

test('fatal torso settles horizontally during the death beat and stays above the floor',()=>{
  const r=renderer(),visuals=new PlayerInjuryVisuals(r);
  const run={x:0,y:0,angle:.8,health:0,bite:{phase:'terminal',reason:'torso',sequence:1},playerWounds:{eviscerated:true,torso:3}};
  for(let frame=0;frame<90;frame++)visuals.update(run,frame*1000/60,1/60);
  const torso=visuals.fragments.find(f=>f.region===0),up=new THREE.Vector3(0,1,0).applyQuaternion(torso.mesh.quaternion);
  assert.ok(Math.abs(up.y)<.15,'torso lies down rather than freezing upright at floor contact');
  torso.mesh.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(torso.mesh);
  assert.ok(box.min.y>=.04&&box.min.y<.08,'rotated anatomy rests on the real floor');
  visuals.dispose();
});

test('a stalled frame cannot leave the fatal torso suspended after the death beat',()=>{
  const r=renderer(),visuals=new PlayerInjuryVisuals(r);
  const run={x:0,y:0,angle:.5,health:0,bite:{phase:'terminal',reason:'torso',sequence:1},playerWounds:{eviscerated:true}};
  visuals.update(run,100,.016);visuals.update(run,4100,.05);
  const torso=visuals.fragments.find(f=>f.region===0);
  assert.ok(Math.abs(new THREE.Vector3(0,1,0).applyQuaternion(torso.mesh.quaternion).y)<.15);
  torso.mesh.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(torso.mesh);
  assert.ok(box.min.y>=.04&&box.min.y<.08,'settles even when the presentation skips directly past three seconds');
  assert.equal(torso.settled,true);visuals.dispose();
});
