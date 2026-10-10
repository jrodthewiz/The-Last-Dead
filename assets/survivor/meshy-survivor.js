import * as THREE from '../../vendor/three.module.js';
import {loadGlb} from '../load-glb.js';
import {clone as cloneSkeleton} from '../../vendor/utils/SkeletonUtils.js';
import {FOREGROUND_ARM_URL,installForegroundArms} from './foreground-arms.js';
import {FPS_ARM_URL,FPS_ARM_REVISION,installFPSArms} from './fps-arms.js';
import {groundAt} from '../../coastal-terrain.js';

export const SURVIVOR_MODEL_URL = new URL('./tld-survivor-v02.glb', import.meta.url).href;
const clamp=THREE.MathUtils.clamp;
const UP=new THREE.Vector3(0,1,0),X=new THREE.Vector3(1,0,0);

// Simulation owns translation. Retain vertical gait bob but strip horizontal root motion.
export function inPlaceClip(source) {
  const clip=source.clone();
  for(const track of clip.tracks)if(track.name==='Hips.position') {
    for(let i=0;i<track.values.length;i+=3){track.values[i]=track.values[0];track.values[i+2]=track.values[2];}
  }
  return clip;
}

export function createMeshySurvivor(template,clips,{firstPerson=false}={}) {
  const actor=new THREE.Group();actor.name=firstPerson?'MeshyFirstPersonBody':'MeshyFullBody';
  const model=cloneSkeleton(template);actor.add(model);
  const views=[];model.traverse(o=>{if(o.name.startsWith('TLD_ViewSleeve_'))views.push(o);});views.forEach(o=>o.removeFromParent());
  const body=model.getObjectByName('TLD_Local_Torso_Legs'),head=model.getObjectByName('TLD_Head_Hide_For_Local_Player'),arms=model.getObjectByName('TLD_Remote_Arms');
  if(!body?.isSkinnedMesh||!head||!arms)throw new Error('Survivor asset is missing required visibility sections');
  head.visible=arms.visible=!firstPerson;
  const bones={};model.traverse(o=>{if(o.isBone)bones[o.name]=o;if(o.isMesh){o.castShadow=!firstPerson;o.receiveShadow=true;o.frustumCulled=false;}});
  actor.updateMatrixWorld(true);
  const intactBodyGeometry=body.geometry;
  if(firstPerson) {
    // Only the local upper jacket leans behind the camera; lower body proportions stay intact.
    body.geometry=body.geometry.clone();const p=new THREE.Vector3(),inverse=body.matrixWorld.clone().invert(),positions=body.geometry.attributes.position;
    for(let i=0;i<positions.count;i++) {p.fromBufferAttribute(positions,i).applyMatrix4(body.matrixWorld);const t=clamp((p.y-1.02)/.46,0,1);p.z+=.40*t*t*(3-2*t);p.applyMatrix4(inverse);positions.setXYZ(i,p.x,p.y,p.z);}
    positions.needsUpdate=true;body.geometry.computeVertexNormals();body.geometry.computeBoundingSphere();
  }
  const mixer=new THREE.AnimationMixer(model),actions={};
  for(const clip of clips){const action=mixer.clipAction(inPlaceClip(clip));action.play();action.setEffectiveWeight(clip.name==='Idle_Relaxed'?1:0);actions[clip.name]=action;}
  for(const name of ['Idle_Relaxed','Walk_Forward','Run_Forward'])if(!actions[name])throw new Error('Missing survivor clip: '+name);
  // Bind-pose sole samples provide a cheap floor constraint for all imported clip poses.
  const position=body.geometry.attributes.position,point=new THREE.Vector3(),sole=[];
  for(let i=0;i<position.count;i++){point.fromBufferAttribute(position,i).applyMatrix4(body.matrixWorld);if(point.y<.045)sole.push(i);}
  const stride=Math.max(1,Math.floor(sole.length/80)),soleSamples=sole.filter((_,i)=>i%stride===0);
  const basePose=Object.values(bones).map(bone=>({bone,position:bone.position.clone(),rotation:bone.quaternion.clone(),scale:bone.scale.clone()}));
  actor.userData={source:'meshy-v02',firstPerson,head,body,arms,bones,mixer,actions,soleSamples,point,basePose,intactBodyGeometry,
    axis:new THREE.Vector3(),parentRotation:new THREE.Quaternion(),actorRotation:new THREE.Quaternion(),delta:new THREE.Quaternion(),
    legs:[{hip:bones.LeftUpLeg,knee:bones.LeftLeg},{hip:bones.RightUpLeg,knee:bones.RightLeg}],animation:'Idle_Relaxed'};
  return actor;
}

function rotateJoint(state,bone,angle) {
  bone.parent.getWorldQuaternion(state.parentRotation).invert();
  state.axis.copy(X).applyQuaternion(state.actorRotation).applyQuaternion(state.parentRotation);
  state.delta.setFromAxisAngle(state.axis,angle);bone.quaternion.premultiply(state.delta);bone.updateMatrixWorld(true);
}

export function animateMeshySurvivor(actor,run,dt,camera=null) {
  const state=actor.userData,{actions,mixer,bones}=state,slide=clamp(run.slide||0,0,1),air=(run.z||0)>.05;
  const speed=Math.hypot(run.vx||0,run.vy||0);
  const moving=clamp(speed/.3,0,1)*(1-slide)*(air?0:1),running=clamp((speed-1.5)/1.2,0,1);
  actions.Idle_Relaxed.setEffectiveWeight(1-moving);actions.Walk_Forward.setEffectiveWeight(moving*(1-running));actions.Run_Forward.setEffectiveWeight(moving*running);
  actions.Walk_Forward.setEffectiveTimeScale(clamp(speed/1.5,.5,1.6));actions.Run_Forward.setEffectiveTimeScale(clamp(speed/2.8,.65,1.5));
  // PropertyMixer may skip unchanged values at dt=0. Restore the pre-additive pose
  // explicitly so paused slide/jump previews cannot accumulate rotations.
  for(const p of state.basePose){p.bone.position.copy(p.position);p.bone.quaternion.copy(p.rotation);p.bone.scale.copy(p.scale);}
  mixer.update(run.mode==='play'?clamp(dt,0,.05):0);
  for(const p of state.basePose){p.position.copy(p.bone.position);p.rotation.copy(p.bone.quaternion);p.scale.copy(p.bone.scale);}
  state.animation=slide>.25?'Slide':air?'Jump':moving<.1?'Idle_Relaxed':running>.5?'Run_Forward':'Walk_Forward';
  const yaw=-(run.angle||0)-Math.PI/2,back=state.firstPerson?.46-slide*.04:0;
  const feet=(groundAt(run.course,run.x,run.y)+(run.z||0))*4;
  actor.position.set(run.x*4+Math.sin(yaw)*back,feet,run.y*4+Math.cos(yaw)*back);actor.rotation.set(0,yaw,0);
  actor.updateMatrixWorld(true);actor.getWorldQuaternion(state.actorRotation);
  if(slide>0) {
    bones.Hips.position.y-=slide*46;
    actor.updateMatrixWorld(true);
    for(const side of ['Left','Right']){rotateJoint(state,bones[side+'UpLeg'],slide*1.30);rotateJoint(state,bones[side+'Leg'],-slide*.65);}
    rotateJoint(state,bones.Spine02,-slide*.16);
  } else if(air) {
    for(const side of ['Left','Right']){rotateJoint(state,bones[side+'UpLeg'],.30);rotateJoint(state,bones[side+'Leg'],-.42);}
  }
  actor.updateMatrixWorld(true);state.body.skeleton.update();
  let floor=Infinity;
  for(const index of state.soleSamples){state.body.getVertexPosition(index,state.point);state.point.applyMatrix4(state.body.matrixWorld);floor=Math.min(floor,state.point.y);}
  if(Number.isFinite(floor))actor.position.y+=feet-floor;
  actor.updateMatrixWorld(true);
}

export function installMeshyViewSleeves(renderer,template) {
  return installForegroundArms(renderer,template);
}

export function releaseMeshyAsset(root) {
  const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
  root?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.skeleton)skeletons.add(o.skeleton);for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean))materials.add(m);});
  for(const m of materials)for(const value of Object.values(m))if(value?.isTexture)textures.add(value);
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());skeletons.forEach(s=>s.dispose());
}

export async function loadMeshySurvivors(renderer,state) {
  try {
    const gltf=await loadGlb(SURVIVOR_MODEL_URL);
    if(state.disposed){releaseMeshyAsset(gltf.scene);return;}
    state.armStatus='loading';state.template=gltf.scene;
    const local=createMeshySurvivor(gltf.scene,gltf.animations,{firstPerson:true}),peer=createMeshySurvivor(gltf.scene,gltf.animations);
    state.local.removeFromParent();state.peer.removeFromParent();
    // Fallback meshes own geometry, while their materials are also used by existing grip hands.
    for(const previous of [state.local,state.peer])previous.traverse(o=>o.geometry?.dispose());
    state.local=local;state.peer=peer;renderer.scene.add(local,peer);peer.visible=false;local.visible=false;
    state.status='ready';
    // A missing foreground derivative must not send imported full-body actors
    // through the procedural fallback animator or discard their valid clips.
    try{
      const arms=await loadGlb(FOREGROUND_ARM_URL);
      if(state.disposed){releaseMeshyAsset(arms.scene);return;}
      try{state.viewSleeves=installMeshyViewSleeves(renderer,arms.scene);}
      catch(error){releaseMeshyAsset(arms.scene);throw error;}
      state.armTemplate=arms.scene;state.armStatus='ready';
      const fps=await loadGlb(FPS_ARM_URL);
      if(state.disposed){releaseMeshyAsset(fps.scene);return;}
      try{state.viewSleeves=installFPSArms(renderer,fps);}
      catch(error){releaseMeshyAsset(fps.scene);throw error;}
      state.fpsTemplate=fps.scene;state.fpsRigRevision=FPS_ARM_REVISION;
    }catch(error){state.armStatus='fallback';state.armError=String(error?.message||error);}
  } catch(error) {state.status='fallback';state.error=String(error?.message||error);}
}
