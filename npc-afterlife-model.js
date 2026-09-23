import * as THREE from './vendor/three.module.js';
import {clone} from './vendor/utils/SkeletonUtils.js';

export const AFTERLIFE_ASH_WITNESS_URL = './assets/models/afterlife-ash-witness.glb';

export const AFTERLIFE_ASH_WITNESS_CLIPS = Object.freeze({
 idle: 'AshWitness_Idle',
 shuffle: 'AshWitness_Shuffle',
 collapse: 'AshWitness_Collapse',
});

const findClip = (clips, name) => clips.find(clip => clip?.name === name) || null;
const boundsCache = new WeakMap();

/**
 * Load the authored model once during renderer warmup. The returned template is
 * safe to clone with SkeletonUtils without reloading the 2.3 MB GLB per enemy.
 */
export async function loadAfterlifeModel(loader, url=AFTERLIFE_ASH_WITNESS_URL){
 const gltf=await loader.loadAsync(url);
 const template=gltf.scene;
 template.name='AshWitnessTemplate';
 template.userData.afterlifeAsset=true;
 template.userData.afterlifeModel=true;
 template.traverse(object=>{
  if(!object.isMesh)return;
  object.geometry.userData.sharedAsset=true;
  const markTexture=texture=>{if(texture)texture.userData.sharedAsset=true;};
  const markMaterial=material=>{
   if(!material)return;
   material.userData.sharedLibrary=true;
   markTexture(material.map);markTexture(material.normalMap);markTexture(material.roughnessMap);
   markTexture(material.metalnessMap);markTexture(material.emissiveMap);markTexture(material.aoMap);
  };
  if(Array.isArray(object.material))object.material.forEach(markMaterial);else markMaterial(object.material);
  object.castShadow=true;object.receiveShadow=true;object.frustumCulled=false;
 });
 return {template,clips:Array.isArray(gltf.animations)?gltf.animations:[],gltf,url};
}

/**
 * Create one lightweight enemy instance. Collision/hurtboxes stay in the
 * existing simulation; this root only owns the visual clone and its mixer.
 */
export function createAfterlifeModel(asset,kind=0,seed=0){
 const template=asset?.template||asset;
 const clips=asset?.clips||[];
 if(!template)return null;
 const root=new THREE.Group();
 root.name='AshWitnessAfterlife';
 const pivot=new THREE.Group(),normalizer=new THREE.Group();
 root.add(pivot);pivot.add(normalizer);
 const model=clone(template);
 model.name='AshWitnessModel';
 normalizer.add(model);
 let bounds=boundsCache.get(template);
 if(!bounds){bounds=new THREE.Box3().setFromObject(template,true);boundsCache.set(template,bounds);}
 const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 const scale=1.86/Math.max(.001,size.y);
 normalizer.scale.setScalar(scale);
 normalizer.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
 // Browser evidence shows this export's native face is +Z. The renderer's
 // actor contract targets local -Z, so the wrapper carries one half-turn.
 pivot.rotation.y=Math.PI;
 const materials=[];
 model.traverse(object=>{
  if(!object.isMesh)return;
  const material=Array.isArray(object.material)?object.material.map(item=>item.clone()):object.material?.clone();
  object.material=material;
  for(const item of Array.isArray(material)?material:[material]){
   if(!item)continue;
   delete item.userData.sharedLibrary;
   item.userData.afterlifeOwned=true;
   item.userData.baseEmissive=item.emissive?.clone?.()||new THREE.Color(0);
   item.userData.baseEmissiveIntensity=Number(item.emissiveIntensity)||0;
   materials.push(item);
  }
  object.castShadow=true;object.receiveShadow=true;object.frustumCulled=false;
 });
 const warningRing=new THREE.Mesh(
  new THREE.TorusGeometry(.44,.012,5,28),
  new THREE.MeshBasicMaterial({color:0xc84a54,transparent:true,opacity:.28,depthWrite:false}),
 );
 warningRing.rotation.x=-Math.PI/2;warningRing.position.y=.028;warningRing.visible=false;root.add(warningRing);
 const mixer=clips.length?new THREE.AnimationMixer(model):null;
 const idleClip=findClip(clips,AFTERLIFE_ASH_WITNESS_CLIPS.idle);
 const shuffleClip=findClip(clips,AFTERLIFE_ASH_WITNESS_CLIPS.shuffle);
 const collapseClip=findClip(clips,AFTERLIFE_ASH_WITNESS_CLIPS.collapse);
 const actions={};
 if(mixer){
  if(idleClip){actions.idle=mixer.clipAction(idleClip);actions.idle.setLoop(THREE.LoopRepeat,Infinity).setEffectiveWeight(1).play();}
  if(shuffleClip){actions.shuffle=mixer.clipAction(shuffleClip);actions.shuffle.setLoop(THREE.LoopRepeat,Infinity).setEffectiveWeight(0).play();}
  if(collapseClip){actions.collapse=mixer.clipAction(collapseClip);actions.collapse.setLoop(THREE.LoopOnce,1);actions.collapse.clampWhenFinished=true;actions.collapse.setEffectiveWeight(0);}
  mixer.update(0);
 }
 const state={
  marker:'afterlife-model',
  model,pivot,normalizer,warningRing,materials,mixer,actions,clips,
  kind, seed, last:0, motion:0, deadAt:null, lastPosition:new THREE.Vector3(), hasLastPosition:false,
  sourceHeight:size.y, normalization:scale,
  idleAction:actions.idle||null, shuffleAction:actions.shuffle||null,
  collapseAction:actions.collapse||null, collapseStarted:false,
 };
 // `afterlife` is an object so the shared disposer can stop its mixer; the
 // string marker is explicit for diagnostics and remains distinct from the
 // existing `warden`/`bellwraith` contracts.
 root.userData.afterlife=state;
 root.userData.afterlifeModel=true;
 root.userData.source='meshy-ash-witness-blender-authored';
 return root;
}

const setWeights=(state,idleWeight,shuffleWeight,collapseWeight)=>{
 if(state.idleAction)state.idleAction.setEffectiveWeight(idleWeight);
 if(state.shuffleAction)state.shuffleAction.setEffectiveWeight(shuffleWeight);
 if(state.collapseAction)state.collapseAction.setEffectiveWeight(collapseWeight);
};

/**
 * Drive animation selection without changing the simulation's attack/death
 * countdowns. `enemy.attacking` remains the existing telegraph authority.
 */
export function animateAfterlifeModel(root,enemy={},now=0,seed=0){
 const state=root?.userData?.afterlife;
 if(!state)return false;
 const dt=state.last?Math.min(.05,Math.max(0,(now-state.last)/1000)):.016;
 state.last=now;state.seed=seed;
 const dx=root.position.x-state.lastPosition.x,dz=root.position.z-state.lastPosition.z;
 const measuredSpeed=state.hasLastPosition?Math.hypot(dx,dz)/Math.max(.001,dt):0;
 state.lastPosition.set(root.position.x,root.position.y,root.position.z);state.hasLastPosition=true;
 const moved=Math.min(2.2,Math.max(0,measuredSpeed));
 state.motion+=(moved-state.motion)*Math.min(1,dt*10);
 const attackElapsed=Number(enemy.attack);
 const warning=!!enemy.attacking||(Number.isFinite(attackElapsed)&&attackElapsed>=0&&attackElapsed<.3);
 state.warning=warning;
 state.warningRing.visible=warning&&!enemy.dead;
 state.warningRing.scale.setScalar(1+Math.min(1,state.motion)*.12);
 for(const material of state.materials){
  if(!material.emissive)continue;
  const base=material.userData.baseEmissive||new THREE.Color(0);
  material.emissive.copy(base);
  if(warning){material.emissive.r+=.18;material.emissive.g+=.018;material.emissive.b+=.012;material.emissiveIntensity=Math.max(.42,Number(material.userData.baseEmissiveIntensity)||0);}
  else material.emissiveIntensity=Number(material.userData.baseEmissiveIntensity)||0;
 }
 if(enemy.dead){
  if(!state.collapseStarted){
   state.collapseStarted=true;state.deadAt=now;
   if(state.collapseAction){state.collapseAction.reset().setEffectiveWeight(1).play();}
  }
  setWeights(state,0,0,state.collapseAction?1:0);
 }else{
  state.collapseStarted=false;state.deadAt=null;
  const shuffleWeight=Math.max(0,Math.min(1,(state.motion-.08)/.65));
  setWeights(state,state.shuffleAction?1-shuffleWeight:1,state.shuffleAction?shuffleWeight:0,0);
  if(state.shuffleAction)state.shuffleAction.setEffectiveTimeScale(Math.max(.65,Math.min(1.5,.78+state.motion*.42)));
 }
 // Keep combat telegraph ownership with the enemy simulation. This marker is
 // useful to renderer diagnostics and lets a future attack clip be layered in
 // without hiding the existing warning window.
 state.attacking=!!enemy.attacking;
 state.attackWindow=Number(enemy.windup||0);
 state.mixer?.update(dt);
 return true;
}

export function disposeAfterlifeModel(root){
 const state=root?.userData?.afterlife;
 if(!state)return;
 state.mixer?.stopAllAction();
 state.mixer?.uncacheRoot(state.model);
  state.mixer=null;state.actions={};
}
