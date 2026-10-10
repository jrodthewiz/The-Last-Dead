import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';
import {createAfterlifeModel,animateAfterlifeModel,disposeAfterlifeModel} from '../npc-afterlife-model.js';
import {BODY_SPEAR_MOTION} from '../assets/animations/body-spear-v1.js';
import {BodySpearVisuals,applyBodySpearReaction,fitBodySpearFrame,prepareBodySpearAnatomy} from '../body-spear-visuals.js';
import {BrutalCombatVisuals} from '../brutal-combat-visuals.js';
import {createMeshySurvivor,animateMeshySurvivor} from '../assets/survivor/meshy-survivor.js';
import {makeCourse,newRun,eye} from '../engine.js';
import {actorGroundAt} from '../coastal-structures.js';
import {portMaterialHooks} from '../webgpu-material-hooks.js';
import {MeshStandardNodeMaterial} from '../vendor/three.webgpu.js';

const assets=[],evidence=[];let anatomy,arms,player;
test.after(()=>{if(process.env.BODY_SPEAR_EVIDENCE==='1')writeFileSync(new URL('../.codex-temp/body-spear-v1/runtime-contact.json.gz',import.meta.url),gzipSync(JSON.stringify(evidence)));});
test.before(async()=>{
 const bitmap=globalThis.createImageBitmap,self=globalThis.self;
 globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
 const load=async file=>{const bytes=readFileSync(new URL('../'+file,import.meta.url));return{bytes,gltf:await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')};};
 try{
  for(const id of Object.keys(BODY_SPEAR_MOTION.bodies)){
   const file=id==='ash-witness'?'assets/models/afterlife-ash-witness-motion-v07.glb':`assets/models/zombie-variants/${id}.glb`,{bytes,gltf}=await load(file);
   assets.push({id,appearance:id,template:gltf.scene,clips:gltf.animations,sha:createHash('sha256').update(bytes).digest('hex')});
  }
  anatomy=prepareBodySpearAnatomy((await load('assets/models/body-spear-anatomy-v1.glb')).gltf.scene);
  arms=(await load('assets/survivor/viewmodel-arms-v2.glb')).gltf.scene;
  player=(await load('assets/survivor/tld-survivor-v02.glb')).gltf;
 }finally{if(bitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=bitmap;if(self===undefined)delete globalThis.self;else globalThis.self=self;}
});
const bonePoint=(root,name)=>root.getObjectByName(name).getWorldPosition(new THREE.Vector3());
test('guest snapshot arm frame retains world terrain and structure support',()=>{
 const course={coastal:{terrain:true,structures:[{id:'landing'}]}},peer={x:6,y:6,z:.1,angle:0,slide:.2,supportZ:2.3,structureId:'landing'};
 const visual=Object.create(BrutalCombatVisuals.prototype);visual.run={course};
 const point=visual.playerPoint(new THREE.Vector3(0,0,0),peer,true);
 assert(Math.abs(point.y-eye({...peer,course})*4)<1e-6,'serialized peer still uses the guest world floor');
});
function visualFixture(asset,{remote=false,crawler=false}={}){
 const run=newRun(makeCourse());Object.assign(run,{mode:'play',x:6,y:6,angle:0,slide:0,z:0});
 const root=createAfterlifeModel(asset,0,42),enemy={id:42,kind:0,variant:crawler?'skitter':'stalker',locomotion:crawler?'crawler':'shambler',x:6.25,y:6,facing:Math.PI,attack:99,hits:0,flash:0,stagger:.2};
 run.course.enemies=[enemy];
 for(let i=0;i<90;i++)animateAfterlifeModel(root,enemy,i*1000/60,42);root.position.set(enemy.x*4,actorGroundAt(run.course,enemy)*4,enemy.y*4);
 const cameraRig=new THREE.Group(),camera=new THREE.PerspectiveCamera();cameraRig.add(camera);cameraRig.position.set(24,eye(run)*4,24);camera.rotation.y=-Math.PI/2;
 const scene=new THREE.Group();scene.add(root,cameraRig);
 const peer=createMeshySurvivor(player.scene,player.animations);scene.add(peer);peer.position.set(24,actorGroundAt(run.course,run)*4,24);peer.rotation.y=-Math.PI/2;
 if(remote)animateMeshySurvivor(peer,{...run,mode:'ready'},1/60);
 const renderer={scene,camera,cameraRig,settings:{gore:true,reducedMotion:false},weaponGroups:[],_enemyVisuals:new Map([[42,{root}]]),_survivors:{template:player.scene,armTemplate:arms,armStatus:'ready',peer}};
 const visual=Object.create(BrutalCombatVisuals.prototype);
 Object.assign(visual,{renderer,root:new THREE.Group(),poseRestore:[],actors:new Map(),status:'ready',fragments:[],point:new THREE.Vector3(),target:new THREE.Vector3(),pole:new THREE.Vector3(),cameraPoint:new THREE.Vector3(),axis:new THREE.Vector3(),right:new THREE.Vector3(),rotation:new THREE.Quaternion(),delta:new THREE.Quaternion(),parentRotation:new THREE.Quaternion()});scene.add(visual.root);
 const spear=Object.create(BodySpearVisuals.prototype);Object.assign(spear,{combat:visual,frames:new WeakMap(),status:'ready',fitted:0,failedFits:0,asset:anatomy});visual.bodySpear=spear;
 visual.setupArms();
 run.brutal={kind:'pierce',phase:'contact',enemyId:42,sequence:1,contactAt:.24,extractionAt:.68,releaseAt:.95,duration:1.5,elapsed:0};
 return{run,root,visual,scene,renderer,peer,remote,enemy};
}

test('Blender reactions use each immutable delivered rig and preserve fixed segment lengths',()=>{
 for(const asset of assets){
  const data=BODY_SPEAR_MOTION.bodies[asset.id];assert.equal(data.sourceSha256,asset.sha);assert.equal(asset.clips.length,10);assert.equal(Object.keys(data.rotations).length,23);
  const root=createAfterlifeModel(asset,0,42);root.updateMatrixWorld(true);
  const base=[];root.traverse(node=>{if(node.isBone)base.push({node,p:node.position.clone(),q:node.quaternion.clone()});});
  const lengths=['Left','Right'].flatMap(side=>[['Arm','ForeArm'],['ForeArm','Hand'],['UpLeg','Leg'],['Leg','Foot']].map(pair=>({pair:pair.map(n=>side+n),length:bonePoint(root,side+pair[0]).distanceTo(bonePoint(root,side+pair[1]))})));
  for(const hz of [30,60,120])for(let i=0;i<=hz*1.5;i++){
   for(const b of base){b.node.position.copy(b.p);b.node.quaternion.copy(b.q);}applyBodySpearReaction(root,i/hz,1);
   for(const c of lengths)assert(Math.abs(bonePoint(root,c.pair[0]).distanceTo(bonePoint(root,c.pair[1]))-c.length)<1e-5,asset.id+' fixed '+c.pair.join('/'));
   for(const b of base)assert(b.node.quaternion.toArray().every(Number.isFinite));
  }
  for(let i=0;i<90;i++)animateAfterlifeModel(root,{id:42,kind:0,variant:'stalker',locomotion:'shambler',attack:99,hits:0,flash:0,stagger:0},i*1000/60,42);
  const arms=base.filter(b=>/^(Left|Right)(Shoulder|Arm|ForeArm|Hand)$/.test(b.node.name)).map(b=>({node:b.node,q:b.node.quaternion.clone()}));
  applyBodySpearReaction(root,0,1);for(const b of arms)assert(b.node.quaternion.angleTo(b.q)<.00001,asset.id+' reaction starts from animated arm pose');
  disposeAfterlifeModel(root);
 }
});

test('entry and exit fit actual skin on all four posed source bodies',()=>{
 for(const asset of assets){
  const root=createAfterlifeModel(asset,0,42);animateAfterlifeModel(root,{id:42,kind:0,variant:'stalker',locomotion:'shambler',attack:99,hits:0,flash:0,stagger:0},0,42);applyBodySpearReaction(root,.24,1);
  const fit=fitBodySpearFrame(root);assert(fit,asset.id+' has two actual skin intersections');assert(fit.depth>.07&&fit.depth<.65);assert(fit.entry.distanceTo(fit.exit)>.07);
  const full=[];root.traverse(mesh=>{if(mesh.isSkinnedMesh){mesh.skeleton.update();mesh.computeBoundingSphere();full.push(mesh);}});
  const ray=new THREE.Raycaster(),center=fit.entry.clone().lerp(fit.exit,.5);
  for(const sign of [1,-1]){ray.set(center.clone().addScaledVector(fit.front,sign*1.1),fit.front.clone().multiplyScalar(-sign));const surface=ray.intersectObjects(full,false)[0]?.point;assert(surface);const error=surface.distanceTo(sign===1?fit.entry:fit.exit);assert(error<.00001,asset.id+' '+sign+' torso/full skin discrepancy '+error);}
  const saved=fit.entryLocal.clone();root.position.set(7,3,-2);root.rotation.y=1.2;root.updateMatrixWorld(true);
  const moved=fitBodySpearFrame(root);assert(moved);assert(moved.entryLocal.distanceTo(saved)<.001,asset.id+' independent of world placement');disposeAfterlifeModel(root);
 }
});

test('opening frame follows the actual deformed skin through withdrawal',()=>{
 for(const asset of assets){
  const f=visualFixture(asset,{crawler:asset.id==='crooked-crawler'});
  for(const t of [.24,.38,.48,.68,.71,.91]){
   f.visual.beginFrame();f.run.brutal.elapsed=t;f.run.brutal.contactApplied=true;f.visual.pose(f.run);f.scene.updateMatrixWorld(true);
   const locked=f.visual.bodySpear.frame(f.root,1,true),actual=fitBodySpearFrame(f.root);
   if(t===.24)assert(locked.front.dot(f.renderer.camera.getWorldPosition(new THREE.Vector3()).sub(locked.entry).normalize())>.5,asset.id+' entry faces the player');
   assert(locked.entry.distanceTo(actual.entry)<.005,asset.id+' entry drifts off posed skin at '+t);
   assert(locked.exit.distanceTo(actual.exit)<.005,asset.id+' exit drifts off posed skin at '+t);
  }
  f.visual.beginFrame();f.visual.counterGrip?.dispose();disposeAfterlifeModel(f.root);
 }
});

test('authored resistance keeps the scanned sleeve and coat edges bounded',()=>{
 const p=new THREE.Vector3(),q=new THREE.Vector3();
 const longest=root=>{let maximum=0;root.updateMatrixWorld(true);root.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();const ix=mesh.geometry.index;for(let i=0;i<ix.count;i+=3){mesh.getVertexPosition(ix.getX(i),p).applyMatrix4(mesh.matrixWorld);for(let k=1;k<3;k++){mesh.getVertexPosition(ix.getX(i+k),q).applyMatrix4(mesh.matrixWorld);maximum=Math.max(maximum,p.distanceTo(q));}}});return maximum;};
 for(const asset of assets){const root=createAfterlifeModel(asset,0,42);for(let i=0;i<90;i++)animateAfterlifeModel(root,{id:42,kind:0,variant:'stalker',locomotion:'shambler',attack:99,hits:0,flash:0,stagger:0},i*1000/60,42);const original=longest(root),base=[];root.traverse(node=>{if(node.isBone)base.push({node,p:node.position.clone(),q:node.quaternion.clone()});});for(const t of [.14,.24,.38,.68,.91]){for(const b of base){b.node.position.copy(b.p);b.node.quaternion.copy(b.q);}applyBodySpearReaction(root,t,1);assert(longest(root)<=Math.max(.35,original*1.8),`${asset.id} sleeve/coat strips at ${t}`);}disposeAfterlifeModel(root);}
});

test('paired pose reaches penetration and brace without stretching the imported first-person or peer arms',()=>{
 for(const asset of assets)for(const remote of [false,true])for(const crawler of [false,true]){
  const f=visualFixture(asset,{remote,crawler}),{visual,run,root}=f;
  const armRoot=remote?f.peer:visual.arms;armRoot.updateMatrixWorld(true);
  const original=['Left','Right'].map(side=>({side,upper:bonePoint(armRoot,side+'Arm').distanceTo(bonePoint(armRoot,side+'ForeArm')),lower:bonePoint(armRoot,side+'ForeArm').distanceTo(bonePoint(armRoot,side+'Hand'))}));
  for(const t of [.14,.24,.38,.48,.68,.91]){
   visual.beginFrame();run.brutal.elapsed=t;run.brutal.contactApplied=t>=.24;visual.pose(run,remote);f.scene.updateMatrixWorld(true);
   for(const c of original){assert(Math.abs(bonePoint(armRoot,c.side+'Arm').distanceTo(bonePoint(armRoot,c.side+'ForeArm'))-c.upper)<1e-5);assert(Math.abs(bonePoint(armRoot,c.side+'ForeArm').distanceTo(bonePoint(armRoot,c.side+'Hand'))-c.lower)<1e-5);}
   if(t>=.24&&t<=.48){
    for(const contact of remote?visual.peerContactDistances:visual.contactDistances)assert(contact.distance<.05,`${asset.id} ${remote?'peer':'local'} ${crawler?'crawler':'standing'} ${contact.side} at ${t}: ${contact.distance}`);
    const frame=visual.bodySpear.frame(root,1,true),hand=armRoot.getObjectByName('RightHand'),rig=remote?visual.remoteGrip:visual.counterGrip;
    const direction=new THREE.Vector3().fromArray(rig.hands.right.measurements.longitudinalAxis).applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()));assert(direction.dot(frame.front)<-.995,'straight fingers follow the penetration axis');
    let minimum=Infinity;root.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();for(let v=0;v<mesh.geometry.attributes.position.count;v++){const point=mesh.getVertexPosition(v,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);minimum=Math.min(minimum,point.y);}});
    assert(minimum>=actorGroundAt(run.course,f.enemy)*4-.04,`${asset.id} ${crawler?'crawler':'standing'} floor ${minimum}`);
   }
   assert(f.visual.bodySpear.frame(root,1,t>=.24));
   if(process.env.BODY_SPEAR_EVIDENCE==='1'&&!remote&&crawler===(asset.id==='crooked-crawler')&&[.14,.24,.68].includes(t)){
    const frame=visual.bodySpear.frame(root,1,t>=.24),origin=new THREE.Vector3(24,actorGroundAt(run.course,f.enemy)*4,24),meshes=[];
    for(const actor of [root,armRoot])actor.traverse(mesh=>{
     if(!mesh.isSkinnedMesh||!mesh.visible)return;mesh.skeleton.update();const positions=[],indices=[],uv=[];
     for(let v=0;v<mesh.geometry.attributes.position.count;v++){const point=mesh.getVertexPosition(v,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).sub(origin);positions.push(...point.toArray().map(value=>+value.toFixed(6)));if(mesh.geometry.attributes.uv)uv.push(+mesh.geometry.attributes.uv.getX(v).toFixed(6),+mesh.geometry.attributes.uv.getY(v).toFixed(6));}
     const g=mesh.geometry,index=g.index;
     for(let i=0;i<(index?.count||g.attributes.position.count);i+=3){
      const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k),center=new THREE.Vector3();ids.forEach(id=>center.add(new THREE.Vector3().fromArray(positions,id*3)));center.divideScalar(3).add(origin);
      let cut=false;if(actor===root&&t>=.24){const right=new THREE.Vector3(1,0,0).applyQuaternion(frame.rotation),up=new THREE.Vector3(0,1,0).applyQuaternion(frame.rotation);
       for(const [plane,front,rx,ry]of [[frame.entry,frame.front,frame.halfExtent.x,frame.halfExtent.y],[frame.exit,frame.front.clone().negate(),.087,.106]]){const d=center.clone().sub(plane);if(d.dot(front)>-.055&&Math.hypot(d.dot(right)/rx,d.dot(up)/ry)<1)cut=true;}
       const d=center.clone().sub(frame.entry),inward=-d.dot(frame.front),mix=THREE.MathUtils.clamp(inward/frame.depth,0,1);
       if(inward>-.055&&inward<frame.depth+.055&&Math.hypot(d.dot(right)/THREE.MathUtils.lerp(frame.halfExtent.x,.087,mix),d.dot(up)/THREE.MathUtils.lerp(frame.halfExtent.y,.106,mix))<1)cut=true;
      }
      if(!cut)indices.push(...ids);
     }
     meshes.push({name:actor===root?'victim':'player-arms',positions,indices,uv});
    });
    evidence.push({body:asset.id,time:t,meshes,frame:{entry:frame.entry.clone().sub(origin).toArray(),rotation:frame.rotation.toArray(),depth:frame.depth},contacts:visual.contactDistances,ground:origin.y});
   }
  }
  visual.beginFrame();visual.counterGrip?.dispose();visual.remoteGrip?.dispose();disposeAfterlifeModel(root);
 }
});

test('wound kit has three open, textured meshes and source/depth/distance share both opening planes',()=>{
 for(const name of ['BodySpear_Entry','BodySpear_Exit','BodySpear_Tunnel']){
  const mesh=anatomy.getObjectByName(name);assert(mesh?.isMesh,name);assert(mesh.geometry.attributes.uv);assert(mesh.material.map);assert(mesh.userData.openThroughCavity);
  const tissueNode=new MeshStandardNodeMaterial();assert.doesNotThrow(()=>portMaterialHooks(mesh.material,tissueNode,{migration:{hooks:[]}}));tissueNode.dispose();assert.equal(mesh.material.emissiveIntensity,0);assert(mesh.material.customProgramCacheKey().includes('body-spear-light-response'));
  if(name!=='BodySpear_Tunnel'){assert(mesh.morphTargetDictionary.TissueTension!==undefined);assert(mesh.morphTargetDictionary.GripCompress!==undefined);}
  const p=mesh.geometry.attributes.position,index=mesh.geometry.index;
  for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];assert(ids.some(id=>Math.hypot(p.getX(id),p.getY(id))>.025),'no centre cap triangle');}
 }
 const f=visualFixture(assets[0]);f.run.brutal.elapsed=.24;f.run.brutal.contactApplied=true;f.visual.pose(f.run);
 const state=f.visual.bindActor(f.root);state.wound={type:'pierce',sequence:1};f.visual.bodySpear.addWound(state);f.visual.placeWound(state,true);assert.equal(state.uniforms.uSpearOpen.value,1);
 assert(state.attachments.getObjectByName('BodySpear_Exit'));assert(state.attachments.getObjectByName('BodySpear_Tunnel'));
 for(const entry of state.meshes){assert.notEqual(entry.mesh.material,entry.sourceMaterial,'late GPU cuts use a fresh owned material');assert(!entry.sourceMaterial.customProgramCacheKey().includes('brutal-source-seam'),'ordinary source graph stays uncut');}
 const other=visualFixture(assets[0]),otherState=other.visual.bindActor(other.root);assert.equal(state.meshes[0].mesh.material.customProgramCacheKey(),otherState.meshes[0].mesh.material.customProgramCacheKey(),'identical cut programs reuse loading preparation');assert.notEqual(state.meshes[0].mesh.material.userData.brutalCutUniforms,otherState.meshes[0].mesh.material.userData.brutalCutUniforms,'wound data stays owned by each actor');
 for(const entry of state.meshes)for(const material of [entry.mesh.material,entry.ownedDepth,entry.ownedDistance].flat()){
  const shader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <clipping_planes_fragment>'};material.onBeforeCompile(shader);assert.equal(shader.uniforms.uSpearExitCenter,state.uniforms.uSpearExitCenter);assert(shader.fragmentShader.includes('backP'));assert(shader.fragmentShader.includes('boreExtent'));assert(shader.fragmentShader.includes('discard'));
  const node=new MeshStandardNodeMaterial();let binding;assert.doesNotThrow(()=>{binding=portMaterialHooks(material,node,{migration:{hooks:[]}});});assert.equal(node.positionNode,null,'cuts leave native skinning in charge of position');assert(node.colorNode);const ref=binding.materialUniformNodes.uSpearOpen;assert(ref.isMaterialReferenceNode);assert.equal(ref.material,null);assert.equal(ref.updateReference({material:node}),node);assert.equal(ref.getValueFromReference(),1);ref.updateReference({material:{userData:{brutalCutUniforms:otherState.uniforms}}});assert.equal(ref.getValueFromReference(),0,'a cached cut node follows the next actor');node.dispose();
 }
 other.visual.releaseActor(other.root);other.visual.counterGrip?.dispose();disposeAfterlifeModel(other.root);
 f.visual.placeWound(state,false);assert.equal(state.uniforms.uBrutalKind.value,0);assert.equal(state.uniforms.uSpearOpen.value,0);assert.equal(state.attachments.visible,false);
 f.visual.releaseActor(f.root);for(const entry of state.meshes)assert.equal(entry.mesh.material,entry.sourceMaterial,'release restores the exact original source material');f.visual.counterGrip?.dispose();disposeAfterlifeModel(f.root);
});

test('the impact uses fitted entry/exit positions and stays inside the existing fluid pool',()=>{
 const f=visualFixture(assets[3],{crawler:true});f.run.brutal.elapsed=.24;f.run.brutal.contactApplied=true;f.visual.pose(f.run);
 const state=f.visual.bindActor(f.root),wound={type:'pierce',sequence:1};state.wound=wound;f.visual.bodySpear.addWound(state);f.visual.placeWound(state,true);
 f.visual.drops=Array.from({length:48},()=>({start:new THREE.Vector3(),velocity:new THREE.Vector3(),at:-100,size:0,angle:0}));f.visual.renderer.renderer={shadowMap:{}};
 const frame=f.visual.bodySpear.frame(f.root,1,true);f.visual.emit(f.root,wound,2);f.visual.bodySpear.emitExit(state,wound,2);
 const drops=f.visual.drops.filter(d=>d.at===2);assert.equal(drops.length,34);assert.equal(f.visual.drops.length,48);
 const exit=drops.filter(d=>d.start.distanceTo(frame.exit)<1e-8);assert.equal(exit.length,14);for(const d of exit)assert(d.velocity.dot(frame.front)<-1.3,'spray leaves the exit along the spear');
 assert.equal(drops.filter(d=>d.start.distanceTo(frame.entry)<1e-8).length,20);
 f.visual.releaseActor(f.root);f.visual.counterGrip?.dispose();disposeAfterlifeModel(f.root);
});

test('loading preparation warms real finisher skin and anatomy and restores all source ownership',()=>{
 const f=visualFixture(assets[0]),before=[];f.root.visible=false;
 f.root.traverse(mesh=>{if(mesh.isSkinnedMesh)before.push({mesh,geometry:mesh.geometry,material:mesh.material,culled:mesh.frustumCulled});});
 const sourceMeshes=[];anatomy.traverse(mesh=>{if(mesh.isMesh)sourceMeshes.push({mesh,geometry:mesh.geometry,material:mesh.material});});
 const restore=f.visual.prepareWarmup([f.root]);
 assert.equal(f.root.visible,true);assert.equal(f.visual.actors.size,1);assert.equal(f.visual.arms.visible,true);
 const group=f.visual.root.getObjectByName('FinisherLoadingResources');assert.equal(group.children.length,3);
 for(const saved of before){assert.notEqual(saved.mesh.geometry,saved.geometry);assert.notEqual(saved.mesh.material,saved.material);assert.equal(saved.mesh.frustumCulled,false);}
 restore();restore();assert.equal(f.root.visible,false);assert.equal(f.visual.actors.size,0);assert.equal(f.visual.arms.visible,false);assert.equal(group.parent,null);
 for(const saved of before){assert.equal(saved.mesh.geometry,saved.geometry);assert.equal(saved.mesh.material,saved.material);assert.equal(saved.mesh.frustumCulled,saved.culled);}
 for(const saved of sourceMeshes){assert.equal(saved.mesh.geometry,saved.geometry);assert.equal(saved.mesh.material,saved.material);}
 f.visual.counterGrip?.dispose();disposeAfterlifeModel(f.root);
});
