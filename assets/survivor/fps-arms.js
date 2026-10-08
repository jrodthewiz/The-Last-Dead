import * as THREE from '../../vendor/three.module.js';
import {clone as cloneSkeleton} from '../../vendor/utils/SkeletonUtils.js';
import {installViewmodelDepthBoundary} from './viewmodel-depth.js';
import {FIRST_PERSON_HOLD_POSES} from './viewmodel-hold-poses.js';
import {FPS_GRIP_PROFILES} from './fps-grip-profiles.js';

export const FPS_ARM_URL=new URL('./fps-arms-v3.glb',import.meta.url).href;
const clamp=THREE.MathUtils.clamp;

function garmentEnvelope(rig,name,side,upper,lower){
 const mesh=rig.getObjectByName(`FPSSleeve_${name}_${side}`),elbow=lower.getWorldPosition(new THREE.Vector3()),axis=upper.getWorldPosition(new THREE.Vector3()).sub(elbow),length=axis.length();axis.normalize();
 const point=new THREE.Vector3(),vertices=[];let reach=0;
 mesh.updateMatrixWorld(true);mesh.skeleton.update();
 for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld).sub(elbow);vertices.push(point.clone());reach=Math.max(reach,point.dot(axis));}
 let radius=0;
 for(const p of vertices)if(p.dot(axis)>reach-.03)radius=Math.max(radius,p.clone().addScaledVector(axis,-p.dot(axis)).length());
 return {garmentReach:(reach-.03)/length,capMargin:radius+.012};
}

function resources(root){
 const geometries=new Set(),materials=new Set();root.traverse(o=>{if(!o.isMesh)return;geometries.add(o.geometry);for(const m of(Array.isArray(o.material)?o.material:[o.material]))materials.add(m);});
 geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();
}

export function installFPSArms(renderer,asset){
 const sources=renderer.weaponGroups.map((g,i)=>{
  const name=FIRST_PERSON_HOLD_POSES[i].name,source=asset.scene.getObjectByName('FPSRig_'+name);
  if(!source)throw new Error('Missing Blender FPS rig: '+name);
  const clips=asset.animations.filter(c=>c.name.startsWith(name+'/'));
  if(clips.length!==4||!clips.every(c=>c.tracks.some(t=>t.name.startsWith('FPS_')&&t.name.endsWith('.quaternion')))||!clips.some(c=>c.tracks.some(t=>t.name.includes('Index')&&t.name.endsWith('.quaternion'))))throw new Error('Missing articulated FPS actions: '+name);
  return {name,source,clips};
 });
 let arms=0;
 for(const [index,group]of renderer.weaponGroups.entries()){
  const {name,source,clips}=sources[index],rig=cloneSkeleton(source),owned=new Map();
  rig.name='AnimatedFPS_'+name;rig.traverse(o=>{
   o.layers.set(1);o.userData.viewmodelArm=true;o.userData.weaponBatchIgnore=true;
   if(!o.isMesh)return;
   o.userData.authoredFPSMesh=true;
   o.geometry=o.geometry.clone();o.frustumCulled=false;
   // The Blender 2.93 exporter converts authored loop colors through sRGB.
   // Restore the artist palette once on the owned copy, as verified by the
   // source manifest. The protected source and skeleton bind data stay intact.
   const c=o.geometry.attributes.color;
   if(c){const v=new THREE.Color();for(let i=0;i<c.count;i++){v.setRGB(c.getX(i),c.getY(i),c.getZ(i)).convertLinearToSRGB();c.setXYZ(i,v.r,v.g,v.b);}c.needsUpdate=true;}
   if(!o.geometry.attributes.uv){const p=o.geometry.attributes.position,uv=new Float32Array(p.count*2);for(let i=0;i<p.count;i++){uv[i*2]=p.getX(i)*5;uv[i*2+1]=p.getY(i)*5;}o.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));}
   o.material=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{
    if(!owned.has(m)){const copy=m.clone();copy.side=THREE.FrontSide;copy.userData={...copy.userData,authoredHeroSurface:true};owned.set(m,copy);}return owned.get(m);
   });if(o.material.length===1)o.material=o.material[0];
  });
  // Each side keeps its own rendered subtree for blood/severing. The complete
  // shared bone hierarchy remains under the cloned rig, never the body actor.
  for(const arm of Object.values(group.userData.viewArms||{}))if(arm?.isObject3D)resources(arm);
  // The old cap solver moved the complete weapon to accommodate its wrong
  // wrist frame. The Blender rig owns the fit from this point forward.
  if(group.userData.foregroundFitRig)group.userData.foregroundFitRig.position.set(0,0,0);
  group.add(rig);delete group.userData.foregroundArmFits;delete group.userData.foregroundFitRig;delete group.userData.meleeArms;
  const state={rig,camera:renderer.camera,mixer:new THREE.AnimationMixer(rig),actions:new Map(),arms:[],sampled:[],phase:null,name,index,elapsed:0,
   scratch:{s:new THREE.Vector3(),e:new THREE.Vector3(),w:new THREE.Vector3(),d:new THREE.Vector3(),axis:new THREE.Vector3(),pole:new THREE.Vector3(),goal:new THREE.Vector3(),old:new THREE.Vector3(),next:new THREE.Vector3(),parent:new THREE.Quaternion(),rigRotation:new THREE.Quaternion(),delta:new THREE.Quaternion(),local:new THREE.Quaternion(),position:new THREE.Vector3(),rotation:new THREE.Quaternion(),scale:new THREE.Vector3(),matrix:new THREE.Matrix4()}};
  rig.traverse(o=>{if(o.isBone)state.sampled.push({bone:o,position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone()});});
  for(const clip of clips){const action=state.mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;state.actions.set(clip.name.split('/')[1],{action,duration:clip.duration});}
  group.userData.viewArms={};group.updateWorldMatrix(true,true);
  for(const side of ['right','left']){
   const wrapper=rig.getObjectByName('FPS_'+name+'_'+side);if(!wrapper)continue;
   const prefix='FPS_'+name+'_'+side+'_',upper=rig.getObjectByName(prefix+'Upper'),lower=rig.getObjectByName(prefix+'Lower'),hand=rig.getObjectByName(prefix+'Hand');
   const grip=renderer._findWeaponSocket(group.userData.model||group,side==='right'?'grip':'supportGrip');
   if(!upper?.isBone||!lower?.isBone||!hand?.isBone||!grip)throw new Error('Invalid FPS chain/socket: '+name+'/'+side);
   grip.updateWorldMatrix(true,false);hand.updateWorldMatrix(true,false);
   const offset=grip.matrixWorld.clone().invert().multiply(hand.matrixWorld);
   wrapper.userData.side=side==='right'?1:-1;wrapper.userData.viewmodelSource='blender-skinned-fps-v3';
   const mcp=rig.getObjectByName(prefix+'Middle0'),wristAxis=hand.getWorldPosition(new THREE.Vector3()).sub(mcp.getWorldPosition(new THREE.Vector3())).normalize().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()).invert());
   const localPoint=bone=>rig.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));
   const bindForearm=localPoint(lower).sub(localPoint(hand)).normalize(),bindUpper=localPoint(upper).sub(localPoint(lower)).normalize();
   group.userData.viewArms[side+'Arm']=wrapper;state.arms.push({side,wrapper,upper,lower,hand,grip,offset,wristAxis,bindForearm,bindUpper,...garmentEnvelope(rig,name,side,upper,lower),wristLimit:THREE.MathUtils.degToRad(FPS_GRIP_PROFILES[index][side].wristConeDegrees),gap:0});arms++;
  }
  group.userData.authoredFPS=state;sampleFPSClip(group,'idle',0);
 }
 installViewmodelDepthBoundary(renderer.weaponRig);return arms;
}

// Two fixed anatomical segments seat the hand on the complete live grip.
// Blender supplies joint flex relative to its bind pose; camera-space reach
// corrects the old fallback approach without erasing that performance.
function seatGrip(state,arm){
 const q=state.scratch,{upper,lower,hand,grip}=arm;
 grip.updateWorldMatrix(true,false);q.matrix.multiplyMatrices(grip.matrixWorld,arm.offset);q.matrix.decompose(q.position,q.rotation,q.scale);
 q.rotation.normalize();
 upper.getWorldPosition(q.s);lower.getWorldPosition(q.e);hand.getWorldPosition(q.w);
 const a=q.s.distanceTo(q.e),b=q.e.distanceTo(q.w);
 q.pole.copy(q.s).sub(q.e).normalize();state.rig.getWorldQuaternion(q.rigRotation);
 if(state.index<6){
  // Camera-space elbow approach: the support forearm returns toward the
  // player, instead of following the old fallback's forward elbow pole.
  const approach=arm.side==='right'?[.48,-.65,.59]:[-.60,-.50,.62];
  state.camera.getWorldQuaternion(q.parent);q.next.set(...approach).normalize().applyQuaternion(q.parent);
 }else{
  // Separate the stacked bat wrists and lower the saw's front sleeve so the
  // rear control/casing stays readable. Clamp these camera-space approaches
  // to the anatomical wrist cone below; fixed segment lengths still govern.
  const approach=state.index===6?(arm.side==='right'?[.50,-.75,.42]:[-.60,-.65,.47]):(arm.side==='right'?[.40,-.80,.45]:[-.22,-.90,.38]);
  state.camera.getWorldQuaternion(q.parent);q.next.set(...approach).normalize().applyQuaternion(q.parent);
 }
 q.d.copy(arm.bindForearm).applyQuaternion(q.rigRotation);q.old.copy(q.e).sub(q.w).normalize();
 q.delta.setFromUnitVectors(q.d,q.old);q.next.applyQuaternion(q.delta);q.goal.copy(q.position).addScaledVector(q.next,b);
 // The metacarpal-to-wrist axis supplies the anatomical cone. If a moving
 // melee socket exceeds it, move the hidden shoulder instead of folding the
 // visible wrist backward. Neither segment is scaled or stretched.
 q.axis.copy(arm.wristAxis).applyQuaternion(q.rotation).normalize();q.next.copy(q.goal).sub(q.position).normalize();
 const wristAngle=Math.acos(clamp(q.axis.dot(q.next),-1,1));
 if(wristAngle>arm.wristLimit){
  q.delta.setFromUnitVectors(q.axis,q.next);q.local.identity().slerp(q.delta,arm.wristLimit/wristAngle);q.next.copy(q.axis).applyQuaternion(q.local);
  q.goal.copy(q.position).addScaledVector(q.next,b);
 }
 // Keep the garment termination below the actual camera's lower plane.
 // Wrist contact and the fixed upper/forearm lengths are independent of this
 // hidden-shoulder placement; a close saw grip must not reveal a sleeve disk.
 state.camera.getWorldQuaternion(q.parent);
 q.next.set(arm.side==='right'?.36:-.36,-.44,.12).applyQuaternion(q.parent);
 state.camera.getWorldPosition(q.old);q.next.add(q.old).sub(q.goal).normalize();
 q.d.copy(arm.bindUpper).applyQuaternion(q.rigRotation);q.delta.setFromUnitVectors(q.d,q.pole);q.next.applyQuaternion(q.delta);
 q.axis.set(0,1,-Math.tan(THREE.MathUtils.degToRad(state.camera.fov*.5))).normalize().applyQuaternion(q.parent);
 state.camera.getWorldPosition(q.old);q.old.negate().add(q.goal);
 // Blender's upper garment extends past the anatomical shoulder. Constrain
 // that actual cloth end, not the much nearer bone: the latter can make the
 // target unreachable and collapse the upper arm into a vertical tube.
 const capLimit=clamp((-arm.capMargin-q.axis.dot(q.old))/(a*arm.garmentReach),-1,1);
 if(q.axis.dot(q.next)>capLimit){q.d.copy(q.next).addScaledVector(q.axis,-q.axis.dot(q.next));if(q.d.lengthSq()<1e-10)q.d.set(1,0,0);q.next.copy(q.axis).multiplyScalar(capLimit).addScaledVector(q.d.normalize(),Math.sqrt(1-capLimit*capLimit));}
 q.next.multiplyScalar(a).add(q.goal).sub(q.s);upper.parent.getWorldQuaternion(q.parent);q.next.applyQuaternion(q.parent.invert());upper.parent.getWorldScale(q.scale);q.next.divide(q.scale);upper.position.add(q.next);upper.updateWorldMatrix(true,true);upper.getWorldPosition(q.s);lower.getWorldPosition(q.e);
 const rotate=(bone,from,to)=>{q.delta.setFromUnitVectors(from.normalize(),to.normalize());bone.parent.getWorldQuaternion(q.parent);q.local.copy(q.parent).invert().multiply(q.delta).multiply(q.parent).multiply(bone.quaternion);bone.quaternion.copy(q.local);bone.updateWorldMatrix(true,true);};
 rotate(upper,q.old.copy(q.e).sub(q.s),q.next.copy(q.goal).sub(q.s));
 lower.getWorldPosition(q.e);hand.getWorldPosition(q.w);rotate(lower,q.old.copy(q.w).sub(q.e),q.next.copy(q.position).sub(q.e));
 hand.parent.getWorldQuaternion(q.parent).normalize();hand.quaternion.copy(q.parent.invert().multiply(q.rotation)).normalize();hand.updateWorldMatrix(true,true);
 arm.gap=hand.getWorldPosition(q.w).distanceTo(q.position);
}

export function sampleFPSClip(group,phase,seconds){
 const s=group?.userData.authoredFPS;if(!s)return false;
 const clip=s.actions.get(phase)||s.actions.get('idle');
 for(const p of s.sampled){p.bone.position.copy(p.position);p.bone.quaternion.copy(p.quaternion);p.bone.scale.copy(p.scale);}
 if(s.phase!==phase){s.mixer.stopAllAction();clip.action.reset().play();s.phase=phase;}
 const loop=phase==='idle'||phase==='walk',time=loop?((seconds%clip.duration)+clip.duration)%clip.duration:clamp(seconds,0,clip.duration);
 // LoopOnce clamps by pausing the action. Absolute sampling must also work
 // after a completed attack, or when a second attack rewinds the same phase.
 if(clip.action.paused||time<(s.sampleTime??-1))clip.action.reset().play();
 s.sampleTime=time;
 s.mixer.setTime(time);
 for(const p of s.sampled){p.position.copy(p.bone.position);p.quaternion.copy(p.bone.quaternion);p.scale.copy(p.bone.scale);}
 group.updateWorldMatrix(true,true);for(const arm of s.arms)seatGrip(s,arm);
 // SkinnedMesh updates its inverse world bind in updateMatrixWorld. Make
 // CPU surface/contact queries agree with the following native render.
 s.rig.updateMatrixWorld(true);
 s.rig.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});return true;
}

export function updateFPSArms(group,run,presentation,dt){
 const s=group?.userData.authoredFPS;if(!s)return false;s.elapsed+=Math.max(0,Math.min(.05,dt||0));
 let phase='idle',time=s.elapsed;
 if(presentation.pose?.phase==='draw'){phase='draw';time=presentation.equipAge;}
 else if(s.index<6&&Math.min(presentation.shotAge,presentation.attachmentAge??10)<.5){phase='fire';time=Math.min(presentation.shotAge,presentation.attachmentAge??10);}
 else if(s.index>=6&&run.meleeActive){phase='strike';time=run.meleeProgress||0;}
 else if((run.speed||0)>.15){phase='walk';time=(run.distance||0)*1.1;}
 return sampleFPSClip(group,phase,time);
}

export function fpsGripDiagnostics(group){
 const s=group?.userData.authoredFPS;if(!s)return null;const v=new THREE.Vector3(),w=new THREE.Vector3(),matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),actual=new THREE.Quaternion(),scale=new THREE.Vector3();
 return {source:'Blender weighted FPS v3',phase:s.phase,arms:s.arms.map(a=>{
  a.grip.updateWorldMatrix(true,false);matrix.multiplyMatrices(a.grip.matrixWorld,a.offset).decompose(v,rotation,scale);
  const handRotation=a.hand.getWorldQuaternion(actual).normalize(),axis=a.wristAxis.clone().applyQuaternion(handRotation),forearm=a.lower.getWorldPosition(v).sub(a.hand.getWorldPosition(w)).normalize();
  return {side:a.side,gap:a.gap,rotationGap:rotation.normalize().angleTo(handRotation),wristDegrees:THREE.MathUtils.radToDeg(Math.acos(clamp(axis.dot(forearm),-1,1))),wristLimitDegrees:THREE.MathUtils.radToDeg(a.wristLimit),upperMetres:a.upper.getWorldPosition(v).distanceTo(a.lower.getWorldPosition(w)),forearmMetres:a.lower.getWorldPosition(v).distanceTo(a.hand.getWorldPosition(w))};
 })};
}
