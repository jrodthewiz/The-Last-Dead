import * as THREE from './vendor/three.module.js';
import {clone} from './vendor/utils/SkeletonUtils.js';
import {createMeleeReaction,restoreMeleeReaction,updateMeleeReaction} from './melee-reaction.js';
import {ENEMY_PROFILES} from './campaign.js';
import {createCharacterArticulation,restoreCharacterArticulation,applyCharacterArticulation,enemyArticulationPose} from './character-articulation.js';

export const AFTERLIFE_ASH_WITNESS_URL = './assets/models/afterlife-ash-witness-motion-v06.glb';

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
const actorPhase=(seed,salt=0)=>{
 let value=(Math.trunc((Number(seed)||0)*4096)+Math.imul(salt+1,374761393))|0;
 value=Math.imul(value^(value>>>13),1274126177);
 return ((value^(value>>>16))>>>0)/4294967296;
};

/**
 * Load the authored model once during renderer warmup. The returned template is
 * safe to clone with SkeletonUtils without reloading the GLB per enemy.
 */
export async function loadAfterlifeModel(loader, url=AFTERLIFE_ASH_WITNESS_URL){
 // Consume the original response completely before parsing. The FileLoader
 // progress-stream wrapper in this bundled Three version reports a canceled
 // Chrome request after receiving every byte of the larger rigged GLB.
 const resource=(loader.path||'')+url,requestUrl=loader.manager.resolveURL(resource);
 loader.manager.itemStart(requestUrl);
 let gltf;
 try{
  const response=await fetch(requestUrl,{headers:loader.requestHeader,credentials:loader.withCredentials?'include':'same-origin',signal:loader.manager.abortController?.signal});
  if(!response.ok)throw new Error(`Character asset request failed (${response.status}): ${requestUrl}`);
  const bytes=await response.arrayBuffer(),header=new DataView(bytes);
  if(bytes.byteLength<12||header.getUint32(0,true)!==0x46546c67||header.getUint32(4,true)!==2||header.getUint32(8,true)!==bytes.byteLength)throw new Error(`Incomplete or invalid character GLB: ${requestUrl}`);
  gltf=await loader.parseAsync(bytes,loader.resourcePath||THREE.LoaderUtils.extractUrlBase(resource));
 }catch(error){loader.manager.itemError(requestUrl);throw error;}
 finally{loader.manager.itemEnd(requestUrl);}
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
 const materials=[],materialCopies=new Map();
 model.traverse(object=>{
  if(!object.isMesh)return;
  const copy=source=>{if(!source)return source;if(!materialCopies.has(source))materialCopies.set(source,source.clone());return materialCopies.get(source);};
  const material=Array.isArray(object.material)?object.material.map(copy):copy(object.material);
  object.material=material;
  for(const item of Array.isArray(material)?material:[material]){
   if(!item||materials.includes(item))continue;
   delete item.userData.sharedLibrary;
   item.userData.afterlifeOwned=true;
   // The close lantern is much stronger than the neutral authoring preview.
   // Keep the jacket's fabric and face planes below a flat white response.
   const oral=!!item.userData.oralSurface;
   item.color?.multiplyScalar(oral?.75:.55);
   if('roughness' in item)item.roughness=Math.max(oral?.42:.82,item.roughness);
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
     reflectedLight.directSpecular /= vec3(1.) + reflectedLight.directSpecular / vec3(.025);
    `);
   };
   item.customProgramCacheKey=()=> 'ash-witness-lantern-response-v4';
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
 const idlePhase=actorPhase(seed,11),idleRate=.96+.08*actorPhase(seed,17);
 const actions={};
 if(mixer){
  if(idleClip){actions.idle=mixer.clipAction(idleClip);actions.idle.setLoop(THREE.LoopRepeat,Infinity).setEffectiveWeight(1).setEffectiveTimeScale(idleRate).play();actions.idle.time=idlePhase*idleClip.duration;}
  if(shuffleClip){actions.shuffle=mixer.clipAction(shuffleClip);actions.shuffle.setLoop(THREE.LoopRepeat,Infinity).setEffectiveWeight(0).play();}
  if(chaseClip){actions.chase=mixer.clipAction(chaseClip);actions.chase.setLoop(THREE.LoopRepeat,Infinity).setEffectiveWeight(0).play();}
  if(attackClip){actions.attack=mixer.clipAction(attackClip);actions.attack.setLoop(THREE.LoopOnce,1);actions.attack.clampWhenFinished=true;actions.attack.setEffectiveWeight(0);}
  if(hitClip){actions.hit=mixer.clipAction(hitClip);actions.hit.setLoop(THREE.LoopOnce,1);actions.hit.clampWhenFinished=true;actions.hit.setEffectiveWeight(0);}
  if(collapseClip){actions.collapse=mixer.clipAction(collapseClip);actions.collapse.setLoop(THREE.LoopOnce,1);actions.collapse.clampWhenFinished=true;actions.collapse.setEffectiveWeight(0);}
  mixer.update(0);
 }
 const state={
  marker:'afterlife-model',
  model,pivot,normalizer,warningRing,materials,mixer,actions,clips,articulation:createCharacterArticulation(model),
  articulationContext:{time:0,seed,idlePhase,attackRecovery:null,hitWeight:0},
  kind, seed, last:null, motion:0, deadAt:null, lastPosition:new THREE.Vector3(), hasLastPosition:false,
  sourceHeight:size.y, normalization:scale,
  idleAction:actions.idle||null, shuffleAction:actions.shuffle||null,
  chaseAction:actions.chase||null, chaseBlend:0, gaitPhase:actorPhase(seed,23), gaitDirection:1, turnMotion:0, facingYaw:null,idlePhase,idleRate,
  attackAction:actions.attack||null, hitAction:actions.hit||null,
  collapseAction:actions.collapse||null, collapseStarted:false,
  attackActive:false, hitActive:false, attackStartedAt:null, hitStartedAt:null,hitResumeAt:null,attackResumeAt:null,
  // Keep the one-shot readable while preserving a continuous locomotion pose.
  // The values are deliberately short so combat still tracks the simulation.
  shotBlendIn:.085, shotBlendOut:.11, clipBlend:null,
  gaitTransferMeters:ASH_WITNESS_GAIT_TRANSFER_METERS,
  shuffleStride:shuffleClip?.userData?.strideMeters||ASH_WITNESS_GAIT_TRANSFER_METERS,
  chaseStride:chaseClip?.userData?.strideMeters||1.55,
  authoredFall:!!collapseClip?.userData?.authoredFall,
  capturedAttack:attackClip?.userData?.bodycamMotionVersion===4,
  attackContact:attackClip?.userData?.contactSeconds||.375,
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
 root.userData.source=state.articulation.hasJaw?'meshy-ash-witness-jaw-grip-v05':'meshy-ash-witness-retargeted-v04';
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
 if(key==='attack'){action.paused=true;state.attackPhase='windup';state.attackCancelledAt=null;state.attackResumeAt=null;}
 if(key==='hit')state.hitResumeAt=null;
 state.clipBlend={key, startedAt:now, alpha:0, phase:'in'};
 return true;
};

const stopOneShot=(state,key)=>{
 const action=state[`${key}Action`];
 if(action)action.stop().setEffectiveWeight(0);
 state[`${key}Active`]=false;
 state[`${key}StartedAt`]=null;
 if(key==='hit')state.hitResumeAt=null;
 if(key==='attack')state.attackResumeAt=null;
 if(state.clipBlend?.key===key)state.clipBlend=null;
};

const locomotionWeights=(state)=>{
 const shuffleWeight=Math.max(0,Math.min(1,(Math.max(state.motion,state.turnMotion)-.08)/.65));
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
 const fadeIn=THREE.MathUtils.smoothstep((state.last-blend.startedAt)/1000,0,Math.max(.001,state.shotBlendIn));
 const fadeOut=THREE.MathUtils.smoothstep(duration-action.time,0,Math.max(.001,state.shotBlendOut));
 const cancelled=key==='attack'&&state.attackCancelledAt!==null?1-THREE.MathUtils.smoothstep(state.last-state.attackCancelledAt,0,120):1;
 const resumeAt=key==='hit'?state.hitResumeAt:state.attackResumeAt;
 const resume=resumeAt!==null?1-THREE.MathUtils.smoothstep(state.last-resumeAt,0,160):1;
 const alpha=Math.min(fadeIn,fadeOut,cancelled)*resume;
 blend.alpha=alpha;
 blend.phase=fadeIn<1?'in':fadeOut<1||resume<1?'out':'hold';
 return alpha;
};

// Blender's contact is frame 9 at 24fps. Sample the authored pose from the
// authoritative windup/strike, so fast and heavy variants land the same pose
// when damage is tested. Only recovery advances freely.
function syncSwipe(state,enemy,dt){
 const action=state.attackAction;
 if(!state.attackActive||!action)return;
 const duration=action.getClip().duration,contact=Math.min(state.attackContact,duration*.45),follow=Math.min(.5,duration*.60);
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
 if(state.crawlRestore){for(const p of state.crawlRestore)p.bone.quaternion.copy(p.quaternion);state.crawlRestore.length=0;}
 restoreCharacterArticulation(state.articulation);
 if(enemy.meleeHitId&&!state.meleeReaction)state.meleeReaction=createMeleeReaction(state.model,{seed:enemy.id});
 if(state.meleeReaction)restoreMeleeReaction(state.meleeReaction);
 const dt=state.last===null?0:Math.min(.05,Math.max(0,(now-state.last)/1000));
 state.last=now;state.seed=seed;
 const dx=root.position.x-state.lastPosition.x,dz=root.position.z-state.lastPosition.z;
 const distance=state.hasLastPosition?Math.hypot(dx,dz):0;
 // Spawns, teleports and knockback must not turn into a burst of running steps.
 const traveled=dt>0&&distance<.8&&!enemy.dead&&!(enemy.stagger>0)?distance:0;
 const measuredSpeed=traveled/Math.max(.001,dt);
 state.lastPosition.set(root.position.x,root.position.y,root.position.z);state.hasLastPosition=true;
 const moved=Math.min(6.5,Math.max(0,measuredSpeed));
 state.motion+=(moved-state.motion)*(1-Math.exp(-12*dt));
 state.chaseBlend=state.chaseAction?THREE.MathUtils.smoothstep(state.motion,1.2,2.5):0;
 const stride=THREE.MathUtils.lerp(state.shuffleStride,state.chaseStride,state.chaseBlend);
 state.gaitTransferMeters=stride;
 const cycle=THREE.MathUtils.lerp(state.shuffleAction?.getClip().duration||ASH_WITNESS_GAIT_CYCLE_SECONDS,state.chaseAction?.getClip().duration||ASH_WITNESS_GAIT_CYCLE_SECONDS,state.chaseBlend);
 state.gaitTimeScale=state.motion*cycle/stride;
 let turn=0;
 if(!enemy.dead){
  let facing=root.rotation.y;
  // Grapple windup owns a locked aimAngle. At latch the engine does not set
  // held facing until the next step, so retain that authored reach direction
  // through progress zero instead of turning back toward stale AI facing.
  if((enemy.bitePhase==='windup'||enemy.bitePhase==='held'&&!(enemy.biteProgress>0))&&Number.isFinite(enemy.aimAngle))facing=-enemy.aimAngle-Math.PI/2;
  else if(enemy.strike>0&&Number.isFinite(enemy.slashDir))facing=-enemy.slashDir-Math.PI/2;
  else if(Number.isFinite(enemy.facing))facing=-enemy.facing-Math.PI/2;
  else if(traveled>.002&&!enemy.attacking&&!(enemy.stagger>0))facing=Math.atan2(-dx,-dz);
  state.facingYaw??=facing;
  const delta=Math.atan2(Math.sin(facing-state.facingYaw),Math.cos(facing-state.facingYaw));
  turn=delta*(1-Math.exp(-(enemy.attacking?22:10)*dt));
  state.facingYaw+=turn;
  // Quaternion restoration may represent a pure yaw using X/Z=PI. Write
  // the whole upright actor frame; replacing only Euler Y reverses facing.
  root.rotation.set(0,state.facingYaw,0);
 }
 // The in-place gait follows real displacement, including retreat. Turning
 // on the spot contributes a small shuffle rather than pivoting locked feet.
 const combatLock=enemy.dead||enemy.attacking||enemy.strike>0||enemy.stagger>0||['windup','held','terminal'].includes(enemy.bitePhase);
 const forward=-(dx*Math.sin(state.facingYaw||0)+dz*Math.cos(state.facingYaw||0));
 if(traveled>.0001)state.gaitDirection=forward<-.25*traveled?-1:1;
 const turnTravel=!combatLock&&traveled<.002?Math.abs(turn)*.22:0;
 const turnSpeed=dt>0?turnTravel/dt:0;
 state.turnMotion+=(turnSpeed-state.turnMotion)*(1-Math.exp(-12*dt));
 state.gaitPhase=((state.gaitPhase+state.gaitDirection*(traveled+turnTravel)/stride)%1+1)%1;
 for(const action of [state.shuffleAction,state.chaseAction])if(action){action.paused=true;action.time=state.gaitPhase*action.getClip().duration;}
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
   // Rapid bullets must not reset the same recoil to its first key every
   // 110ms. Let the captured response carry through; physical melee impulses
   // and canonical hit effects still respond to each individual contact.
   if(!state.hitActive)startOneShot(state,'hit',now);
  }
  const attackTrigger=committedAttack&&(!state.attackActive||(enemy.attacking&&!state.attacking))&&!state.hitActive;
  if(attackTrigger){startOneShot(state,'attack',now);if(strike>0)state.clipBlend.startedAt=now-state.shotBlendIn*1000;}
  syncSwipe(state,enemy,dt);
  const locomotion=locomotionWeights(state);
  if(state.hitActive){
   // When simulation locomotion actually resumes, release the full-body
   // recoil into the gait instead of sliding locked feet for its whole clip.
   if(stagger>0)state.hitResumeAt=null;else if(state.motion>.12)state.hitResumeAt??=now;
   const shot=oneShotWeight(state,'hit');
   setWeights(state,locomotion.idle*(1-shot),locomotion.shuffle*(1-shot),0,0,shot);
  }else if(state.attackActive){
   // Preserve anticipation and contact exactly; blend the full-body recovery
   // out as soon as the simulation resumes footwork. The authored arm recoil
   // still advances while the phase-aligned gait takes back the feet.
   if(!warning&&state.attackPhase==='recovery'&&state.motion>.12)state.attackResumeAt??=now;
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
 state.pivot.position.z=!state.capturedAttack&&state.attackActive&&state.attackAction?
  -.30*Math.sin(Math.PI*state.attackAction.time/state.attackAction.getClip().duration)*state.attackAction.getEffectiveWeight():0;
 state.mixer?.update(dt);
 if(state.meleeReaction)updateMeleeReaction(state.meleeReaction,enemy,dt,-root.rotation.y-Math.PI/2);
 const attackDuration=state.attackAction?.getClip().duration||1,follow=Math.min(.5,attackDuration*.60);
 const attackRecovery=state.attackActive&&state.attackPhase==='recovery'?THREE.MathUtils.clamp((state.attackAction.time-follow)/Math.max(.001,attackDuration-follow),0,1):null;
 const articulationContext=state.articulationContext;
 articulationContext.time=now*.001;articulationContext.seed=state.seed;
 articulationContext.idlePhase=state.idleAction?state.idleAction.time/state.idleAction.getClip().duration:state.idlePhase;
 articulationContext.attackRecovery=attackRecovery;articulationContext.hitWeight=state.hitActive?state.hitAction?.getEffectiveWeight()||0:0;
 applyCharacterArticulation(state.articulation,enemyArticulationPose(enemy,articulationContext));
 if(!enemy.dead&&enemy.locomotion==='crawl'){
  // Loss of support folds the entire body toward its travel direction. The
  // surviving hands retain a distance-driven pull, including quiet breathing.
  const age=Math.max(0,(now-(state.crawlStartedAt??=now))/1000),lower=THREE.MathUtils.smoothstep(age,0,.55),pull=Math.sin(state.gaitPhase*Math.PI*2);
  state.pivot.rotation.x=-1.25*lower;state.pivot.rotation.z=.035*pull*lower;
  state.pivot.position.y=.10*lower;state.pivot.position.z=0;
  for(const [side,sign]of [['left',1],['right',-1]]){
   const arm=state.model.getObjectByName(side==='left'?'LeftArm':'RightArm');
   if(arm&&!enemy.wounds?.[side+'Arm']){
    // Imported arm axes vary. Convert the actor's transverse into this bone
    // frame and register restoration with the articulation's next mixer pose.
    const axis=new THREE.Vector3(1,0,0).applyQuaternion(root.quaternion).applyQuaternion(arm.getWorldQuaternion(new THREE.Quaternion()).invert());
    state.crawlRestore ||= [];state.crawlRestore.push({bone:arm,quaternion:arm.quaternion.clone()});
    arm.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis,(.28+.18*pull*sign)*lower));
   }
  }
 }else state.crawlStartedAt=null;
 if(!enemy.dead&&state.revivalPose){
  state.revivalStartedAt??=now;
  const rise=THREE.MathUtils.smoothstep((now-state.revivalStartedAt)/1000,0,.95),pose=state.revivalPose;
  for(const p of pose.bones){p.bone.position.lerpVectors(p.position,p.bone.position.clone(),rise);p.bone.quaternion.slerpQuaternions(p.quaternion,p.bone.quaternion.clone(),rise);}
  state.pivot.position.lerpVectors(pose.pivotPosition,state.pivot.position.clone(),rise);state.pivot.quaternion.slerpQuaternions(pose.pivotQuaternion,state.pivot.quaternion.clone(),rise);
  if(rise>=1)state.revivalPose=null;
 }
 if(enemy.dead&&state.corpseSupport.length&&!state.authoredFall){
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
 restoreCharacterArticulation(state.articulation);
 state.mixer?.stopAllAction();
 state.mixer?.uncacheRoot(state.model);
  state.mixer=null;state.actions={};
}
