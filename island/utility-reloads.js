import {sampleFPSClip} from '../assets/survivor/fps-arms.js';
import * as T from '../vendor/three.module.js';

// These three actions keep the original weapon's moving parts and the same
// articulated support hand. The reload clock is also the ammunition clock.
export function createUtilityReload(group,model,index){
 const arms=group.userData.reloadArm||group,left=arms.userData.authoredFPS.arms.find(a=>a.side==='left'),home=left.grip,socket=new T.Object3D();socket.matrixAutoUpdate=false;model.add(socket);
 const hand=arms.userData.authoredFPS.rig.getObjectByName('FPS_'+arms.userData.authoredFPS.name+'_left_Middle0'),knuckle=left.hand.worldToLocal(hand.getWorldPosition(new T.Vector3()));
 const prop=new T.Group();prop.name=index===0?'Ossuary speedloader':index===2?'Arc replacement cell':'Ripper fuel flask';prop.userData.weaponBatchIgnore=true;model.add(prop);
 const metal=new T.MeshLambertMaterial({color:0x89988a,flatShading:true}),brass=new T.MeshLambertMaterial({color:0xb5a373,flatShading:true}),red=new T.MeshLambertMaterial({color:0x985744,flatShading:true});
 const cartridges=[],cylinder=(parent,r,h,mat,x=0,y=0,z=0)=>{const m=new T.Mesh(new T.CylinderGeometry(r,r,h,8),mat);m.rotation.x=Math.PI/2;m.position.set(x,y,z);parent.add(m);return m;};let moving,rest;
 if(index===0){moving=model.userData.ossuary.cylinder;rest=moving.position.clone();cylinder(prop,.15,.045,metal);for(let i=0;i<6;i++){const a=i*Math.PI/3;cartridges.push(cylinder(prop,.032,.17,brass,Math.sin(a)*.12,Math.cos(a)*.12,-.07));}}
 if(index===2){moving=model.userData.arc.reactor;rest=moving.position.clone();prop.visible=false;}
 if(index===7){moving=model.getObjectByName('fuel-cap');moving.position.set(-.16,.333,.06);moving.rotation.set(0,0,0);rest=moving.position.clone();const neck=new T.Mesh(new T.CylinderGeometry(.055,.063,.09,8,1,true),metal),mouth=new T.Mesh(new T.CylinderGeometry(.046,.046,.009,8),new T.MeshLambertMaterial({color:0x26352d,flatShading:true}));neck.position.set(-.16,.278,.06);mouth.position.set(-.16,.322,.06);moving.parent.add(neck,mouth);moving.userData.weaponBatchIgnore=true;const body=new T.Mesh(new T.BoxGeometry(.18,.25,.11),red);body.position.set(0,.10,0);prop.add(body);const spout=new T.Mesh(new T.CylinderGeometry(.02,.025,.17,6),brass);spout.rotation.z=-.65;spout.position.set(.04,-.09,0);prop.add(spout);}
 const goal=new T.Matrix4(),inverse=left.offset.clone().invert(),homePoint=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3(),point=new T.Vector3(),offset=new T.Vector3(),outlet=new T.Vector3(-.0114,-.1577,0),pourCenter=new T.Vector3();
 return {prop,moving,cartridges,update(progress,count=6){
  const p=Math.max(0,progress),ease=(a,b)=>T.MathUtils.smoothstep(p,a,b),envelope=ease(.1,.24)*(1-ease(.79,.94));moving.position.copy(rest);prop.visible=false;
  if(index===0){cartridges.forEach((round,i)=>round.visible=i<count);moving.position.x-=envelope*.32;moving.rotation.y=-envelope*.08;prop.visible=p>.3&&p<.76;prop.position.set(-envelope*.32,-.095,.29-ease(.43,.61)*.22+ease(.65,.76)*.24);point.copy(prop.position);point.z+=.07;}
  if(index===2){const lift=(ease(.2,.4)-ease(.53,.72))*.45;moving.position.y+=lift;moving.rotation.z=-Math.sin(p*Math.PI)*.08;point.set(-.12,.18+lift,-.46);}
  if(index===7){const open=ease(.12,.24)*(1-ease(.77,.91));moving.position.y+=open*.10;moving.position.x-=open*.14;moving.rotation.y=open*Math.PI*2;prop.visible=p>.28&&p<.78;prop.rotation.set(0,0,.65);moving.parent.updateWorldMatrix(true,false);pourCenter.copy(rest);moving.parent.localToWorld(pourCenter);model.worldToLocal(pourCenter);pourCenter.y+=.015;prop.position.copy(pourCenter).sub(offset.copy(outlet).applyQuaternion(prop.quaternion));prop.position.y+=.12*(1-ease(.30,.40))+.12*ease(.67,.78);prop.updateMatrix();point.set(-.04,.09,.055).applyMatrix4(prop.matrix);}
  if(group.userData.reloadArm)arms.visible=progress>=0;if(progress<0){left.grip=home;return;}
  group.updateWorldMatrix(true,true);home.updateWorldMatrix(true,false);goal.multiplyMatrices(home.matrixWorld,left.offset).decompose(homePoint,rotation,scale);model.localToWorld(point);offset.copy(knuckle).multiply(scale).applyQuaternion(rotation);point.sub(offset);point.lerp(homePoint,1-ease(.10,.27)*(1-ease(.78,.95)));goal.compose(point,rotation,scale);socket.matrix.copy(model.matrixWorld).invert().multiply(goal).multiply(inverse);left.grip=socket;if(group.userData.reloadArm)sampleFPSClip(arms,'idle',0);
 }};
}
