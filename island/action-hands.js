import * as T from '../vendor/three.module.js';
import {loadGlb} from '../assets/load-glb.js';
import {installFPSArms,sampleFPSClip} from '../assets/survivor/fps-arms.js';
import {FIRST_PERSON_HOLD_POSES} from '../assets/survivor/viewmodel-hold-poses.js';
import {consoleMaterial} from './retro-materials.js';
import {chestHandPoint,chestTissueState} from '../chest-finisher-visuals.js';
import {CRIMSON} from './close-combat.js';

const smooth=(t,a,b)=>T.MathUtils.smoothstep(t,a,b);
export async function createActionHands(camera,source=loadGlb(new URL('../assets/survivor/fps-arms-v5.glb',import.meta.url).href)){
 const root=new T.Group(),group=new T.Group(),model=new T.Group();root.name='Blackwater action hands';camera.add(root);root.add(group);group.add(model);group.userData.model=model;
 const pose=FIRST_PERSON_HOLD_POSES[1];group.position.fromArray(pose.position);group.rotation.fromArray(pose.rotation);group.scale.setScalar(pose.scale);
 const grip=new T.Object3D(),support=new T.Object3D();model.add(grip,support);model.userData.grip=grip;model.userData.supportGrip=support;
 const [asset,anatomy]=await Promise.all([source,loadGlb(new URL('../assets/models/chest-anatomy-v2.glb',import.meta.url).href)]);
 installFPSArms({weaponGroups:[group],fpsSourceIndices:[1],weaponRig:root,camera,_findWeaponSocket:(m,name)=>m.userData[name]},asset);
 const frame=group.userData.authoredFPS,parts=frame.arms.map(a=>{a.grip.matrixAutoUpdate=false;return {...a,inverse:a.offset.clone().invert(),base:camera.getWorldQuaternion(new T.Quaternion()).invert().multiply(a.hand.getWorldQuaternion(new T.Quaternion())),fingerAxis:a.hand.worldToLocal(group.getObjectByName('FPS_breach_'+a.side+'_Middle0').getWorldPosition(new T.Vector3())).normalize()};});
 root.traverse(o=>{o.layers.set(0);if(o.isMesh){o.renderOrder=0;for(const m of(Array.isArray(o.material)?o.material:[o.material])){m.userData.viewmodelDepth=false;consoleMaterial(m);m.color?.setHex(m.userData.surfaceRole==='authored-canvas'?0x91aeb4:0xa29674);}}});
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
 let lastKind='',age=0;
 return {root,group,parts,prop,get gaps(){return frame.arms.map(a=>a.gap);},update({action,dt,visible}){
  root.visible=visible&&!!action;if(!root.visible){lastKind='';return;}const kind=action.kind;if(kind!==lastKind){age=0;lastKind=kind;}age+=dt;const t=action.time||0,p=t/(action.duration||1),envelope=smooth(p,0,.14)*(1-smooth(p,.8,1));camera.updateWorldMatrix(true,false);camera.getWorldQuaternion(cameraRotation);model.updateWorldMatrix(true,false);inverseWorld.copy(model.matrixWorld).invert();
  for(const arm of parts){const right=arm.side==='right';point.set(right?.25:-.25,-.30,-.55);rotation.copy(cameraRotation).multiply(arm.base);
   if(kind==='punch'){const drive=smooth(t,.06,.19)*(1-smooth(t,.25,.54));point.set(right?.23-drive*.16:-.23,-.28+drive*.14,-.48-drive*.65);}
   if(kind==='shove'){const drive=smooth(t,.025,.17)*(1-smooth(t,.17,.44));point.set(right?.22:-.22,-.30+drive*.04,-.48-drive*.62);rotation.slerp(delta.copy(cameraRotation).multiply(arm.openRot.shove),smooth(t,0,.12));}
   if(kind==='vault'){const reach=smooth(p,0,.22)*(1-smooth(p,.35,.57));point.set(right?.25:-.25,-.32-reach*.10,-.48-reach*.28);rotation.slerp(delta.copy(cameraRotation).multiply(arm.openRot.vault),smooth(p,0,.14));}
   if(kind==='heal'){if(action.id==='beer'){point.set(right?.20:-.28,-.38+envelope*(right?.40:.08),-.52+envelope*(right?.17:0));if(right)rotation.multiply(delta.setFromAxisAngle(axis.set(1,0,0),envelope*-.75));}else{point.set(right?.10:-.12,-.28+(right?Math.sin(p*Math.PI*6)*.025:0),-.56+(right?.08:0));}}
   if(kind==='search')point.set(right?.22:-.24,-.38+Math.sin(t*10+(right?0:Math.PI))*.045,-.64-Math.sin(t*5+(right?0:Math.PI))*.12);
   point.y-=smooth(p,.82,1)*.24;point.applyMatrix4(camera.matrixWorld);if(kind==='shove'&&action.target){const reach=smooth(t,.025,.17)*(1-smooth(t,.17,.44));a.set(right?.16:-.16,0,0).applyQuaternion(cameraRotation).add(action.target);point.lerp(a,reach);}
   if(kind==='vault'){const reach=smooth(p,.02,.18)*(1-smooth(p,.32,.48));a.set(right?.23:-.23,0,0).applyQuaternion(cameraRotation).add(new T.Vector3(action.hand.x,action.hand.y+.04,action.hand.z));point.lerp(a,reach);}
   if(kind==='punch'&&right&&action.target){const weight=smooth(t,.06,.19)*(1-smooth(t,.25,.54));point.lerp(action.target,weight);}
   if(kind==='crimson'){
    const f=action.frame,hand=chestHandPoint(right?'Right':'Left',t,{contactAt:CRIMSON.contact,extractionAt:CRIMSON.extract,releaseAt:CRIMSON.release,spearDepth:f.depth});hand.applyQuaternion(f.rotation).add(f.entry);point.lerp(hand,smooth(t,0,.13)*(1-smooth(t,CRIMSON.release,CRIMSON.duration)));
    if(right){axis.copy(arm.fingerAxis).applyQuaternion(rotation);delta.setFromUnitVectors(axis,f.front.clone().negate());rotation.premultiply(delta);}
   }
   if(right)rightPoint.copy(point);matrix.compose(point,rotation,scale);arm.grip.matrix.copy(inverseWorld).multiply(matrix).multiply(arm.inverse);
  }
  sampleFPSClip(group,'idle',0);
  const flex=kind==='shove'||kind==='vault'?0:kind==='punch'?.48:kind==='crimson'&&t<CRIMSON.extract?-.48:kind==='heal'&&action.id==='beer'?.20:.08;
  for(const digit of ['Index','Middle','Ring','Little'])for(let i=0;i<3;i++)rightBones[digit+i].quaternion.multiply(delta.setFromAxisAngle(axis.set(1,0,0),flex*[.7,1,.65][i]));
  if(kind==='shove'||kind==='vault')for(const arm of parts)openPalm(arm,smooth(t,0,.12));
  group.updateMatrixWorld(true);

  // The held remedy follows the solved palm. It is a world-depth object, like
  // the arms, so the chest can actually occlude the driven hand.
  bottle.visible=kind==='heal'&&action.id==='beer';wrap.visible=kind==='heal'&&action.id!=='beer';if(heart){heart.visible=kind==='crimson'&&t>=CRIMSON.extract&&t<CRIMSON.release+.12;if(heart.visible){const shapes=chestTissueState(t);heart.traverse(m=>{if(m.morphTargetDictionary)for(const [name,i]of Object.entries(m.morphTargetDictionary))m.morphTargetInfluences[i]=shapes[name]||0;});}}
  // Fit the bottle into the bent middle finger's contact arc. The cylinder
  // axis runs across the four knuckles, not along the wrist or the camera.
  rightBones.Middle0.getWorldPosition(a);rightBones.Middle1.getWorldPosition(b);rightBones.Middle2.getWorldPosition(c);u.subVectors(b,a);v.subVectors(c,a);normal.crossVectors(u,v);const denominator=2*normal.lengthSq();
  if(denominator>1e-12){center.copy(a).add(cross.crossVectors(v,normal).multiplyScalar(u.lengthSq()/denominator)).add(cross.crossVectors(normal,u).multiplyScalar(v.lengthSq()/denominator));}else center.copy(b);
  rightBones.Index0.getWorldPosition(a);rightBones.Little0.getWorldPosition(c);axis.subVectors(a,c).normalize();propRotation.setFromUnitVectors(new T.Vector3(0,1,0),axis);prop.quaternion.copy(cameraRotation).invert().multiply(propRotation);prop.position.copy(camera.worldToLocal(center));prop.scale.setScalar(kind==='heal'&&action.id==='beer'?.70:1);

 }};
}
