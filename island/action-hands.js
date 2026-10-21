import * as T from '../vendor/three.module.js';
import {loadGlb} from '../assets/load-glb.js';
import {installFPSArms,sampleFPSClip} from '../assets/survivor/fps-arms.js';
import {FIRST_PERSON_HOLD_POSES} from '../assets/survivor/viewmodel-hold-poses.js';
import {consoleMaterial} from './retro-materials.js';
import {chestHandPoint,chestTissueState} from '../chest-finisher-visuals.js';
import {CRIMSON} from './close-combat.js';
import {punchMotion,searchLidAngle} from './search-motion.js';

const smooth=(t,a,b)=>T.MathUtils.smoothstep(t,a,b);
export async function createActionHands(camera,source=loadGlb(new URL('../assets/survivor/fps-arms-v5.glb',import.meta.url).href)){
 const root=new T.Group(),group=new T.Group(),model=new T.Group();root.name='Blackwater action hands';camera.add(root);root.add(group);group.add(model);group.userData.model=model;
 const pose=FIRST_PERSON_HOLD_POSES[1];group.position.fromArray(pose.position);group.rotation.fromArray(pose.rotation);group.scale.setScalar(pose.scale);
 const grip=new T.Object3D(),support=new T.Object3D();model.add(grip,support);model.userData.grip=grip;model.userData.supportGrip=support;
 const [asset,anatomy]=await Promise.all([source,loadGlb(new URL('../assets/models/chest-anatomy-v2.glb',import.meta.url).href)]);
 installFPSArms({weaponGroups:[group],fpsSourceIndices:[1],weaponRig:root,camera,_findWeaponSocket:(m,name)=>m.userData[name]},asset);
 const frame=group.userData.authoredFPS,parts=frame.arms.map(a=>{a.grip.matrixAutoUpdate=false;return {...a,inverse:a.offset.clone().invert(),base:camera.getWorldQuaternion(new T.Quaternion()).invert().multiply(a.hand.getWorldQuaternion(new T.Quaternion())),fingerAxis:a.hand.worldToLocal(group.getObjectByName('FPS_breach_'+a.side+'_Middle0').getWorldPosition(new T.Vector3())).normalize()};});
 root.traverse(o=>{o.layers.set(0);if(o.isMesh){o.renderOrder=0;for(const m of(Array.isArray(o.material)?o.material:[o.material])){m.userData.viewmodelDepth=false;consoleMaterial(m);m.color?.setHex(m.userData.surfaceRole==='authored-canvas'?0x91aeb4:0xa29674);}}});
 const blood={value:0},bloodMaterials=new Set();
 function bloodSurface(branch){branch?.traverse(o=>{if(!o.isMesh)return;for(const m of(Array.isArray(o.material)?o.material:[o.material])){
  if(m.userData.surfaceRole!=='authored-glove'||bloodMaterials.has(m))continue;bloodMaterials.add(m);const prior=m.onBeforeCompile,key=m.customProgramCacheKey();
  m.onBeforeCompile=(shader,renderer)=>{prior.call(m,shader,renderer);shader.uniforms.crimsonHandBlood=blood;shader.vertexShader='varying vec3 crimsonGlovePosition;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncrimsonGlovePosition=position;');shader.fragmentShader=`uniform float crimsonHandBlood;varying vec3 crimsonGlovePosition;
float crimsonHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float crimsonNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(crimsonHash(i),crimsonHash(i+vec3(1,0,0)),f.x),mix(crimsonHash(i+vec3(0,1,0)),crimsonHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(crimsonHash(i+vec3(0,0,1)),crimsonHash(i+vec3(1,0,1)),f.x),mix(crimsonHash(i+vec3(0,1,1)),crimsonHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
`+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nvec3 bp=crimsonGlovePosition;float bloodField=crimsonNoise(bp*19.+vec3(4.7,1.3,7.2))*.8+crimsonNoise(bp*47.)*.2;float feather=max(fwidth(bloodField),.018);float smear=smoothstep(.44-feather,.64+feather,bloodField);float fleck=step(.94,crimsonHash(floor(bp*113.)));float bloodMask=max(smear,fleck*.72)*crimsonHandBlood;diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.18,.023,.016),vec3(.31,.038,.024),bloodField),bloodMask);');};
  m.customProgramCacheKey=()=>key+'-crimson-glove-v2';m.needsUpdate=true;
 }});}
 bloodSurface(root);
 const prop=new T.Group();root.add(prop);const bottle=new T.Group(),wrap=new T.Group(),heart=anatomy.scene.getObjectByName('Heart')?.clone(true);prop.add(bottle,wrap);if(heart){prop.add(heart);heart.position.set(0,0,0);heart.scale.setScalar(.8);heart.traverse(o=>{if(o.isMesh){o.material=o.material.clone();consoleMaterial(o.material);}});}
 const glass=new T.MeshLambertMaterial({color:0x52634a,flatShading:true}),paper=new T.MeshLambertMaterial({color:0xd3c89d,flatShading:true}),dark=new T.MeshLambertMaterial({color:0x8b6644,flatShading:true});
 const cylinder=(parent,r1,r2,h,y,mat)=>{const m=new T.Mesh(new T.CylinderGeometry(r1,r2,h,8),mat);m.position.y=y;parent.add(m);return m;};
 cylinder(bottle,.032,.038,.17,0,glass);cylinder(bottle,.014,.032,.05,.11,glass);cylinder(bottle,.014,.014,.065,.165,glass);cylinder(bottle,.017,.017,.012,.203,dark);cylinder(bottle,.033,.038,.085,-.01,paper);
 const label=new T.Mesh(new T.BoxGeometry(.032,.038,.002),dark);label.position.set(0,0,.038);label.rotation.z=Math.PI/4;bottle.add(label);const roll=cylinder(wrap,.036,.036,.07,0,paper);roll.rotation.z=Math.PI/2;const band=new T.Mesh(new T.BoxGeometry(.09,.015,.12),paper);band.position.set(0,-.02,.065);wrap.add(band);
 const point=new T.Vector3(),rightPoint=new T.Vector3(),rotation=new T.Quaternion(),delta=new T.Quaternion(),matrix=new T.Matrix4(),inverseWorld=new T.Matrix4(),scale=new T.Vector3(.56,.56,.56),axis=new T.Vector3(),cameraRotation=new T.Quaternion();root.visible=false;
 const leftBones={};for(const digit of ['Index','Middle','Ring','Little','Thumb'])for(let i=0;i<3;i++)leftBones[digit+i]=group.getObjectByName('FPS_breach_left_'+digit+i);
 const rightBones={};for(const digit of ['Index','Middle','Ring','Little','Thumb'])for(let i=0;i<3;i++)rightBones[digit+i]=group.getObjectByName('FPS_breach_right_'+digit+i);
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),u=new T.Vector3(),v=new T.Vector3(),normal=new T.Vector3(),cross=new T.Vector3(),center=new T.Vector3(),propRotation=new T.Quaternion();
 for(const arm of parts){const bones=arm.side==='right'?rightBones:leftBones;arm.hand.updateWorldMatrix(true,true);const across=arm.hand.worldToLocal(bones.Index0.getWorldPosition(new T.Vector3())).sub(arm.hand.worldToLocal(bones.Little0.getWorldPosition(new T.Vector3()))).normalize(),forward=arm.fingerAxis.clone();across.addScaledVector(forward,-across.dot(forward)).normalize();arm.across=across;arm.palmNormal=new T.Vector3().crossVectors(across,forward).multiplyScalar(arm.side==='right'?-1:1);const local=new T.Matrix4().makeBasis(across,forward,new T.Vector3().crossVectors(across,forward)).invert();arm.openRot={};
  for(const kind of ['shove','vault']){const finger=kind==='shove'?new T.Vector3(arm.side==='right'?.08:-.08,1,-.05).normalize():new T.Vector3(0,0,-1),palm=kind==='shove'?new T.Vector3(0,0,-1):new T.Vector3(0,-1,0),third=palm.multiplyScalar(arm.side==='right'?-1:1),side=new T.Vector3().crossVectors(finger,third).normalize();third.crossVectors(side,finger).normalize();arm.openRot[kind]=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(side,finger,third).multiply(local));}
 }
 const boneRotation=new T.Quaternion(),parentRotation=new T.Quaternion(),handRotation=new T.Quaternion(),jointDirection=new T.Vector3(),desiredDirection=new T.Vector3();
 function openPalm(arm,weight){const bones=arm.side==='right'?rightBones:leftBones;arm.hand.getWorldQuaternion(handRotation);for(const [index,digit]of ['Index','Middle','Ring','Little'].entries())for(let i=0;i<3;i++){const bone=bones[digit+i];bone.getWorldQuaternion(boneRotation);jointDirection.set(0,1,0).applyQuaternion(boneRotation);desiredDirection.copy(arm.fingerAxis).addScaledVector(arm.across,[.12,.025,-.045,-.13][index]).addScaledVector(arm.palmNormal,i*.07).normalize().applyQuaternion(handRotation);delta.setFromUnitVectors(jointDirection,desiredDirection);bone.parent.getWorldQuaternion(parentRotation);boneRotation.copy(parentRotation).invert().multiply(delta).multiply(parentRotation);delta.identity().slerp(boneRotation,weight);bone.quaternion.premultiply(delta);bone.updateWorldMatrix(false,true);}}
 function pointJoint(bone,direction){bone.getWorldQuaternion(boneRotation);jointDirection.set(0,1,0).applyQuaternion(boneRotation);delta.setFromUnitVectors(jointDirection,direction);bone.parent.getWorldQuaternion(parentRotation);boneRotation.copy(parentRotation).invert().multiply(delta).multiply(parentRotation);bone.quaternion.premultiply(boneRotation);bone.updateWorldMatrix(false,true);}
 function closeFist(arm,weight=1){
  const bones=arm.side==='right'?rightBones:leftBones;arm.hand.getWorldQuaternion(handRotation);
  // Solve a closed three-phalange pose from the actual segment lengths. The
  // fingertip lands at the palmar pad, rather than hanging below the palm.
  // Cache the resulting local bone rotations: the wrist/arm solver continues
  // to own the moving fist, without resampling a direction approximation.
  if(arm.closedPose){for(const [bone,q]of arm.closedPose)bone.quaternion.slerp(q,weight);return;}
  const f=arm.fingerAxis,n=arm.palmNormal;
  for(const digit of ['Index','Middle','Ring','Little']){
   const joints=[0,1,2].map(i=>bones[digit+i]),l1=joints[1].position.length(),l2=joints[2].position.length(),l3=l2*.88;
   const pip=new T.Vector2(l1*.42,l1*.9075),tip=new T.Vector2(-l1*.60,l1*.30),line=tip.clone().sub(pip),distance=line.length();line.normalize();
   const along=(l2*l2-l3*l3+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l2*l2-along*along));
   const dip=pip.clone().addScaledVector(line,along).add(new T.Vector2(line.y,-line.x).multiplyScalar(height));
   joints[0].getWorldPosition(a);arm.hand.worldToLocal(a);const origin=a.clone();
   for(const [i,p]of [pip,dip,tip].entries()){
    a.copy(origin).addScaledVector(f,p.x).addScaledVector(n,p.y);arm.hand.localToWorld(a);joints[i].getWorldPosition(b);desiredDirection.subVectors(a,b).normalize();pointJoint(joints[i],desiredDirection);
   }
  }
  // Oppose the thumb outside the folded index/middle pads.
  for(const [i,target]of ['Index1','Middle2','Ring2'].entries()){bones[target].getWorldPosition(a);a.addScaledVector(desiredDirection.copy(n).applyQuaternion(handRotation),.012);bones['Thumb'+i].getWorldPosition(b);desiredDirection.subVectors(a,b).normalize();pointJoint(bones['Thumb'+i],desiredDirection);}
  arm.closedPose=['Index','Middle','Ring','Little','Thumb'].flatMap(digit=>[0,1,2].map(i=>{const bone=bones[digit+i];return[bone,bone.quaternion.clone()];}));
 }
 let lastKind='',age=0;
 return {root,group,parts,prop,heart,bloodSurface,stain(){blood.value=1;},clearBlood(){blood.value=0;},get blood(){return blood.value;},get gaps(){return frame.arms.map(a=>a.gap);},update({action,dt,visible}){
  blood.value=Math.max(0,blood.value-dt*.06);root.visible=visible&&!!action;if(!root.visible){lastKind='';return;}const kind=action.kind;if(kind!==lastKind){age=0;lastKind=kind;}age+=dt;const t=action.time||0,p=t/(action.duration||1),envelope=smooth(p,0,.14)*(1-smooth(p,.8,1));camera.updateWorldMatrix(true,false);camera.getWorldQuaternion(cameraRotation);model.updateWorldMatrix(true,false);inverseWorld.copy(model.matrixWorld).invert();
  for(const arm of parts){const right=arm.side==='right';point.set(right?.25:-.25,-.30,-.55);rotation.copy(cameraRotation).multiply(arm.base);
   if(kind==='punch'){const strike=arm.side===(action.side||'right'),pose=punchMotion(t,strike);point.set((right?1:-1)*pose.x,pose.y,pose.z);rotation.copy(cameraRotation).multiply(arm.openRot.vault);if(strike)rotation.multiply(delta.setFromAxisAngle(axis.set(0,0,1),(right?-1:1)*pose.drive*.10));}
   if(kind==='shove'){const drive=smooth(t,.025,.17)*(1-smooth(t,.17,.44));point.set(right?.22:-.22,-.30+drive*.04,-.48-drive*.62);rotation.slerp(delta.copy(cameraRotation).multiply(arm.openRot.shove),smooth(t,0,.12));}
   if(kind==='vault'){const reach=smooth(p,0,.22)*(1-smooth(p,.35,.57));point.set(right?.25:-.25,-.32-reach*.10,-.48-reach*.28);rotation.slerp(delta.copy(cameraRotation).multiply(arm.openRot.vault),smooth(p,0,.14));}
   if(kind==='heal'){if(action.id==='beer'){point.set(right?.20:-.28,-.38+envelope*(right?.40:.08),-.52+envelope*(right?.17:0));if(right)rotation.multiply(delta.setFromAxisAngle(axis.set(1,0,0),envelope*-.75));}else{point.set(right?.10:-.12,-.28+(right?Math.sin(p*Math.PI*6)*.025:0),-.56+(right?.08:0));}}
   if(kind==='search')point.set(right?.22:-.24,-.32,-.52);
   point.y-=smooth(p,.82,1)*.24;point.applyMatrix4(camera.matrixWorld);if(kind==='shove'&&action.target){const reach=smooth(t,.025,.17)*(1-smooth(t,.17,.44));a.set(right?.16:-.16,0,0).applyQuaternion(cameraRotation).add(action.target);point.lerp(a,reach);}
   if(kind==='vault'){const reach=smooth(p,.02,.18)*(1-smooth(p,.32,.48));a.set(right?.23:-.23,0,0).applyQuaternion(cameraRotation).add(new T.Vector3(action.hand.x,action.hand.y+.04,action.hand.z));point.lerp(a,reach);}
   if(kind==='punch'&&arm.side===(action.side||'right')&&action.target){const weight=punchMotion(t,true).drive;point.lerp(action.target,weight);}
   if(kind==='search'&&action.container){
    const container=action.container,reach=smooth(p,0,.22)*(1-smooth(p,.80,1)),bag=container.kind==='bag',depth=bag?.44:.65,width=bag?.72:1.05,angle=searchLidAngle(t),yaw=container.yaw||0;
    const rummage=right?smooth(p,.60,.71)*(1-smooth(p,.79,.90)):0;
    const lx=right?width*.14:-width*.32,lz=right?T.MathUtils.lerp(-depth/2+Math.cos(angle)*depth,0,rummage):depth*.32;
    const height=right?T.MathUtils.lerp(.49-Math.sin(angle)*depth,.34,rummage):.40;
    a.set(container.x+Math.cos(yaw)*lx+Math.sin(yaw)*lz,container.y+height,container.z-Math.sin(yaw)*lx+Math.cos(yaw)*lz);
    point.lerp(a,reach);
    // Palm faces down onto the lid; preserve finger direction along its edge.
    rotation.slerp(delta.copy(cameraRotation).multiply(arm.openRot.vault),reach);
   }
   if(kind==='crimson'){
    const f=action.frame,hand=chestHandPoint(right?'Right':'Left',t,{contactAt:CRIMSON.contact,extractionAt:CRIMSON.extract+.12,releaseAt:CRIMSON.release,spearDepth:f.depth});if(right){const pull=smooth(t,CRIMSON.extract-.10,CRIMSON.extract+.16);hand.x+=pull*.14;hand.y+=pull*.075;hand.z+=pull*.17;}hand.applyQuaternion(f.rotation).add(f.entry);point.lerp(hand,smooth(t,.08,.23)*(1-smooth(t,CRIMSON.release,CRIMSON.duration)));
    if(right){axis.copy(arm.fingerAxis).applyQuaternion(rotation);delta.setFromUnitVectors(axis,f.front.clone().negate());rotation.premultiply(delta);}
   }
   if(right)rightPoint.copy(point);matrix.compose(point,rotation,scale);arm.grip.matrix.copy(inverseWorld).multiply(matrix).multiply(arm.inverse);
  }
  sampleFPSClip(group,'idle',0);
  const flex=kind==='shove'||kind==='vault'?0:kind==='punch'?.48:kind==='crimson'&&t<CRIMSON.extract?-.48:kind==='heal'&&action.id==='beer'?.20:.08;
  for(const digit of ['Index','Middle','Ring','Little'])for(let i=0;i<3;i++)rightBones[digit+i].quaternion.multiply(delta.setFromAxisAngle(axis.set(1,0,0),flex*[.7,1,.65][i]));
  if(kind==='punch')for(const arm of parts)closeFist(arm);
  if(kind==='crimson')closeFist(parts.find(a=>a.side==='right'),1-smooth(t,CRIMSON.extract-.20,CRIMSON.extract-.05));
  if(kind==='search')for(const arm of parts)openPalm(arm,smooth(p,0,.22)*(1-smooth(p,.80,1)));
  if(kind==='shove'||kind==='vault')for(const arm of parts)openPalm(arm,smooth(t,0,.12));
  group.updateMatrixWorld(true);

  // The held remedy follows the solved palm. It is a world-depth object, like
  // the arms, so the chest can actually occlude the driven hand.
  bottle.visible=kind==='heal'&&action.id==='beer';wrap.visible=kind==='heal'&&action.id!=='beer';if(heart){heart.visible=kind==='crimson'&&t>=CRIMSON.extract&&!action.organReleased&&t<CRIMSON.release+.12;if(heart.visible){const shapes=chestTissueState(t,{contactAt:CRIMSON.contact,extractionAt:CRIMSON.extract,releaseAt:CRIMSON.release});heart.traverse(m=>{if(m.morphTargetDictionary)for(const [name,i]of Object.entries(m.morphTargetDictionary))m.morphTargetInfluences[i]=shapes[name]||0;});}}
  // Fit the bottle into the bent middle finger's contact arc. The cylinder
  // axis runs across the four knuckles, not along the wrist or the camera.
  rightBones.Middle0.getWorldPosition(a);rightBones.Middle1.getWorldPosition(b);rightBones.Middle2.getWorldPosition(c);u.subVectors(b,a);v.subVectors(c,a);normal.crossVectors(u,v);const denominator=2*normal.lengthSq();
  if(denominator>1e-12){center.copy(a).add(cross.crossVectors(v,normal).multiplyScalar(u.lengthSq()/denominator)).add(cross.crossVectors(normal,u).multiplyScalar(v.lengthSq()/denominator));}else center.copy(b);
  rightBones.Index0.getWorldPosition(a);rightBones.Little0.getWorldPosition(c);axis.subVectors(a,c).normalize();propRotation.setFromUnitVectors(new T.Vector3(0,1,0),axis);prop.quaternion.copy(cameraRotation).invert().multiply(propRotation);prop.position.copy(camera.worldToLocal(center));prop.scale.setScalar(kind==='heal'&&action.id==='beer'?.70:1);

 }};
}
