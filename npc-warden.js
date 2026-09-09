import * as THREE from './vendor/three.module.js';
import {clone} from './vendor/utils/SkeletonUtils.js';
import {applyWardenVariant,resolveWardenVariant} from './enemy-variation.js';

const templateBounds = new WeakMap();
const skinBounds = new WeakMap();

export function createWarden(template,clips=[],kind=0,variant='',seed=0){
 const root=new THREE.Group(),pivot=new THREE.Group(),normalizer=new THREE.Group(),model=clone(template);root.name='EvilWarden';root.add(pivot);pivot.add(normalizer);normalizer.add(model);
 const mixer=clips.length?new THREE.AnimationMixer(model):null;if(mixer){mixer.clipAction(clips[0]).play();mixer.update(0);}
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
 applyWardenVariant(materials,appearance);
 ring.material.color.setHex(appearance.signal);
 root.userData.warden={pivot,normalizer,model,bones,materials,deadAt:null,mixer,clip:clips[0]||null,last:0,sourceHeight:size.y,normalization:scale,kind,ring,lastPosition:null,motion:0,variant:appearance.key,appearance};return root;
}

export function resetWarden(root,variant='',seed=0){
 const w=root?.userData?.warden;if(!w)return root;
 root.visible=true;w.deadAt=null;w.last=0;w.motion=0;w.lastPosition?.set(0,0,0);
 w.pivot.position.set(0,0,0);w.pivot.rotation.set(0,0,0);
 for(const item of w.bones.values()){item.bone.position.copy(item.position);item.bone.quaternion.copy(item.base);}
 if(w.mixer){w.mixer.stopAllAction();if(w.clip)w.mixer.clipAction(w.clip).reset().play();w.mixer.setTime?.(0);}
 const appearance=resolveWardenVariant(w.kind,variant||w.variant,seed);
 w.variant=appearance.key;w.appearance=appearance;applyWardenVariant(w.materials,appearance);w.ring.material.color.setHex(appearance.signal);w.ring.visible=false;
 return root;
}

const q=new THREE.Quaternion(),axis=new THREE.Vector3();
function pose(bones,names,x=0,y=0,z=0){const item=names.map(n=>bones.get(n)).find(Boolean);if(!item)return;item.bone.quaternion.copy(item.base);for(const[a,v]of[[[1,0,0],x],[[0,1,0],y],[[0,0,1],z]]){axis.set(...a);q.setFromAxisAngle(axis,v);item.bone.quaternion.multiply(q);}}
export function animateWarden(root,enemy,now,seed){
 const w=root.userData.warden,t=now*.001,walk=Math.sin(t*7+seed),warning=!!enemy.attacking,attack=warning?1-Math.min(1,(enemy.windup||0)/[.28,.48,.65][w.kind]):Math.min(1,(enemy.strike||0)/.22),hit=Math.min(1,(enemy.flash||0)/.16);
 const requested=enemy.variant||w.variant;
 const appearance=resolveWardenVariant(w.kind,requested,seed);
 if(appearance.key!==w.variant){w.variant=appearance.key;w.appearance=appearance;applyWardenVariant(w.materials,appearance);w.ring.material.color.setHex(appearance.signal);}
 w.ring.visible=warning&&!enemy.dead;w.ring.scale.setScalar(1+attack*.35);
 if(enemy.dead){w.deadAt??=t;const fall=Math.min(1,(t-w.deadAt)*2.8);w.pivot.rotation.x=fall*1.45;w.pivot.position.y=-fall*.35;root.visible=fall<1;return;}
 w.deadAt=null;root.visible=true;w.pivot.rotation.x=.06+hit*.2;w.pivot.position.y=w.kind===1?.08+Math.sin(t*2+seed)*.035:Math.abs(walk)*.015;
 if(w.mixer){const dt=w.last?Math.min(.05,(now-w.last)/1000):.016;w.last=now;const moved=w.lastPosition?Math.hypot(root.position.x-w.lastPosition.x,root.position.z-w.lastPosition.z)/Math.max(.001,dt):0;w.lastPosition??=new THREE.Vector3();w.lastPosition.copy(root.position);w.motion+=(Math.min(3,moved)-w.motion)*Math.min(1,dt*12);w.mixer.update(dt*(warning?.08:Math.max(.06,Math.min(2.4,w.motion*.75))));const hip=w.bones.get('hips');if(hip){hip.bone.position.x=hip.position.x;hip.bone.position.z=hip.position.z;}for(const n of['leftarm','rightarm']){const b=w.bones.get(n);if(b)b.bone.quaternion.multiply(q.setFromAxisAngle(axis.set(1,0,0),-attack*.8));}}else{
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
