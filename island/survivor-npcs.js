import * as T from '../vendor/three.module.js';
import {createMeshySurvivor} from '../assets/survivor/meshy-survivor.js';
import {stylizeModel,consoleMaterial} from './retro-materials.js';
import {dressSurvivor} from './character-craft.js';
import {SURVIVORS} from './survivor-roles.js';
import {groundHeight} from './data.js';
import {supportHeight} from './simulation.js';

// Metres, +Y up. The imported survivor looks down local -Z. Fixed stations
// own translation; the mixer owns the base pose, followed by bounded work IK.
export function createSurvivorNPCs(scene,gltf,data){
 const people=[],colliders=[];
 for(const definition of SURVIVORS){
  const actor=createMeshySurvivor(gltf.scene,gltf.animations);stylizeModel(actor);dressSurvivor(actor,{operator:true,palette:definition.palette});
  const bounds=new T.Box3().setFromObject(actor),scale=(definition.id==='mara'?1.72:1.81)/(bounds.max.y-bounds.min.y),floor=supportHeight(data,definition.x,definition.z);
  actor.scale.setScalar(scale);actor.position.set(definition.x,floor-bounds.min.y*scale,definition.z);actor.rotation.y=definition.yaw;actor.name=definition.name;scene.add(actor);actor.updateMatrixWorld(true);
  const s=actor.userData,b=s.bones,rest=[b.LeftArm,b.LeftForeArm,b.LeftHand,b.RightArm,b.RightForeArm,b.RightHand,b.Head,b.Spine02].map(bone=>({bone,q:bone.quaternion.clone()}));
  const prop=new T.Group();prop.name=definition.id==='mara'?'Boatwright hand plane':'Folded clinic cloth';const mat=consoleMaterial(new T.MeshLambertMaterial({color:definition.id==='mara'?0x81765c:0xc9c7ac,flatShading:true})),dark=consoleMaterial(new T.MeshLambertMaterial({color:0x465a54,flatShading:true}));
  const mesh=new T.Mesh(new T.BoxGeometry(definition.id==='mara'?.14:.18,.045,definition.id==='mara'?.29:.22),mat);prop.add(mesh);
  if(definition.id==='mara'){const knob=new T.Mesh(new T.CylinderGeometry(.025,.03,.08,6),dark);knob.position.set(0,.06,-.075);prop.add(knob);const iron=new T.Mesh(new T.BoxGeometry(.09,.08,.045),dark);iron.position.set(0,.04,.055);iron.rotation.x=-.25;prop.add(iron);}
  scene.add(prop);
  const person={...definition,actor,prop,floor,rest,time:definition.id==='mara'?0:2.4,attention:0,activity:'working',soles:[],arms:[]};
  s.body.skeleton.update();const p=new T.Vector3(),positions=s.body.geometry.attributes.position;
  for(let i=0;i<positions.count;i++){s.body.getVertexPosition(i,p).applyMatrix4(s.body.matrixWorld);if(p.y<floor+.07)person.soles.push(i);}
  const stride=Math.max(1,Math.floor(person.soles.length/64));person.soles=person.soles.filter((_,i)=>i%stride===0);
  for(const side of ['Left','Right']){const hand=b[side+'Hand'],palm=new T.Vector3(),sample=new T.Vector3(),a=s.arms,indices=a.geometry.attributes.skinIndex,weights=a.geometry.attributes.skinWeight;let total=0;
   for(let i=0;i<a.geometry.attributes.position.count;i++){let w=0;for(let j=0;j<4;j++)if(a.skeleton.bones[indices.getComponent(i,j)]===hand)w+=weights.getComponent(i,j);if(w<.7)continue;a.getVertexPosition(i,sample).applyMatrix4(a.matrixWorld);palm.addScaledVector(sample,w);total+=w;}
   if(total)palm.multiplyScalar(1/total);else hand.getWorldPosition(palm);hand.worldToLocal(palm);
   person.arms.push({side,upper:b[side+'Arm'],lower:b[side+'ForeArm'],hand,palm,base:new T.Quaternion(),target:new T.Vector3(),restPalm:new T.Vector3()});
  }
  colliders.push({id:'survivor-'+definition.id,x:definition.x,z:definition.z,w:.65,d:.65,y:floor,h:1.8});people.push(person);
 }
 const a=new T.Vector3(),c=new T.Vector3(),h=new T.Vector3(),axis=new T.Vector3(),pole=new T.Vector3(),elbow=new T.Vector3(),from=new T.Vector3(),to=new T.Vector3(),point=new T.Vector3(),q=new T.Quaternion(),parent=new T.Quaternion(),inverse=new T.Quaternion();
 const turn=(bone,u,v)=>{q.setFromUnitVectors(u.normalize(),v.normalize());bone.parent.getWorldQuaternion(parent);inverse.copy(parent).invert();q.premultiply(inverse).multiply(parent).multiply(bone.quaternion);bone.quaternion.copy(q);bone.updateWorldMatrix(true,true);};
 function update(dt,state,camera){for(const n of people){
  const actor=n.actor,s=actor.userData,b=s.bones;actor.visible=camera.distanceToSquared(actor.position)<125**2;n.prop.visible=actor.visible;if(!actor.visible)continue;
  for(const r of n.rest)r.bone.quaternion.copy(r.q);s.mixer.update(dt);for(const r of n.rest)r.q.copy(r.bone.quaternion);
  const near=Math.hypot(state.x-n.x,state.z-n.z)<3.3&&Math.abs(state.y-n.floor)<2;n.attention=T.MathUtils.damp(n.attention,near?1:0,4,dt);n.time+=dt*(1-n.attention);n.activity=n.attention>.8?'listening':'working';
  // Work pauses before attention turns; feet and hips keep their planted stance.
  const facing=Math.atan2(state.x-n.x,state.z-n.z)+Math.PI-n.yaw,look=Math.atan2(Math.sin(facing),Math.cos(facing));b.Head.rotation.y+=T.MathUtils.clamp(look,-.65,.65)*n.attention;b.Head.rotation.x+=.13*(1-n.attention);b.Spine02.rotation.x+=.075*(1-n.attention);
  actor.updateMatrixWorld(true);s.body.skeleton.update();let low=Infinity;for(const index of n.soles){s.body.getVertexPosition(index,point).applyMatrix4(s.body.matrixWorld);low=Math.min(low,point.y);}if(Number.isFinite(low))actor.position.y+=n.floor-low;actor.updateMatrixWorld(true);
  const cycle=(n.time%6.4),stroke=Math.sin(cycle*3.8)*(1-T.MathUtils.smoothstep(cycle,4,4.5)),work=1-T.MathUtils.smoothstep(cycle,4.5,5.1)+T.MathUtils.smoothstep(cycle,5.8,6.4);n.workWeight=work*(1-n.attention*.9);n.activity=n.attention>.8?'listening':work<.1?'resting':'working';
  for(const arm of n.arms){
   arm.hand.getWorldQuaternion(arm.base);arm.restPalm.copy(arm.palm);arm.hand.localToWorld(arm.restPalm);
   const right=arm.side==='Right';
   if(n.id==='mara')arm.target.set(n.x+(right?-.19+stroke*.18:.28),groundHeight(-541,175)+(right?1.19:1.16),175.3);
   else arm.target.set(953.03+(right?stroke*.05:0),15.28,-301+(right?.23:-.3));
   const blend=work*(1-n.attention*.9);arm.target.lerp(arm.restPalm,1-blend);
   // Target the palm centre, preserving the imported wrist orientation. The
   // hand-carried tool follows this contact point, never an unrelated sine.
   arm.hand.getWorldPosition(h);point.copy(arm.restPalm).sub(h);arm.target.sub(point);
   arm.upper.getWorldPosition(a);arm.lower.getWorldPosition(c);arm.hand.getWorldPosition(h);const l1=a.distanceTo(c),l2=c.distanceTo(h),distance=T.MathUtils.clamp(a.distanceTo(arm.target),Math.abs(l1-l2)+.001,l1+l2-.001);axis.copy(arm.target).sub(a).normalize();pole.set(right?-.5:.5,-.4,.25).applyAxisAngle(T.Object3D.DEFAULT_UP,n.yaw);pole.addScaledVector(axis,-pole.dot(axis)).normalize();const along=(l1*l1-l2*l2+distance*distance)/(2*distance);elbow.copy(a).addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,l1*l1-along*along)));
   turn(arm.upper,from.copy(c).sub(a),to.copy(elbow).sub(a));arm.lower.getWorldPosition(c);arm.hand.getWorldPosition(h);turn(arm.lower,from.copy(h).sub(c),to.copy(arm.target).sub(c));arm.hand.parent.getWorldQuaternion(parent).invert();arm.hand.quaternion.copy(parent.multiply(arm.base));arm.hand.updateWorldMatrix(true,true);
   if(right){n.prop.position.copy(arm.palm);arm.hand.localToWorld(n.prop.position);n.prop.position.y-=.045;n.prop.rotation.set(0,n.id==='mara'?Math.PI/2:n.yaw,0);}
  }
 }}
 return {people,colliders,update};
}
