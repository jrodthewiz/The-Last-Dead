import * as THREE from './vendor/three.module.js';
import {clone} from './vendor/utils/SkeletonUtils.js';
import {createMeleeReaction,restoreMeleeReaction,updateMeleeReaction} from './melee-reaction.js';
import {ENEMY_PROFILES} from './campaign.js';

export const AFTERLIFE_ASH_WITNESS_URL = './assets/models/afterlife-ash-witness-chase-v03.glb';

export const AFTERLIFE_ASH_WITNESS_CLIPS = Object.freeze({
 idle: 'AshWitness_Idle',
 shuffle: 'AshWitness_Shuffle',
 chase: 'AshWitness_Chase',
 attack: 'AshWitness_AttackLunge',
 hit: 'AshWitness_HitRecoil',
 collapse: 'AshWitness_Collapse',
});

const findClip = (clips, name) => clips.find(clip => clip?.name === name) || null;
const boundsCache = new WeakMap();
// Measured from the Blender Dread v02 contact/transfer samples: the two feet
// cover about .95m together over the 1.5s authored cycle. Use this to keep the
// in-place clip's phase close to the simulation root speed without IK.
const ASH_WITNESS_GAIT_TRANSFER_METERS=.95;
const ASH_WITNESS_GAIT_CYCLE_SECONDS=1.5;

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
   // The close lantern is much stronger than the neutral authoring preview.
   // Keep the jacket's fabric and face planes below a flat white response.
   item.color?.multiplyScalar(.55);
   if('roughness' in item)item.roughness=Math.max(.82,item.roughness);
   if('metalness' in item)item.metalness=Math.min(.04,item.metalness);
   if('envMapIntensity' in item)item.envMapIntensity=.12;
   // Preserve the scanned fabric at arm's length: the lantern originates in
   // front of the camera and its inverse-square peak otherwise clips it white.
   // This soft shoulder retains texture and normal contrast without a light.
   item.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`
     #include <lights_fragment_end>
     vec3 witnessLimit = max(diffuseColor.rgb * .30, vec3(.004));
     reflectedLight.directDiffuse /= vec3(1.) + reflectedLight.directDiffuse / witnessLimit;
     reflectedLight.directSpecular *= .5;
    `);
   };
   item.customProgramCacheKey=()=> 'ash-witness-lantern-response-v3';
   // The authoring export duplicates its albedo into a white emissive map.
   // Treat the cloth/skin as lit surfaces in-game; otherwise even perfect
   // direct-light response cannot stop the actor glowing through the dark.
   item.emissive?.setHex(0x000000);
   item.emissiveIntensity=0;
   item.emissiveMap=null;
   item.needsUpdate=true;
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
 const chaseClip=findClip(clips,AFTERLIFE_ASH_WITNESS_CLIPS.chase);
 const attackClip=findClip(clips,AFTERLIFE_ASH_WITNESS_CLIPS.attack);
 const hitClip=findClip(clips,AFTERLIFE_ASH_WITNESS_CLIPS.hit);
 const collapseClip=findClip(clips,AFTERLIFE_ASH_WITNESS_CLIPS.collapse);
 const actions={};
 if(mixer){
  if(idleClip){actions.idle=mixer.clipAction(idleClip);actions.idle.setLoop(THREE.LoopRepeat,Infinity).setEffectiveWeight(1).play();}
  if(shuffleClip){actions.shuffle=mixer.clipAction(shuffleClip);actions.shuffle.setLoop(THREE.LoopRepeat,Infinity).setEffectiveWeight(0).play();}
  if(chaseClip){actions.chase=mixer.clipAction(chaseClip);actions.chase.setLoop(THREE.LoopRepeat,Infinity).setEffectiveWeight(0).play();}
  if(attackClip){actions.attack=mixer.clipAction(attackClip);actions.attack.setLoop(THREE.LoopOnce,1);actions.attack.clampWhenFinished=true;actions.attack.setEffectiveWeight(0);}
  if(hitClip){actions.hit=mixer.clipAction(hitClip);actions.hit.setLoop(THREE.LoopOnce,1);actions.hit.clampWhenFinished=true;actions.hit.setEffectiveWeight(0);}
  if(collapseClip){actions.collapse=mixer.clipAction(collapseClip);actions.collapse.setLoop(THREE.LoopOnce,1);actions.collapse.clampWhenFinished=true;actions.collapse.setEffectiveWeight(0);}
  mixer.update(0);
 }
 const state={
  marker:'afterlife-model',
  model,pivot,normalizer,warningRing,materials,mixer,actions,clips,
  kind, seed, last:0, motion:0, deadAt:null, lastPosition:new THREE.Vector3(), hasLastPosition:false,
  sourceHeight:size.y, normalization:scale,
  idleAction:actions.idle||null, shuffleAction:actions.shuffle||null,
  chaseAction:actions.chase||null, chaseBlend:0, gaitPhase:(seed*.173)%1, facingYaw:null,
  attackAction:actions.attack||null, hitAction:actions.hit||null,
  collapseAction:actions.collapse||null, collapseStarted:false,
  attackActive:false, hitActive:false, attackStartedAt:null, hitStartedAt:null,
  // Keep the one-shot readable while preserving a continuous locomotion pose.
  // The values are deliberately short so combat still tracks the simulation.
  shotBlendIn:.085, shotBlendOut:.11, clipBlend:null,
  gaitTransferMeters:ASH_WITNESS_GAIT_TRANSFER_METERS,
  gaitTimeScale:0,
  lastHits:0, lastFlash:0, lastStagger:0,
  corpseSupport:['Hips','Head','LeftFoot','RightFoot','LeftHand','RightHand'].map(name=>model.getObjectByName(name)).filter(Boolean),
  collapseFall:0,
 };
 // `afterlife` is an object so the shared disposer can stop its mixer; the
 // string marker is explicit for diagnostics and remains distinct from the
 // existing `warden`/`bellwraith` contracts.
 root.userData.afterlife=state;
 root.userData.afterlifeModel=true;
 root.userData.source='meshy-ash-witness-blender-authored';
 return root;
}

const setWeights=(state,idleWeight,shuffleWeight,collapseWeight,attackWeight=0,hitWeight=0)=>{
 if(state.idleAction)state.idleAction.setEffectiveWeight(idleWeight);
 if(state.shuffleAction)state.shuffleAction.setEffectiveWeight(shuffleWeight*(1-state.chaseBlend));
 if(state.chaseAction)state.chaseAction.setEffectiveWeight(shuffleWeight*state.chaseBlend);
 if(state.attackAction)state.attackAction.setEffectiveWeight(attackWeight);
 if(state.hitAction)state.hitAction.setEffectiveWeight(hitWeight);
 if(state.collapseAction)state.collapseAction.setEffectiveWeight(collapseWeight);
};

const startOneShot=(state,key,now)=>{
 const action=state[`${key}Action`];
 if(!action)return false;
 action.reset().setEffectiveWeight(1).play();
 state[`${key}Active`]=true;
 state[`${key}StartedAt`]=now;
 if(key==='attack'){action.paused=true;state.attackPhase='windup';state.attackCancelledAt=null;}
 state.clipBlend={key, startedAt:now, alpha:0, phase:'in'};
 return true;
};

const stopOneShot=(state,key)=>{
 const action=state[`${key}Action`];
 if(action)action.stop().setEffectiveWeight(0);
 state[`${key}Active`]=false;
 state[`${key}StartedAt`]=null;
 if(state.clipBlend?.key===key)state.clipBlend=null;
};

const locomotionWeights=(state)=>{
 const shuffleWeight=Math.max(0,Math.min(1,(state.motion-.08)/.65));
 return {
  idle:state.shuffleAction?1-shuffleWeight:1,
  shuffle:state.shuffleAction?shuffleWeight:0,
 };
};

const oneShotWeight=(state,key)=>{
 const action=state[`${key}Action`];
 const blend=state.clipBlend?.key===key?state.clipBlend:null;
 if(!action||!blend)return 1;
 const duration=Math.max(.001,action.getClip().duration||0);
 const fadeIn=Math.min(1,Math.max(0,(state.last-blend.startedAt)/1000/Math.max(.001,state.shotBlendIn)));
 const fadeOut=Math.min(1,Math.max(0,(duration-action.time)/Math.max(.001,state.shotBlendOut)));
 const cancelled=key==='attack'&&state.attackCancelledAt!==null?Math.max(0,1-(state.last-state.attackCancelledAt)/120):1;
 const alpha=Math.min(fadeIn,fadeOut,cancelled);
 blend.alpha=alpha;
 blend.phase=fadeIn<1?'in':fadeOut<1?'out':'hold';
 return alpha;
};

// Blender's contact is frame 9 at 24fps. Sample the authored pose from the
// authoritative windup/strike, so fast and heavy variants land the same pose
// when damage is tested. Only recovery advances freely.
function syncSwipe(state,enemy,dt){
 const action=state.attackAction;
 if(!state.attackActive||!action)return;
 const duration=action.getClip().duration,contact=Math.min(.375,duration*.45),follow=Math.min(.5,duration*.60);
 if(enemy.attacking){
  const profile=ENEMY_PROFILES[enemy.variant]||ENEMY_PROFILES[['stalker','caster','brute'][enemy.kind]||'stalker'];
  const total=Math.max(.01,enemy.windupTime??enemy.windupDuration??profile.windup);
  action.time=contact*THREE.MathUtils.clamp(1-(enemy.windup||0)/total,0,1);
  state.attackPhase='windup';
 }else if(enemy.strike>0){
  const window=enemy.kind===1?.22:.24;
  action.time=contact+(follow-contact)*THREE.MathUtils.clamp(1-enemy.strike/window,0,1);
  state.attackPhase='contact';
 }else if(state.attackPhase==='windup'){
  state.attackCancelledAt??=state.last;
  state.attackPhase='cancelled';
 }else if(state.attackPhase!=='cancelled'){
  action.time=Math.min(duration,Math.max(follow,action.time)+dt);
  state.attackPhase='recovery';
 }
 action.paused=true;
}

/**
 * Drive animation selection without changing the simulation's attack/death
 * countdowns. `enemy.attacking` remains the existing telegraph authority.
 */
export function animateAfterlifeModel(root,enemy={},now=0,seed=0){
 const state=root?.userData?.afterlife;
 if(!state)return false;
 if(enemy.meleeHitId&&!state.meleeReaction)state.meleeReaction=createMeleeReaction(state.model,{seed:enemy.id});
 if(state.meleeReaction)restoreMeleeReaction(state.meleeReaction);
 const dt=state.last?Math.min(.05,Math.max(0,(now-state.last)/1000)):.016;
 state.last=now;state.seed=seed;
 const dx=root.position.x-state.lastPosition.x,dz=root.position.z-state.lastPosition.z;
 const distance=state.hasLastPosition?Math.hypot(dx,dz):0;
 // Spawns, teleports and knockback must not turn into a burst of running steps.
 const traveled=distance<.8&&!enemy.dead&&!(enemy.stagger>0)?distance:0;
 const measuredSpeed=traveled/Math.max(.001,dt);
 state.lastPosition.set(root.position.x,root.position.y,root.position.z);state.hasLastPosition=true;
 const moved=Math.min(6.5,Math.max(0,measuredSpeed));
 state.motion+=(moved-state.motion)*(1-Math.exp(-12*dt));
 state.chaseBlend=state.chaseAction?THREE.MathUtils.smoothstep(state.motion,1.2,2.5):0;
 const stride=THREE.MathUtils.lerp(ASH_WITNESS_GAIT_TRANSFER_METERS,1.55,state.chaseBlend);
 state.gaitTransferMeters=stride;
 state.gaitPhase=(state.gaitPhase+traveled/stride)%1;
 state.gaitTimeScale=state.motion*ASH_WITNESS_GAIT_CYCLE_SECONDS/stride;
 for(const action of [state.shuffleAction,state.chaseAction])if(action){action.paused=true;action.time=state.gaitPhase*action.getClip().duration;}
 if(!enemy.dead){
  let facing=root.rotation.y;
  if(enemy.strike>0&&Number.isFinite(enemy.slashDir))facing=-enemy.slashDir-Math.PI/2;
  else if(traveled>.002&&!enemy.attacking&&!(enemy.stagger>0))facing=Math.atan2(-dx,-dz);
  state.facingYaw??=facing;
  const delta=Math.atan2(Math.sin(facing-state.facingYaw),Math.cos(facing-state.facingYaw));
  state.facingYaw+=delta*(1-Math.exp(-(enemy.attacking?22:10)*dt));
  root.rotation.y=state.facingYaw;
 }
 // `enemy.attack === 0` means the cooldown is ready in engine.js; it is not
 // an attack countdown. Only the explicit windup/swing flags may drive this
 // visual telegraph, otherwise every idle enemy would lunge forever.
 const strike=Number(enemy.strike)||0;
 const warning=!enemy.dead&&(!!enemy.attacking||strike>0);
 state.warning=warning;
 state.warningRing.visible=warning&&!enemy.dead;
 state.warningRing.scale.setScalar(1+Math.min(1,state.motion)*.12);
 for(const material of state.materials){
  if(!material.emissive)continue;
  const base=material.userData.baseEmissive||new THREE.Color(0);
  material.emissive.copy(base);
  // The floor ring and authored pose own the warning. Do not turn the whole
  // jacket into an emissive red/white silhouette during a close attack.
  material.emissiveIntensity=Number(material.userData.baseEmissiveIntensity)||0;
 }
 const hitCount=Number(enemy.hits)||0;
 const flash=Number(enemy.flash)||0;
 const stagger=Number(enemy.stagger)||0;
 const hitEdge=hitCount>state.lastHits||(flash>.01&&state.lastFlash<=.01)||(stagger>.01&&state.lastStagger<=.01);
 state.lastHits=hitCount;state.lastFlash=flash;state.lastStagger=stagger;
 if(enemy.dead){
  stopOneShot(state,'attack');
  stopOneShot(state,'hit');
  if(!state.collapseStarted){
   state.collapseStarted=true;state.deadAt=now;
   if(state.collapseAction){state.collapseAction.reset().setEffectiveWeight(1).play();}
  }
  setWeights(state,0,0,state.collapseAction?1:0,0,0);
 }else{
  state.collapseStarted=false;state.deadAt=null;
  state.pivot.rotation.x=0;state.pivot.rotation.z=0;state.pivot.position.y=0;state.collapseFall=0;
  // Ordinary damage does not interrupt engine melee. Keep its contact pose
  // visible; only an idle hit or a real stagger may replace it with recoil.
  const committedAttack=warning&&stagger<=0;
  if(committedAttack&&state.hitActive)stopOneShot(state,'hit');
  if(hitEdge&&!committedAttack){
   stopOneShot(state,'attack');
   startOneShot(state,'hit',now);
  }
  const attackTrigger=committedAttack&&(!state.attackActive||(enemy.attacking&&!state.attacking))&&!state.hitActive;
  if(attackTrigger){startOneShot(state,'attack',now);if(strike>0)state.clipBlend.startedAt=now-state.shotBlendIn*1000;}
  syncSwipe(state,enemy,dt);
  const locomotion=locomotionWeights(state);
  if(state.hitActive){
   const shot=oneShotWeight(state,'hit');
   setWeights(state,locomotion.idle*(1-shot),locomotion.shuffle*(1-shot),0,0,shot);
  }else if(state.attackActive){
   const shot=oneShotWeight(state,'attack');
   setWeights(state,locomotion.idle*(1-shot),locomotion.shuffle*(1-shot),0,shot,0);
  }else{
   setWeights(state,locomotion.idle,locomotion.shuffle,0,0,0);
  }
 }
 // Keep combat telegraph ownership with the enemy simulation. This marker is
 // useful to renderer diagnostics and lets a future attack clip be layered in
 // without hiding the existing warning window.
 state.attacking=!!enemy.attacking;
 state.attackWindow=Number(enemy.windup||0);
 state.pivot.position.z=state.attackActive&&state.attackAction?
  -.30*Math.sin(Math.PI*state.attackAction.time/state.attackAction.getClip().duration)*state.attackAction.getEffectiveWeight():0;
 state.mixer?.update(dt);
 if(state.meleeReaction)updateMeleeReaction(state.meleeReaction,enemy,dt,-root.rotation.y-Math.PI/2);
 if(enemy.dead&&state.corpseSupport.length){
  // The authored clip folds the spine but keeps its root upright. Complete
  // the loss of balance around the ankle origin, with six rig anchors keeping
  // it above the floor. No ragdoll solver or per-vertex bounds are required.
  const progress=Math.min(1,Math.max(0,((now-state.deadAt)/1000-.22)/1.15));
  const fall=progress*progress*(3-2*progress);
  state.collapseFall=fall;
  state.pivot.rotation.x=-1.45*fall;state.pivot.rotation.z=.16*fall;
  state.pivot.position.y=0;
  root.updateMatrixWorld(true);
  let minimum=Infinity;
  for(const bone of state.corpseSupport)minimum=Math.min(minimum,bone.matrixWorld.elements[13]-root.position.y);
  state.pivot.position.y=Math.max(0,.09-minimum);
 }
 if(state.attackActive&&state.attackAction&&state.attackAction.time>=state.attackAction.getClip().duration-.001&&!warning&&strike<=0)stopOneShot(state,'attack');
 if(state.attackActive&&state.attackCancelledAt!==null&&now-state.attackCancelledAt>=120)stopOneShot(state,'attack');
 if(state.hitActive&&state.hitAction&&state.hitAction.time>=state.hitAction.getClip().duration-.001)stopOneShot(state,'hit');
 return true;
}

export function disposeAfterlifeModel(root){
 const state=root?.userData?.afterlife;
 if(!state)return;
 state.mixer?.stopAllAction();
 state.mixer?.uncacheRoot(state.model);
  state.mixer=null;state.actions={};
}
