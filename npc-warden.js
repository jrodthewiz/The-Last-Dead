import * as THREE from './vendor/three.module.js';
import {clone} from './vendor/utils/SkeletonUtils.js';
import {applyWardenVariant,resolveWardenVariant} from './enemy-variation.js';

const templateBounds = new WeakMap();
const skinBounds = new WeakMap();

export function createWarden(template,clips=[],kind=0,variant='',seed=0){
 const root=new THREE.Group(),pivot=new THREE.Group(),normalizer=new THREE.Group(),model=clone(template);root.name='EvilWarden';root.add(pivot);pivot.add(normalizer);normalizer.add(model);
 const findClip=pattern=>clips.find(clip=>pattern.test(clip.name||''))||null;
 const walkClip=findClip(/^TLD_Walk$/i)||findClip(/walk/i);
 const idleClip=findClip(/^TLD_Idle$/i)||findClip(/idle/i)||findClip(/clip0/i)||(walkClip?null:clips[0]||null);
 const combatClips={windup:findClip(/^TLD_Windup$/i),strike:findClip(/^TLD_Strike$/i),hit:findClip(/^TLD_Hit$/i),collapse:findClip(/^TLD_Collapse$/i)};
 const mixer=clips.length?new THREE.AnimationMixer(model):null,actions={};
 if(mixer){
  if(idleClip){actions.idle=mixer.clipAction(idleClip);actions.idle.setEffectiveWeight(1);actions.idle.play();}
  if(walkClip&&walkClip!==idleClip){actions.walk=mixer.clipAction(walkClip);actions.walk.setEffectiveWeight(idleClip?0:1);actions.walk.play();}
  for(const [name,clip] of Object.entries(combatClips))if(clip){const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.setEffectiveWeight(0);action.play();action.paused=true;actions[name]=action;}
  mixer.update(0);
 }
 // Clones start in the same animation pose. Reuse its bounds for normalization
 // and render sorting; frustum culling is disabled for these animated meshes.
 model.updateMatrixWorld(true);
 model.traverse(o=>{if(o.isSkinnedMesh){
  let cached=skinBounds.get(o.geometry);
  if(!cached){o.skeleton.update();o.computeBoundingBox();o.computeBoundingSphere();cached={box:o.boundingBox.clone(),sphere:o.boundingSphere.clone()};skinBounds.set(o.geometry,cached);}
  o.boundingBox=cached.box.clone();o.boundingSphere=cached.sphere.clone();
 }});
 let bounds=templateBounds.get(template);
 if(!bounds){

  bounds=new THREE.Box3().setFromObject(model,true);templateBounds.set(template,bounds);
 }
 const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),scale=[1.95,2.05,2.2][kind]/size.y;
 normalizer.scale.setScalar(scale);normalizer.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);pivot.rotation.y=Math.PI;
 const accent=[0xff4936,0xad7cf5,0xffb152][kind];
 // A restrained ground cue signals windup without wrapping the body in an aura.
 const ring=new THREE.Mesh(new THREE.TorusGeometry(kind===2?.57:.44,.012,5,28),new THREE.MeshBasicMaterial({color:accent,transparent:true,opacity:.28,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.028;root.add(ring);ring.visible=false;
 const bones=new Map(),materials=[];model.traverse(o=>{if(o.isBone)bones.set(o.name.toLowerCase().replace(/[^a-z]/g,''),{bone:o,base:o.quaternion.clone(),position:o.position.clone()});if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;o.material=o.material.clone();o.material.envMapIntensity=.9;materials.push(o.material);}});
 const appearance=resolveWardenVariant(kind,variant,seed);
 const modelScale=appearance.modelScale??1;root.scale.setScalar(modelScale);
 applyWardenVariant(materials,appearance);
 ring.material.color.setHex(appearance.signal);
 root.userData.warden={pivot,normalizer,model,bones,materials,deadAt:null,mixer,actions,idleAction:actions.idle||null,walkAction:actions.walk||null,last:0,sourceHeight:size.y,normalization:scale,kind,ring,lastPosition:null,motion:0,wasWalking:false,modelScale,variant:appearance.key,appearance};return root;
}

export function resetWarden(root,variant='',seed=0){
 const w=root?.userData?.warden;if(!w)return root;
 root.visible=true;w.deadAt=null;w.hitStartedAt=null;w.lastFlash=0;w.last=0;w.motion=0;w.lastPosition=null;
 w.pivot.position.set(0,0,0);w.pivot.rotation.set(0,0,0);
 for(const item of w.bones.values()){item.bone.position.copy(item.position);item.bone.quaternion.copy(item.base);}
 if(w.mixer){w.mixer.stopAllAction();for(const[name,action]of Object.entries(w.actions||{})){action.reset();action.setEffectiveWeight(name==='idle'||!w.idleAction?1:0);action.play();action.paused=!['idle','walk'].includes(name);}w.mixer.setTime?.(0);w.wasWalking=false;}
 const appearance=resolveWardenVariant(w.kind,variant||w.variant,seed);
 w.variant=appearance.key;w.appearance=appearance;w.modelScale=appearance.modelScale??1;root.scale.setScalar(w.modelScale);applyWardenVariant(w.materials,appearance);w.ring.material.color.setHex(appearance.signal);w.ring.visible=false;
 return root;
}

const q=new THREE.Quaternion(),axis=new THREE.Vector3();
function pose(bones,names,x=0,y=0,z=0){const item=names.map(n=>bones.get(n)).find(Boolean);if(!item)return;item.bone.quaternion.copy(item.base);for(const[a,v]of[[[1,0,0],x],[[0,1,0],y],[[0,0,1],z]]){axis.set(...a);q.setFromAxisAngle(axis,v);item.bone.quaternion.multiply(q);}}
function animateAuthoredWarden(root,w,enemy,now){
 const t=now*.001,dt=w.last?Math.min(.05,Math.max(0,(now-w.last)/1000)):.016;w.last=now;
 const moved=w.lastPosition?Math.hypot(root.position.x-w.lastPosition.x,root.position.z-w.lastPosition.z)/Math.max(.001,dt):0;
 w.lastPosition??=new THREE.Vector3();w.lastPosition.copy(root.position);
 w.motion+=(Math.min(3,moved)-w.motion)*Math.min(1,dt*12);
 const flash=Math.max(0,enemy.flash||0);
 if(flash>.001&&!(w.lastFlash>.001))w.hitStartedAt=t;
 w.lastFlash=flash;
 const hitElapsed=w.hitStartedAt==null?Infinity:t-w.hitStartedAt;
 const hitAction=w.actions.hit,hitDuration=hitAction?.getClip().duration||0;
 const hitWeight=hitElapsed<hitDuration?Math.min(1,Math.max(0,(hitDuration-hitElapsed)/.10)):0;
 const windup=!!enemy.attacking&&!!w.actions.windup;
 const strike=!windup&&(enemy.strike||0)>0&&!!w.actions.strike;
 const dead=!!enemy.dead&&!!w.actions.collapse;
 if(dead)w.deadAt??=t;else w.deadAt=null;
 const combatWeight=dead?1:hitWeight?hitWeight:windup||strike?1:0;
 const walkWeight=Math.max(0,Math.min(1,(w.motion-.12)/.72));
 w.actions.idle?.setEffectiveWeight((1-walkWeight)*(1-combatWeight));
 w.actions.walk?.setEffectiveWeight(walkWeight*(1-combatWeight));
 if(w.actions.walk)w.actions.walk.setEffectiveTimeScale(Math.max(.55,Math.min(1.6,w.motion/1.35)));
 const windupAction=w.actions.windup,strikeAction=w.actions.strike,collapseAction=w.actions.collapse;
 if(windupAction){windupAction.time=windup?windupAction.getClip().duration*Math.max(0,Math.min(1,1-(enemy.windup||0)/(enemy.windupTime||.65))):0;windupAction.setEffectiveWeight(windup&&!dead&&!hitWeight?1:0);}
 if(strikeAction){const phase=Math.max(0,Math.min(1,1-(enemy.strike||0)/.24));strikeAction.time=strike?strikeAction.getClip().duration*(.34+phase*.66):0;strikeAction.setEffectiveWeight(strike&&!dead&&!hitWeight?1:0);}
 if(hitAction){hitAction.time=Math.min(hitDuration,Math.max(0,hitElapsed));hitAction.setEffectiveWeight(dead?0:hitWeight);}
 if(collapseAction){collapseAction.time=dead?Math.min(collapseAction.getClip().duration,t-w.deadAt):0;collapseAction.setEffectiveWeight(dead?1:0);}
 w.mixer.update(dt);
 if(dead){const elapsed=t-w.deadAt;w.pivot.rotation.x=Math.min(1,elapsed/1.8)*.08;w.pivot.position.y=-Math.max(0,Math.min(1,(elapsed-.4)/1.4))*.12;root.visible=elapsed<2.3;}
 else{root.visible=true;w.pivot.rotation.x=0;w.pivot.position.y=w.kind===1?.08+Math.sin(t*2)*.025:0;}
 for(const m of w.materials){if(!m.emissive)continue;m.emissive.copy(m.userData.baseEmissive);m.emissive.r+=flash*.65;m.emissive.g+=flash*.14;m.emissive.b+=flash*.1;m.emissiveIntensity=flash>0?Math.max(1,m.userData.baseEmissiveIntensity||0):(m.userData.baseEmissiveIntensity??0);}
}
export function animateWarden(root,enemy,now,seed){
 const w=root.userData.warden,t=now*.001,walk=Math.sin(t*7+seed),warning=!!enemy.attacking,attack=warning?1-Math.min(1,(enemy.windup||0)/[.28,.48,.65][w.kind]):Math.min(1,(enemy.strike||0)/.22),hit=Math.min(1,(enemy.flash||0)/.16);
 const requested=enemy.variant||w.variant;
 const appearance=resolveWardenVariant(w.kind,requested,seed);
 if(appearance.key!==w.variant){w.variant=appearance.key;w.appearance=appearance;w.modelScale=appearance.modelScale??1;root.scale.setScalar(w.modelScale);applyWardenVariant(w.materials,appearance);w.ring.material.color.setHex(appearance.signal);}
 w.ring.visible=warning&&!enemy.dead;w.ring.scale.setScalar(1+attack*.35);
 if(w.actions.windup){animateAuthoredWarden(root,w,enemy,now);return;}
 if(enemy.dead){w.deadAt??=t;const fall=Math.min(1,(t-w.deadAt)*2.8);w.pivot.rotation.x=fall*1.45;w.pivot.position.y=-fall*.35;root.visible=fall<1;return;}
 w.deadAt=null;root.visible=true;w.pivot.rotation.x=.06+hit*.2;w.pivot.position.y=w.kind===1?.08+Math.sin(t*2+seed)*.035:Math.abs(walk)*.015;
 if(w.mixer){const dt=w.last?Math.min(.05,(now-w.last)/1000):.016;w.last=now;const moved=w.lastPosition?Math.hypot(root.position.x-w.lastPosition.x,root.position.z-w.lastPosition.z)/Math.max(.001,dt):0;w.lastPosition??=new THREE.Vector3();w.lastPosition.copy(root.position);w.motion+=(Math.min(3,moved)-w.motion)*Math.min(1,dt*12);const walkWeight=warning?0:Math.max(0,Math.min(1,(w.motion-.12)/.72));if(w.idleAction)w.idleAction.setEffectiveWeight(w.walkAction?1-walkWeight:1);if(w.walkAction){const walking=!!(walkWeight>.08);if(walking&&!w.wasWalking){w.walkAction.reset().play();}w.wasWalking=walking;w.walkAction.setEffectiveWeight(w.idleAction?walkWeight:1);w.walkAction.setEffectiveTimeScale(Math.max(.55,Math.min(1.6,w.motion/1.35)));}w.mixer.update(dt);const hip=w.bones.get('hips');if(hip){hip.bone.position.x=hip.position.x;hip.bone.position.z=hip.position.z;}for(const n of['leftarm','rightarm']){const b=w.bones.get(n);if(b)b.bone.quaternion.multiply(q.setFromAxisAngle(axis.set(1,0,0),-attack*.8));}}else{
 pose(w.bones,['hips'],0,Math.sin(t*3.5+seed)*.06,0);
 pose(w.bones,['spine','spine01'],.08+Math.sin(t*1.9)*.025,0,0);
 pose(w.bones,['head'],Math.sin(t*1.7)*.07,-Math.sin(t*1.2+seed)*.08,.05);
 pose(w.bones,['leftarm','leftupperarm'],walk*.22-attack*.75,0,-1.25+attack*.8);
 pose(w.bones,['rightarm','rightupperarm'],-walk*.22-attack*.75,0,1.25-attack*.8);
 pose(w.bones,['leftforearm','leftlowerarm'],-.2-attack*.7,0,0);pose(w.bones,['rightforearm','rightlowerarm'],-.2-attack*.7,0,0);
 pose(w.bones,['leftupleg','leftupperleg'],walk*.34,0,0);pose(w.bones,['rightupleg','rightupperleg'],-walk*.34,0,0);
 pose(w.bones,['leftleg','leftlowerleg'],Math.max(0,-walk)*.4,0,0);pose(w.bones,['rightleg','rightlowerleg'],Math.max(0,walk)*.4,0,0);
 }
 for(const m of w.materials){if(!m.emissive)continue;m.emissive.copy(m.userData.baseEmissive);m.emissive.r+=hit*.65;m.emissive.g+=hit*.14;m.emissive.b+=hit*.1;m.emissiveIntensity=hit>0?Math.max(1,m.userData.baseEmissiveIntensity||0):(m.userData.baseEmissiveIntensity??0);}
}
