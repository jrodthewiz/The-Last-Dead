import {sampleFPSClip} from '../assets/survivor/fps-arms.js';
import * as T from '../vendor/three.module.js';

// These three actions keep the original weapon's moving parts and the same
// articulated support hand. The reload clock is also the ammunition clock.
export function createUtilityReload(group,model,index){
 const arms=group.userData.reloadArm||group,left=arms.userData.authoredFPS.arms.find(a=>a.side==='left'),home=left.grip,socket=new T.Object3D();socket.matrixAutoUpdate=false;model.add(socket);
 const hand=arms.userData.authoredFPS.rig.getObjectByName('FPS_'+arms.userData.authoredFPS.name+'_left_Middle0'),knuckle=left.hand.worldToLocal(hand.getWorldPosition(new T.Vector3()));
 const prop=new T.Group();prop.name=index===0?'Ossuary speedloader':index===2?'Arc replacement cell':'Ripper fuel flask';prop.userData.weaponBatchIgnore=true;model.add(prop);
 const metal=new T.MeshLambertMaterial({color:0x89988a,flatShading:true}),brass=new T.MeshLambertMaterial({color:0xb5a373,flatShading:true}),red=new T.MeshLambertMaterial({color:0x985744,flatShading:true});
 const cylinder=(parent,r,h,mat,x=0,y=0,z=0)=>{const m=new T.Mesh(new T.CylinderGeometry(r,r,h,8),mat);m.rotation.x=Math.PI/2;m.position.set(x,y,z);parent.add(m);return m;};let moving,rest;
 if(index===0){moving=model.userData.ossuary.cylinder;rest=moving.position.clone();cylinder(prop,.15,.045,metal);for(let i=0;i<6;i++){const a=i*Math.PI/3;cylinder(prop,.032,.17,brass,Math.sin(a)*.12,Math.cos(a)*.12,-.07);}}
 if(index===2){moving=model.userData.arc.reactor;rest=moving.position.clone();prop.visible=false;}
 if(index===7){moving=model.getObjectByName('fuel-cap');rest=moving.position.clone();moving.userData.weaponBatchIgnore=true;const body=new T.Mesh(new T.BoxGeometry(.18,.25,.11),red);body.position.set(0,.10,0);prop.add(body);const spout=new T.Mesh(new T.CylinderGeometry(.02,.025,.17,6),brass);spout.rotation.z=-.65;spout.position.set(.04,-.09,0);prop.add(spout);}
 const goal=new T.Matrix4(),inverse=left.offset.clone().invert(),homePoint=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3(),point=new T.Vector3(),offset=new T.Vector3();
 return {prop,moving,update(progress){
  const p=Math.max(0,progress),ease=(a,b)=>T.MathUtils.smoothstep(p,a,b),envelope=ease(.1,.24)*(1-ease(.79,.94));moving.position.copy(rest);prop.visible=false;
  if(index===0){moving.position.x-=envelope*.32;moving.rotation.y=-envelope*.08;prop.visible=p>.3&&p<.76;prop.position.set(-envelope*.32,-.095,.29-ease(.43,.61)*.22+ease(.65,.76)*.24);point.copy(prop.position);point.z+=.07;}
  if(index===2){const lift=(ease(.2,.4)-ease(.53,.72))*.45;moving.position.y+=lift;moving.rotation.z=-Math.sin(p*Math.PI)*.08;point.set(-.12,.18+lift,-.46);}
  if(index===7){const open=ease(.12,.24)*(1-ease(.77,.91));moving.position.z+=open*.12;moving.rotation.z=open*Math.PI*2;prop.visible=p>.28&&p<.78;prop.position.set(.05,.40+.16*(1-ease(.30,.40))+.16*ease(.67,.78),.18);prop.rotation.z=-.55;point.copy(prop.position);point.y+=.12;}
  if(group.userData.reloadArm)arms.visible=progress>=0;if(progress<0){left.grip=home;return;}
  group.updateWorldMatrix(true,true);home.updateWorldMatrix(true,false);goal.multiplyMatrices(home.matrixWorld,left.offset).decompose(homePoint,rotation,scale);model.localToWorld(point);offset.copy(knuckle).multiply(scale).applyQuaternion(rotation);point.sub(offset);point.lerp(homePoint,1-ease(.10,.27)*(1-ease(.78,.95)));goal.compose(point,rotation,scale);socket.matrix.copy(model.matrixWorld).invert().multiply(goal).multiply(inverse);left.grip=socket;if(group.userData.reloadArm)sampleFPSClip(arms,'idle',0);
 }};
}
