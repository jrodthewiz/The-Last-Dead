import * as T from '../vendor/three.module.js';

// The physical charging knob owns contact. A wrist position at the receiver
// centre cannot describe a grasp, particularly across these two hold families.
export function createRifleReload(group,model,index){
 const meta=model.userData.rifle,magazine=meta.parts[index===4?'curved-magazine':'box-magazine'],left=group.userData.authoredFPS.arms.find(a=>a.side==='left'),home=left.grip,socket=new T.Object3D(),knob=new T.Object3D();socket.matrixAutoUpdate=false;model.add(socket);knob.name=meta.variant+' reload charging contact';const control=index===4?meta.mechanisms.boltHandle:meta.mechanisms.chargingLever;knob.position.set(index===4?.093:.105,0,0);control.add(knob);
 const rig=group.userData.authoredFPS.rig,prefix='FPS_'+group.userData.authoredFPS.name+'_left_',bone=name=>rig.getObjectByName(prefix+name),local=n=>left.hand.worldToLocal(n.getWorldPosition(new T.Vector3()));
 const indexJoint=bone('Index1'),forward=local(bone('Middle1')).sub(local(bone('Middle0'))).normalize(),across=local(bone('Index0')).sub(local(bone('Little0'))).normalize(),normal=new T.Vector3().crossVectors(across,forward).normalize();across.crossVectors(forward,normal).normalize();
 // Close a hook around the knob rather than transporting an open fore-end
 // palm. Rotate around the measured palm-across axis in each parent frame.
 const fingerPoses=[],axis=new T.Vector3(),parentQ=new T.Quaternion(),handQ=new T.Quaternion(),delta=new T.Quaternion(),current=new T.Vector3(),target=new T.Vector3();left.hand.getWorldQuaternion(handQ);axis.copy(across).applyQuaternion(handQ);
 const turn=(joint,angle)=>{const from=joint.quaternion.clone();joint.parent.getWorldQuaternion(parentQ);delta.setFromAxisAngle(current.copy(axis).applyQuaternion(parentQ.invert()),angle);joint.quaternion.premultiply(delta).normalize();joint.updateWorldMatrix(true,true);fingerPoses.push({joint,from,to:joint.quaternion.clone()});};
 for(const name of ['Index','Middle','Ring','Little'])for(const [j,angle]of [[0,.9],[1,.25],[2,.1]])turn(bone(name+j),angle);
 const padOffset=normal.clone().multiplyScalar(index===4?.036:.053),contact=local(indexJoint).add(padOffset);target.copy(contact);left.hand.localToWorld(target);
 for(const [joint,tip]of [[bone('Thumb0'),bone('Thumb2')],[bone('Thumb1'),bone('Thumb2')]]){const from=joint.quaternion.clone(),origin=joint.getWorldPosition(new T.Vector3()),a=tip.getWorldPosition(new T.Vector3()).sub(origin).normalize(),b=target.clone().sub(origin).normalize(),angle=a.angleTo(b);delta.setFromUnitVectors(a,b);if(angle>.75)delta.slerp(new T.Quaternion(),1-.75/angle);joint.parent.getWorldQuaternion(parentQ);joint.quaternion.premultiply(parentQ.clone().invert().multiply(delta).multiply(parentQ)).normalize();joint.updateWorldMatrix(true,true);fingerPoses.push({joint,from,to:joint.quaternion.clone()});}
 for(const f of fingerPoses)f.joint.quaternion.copy(f.from);group.updateWorldMatrix(true,true);
 const sourceBasis=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(across,forward,normal)),targetBasis=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(-.714142843,0,-.7),new T.Vector3(.7,0,-.714142843),new T.Vector3(0,-1,0))),grasp=targetBasis.multiply(sourceBasis.invert());
 const homeMatrix=new T.Matrix4(),goal=new T.Matrix4(),inverse=left.offset.clone().invert(),localMatrix=new T.Matrix4(),point=new T.Vector3(),homePoint=new T.Vector3(),rotation=new T.Quaternion(),graspRotation=new T.Quaternion(),modelRotation=new T.Quaternion(),scale=new T.Vector3(),offset=new T.Vector3(),position=magazine.position.clone(),magazineRotation=magazine.quaternion.clone();
 const state={knob,contact,left,engaged:0,grasp:0,gap:0,pull:0,point:new T.Vector3()};model.userData.reloadContact=state;group.userData.authoredFPS.beforeSeat=()=>{if(state.grasp>0)for(const f of fingerPoses)f.joint.quaternion.slerp(f.to,state.grasp);};
 return {state,update(progress){
  const p=Math.max(0,progress),ease=(a,b)=>T.MathUtils.smoothstep(p,a,b),drop=(ease(.22,.40)-ease(.48,.67))*.34,pull=(ease(.78,.83)-ease(.85,.90))*.12;magazine.position.copy(position);magazine.position.y-=drop;magazine.quaternion.copy(magazineRotation);state.engaged=ease(.67,.77)*(1-ease(.935,1));state.grasp=ease(.67,.77)*(1-ease(.90,.935));state.pull=pull;
  if(progress<0){left.grip=home;state.engaged=state.grasp=0;return;}
  meta.mechanisms.boltCarrier.position.z+=pull;
  group.updateWorldMatrix(true,true);home.updateWorldMatrix(true,false);homeMatrix.multiplyMatrices(home.matrixWorld,left.offset).decompose(homePoint,rotation,scale);
  // Withdraw the actual magazine; then reach over to hook the exposed knob.
  point.set(-.16,-.20-drop,position.z+.12);model.localToWorld(point);point.lerp(homePoint,1-ease(.06,.20));
  model.getWorldQuaternion(modelRotation);graspRotation.copy(modelRotation).multiply(grasp);rotation.slerp(graspRotation,state.engaged);
  offset.copy(contact).multiply(scale).applyQuaternion(graspRotation);knob.getWorldPosition(state.point);state.point.sub(offset);point.lerp(state.point,state.engaged);point.lerp(homePoint,ease(.935,1));
  goal.compose(point,rotation,scale);localMatrix.copy(model.matrixWorld).invert().multiply(goal).multiply(inverse);socket.matrix.copy(localMatrix);left.grip=socket;
 },diagnostics(){group.updateWorldMatrix(true,true);indexJoint.getWorldPosition(point);offset.copy(padOffset).multiply(left.hand.getWorldScale(scale)).applyQuaternion(left.hand.getWorldQuaternion(rotation));point.add(offset);knob.getWorldPosition(homePoint);state.gap=point.distanceTo(homePoint);return {engaged:Math.min(state.engaged,state.grasp),reach:state.engaged,grasp:state.grasp,gap:state.gap,pull:state.pull};}};
}
