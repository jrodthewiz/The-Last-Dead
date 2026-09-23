import * as THREE from '../../vendor/three.module.js';
import {GLTFLoader} from '../../vendor/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from '../../vendor/utils/SkeletonUtils.js';
import {installViewmodelDepthBoundary} from './viewmodel-depth.js';

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
  actor.userData={source:'meshy-v02',firstPerson,head,body,arms,bones,mixer,actions,soleSamples,point,basePose,
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
  actor.position.set(run.x*4+Math.sin(yaw)*back,(run.z||0)*4,run.y*4+Math.cos(yaw)*back);actor.rotation.set(0,yaw,0);
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
  if(Number.isFinite(floor))actor.position.y+=(run.z||0)*4-floor;
  actor.updateMatrixWorld(true);
}

export function installMeshyViewSleeves(renderer,template) {
  let count=0;
  for(const group of renderer.weaponGroups)group.traverse(arm=>{
    if(!arm.userData.gripSocket||!arm.userData.sculptRuntime?.parts)return;
    const side=arm.userData.side<0?'Left':'Right',source=template.getObjectByName('TLD_ViewSleeve_'+side),limb=arm.userData.sculptRuntime.parts[0];
    if(!source?.isMesh)return;
    for(const child of [...limb.children])if(child.isMesh){child.removeFromParent();child.geometry.dispose();child.material?.dispose();}
    const geometry=source.geometry.clone(),positions=geometry.attributes.position;
    // The view sleeve is fitted to the hand at its upper end. Sweep its lower
    // sections on a short diagonal toward the player's elbow; the previous
    // high-curvature path made the support arm look like a bent hose.
    const support=side==='Left';
    const extension=support ? .98 : .52;
    const spread=support ? -1.0 : .33;
    const dx=-spread/.34,dy=1+extension/.34,length=Math.hypot(dx,dy);
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
      const t=clamp((.34-y)/.34,0,1);
      // The imported sleeve is extremely narrow through the middle. Keep
      // substantial forearm volume all the way from the grip to the elbow;
      // perspective supplies the final widening at the near-camera opening.
      const elbow=1+.10*Math.exp(-Math.pow((t-.58)/.24,2));
      const gripFullness=(support ? .48 : .40)*Math.pow(1-t,2);
      const width=((support ? 4.35-1.15*t : 3.95-1.10*t)+gripFullness)*elbow;
      const depth=(support ? 2.25-.24*t : 2.12-.20*t)*elbow;
      positions.setX(i,spread*t+x*width*dy/length);
      positions.setY(i,y-extension*t-x*width*dx/length);
      positions.setZ(i,z*depth);
    }
    positions.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
    const sleeve=new THREE.Mesh(geometry,source.material.clone());sleeve.name='MeshySleeve_'+side;
    sleeve.material.color.multiplyScalar(1.18);
    sleeve.material.depthTest=false;sleeve.material.depthWrite=false;sleeve.material.side=THREE.FrontSide;
    sleeve.layers.set(1);sleeve.userData.viewmodelArm=true;sleeve.userData.weaponBatchIgnore=true;
    const mobileSleeve = (renderer.canvas?.clientWidth ?? 1280) < 600 ? .78 : 1;
    sleeve.scale.set(mobileSleeve,1,mobileSleeve);
    sleeve.castShadow=sleeve.receiveShadow=false;limb.add(sleeve);arm.userData.viewmodelSource='meshy-v02-sleeve-with-fitted-grip';count++;
  });
  installViewmodelDepthBoundary(renderer.weaponRig);
  return count;
}

export function releaseMeshyAsset(root) {
  const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
  root?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.skeleton)skeletons.add(o.skeleton);for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean))materials.add(m);});
  for(const m of materials)for(const value of Object.values(m))if(value?.isTexture)textures.add(value);
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());skeletons.forEach(s=>s.dispose());
}

export async function loadMeshySurvivors(renderer,state) {
  try {
    const gltf=await new GLTFLoader().loadAsync(SURVIVOR_MODEL_URL);
    if(state.disposed){releaseMeshyAsset(gltf.scene);return;}
    state.template=gltf.scene;
    const local=createMeshySurvivor(gltf.scene,gltf.animations,{firstPerson:true}),peer=createMeshySurvivor(gltf.scene,gltf.animations);
    state.local.removeFromParent();state.peer.removeFromParent();
    // Fallback meshes own geometry, while their materials are also used by existing grip hands.
    for(const previous of [state.local,state.peer])previous.traverse(o=>o.geometry?.dispose());
    state.local=local;state.peer=peer;renderer.scene.add(local,peer);peer.visible=false;local.visible=false;
    state.viewSleeves=installMeshyViewSleeves(renderer,gltf.scene);state.status='ready';
  } catch(error) {state.status='fallback';state.error=String(error?.message||error);}
}
