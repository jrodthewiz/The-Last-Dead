import * as THREE from './vendor/three.module.js';
import {clone} from './vendor/utils/SkeletonUtils.js';
import {createMeleeReaction,restoreMeleeReaction,updateMeleeReaction} from './melee-reaction.js';
import {ENEMY_PROFILES} from './campaign.js';
import {createCharacterArticulation,restoreCharacterArticulation,applyCharacterArticulation,enemyArticulationPose} from './character-articulation.js';
import {ASH_WITNESS_APPEARANCE,ASH_WITNESS_MODEL_URL} from './zombie-appearances.js';

export const AFTERLIFE_ASH_WITNESS_URL = ASH_WITNESS_MODEL_URL;

export const AFTERLIFE_ASH_WITNESS_CLIPS = Object.freeze({
 idle: 'AshWitness_Idle',
 shuffle: 'AshWitness_Shuffle',
 chase: 'AshWitness_Chase',
 run: 'AshWitness_Run',
 crawl: 'AshWitness_Crawl',
 crawlIdle: 'AshWitness_CrawlIdle',
 contort: 'AshWitness_Contort',
 attack: 'AshWitness_AttackLunge',
 hit: 'AshWitness_HitRecoil',
 collapse: 'AshWitness_Collapse',
});

const findClip = (clips, name) => clips.find(clip => clip?.name === name) || null;
const boundsCache = new WeakMap();
const groundVertexCache=new WeakMap();
const groundBoneNames=new Set(['LeftHand','RightHand','LeftGrip','RightGrip','LeftForeArm','RightForeArm','LeftLeg','RightLeg','LeftFoot','RightFoot','LeftToeBase','RightToeBase']);
const groundDirections=[];
for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)if(x||y||z)groundDirections.push([x,y,z]);

function groundSamples(model){
 const samples=[],point=new THREE.Vector3();
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  let indices=groundVertexCache.get(mesh.geometry);
  if(!indices){
   const groups=new Map(),skin=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight,position=mesh.geometry.attributes.position;
   for(let i=0;i<mesh.skeleton.bones.length;i++)if(groundBoneNames.has(mesh.skeleton.bones[i].name))groups.set(i,groundDirections.map(()=>({score:-Infinity,vertex:-1})));
   for(let vertex=0;vertex<position.count;vertex++){
    let boneIndex=-1,largest=0;
    for(let slot=0;slot<4;slot++){const weight=weights.getComponent(vertex,slot);if(weight>largest){largest=weight;boneIndex=skin.getComponent(vertex,slot);}}
    const candidates=groups.get(boneIndex);if(!candidates)continue;
    point.fromBufferAttribute(position,vertex).applyMatrix4(mesh.bindMatrix).applyMatrix4(mesh.skeleton.boneInverses[boneIndex]);
    for(let direction=0;direction<groundDirections.length;direction++){
     const axis=groundDirections[direction],score=point.x*axis[0]+point.y*axis[1]+point.z*axis[2];
     if(score>candidates[direction].score){candidates[direction].score=score;candidates[direction].vertex=vertex;}
    }
   }
   const unique=new Set();for(const candidates of groups.values())for(const candidate of candidates)if(candidate.vertex>=0)unique.add(candidate.vertex);
   indices=new Uint32Array(unique);groundVertexCache.set(mesh.geometry,indices);
  }
  if(indices.length)samples.push({mesh,indices});
 });
 return samples;
}

function groundCrawlerTransition(root,state,enemy){
 const shot=Math.max(state.attackAction?.getEffectiveWeight()||0,state.hitAction?.getEffectiveWeight()||0),rise=state.grappleRise;
 const bridge=enemy.dead&&state.crawlDeathBridge?.applied;
 const changing=(shot>0&&shot<1)||(rise>0&&rise<1)||bridge;
 state.floorLift=0;
 if(!state.crawlerBlend||!changing||state.revivalPose)return;
 // Quaternion blending sweeps hands/soles in an arc even when both endpoint
 // clips are grounded. Skin support samples are selected once from 26 extreme
 // directions per distal bone; the hot path never scans the complete mesh.
 root.updateMatrixWorld(true);let minimum=Infinity;
 for(const support of state.groundSamples){
  support.mesh.skeleton.update();
  for(const vertex of support.indices){support.mesh.getVertexPosition(vertex,state.groundPoint).applyMatrix4(support.mesh.matrixWorld);minimum=Math.min(minimum,state.groundPoint.y-root.position.y);}
 }
 state.floorLift=Math.min(.24,Math.max(0,.012-minimum));
 state.pivot.position.y+=state.floorLift;
}
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
 const runClip=findClip(clips,AFTERLIFE_ASH_WITNESS_CLIPS.run);
 const crawlClip=findClip(clips,AFTERLIFE_ASH_WITNESS_CLIPS.crawl);
 const crawlIdleClip=findClip(clips,AFTERLIFE_ASH_WITNESS_CLIPS.crawlIdle);
 const contortClip=findClip(clips,AFTERLIFE_ASH_WITNESS_CLIPS.contort);
 const attackClip=findClip(clips,AFTERLIFE_ASH_WITNESS_CLIPS.attack);
 const hitClip=findClip(clips,AFTERLIFE_ASH_WITNESS_CLIPS.hit);
 const collapseClip=findClip(clips,AFTERLIFE_ASH_WITNESS_CLIPS.collapse);
 const idlePhase=actorPhase(seed,11),idleRate=.96+.08*actorPhase(seed,17);
 const actions={};
 if(mixer){
  if(idleClip){actions.idle=mixer.clipAction(idleClip);actions.idle.setLoop(THREE.LoopRepeat,Infinity).setEffectiveWeight(1).setEffectiveTimeScale(idleRate).play();actions.idle.time=idlePhase*idleClip.duration;}
  if(shuffleClip){actions.shuffle=mixer.clipAction(shuffleClip);actions.shuffle.setLoop(THREE.LoopRepeat,Infinity).setEffectiveWeight(0).play();}
  if(chaseClip){actions.chase=mixer.clipAction(chaseClip);actions.chase.setLoop(THREE.LoopRepeat,Infinity).setEffectiveWeight(0).play();}
  if(runClip){actions.run=mixer.clipAction(runClip);actions.run.setLoop(THREE.LoopRepeat,Infinity).setEffectiveWeight(0).play();}
  if(crawlClip){actions.crawl=mixer.clipAction(crawlClip);actions.crawl.setLoop(THREE.LoopRepeat,Infinity).setEffectiveWeight(0).play();}
  if(crawlIdleClip){actions.crawlIdle=mixer.clipAction(crawlIdleClip);actions.crawlIdle.setLoop(THREE.LoopRepeat,Infinity).setEffectiveWeight(0).setEffectiveTimeScale(idleRate).play();actions.crawlIdle.time=idlePhase*crawlIdleClip.duration;}
  if(contortClip){actions.contort=mixer.clipAction(contortClip);actions.contort.setLoop(THREE.LoopRepeat,Infinity).setEffectiveWeight(0).play();actions.contort.paused=true;}
  if(attackClip){actions.attack=mixer.clipAction(attackClip);actions.attack.setLoop(THREE.LoopOnce,1);actions.attack.clampWhenFinished=true;actions.attack.setEffectiveWeight(0);}
  if(hitClip){actions.hit=mixer.clipAction(hitClip);actions.hit.setLoop(THREE.LoopOnce,1);actions.hit.clampWhenFinished=true;actions.hit.setEffectiveWeight(0);}
  if(collapseClip){actions.collapse=mixer.clipAction(collapseClip);actions.collapse.setLoop(THREE.LoopOnce,1);actions.collapse.clampWhenFinished=true;actions.collapse.setEffectiveWeight(0);}
  mixer.update(0);
 }
 const state={
  marker:'afterlife-model',
  sourceTemplate:template,appearance:asset?.appearance||ASH_WITNESS_APPEARANCE,appearancePalette:asset?.appearancePalette||null,preserveAtlasColors:!!asset?.preserveAtlasColors,
  model,pivot,normalizer,warningRing,materials,mixer,actions,clips,articulation:createCharacterArticulation(model),
  articulationContext:{time:0,seed,idlePhase,attackRecovery:null,hitWeight:0},
  kind, seed, last:null, motion:0, deadAt:null, lastPosition:new THREE.Vector3(), hasLastPosition:false,
  attention:{yaw:0,pitch:0,tilt:0,applied:false,
    controls:[['neck',.35],['Head',.65]].map(([name,weight])=>({bone:model.getObjectByName(name),weight,rest:new THREE.Quaternion()})).filter(c=>c.bone),
    world:new THREE.Quaternion(),parent:new THREE.Quaternion(),delta:new THREE.Quaternion(),rotation:new THREE.Quaternion(),
    axisUp:new THREE.Vector3(0,1,0),axisRight:new THREE.Vector3(),axisForward:new THREE.Vector3(),rootRotation:new THREE.Quaternion()},
  sourceHeight:size.y, normalization:scale,
  idleAction:actions.idle||null, shuffleAction:actions.shuffle||null,
  chaseAction:actions.chase||null, chaseBlend:0, gaitPhase:actorPhase(seed,23), gaitDirection:1, turnMotion:0, facingYaw:null,idlePhase,idleRate,
  runAction:actions.run||null,crawlAction:actions.crawl||null,crawlIdleAction:actions.crawlIdle||null,contortAction:actions.contort||null,
  motionClass:'shambler',runBlend:0,crawlerBlend:0,contortBlend:0,grappleRise:0,contortPhase:0,
  locomotionWeights:{idle:1,shuffle:0},gaitActions:[actions.shuffle,actions.chase,actions.run,actions.crawl].filter(Boolean),
  crawlDeathBridge:null,
  groundSamples:groundSamples(model),groundPoint:new THREE.Vector3(),floorLift:0,
  attackAction:actions.attack||null, hitAction:actions.hit||null,
  collapseAction:actions.collapse||null, collapseStarted:false,
  attackActive:false, hitActive:false, attackStartedAt:null, hitStartedAt:null,hitResumeAt:null,attackResumeAt:null,
  // Keep the one-shot readable while preserving a continuous locomotion pose.
  // The values are deliberately short so combat still tracks the simulation.
  shotBlendIn:.085, shotBlendOut:.11, clipBlend:null,
  gaitTransferMeters:ASH_WITNESS_GAIT_TRANSFER_METERS,
  shuffleStride:shuffleClip?.userData?.strideMeters||ASH_WITNESS_GAIT_TRANSFER_METERS,
  chaseStride:chaseClip?.userData?.strideMeters||1.55,
  runStride:runClip?.userData?.strideMeters||1.8,crawlStride:crawlClip?.userData?.strideMeters||.72,
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
 root.userData.appearance=state.appearance;
 root.userData.source=state.appearance!==ASH_WITNESS_APPEARANCE?`meshy-${state.appearance}-canonical-v07`:state.articulation.hasJaw?'meshy-ash-witness-jaw-grip-v05':'meshy-ash-witness-retargeted-v04';
 return root;
}

const setWeights=(state,idleWeight,shuffleWeight,collapseWeight,attackWeight=0,hitWeight=0)=>{
 const low=state.crawlerBlend*(1-state.grappleRise),standing=1-low,runner=state.runBlend;
 if(state.idleAction)state.idleAction.setEffectiveWeight(idleWeight*standing);
 if(state.crawlIdleAction)state.crawlIdleAction.setEffectiveWeight(idleWeight*low*(1-state.contortBlend));
 if(state.contortAction)state.contortAction.setEffectiveWeight(idleWeight*low*state.contortBlend);
 if(state.crawlAction)state.crawlAction.setEffectiveWeight(shuffleWeight*low);
 if(state.shuffleAction)state.shuffleAction.setEffectiveWeight(shuffleWeight*standing*(1-runner)*(1-state.chaseBlend));
 if(state.chaseAction)state.chaseAction.setEffectiveWeight(shuffleWeight*standing*(1-runner)*state.chaseBlend);
 if(state.runAction)state.runAction.setEffectiveWeight(shuffleWeight*standing*runner);
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
 const canMove=state.crawlerBlend?state.crawlAction:state.shuffleAction||state.runAction;
 state.locomotionWeights.idle=canMove?1-shuffleWeight:1;
 state.locomotionWeights.shuffle=canMove?shuffleWeight:0;
 return state.locomotionWeights;
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
 let alpha=Math.min(fadeIn,fadeOut,cancelled)*resume;
 if(key==='attack'&&state.crawlerBlend){
  // Rise with the canonical anticipation instead of popping a crawling body
  // upright in the generic 85ms fade. Contact still owns the exact v06 pose.
  const contact=Math.min(state.attackContact,duration*.45),follow=Math.min(.5,duration*.60);
  const rise=THREE.MathUtils.smoothstep(action.time,0,contact*.88);
  const settle=1-THREE.MathUtils.smoothstep(action.time,follow,duration-.025);
  alpha*=state.attackPhase==='windup'?rise:state.attackPhase==='recovery'?settle:1;
 }
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
function restoreAttention(state){
 const attention=state.attention;if(!attention?.applied)return;
 for(const control of attention.controls)control.bone.quaternion.copy(control.rest);
 attention.applied=false;
}

function applyAttention(root,state,enemy,dt){
 const a=state.attention;
 const locked=enemy.dead||enemy.attacking||enemy.strike>0||enemy.stagger>0||state.attackActive||state.hitActive||['windup','held','terminal'].includes(enemy.bitePhase);
 const gain=1-Math.exp(-dt*7);
 a.yaw+=(THREE.MathUtils.clamp(Number(enemy.look)||0,-.95,.95)-a.yaw)*gain;
 a.pitch+=(THREE.MathUtils.clamp(Number(enemy.lookPitch)||0,-.16,.28)-a.pitch)*gain;
 const tilt=(Number(enemy.noticeStrength)||0)*.075*(actorPhase(state.seed,97)<.5?-1:1);
 a.tilt+=(tilt-a.tilt)*gain;
 // Contacts keep their exact authored pose; attention resumes only after the
 // one-shot releases. World-axis deltas also fit differing Meshy bind bases.
 if(locked||Math.abs(a.yaw)+Math.abs(a.pitch)+Math.abs(a.tilt)<1e-6)return;
 root.updateWorldMatrix(true,true);root.getWorldQuaternion(a.rootRotation);
 a.axisRight.set(1,0,0).applyQuaternion(a.rootRotation);
 a.axisForward.set(0,0,-1).applyQuaternion(a.rootRotation);
 for(const c of a.controls){
  c.rest.copy(c.bone.quaternion);c.bone.getWorldQuaternion(a.world);
  a.delta.setFromAxisAngle(a.axisUp,-a.yaw*c.weight);
  a.rotation.setFromAxisAngle(a.axisRight,a.pitch*c.weight);a.delta.multiply(a.rotation);
  a.rotation.setFromAxisAngle(a.axisForward,a.tilt*c.weight);a.delta.multiply(a.rotation);
  a.world.premultiply(a.delta);c.bone.parent.getWorldQuaternion(a.parent).invert();
  c.bone.quaternion.copy(a.parent.multiply(a.world)).normalize();c.bone.updateWorldMatrix(false,true);
 }
 a.applied=true;
}

export function animateAfterlifeModel(root,enemy={},now=0,seed=0){
 const state=root?.userData?.afterlife;
 if(!state)return false;
 restoreAttention(state);
 // A low corpse begins from the pose that actually died. Restoring the mixer's
 // previous target first also keeps this short bridge stable at paused times.
 const bridge=state.crawlDeathBridge;
 if(bridge?.applied){for(const p of bridge.bones){p.bone.position.copy(p.targetPosition);p.bone.quaternion.copy(p.targetQuaternion);}bridge.applied=false;}
 if(enemy.dead&&!state.collapseStarted&&state.motionClass==='crawler'){
  state.crawlDeathBridge??={bones:[],applied:false};
  const deathPose=state.crawlDeathBridge;
  deathPose.pivotLift=state.pivot.position.y;
  if(!deathPose.bones.length)state.model.traverse(bone=>{if(bone.isBone)deathPose.bones.push({bone,position:bone.position.clone(),quaternion:bone.quaternion.clone(),targetPosition:new THREE.Vector3(),targetQuaternion:new THREE.Quaternion()});});
  for(const p of deathPose.bones){p.position.copy(p.bone.position);p.quaternion.copy(p.bone.quaternion);}
 }
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
 // 'crawl' belongs to amputated support; 'crawler' is the authored, uninjured
 // creature. Older saved enemies/fixture clips fall back to the original gait.
 const requested=enemy.locomotion==='crawler'||(!enemy.locomotion&&enemy.variant==='skitter')?'crawler':enemy.locomotion==='runner'||(!enemy.locomotion&&enemy.variant==='bloodhound')?'runner':'shambler';
 state.motionClass=requested==='crawler'&&state.crawlAction&&state.crawlIdleAction?'crawler':requested==='runner'&&state.runAction?'runner':'shambler';
 state.crawlerBlend=state.motionClass==='crawler'?1:0;
 state.runBlend=state.motionClass==='runner'?THREE.MathUtils.smoothstep(state.motion,.65,1.65):0;
 state.chaseBlend=state.motionClass==='shambler'&&state.chaseAction?THREE.MathUtils.smoothstep(state.motion,1.2,2.5):0;
 const standingStride=THREE.MathUtils.lerp(THREE.MathUtils.lerp(state.shuffleStride,state.chaseStride,state.chaseBlend),state.runStride,state.runBlend);
 const stride=state.crawlerBlend?state.crawlStride:standingStride;
 state.gaitTransferMeters=stride;
 const standingCycle=THREE.MathUtils.lerp(THREE.MathUtils.lerp(state.shuffleAction?.getClip().duration||ASH_WITNESS_GAIT_CYCLE_SECONDS,state.chaseAction?.getClip().duration||ASH_WITNESS_GAIT_CYCLE_SECONDS,state.chaseBlend),state.runAction?.getClip().duration||ASH_WITNESS_GAIT_CYCLE_SECONDS,state.runBlend);
 const cycle=state.crawlerBlend?state.crawlAction.getClip().duration:standingCycle;
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
 for(const action of state.gaitActions){action.paused=true;action.time=state.gaitPhase*action.getClip().duration;}
 const grapple=enemy.bitePhase==='windup'||enemy.bitePhase==='held'||enemy.bitePhase==='terminal';
 const riseTarget=enemy.bitePhase==='windup'?THREE.MathUtils.smoothstep(Number(enemy.biteProgress)||0,0,.78):grapple?1:0;
 state.grappleRise=state.crawlerBlend?(grapple?riseTarget:state.grappleRise*Math.exp(-10*dt)):0;
 const contortDuration=state.contortAction?.getClip().duration||1.8,period=7.1+actorPhase(seed,67)*3.7;
 const contortAge=((now*.001+actorPhase(seed,71)*period)%period+period)%period;
 const contortAllowed=state.crawlerBlend&&state.contortAction&&!combatLock&&!state.hitActive&&state.motion<.1;
 const contortIntent=Number.isFinite(enemy.contortion)?THREE.MathUtils.clamp(enemy.contortion,0,1):actorPhase(seed,73)<.34&&contortAge<contortDuration?Math.sin(Math.PI*contortAge/contortDuration)**2:0;
 const contortTarget=contortAllowed?contortIntent:0;
 state.contortBlend+=(contortTarget-state.contortBlend)*(1-Math.exp(-12*dt));
 if(!state.crawlerBlend)state.contortBlend=0;
 state.contortPhase=(contortAge%contortDuration)/contortDuration;
 if(state.contortAction)state.contortAction.time=state.contortPhase*contortDuration;
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
  if(state.crawlerBlend&&state.authoredFall)state.pivot.position.y=0;
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
 if(enemy.dead&&state.crawlDeathBridge){
  const deathPose=state.crawlDeathBridge,blend=THREE.MathUtils.smoothstep((now-state.deadAt)/1000,.12,.48);
  if(blend<1){
   for(const p of deathPose.bones){p.targetPosition.copy(p.bone.position);p.targetQuaternion.copy(p.bone.quaternion);p.bone.position.lerpVectors(p.position,p.targetPosition,blend);p.bone.quaternion.slerpQuaternions(p.quaternion,p.targetQuaternion,blend);}
   deathPose.applied=true;
   state.pivot.position.y=deathPose.pivotLift*(1-blend);
  }
 }
 if(state.meleeReaction)updateMeleeReaction(state.meleeReaction,enemy,dt,-root.rotation.y-Math.PI/2);
 const attackDuration=state.attackAction?.getClip().duration||1,follow=Math.min(.5,attackDuration*.60);
 const attackRecovery=state.attackActive&&state.attackPhase==='recovery'?THREE.MathUtils.clamp((state.attackAction.time-follow)/Math.max(.001,attackDuration-follow),0,1):null;
 const articulationContext=state.articulationContext;
 articulationContext.time=now*.001;articulationContext.seed=state.seed;
 articulationContext.idlePhase=state.idleAction?state.idleAction.time/state.idleAction.getClip().duration:state.idlePhase;
 articulationContext.attackRecovery=attackRecovery;articulationContext.hitWeight=state.hitActive?state.hitAction?.getEffectiveWeight()||0:0;
 articulationContext.motionClass=state.motionClass;articulationContext.burst=Number(enemy.burst)||0;articulationContext.contortion=state.contortBlend;
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
 groundCrawlerTransition(root,state,enemy);
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
 applyAttention(root,state,enemy,dt);
 return true;
}

export function disposeAfterlifeModel(root){
 const state=root?.userData?.afterlife;
 if(!state)return;
 restoreAttention(state);
 restoreCharacterArticulation(state.articulation);
 if(state.crawlDeathBridge?.applied)for(const p of state.crawlDeathBridge.bones){p.bone.position.copy(p.targetPosition);p.bone.quaternion.copy(p.targetQuaternion);}
 state.mixer?.stopAllAction();
 state.mixer?.uncacheRoot(state.model);
  state.mixer=null;state.actions={};
}
