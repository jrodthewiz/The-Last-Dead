import * as THREE from './vendor/three.module.js';
import {clone} from './vendor/utils/SkeletonUtils.js';
export function createWarden(template,clips=[],kind=0){
 const root=new THREE.Group(),pivot=new THREE.Group(),normalizer=new THREE.Group(),model=clone(template);root.name='EvilWarden';root.add(pivot);pivot.add(normalizer);normalizer.add(model);
 const mixer=clips.length?new THREE.AnimationMixer(model):null;if(mixer){mixer.clipAction(clips[0]).play();mixer.update(0);}
 model.updateMatrixWorld(true);model.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();o.computeBoundingBox();}});
 const bounds=new THREE.Box3().setFromObject(model,true),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),scale=[1.95,2.05,2.2][kind]/size.y;
 normalizer.scale.setScalar(scale);normalizer.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);pivot.rotation.y=Math.PI;
 const accent=[0xff4936,0xad7cf5,0xffb152][kind],signalMaterial=new THREE.MeshStandardMaterial({color:accent,emissive:accent,emissiveIntensity:.7,roughness:.3});
 const signal=new THREE.Mesh(new THREE.SphereGeometry(kind===2?.1:.065,10,8),signalMaterial);signal.position.set(0,kind===2?1.34:1.15,.19);pivot.add(signal);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(kind===2?.57:.44,.018,5,28),new THREE.MeshBasicMaterial({color:accent,transparent:true,opacity:.7}));ring.rotation.x=-Math.PI/2;ring.position.y=.028;root.add(ring);ring.visible=false;
 if(kind===1){const halo=new THREE.Mesh(new THREE.TorusGeometry(.43,.025,6,28),signalMaterial);halo.position.set(0,1.55,-.17);pivot.add(halo);for(const side of[-1,1]){const thorn=new THREE.Mesh(new THREE.ConeGeometry(.065,.38,6),signalMaterial);thorn.position.set(side*.4,1.68,-.17);thorn.rotation.z=-side*.4;pivot.add(thorn);}}
 if(kind===2){const armor=new THREE.MeshStandardMaterial({color:0xaaa08a,roughness:.65,metalness:.3});for(const side of[-1,1]){const plate=new THREE.Mesh(new THREE.IcosahedronGeometry(.28,0),armor);plate.scale.set(1.15,.65,.8);plate.position.set(side*.34,1.44,.02);pivot.add(plate);}}
 const bones=new Map(),materials=[];model.traverse(o=>{if(o.isBone)bones.set(o.name.toLowerCase().replace(/[^a-z]/g,''),{bone:o,base:o.quaternion.clone(),position:o.position.clone()});if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;o.material=o.material.clone();o.material.envMapIntensity=.9;o.material.metalness=.06;o.material.roughness=.76;materials.push(o.material);}});
 root.userData.warden={pivot,normalizer,model,bones,materials,deadAt:null,mixer,last:0,sourceHeight:size.y,normalization:scale,kind,signal,ring,lastPosition:null,motion:0};return root;
}

const q=new THREE.Quaternion(),axis=new THREE.Vector3();
function pose(bones,names,x=0,y=0,z=0){const item=names.map(n=>bones.get(n)).find(Boolean);if(!item)return;item.bone.quaternion.copy(item.base);for(const[a,v]of[[[1,0,0],x],[[0,1,0],y],[[0,0,1],z]]){axis.set(...a);q.setFromAxisAngle(axis,v);item.bone.quaternion.multiply(q);}}
export function animateWarden(root,enemy,now,seed){
 const w=root.userData.warden,t=now*.001,walk=Math.sin(t*7+seed),warning=!!enemy.attacking,attack=warning?1-Math.min(1,(enemy.windup||0)/[.28,.48,.65][w.kind]):Math.min(1,(enemy.strike||0)/.22),hit=Math.min(1,(enemy.flash||0)/.16);
 w.ring.visible=warning&&!enemy.dead;w.ring.scale.setScalar(1+attack*.35);w.signal.material.emissiveIntensity=.7+attack*3;
 if(enemy.dead){w.deadAt??=t;const fall=Math.min(1,(t-w.deadAt)*2.8);w.pivot.rotation.x=fall*1.45;w.pivot.position.y=-fall*.35;root.visible=fall<1;return;}
 w.deadAt=null;root.visible=true;w.pivot.rotation.x=.06+hit*.2;w.pivot.position.y=w.kind===1?.08+Math.sin(t*2+seed)*.035:Math.abs(walk)*.015;
 if(w.mixer){const dt=w.last?Math.min(.05,(now-w.last)/1000):.016;w.last=now;const moved=w.lastPosition?Math.hypot(root.position.x-w.lastPosition.x,root.position.z-w.lastPosition.z)/Math.max(.001,dt):0;w.lastPosition??=new THREE.Vector3();w.lastPosition.copy(root.position);w.motion+=(Math.min(3,moved)-w.motion)*Math.min(1,dt*12);w.mixer.update(dt*(warning?.08:Math.max(.06,Math.min(2.4,w.motion*.75))));const hip=w.bones.get('hips');if(hip){hip.bone.position.x=hip.position.x;hip.bone.position.z=hip.position.z;}for(const n of['leftarm','rightarm']){const b=w.bones.get(n);if(b)b.bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-attack*.8));}}else{
 pose(w.bones,['hips'],0,Math.sin(t*3.5+seed)*.06,0);
 pose(w.bones,['spine','spine01'],.08+Math.sin(t*1.9)*.025,0,0);
 pose(w.bones,['head'],Math.sin(t*1.7)*.07,-Math.sin(t*1.2+seed)*.08,.05);
 pose(w.bones,['leftarm','leftupperarm'],walk*.22-attack*.75,0,-1.25+attack*.8);
 pose(w.bones,['rightarm','rightupperarm'],-walk*.22-attack*.75,0,1.25-attack*.8);
 pose(w.bones,['leftforearm','leftlowerarm'],-.2-attack*.7,0,0);pose(w.bones,['rightforearm','rightlowerarm'],-.2-attack*.7,0,0);
 pose(w.bones,['leftupleg','leftupperleg'],walk*.34,0,0);pose(w.bones,['rightupleg','rightupperleg'],-walk*.34,0,0);
 pose(w.bones,['leftleg','leftlowerleg'],Math.max(0,-walk)*.4,0,0);pose(w.bones,['rightleg','rightlowerleg'],Math.max(0,walk)*.4,0,0);
 }
 for(const m of w.materials){if(!m.emissive)continue;m.emissive.setRGB(.2+hit*.65,.2+hit*.14,.2+hit*.1);m.emissiveIntensity=1;}
}
