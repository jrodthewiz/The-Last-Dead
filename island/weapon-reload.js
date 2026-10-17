import * as T from '../vendor/three.module.js';

// Preserve the authored receiver and its firing mechanism. Only the barrel
// assembly pivots; both replacement shells travel into the exposed breech.
export function createShotgunReload(group,model){
 const meta=model.userData.breach,shells=[],hinge=new T.Group();hinge.name='Blackwater break-action hinge';hinge.userData.weaponMechanism=true;hinge.position.set(0,.07,-.09);model.add(hinge);model.updateWorldMatrix(true,true);
 for(const name of ['twin-barrels','ribcage','muzzle-housing','support-grip','support-mount','underbarrel-launcher']){const part=meta.parts[name];if(part)hinge.attach(part);}
 const shellRig=new T.Group();shellRig.name='Replacement shotgun shells';hinge.add(shellRig);const body=new T.MeshLambertMaterial({color:0x8e4b37,flatShading:true}),cap=new T.MeshLambertMaterial({color:0xc3a468,flatShading:true});
 for(const x of [-.052,.052]){const pair=new T.Group();shellRig.add(pair);shells.push(pair);const shell=new T.Mesh(new T.CylinderGeometry(.032,.032,.16,8),body);shell.rotation.x=Math.PI/2;shell.position.set(x,-.037,0);pair.add(shell);const base=new T.Mesh(new T.CylinderGeometry(.035,.035,.025,8),cap);base.rotation.x=Math.PI/2;base.position.set(x,-.037,.09);pair.add(base);}
 shellRig.visible=false;const left=group.userData.authoredFPS.arms.find(a=>a.side==='left'),home=left.grip,socket=new T.Object3D();socket.matrixAutoUpdate=false;model.add(socket);
 const middle=group.userData.authoredFPS.rig.getObjectByName('FPS_breach_left_Middle0'),knuckle=left.hand.worldToLocal(middle.getWorldPosition(new T.Vector3())),fingerAxis=knuckle.clone().normalize(),direction=new T.Vector3(),from=new T.Vector3(),delta=new T.Quaternion(),baseRotation=new T.Quaternion(),offset=new T.Vector3();
 const goal=new T.Matrix4(),local=new T.Matrix4(),inverse=left.offset.clone().invert(),homePoint=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3(),point=new T.Vector3();
 return {hinge,shellRig,shells,update(progress,count=2){shells.forEach((shell,i)=>shell.visible=i<count);const p=Math.max(0,progress),ease=(a,b)=>T.MathUtils.smoothstep(p,a,b),open=ease(.08,.25)-ease(.78,.94);hinge.rotation.x=-.55*open;shellRig.visible=progress>=.28&&progress<=.73;shellRig.position.z=.24*(1-ease(.42,.67));
  if(progress<0){left.grip=home;return;}
  group.updateWorldMatrix(true,true);home.updateWorldMatrix(true,false);goal.multiplyMatrices(home.matrixWorld,left.offset).decompose(homePoint,rotation,scale);
  // Palm follows the caps during insertion, then releases before closing.
  const weight=ease(.16,.35)*(1-ease(.69,.83));baseRotation.copy(rotation);direction.set(.6,.65,-.25).normalize().applyQuaternion(group.userData.authoredFPS.camera.quaternion);from.copy(fingerAxis).applyQuaternion(rotation);delta.setFromUnitVectors(from,direction);rotation.premultiply(delta);point.set(-.035,-.07,.09+shellRig.position.z);hinge.localToWorld(point);offset.copy(knuckle).multiply(scale).applyQuaternion(rotation);point.sub(offset);point.lerp(homePoint,1-weight);rotation.slerp(baseRotation,1-weight);goal.compose(point,rotation,scale);local.copy(model.matrixWorld).invert().multiply(goal).multiply(inverse);socket.matrix.copy(local);left.grip=socket;
 }};
}
