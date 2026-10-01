import * as THREE from '../../vendor/three.module.js';
import {installViewmodelDepthBoundary} from './viewmodel-depth.js';

export const FOREGROUND_ARM_URL = new URL('./viewmodel-arms-v1.glb', import.meta.url).href;
// One uniform presentation scale, including the hand and both cloth segments.
// Weapon groups have a .64 scale; this yields a .305 m forearm in the view.
export const FOREGROUND_ARM_SCALE = 1.4;
export const FOREGROUND_WRIST_LIMIT = THREE.MathUtils.degToRad(75);
const DOWN = new THREE.Vector3(0, -1, 0);
const HELD_DEPTH = [.02,.18,.29,.26,.25,.43,.14,.07];
const HINTS = [
  {right:[.42,-.88,.52]},
  {right:[.42,-.88,.52],left:[-.50,-.77,.22]},
  {right:[.42,-.88,.52],left:[-.52,-.81,.20]},
  {right:[.42,-.88,.52],left:[-.54,-.77,.25]},
  {right:[.42,-.88,.52],left:[-.50,-.79,.20]},
  {right:[.42,-.88,.52],left:[-.53,-.81,.23]},
  {right:[.45,-.95,.10],left:[-.50,-.95,.10]},
  {right:[.45,-.95,.10],left:[-.50,-.95,.10]},
];

function fitHardwareGrip(renderer,group,weapon,side) {
  const model=group.userData.model||group;
  const parts=model.userData.sculptRuntime?.parts||model.userData.rifle?.parts;
  const part=parts?.[side==='right'?'grip':'support-grip'];
  if(!part||weapon>=6)return renderer._findWeaponSocket(model,side==='right'?'grip':'supportGrip');
  // The prototype handles were wider than an adult curled hand. Fit only
  // the manufactured grip, leaving the receiver and its mechanisms intact.
  part.scale.set(side==='right'?.40:.58,.65,side==='right'?.40:.58);
  const anchor=new THREE.Object3D();anchor.name=`Anatomical${side}Grip`;
  anchor.position.set(0,side==='right'?-.17:-.12,0);part.add(anchor);
  model.userData[side==='right'?'grip':'supportGrip']=anchor;
  return anchor;
}

function ownedSurface(source) {
  const root = source.clone(true);
  // Blender/glTF axis conversion may live on the root node. Keep the authored
  // frame inside a separate fit pivot, including when the source is one Mesh.
  source.updateWorldMatrix(true,true);
  source.matrixWorld.decompose(root.position,root.quaternion,root.scale);
  root.traverse(node => {
    node.layers.set(1);
    node.userData.viewmodelArm = true;
    node.userData.weaponBatchIgnore = true;
    if (!node.isMesh) return;
    node.geometry = node.geometry.clone();
    node.material = (Array.isArray(node.material) ? node.material : [node.material]).map(m => {
      const material = m.clone();
      material.depthTest = true;
      material.depthWrite = true;
      material.side = THREE.FrontSide;
      material.envMapIntensity = .35;
      return material;
    });
    if (node.material.length === 1) node.material = node.material[0];
    node.castShadow = node.receiveShadow = false;
  });
  const pivot=new THREE.Group();pivot.add(root);
  return pivot;
}

function disposeLegacy(root) {
  root.traverse(node => {
    node.geometry?.dispose();
    for (const m of (Array.isArray(node.material) ? node.material : [node.material])) m?.dispose();
  });
  root.removeFromParent();
}

function placeHand(f) {
    const {arm,hand,grip,point,rotation,parentRotation} = f;
    arm.position.set(0,0,0); arm.quaternion.identity(); arm.scale.setScalar(1);
    // Wrist orientation is independent of the forearm. Fit rotation first,
    // then put the grip centre on the animated weapon's actual socket.
    arm.getWorldQuaternion(parentRotation).invert();
    grip.getWorldQuaternion(rotation);
    hand.quaternion.copy(parentRotation.multiply(rotation)).multiply(f.correction);
    arm.worldToLocal(grip.getWorldPosition(point));
    hand.position.copy(point).add(f.offset);
    hand.scale.setScalar(FOREGROUND_ARM_SCALE);
    hand.updateWorldMatrix(true,true);
}

function preferredForearm(f) {
    const {arm,hand,wrist,point,direction} = f;
    arm.worldToLocal(wrist.getWorldPosition(point));
    direction.copy(f.hint).sub(point).normalize();
    // A bat's backswing can turn its grip past the elbow hint. Keep the wrist
    // inside an anatomical cone instead of bending the hand back on itself.
    f.wristDirection.copy(DOWN).applyQuaternion(hand.quaternion).normalize();
    const angle=Math.acos(THREE.MathUtils.clamp(f.wristDirection.dot(direction),-1,1));
    if(angle>FOREGROUND_WRIST_LIMIT){
      f.coneRotation.identity().slerp(f.coneTarget.setFromUnitVectors(f.wristDirection,direction),FOREGROUND_WRIST_LIMIT/angle);
      direction.copy(f.wristDirection).applyQuaternion(f.coneRotation).normalize();
    }
}

// The lowest reachable elbow direction inside the wrist's anatomical cone.
function lowestDirection(f,normal) {
  const u=f.cameraWristDirection,best=f.bestDirection;
  best.copy(normal).negate();
  if(u.dot(best)>=Math.cos(FOREGROUND_WRIST_LIMIT))return best;
  f.tangent.copy(normal).addScaledVector(u,-normal.dot(u));
  if(f.tangent.lengthSq()<1e-10)f.tangent.set(1,0,0).addScaledVector(u,-u.x);
  best.copy(u).multiplyScalar(Math.cos(FOREGROUND_WRIST_LIMIT))
    .addScaledVector(f.tangent.normalize(),-Math.sin(FOREGROUND_WRIST_LIMIT)).normalize();
  return best;
}

export function fitForegroundArms(group) {
  const fits=group?.userData.foregroundArmFits,placement=group?.userData.foregroundFitRig;
  if(!fits||!placement)return false;
  const camera=group.userData.foregroundCamera,normal=placement.userData.bottomNormal;
  camera.updateWorldMatrix(true,false);
  camera.getWorldQuaternion(placement.userData.cameraRotation);
  normal.set(0,1,-Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))).normalize();
  placement.position.set(0,0,0);
  group.updateWorldMatrix(true,true);
  let depth=HELD_DEPTH[group.userData.foregroundWeapon];
  for(const f of fits){
    placeHand(f);preferredForearm(f);
    f.arm.getWorldQuaternion(f.toCamera).premultiply(placement.userData.inverseCameraRotation.copy(placement.userData.cameraRotation).invert());
    camera.worldToLocal(f.wrist.getWorldPosition(f.cameraWrist));
    f.cameraWristDirection.copy(f.wristDirection).applyQuaternion(f.toCamera).normalize();
    f.worldScale=f.hand.getWorldScale(f.scale).x;
    f.capMargin=(f.capRadius+f.capOvershoot)*f.worldScale+.012;
    const a=f.forearmLength*f.worldScale,b=f.upperLength*f.worldScale;
    const needed=(normal.dot(f.cameraWrist)+a*normal.dot(lowestDirection(f,normal))-b+f.capMargin)/(-normal.z);
    depth=Math.max(depth,needed);
  }
  // Move the entire held assembly, so muzzle, mechanisms and both grips retain
  // their relationship. The camera-space depth is independent of weapon sway.
  placement.userData.depth=depth;
  placement.position.set(0,0,depth).applyQuaternion(placement.userData.cameraRotation);
  placement.parent.getWorldQuaternion(placement.userData.parentRotation).invert();
  placement.position.applyQuaternion(placement.userData.parentRotation);
  placement.position.divide(placement.parent.getWorldScale(placement.userData.parentScale));
  group.updateWorldMatrix(true,true);
  for(const f of fits){
    const {arm,hand,forearm,upper,direction,point,elbow}=f;
    placeHand(f);preferredForearm(f);
    camera.worldToLocal(f.wrist.getWorldPosition(f.cameraWrist));
    f.cameraDirection.copy(direction).applyQuaternion(f.toCamera).normalize();
    const a=f.forearmLength*f.worldScale,b=f.upperLength*f.worldScale;
    const limit=(b-f.capMargin-normal.dot(f.cameraWrist))/a;
    if(normal.dot(f.cameraDirection)>limit){
      lowestDirection(f,normal);
      f.coneTarget.setFromUnitVectors(f.cameraDirection,f.bestDirection);
      let lo=0,hi=1;
      for(let i=0;i<14;i++){
        const t=(lo+hi)*.5;
        f.coneRotation.identity().slerp(f.coneTarget,t);
        f.trialDirection.copy(f.cameraDirection).applyQuaternion(f.coneRotation);
        if(normal.dot(f.trialDirection)>limit)lo=t;else hi=t;
      }
      f.coneRotation.identity().slerp(f.coneTarget,hi);
      f.cameraDirection.applyQuaternion(f.coneRotation).normalize();
    }
    direction.copy(f.cameraDirection).applyQuaternion(f.fromCamera.copy(f.toCamera).invert());
    forearm.position.copy(point);forearm.quaternion.setFromUnitVectors(DOWN,direction);
    forearm.scale.setScalar(FOREGROUND_ARM_SCALE);
    elbow.copy(point).addScaledVector(direction,f.forearmLength*FOREGROUND_ARM_SCALE);
    f.cameraElbow.copy(f.cameraWrist).addScaledVector(f.cameraDirection,a);
    f.cameraDirection.copy(f.shoulderAnchor).sub(f.cameraElbow).normalize();
    const capLimit=THREE.MathUtils.clamp((-f.capMargin-normal.dot(f.cameraElbow))/b,-1,1);
    if(normal.dot(f.cameraDirection)>capLimit){
      f.tangent.copy(f.cameraDirection).addScaledVector(normal,-normal.dot(f.cameraDirection));
      if(f.tangent.lengthSq()<1e-10)f.tangent.set(1,0,0);
      f.cameraDirection.copy(normal).multiplyScalar(capLimit).addScaledVector(f.tangent.normalize(),Math.sqrt(1-capLimit*capLimit));
    }
    direction.copy(f.cameraDirection).applyQuaternion(f.fromCamera);
    upper.position.copy(elbow);upper.quaternion.setFromUnitVectors(DOWN,direction);
    upper.scale.setScalar(FOREGROUND_ARM_SCALE);
    f.shoulderPlaneDistance=normal.dot(f.cameraElbow)+b*normal.dot(f.cameraDirection)+f.capMargin;
    f.wristAngle = Math.acos(THREE.MathUtils.clamp(
      f.wristDirection.copy(DOWN).applyQuaternion(hand.quaternion).dot(
        f.forearmDirection.copy(DOWN).applyQuaternion(forearm.quaternion)), -1,1));
  }
  group.updateWorldMatrix(true,true);
  return true;
}

function capEnvelope(source,length){
  source.updateWorldMatrix(true,true);
  const point=new THREE.Vector3();let radius=0,overshoot=0;
  source.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const positions=mesh.geometry.attributes.position;
    for(let i=0;i<positions.count;i++){
      point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
      if(point.y<=-length+.025){radius=Math.max(radius,Math.hypot(point.x,point.z));overshoot=Math.max(overshoot,-point.y-length);}
    }
  });
  return {radius:radius||.09,overshoot};
}

export function installForegroundArms(renderer,template) {
  // Validate the complete contract before removing any working fallback arm.
  for(let weapon=0;weapon<renderer.weaponGroups.length;weapon++)for(const side of ['right','left']){
    const group=renderer.weaponGroups[weapon],arm=group.userData.viewArms?.[side+'Arm'];if(!arm)continue;
    const suffix=side==='left'?'Left':'Right';
    for(const name of ['TLD_GripHand_','TLD_ViewSleeve_','TLD_UpperSleeve_'])if(!template.getObjectByName(name+suffix))throw new Error(`Missing ${name+suffix}`);
    if(!renderer._findWeaponSocket(group.userData.model||group,side==='right'?'grip':'supportGrip'))throw new Error(`Missing ${side} grip for weapon ${weapon}`);
  }
  let count=0;
  for (let weapon=0;weapon<renderer.weaponGroups.length;weapon++) {
    const group=renderer.weaponGroups[weapon],fits=[];
    const placement=new THREE.Group();placement.name='ForegroundReach_'+weapon;
    placement.userData={bottomNormal:new THREE.Vector3(),cameraRotation:new THREE.Quaternion(),inverseCameraRotation:new THREE.Quaternion(),parentRotation:new THREE.Quaternion(),parentScale:new THREE.Vector3()};
    group.parent.add(placement);placement.add(group);
    group.userData.foregroundFitRig=placement;group.userData.foregroundCamera=renderer.camera;group.userData.foregroundWeapon=weapon;
    for (const side of ['right','left']) {
      const arm=group.userData.viewArms?.[side+'Arm'];
      if (!arm) continue;
      const suffix=side==='left'?'Left':'Right';
      const handSource=template.getObjectByName('TLD_GripHand_'+suffix);
      const sleeveSource=template.getObjectByName('TLD_ViewSleeve_'+suffix);
      const upperSource=template.getObjectByName('TLD_UpperSleeve_'+suffix);
      const grip=fitHardwareGrip(renderer,group,weapon,side);
      if (!handSource||!sleeveSource||!upperSource||!grip) throw new Error(`Missing authored ${suffix} arm/socket for weapon ${weapon}`);
      const hand=arm.userData.hand,socket=arm.userData.gripSocket;
      hand.removeFromParent();
      for (const child of [...arm.children]) disposeLegacy(child);
      for (const child of [...hand.children]) {
        if (child === socket) child.removeFromParent();
        else disposeLegacy(child);
      }
      const imported=ownedSurface(handSource);
      hand.add(imported);
      hand.name='HandPose'; arm.add(hand); hand.add(socket); socket.position.set(0,0,0);socket.quaternion.identity();
      const wrist=new THREE.Object3D();wrist.name='ViewWrist';wrist.position.set(0,-.075,.015);hand.add(wrist);
      const forearm=ownedSurface(sleeveSource),upper=ownedSurface(upperSource);
      forearm.name='AuthoredForearm_'+suffix;upper.name='AuthoredUpperSleeve_'+suffix;
      arm.add(forearm,upper);
      arm.userData.triggerFinger=side==='right'?hand.getObjectByName('RightTriggerFinger'):undefined;
      arm.userData.sockets={wrist,hand:socket,elbow:upper};
      arm.userData.sculptRuntime.parts=[forearm,hand,upper];
      arm.userData.viewmodelSource='blender-native-metric-arms-v1';
      // Support holds rotate about the horizontal fore-end. The chainsaw's
      // raised handle and bat's stacked vertical hold use the grip frame.
      const correction=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),side==='right'?-Math.PI/2:Math.PI/2);
      if(weapon===6||(side==='left'&&weapon===4))correction.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2));
      if(weapon===7&&side==='left')correction.premultiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(.03,-.28,-.96).normalize()));
      const cap=capEnvelope(upperSource,.40);
      const fit={arm,hand,grip,wrist,forearm,upper,correction,capRadius:cap.radius,capOvershoot:cap.overshoot,
        hint:new THREE.Vector3(...HINTS[weapon][side]),offset:new THREE.Vector3(),
        shoulderAnchor:new THREE.Vector3(side==='left'?-.32:.32,-.44,.12),shoulderPoint:new THREE.Vector3(),
        forearmLength:.34,upperLength:.40,point:new THREE.Vector3(),direction:new THREE.Vector3(),elbow:new THREE.Vector3(),
        scale:new THREE.Vector3(),cameraWrist:new THREE.Vector3(),cameraWristDirection:new THREE.Vector3(),bestDirection:new THREE.Vector3(),tangent:new THREE.Vector3(),cameraDirection:new THREE.Vector3(),trialDirection:new THREE.Vector3(),cameraElbow:new THREE.Vector3(),toCamera:new THREE.Quaternion(),fromCamera:new THREE.Quaternion(),
        rotation:new THREE.Quaternion(),parentRotation:new THREE.Quaternion(),coneRotation:new THREE.Quaternion(),coneTarget:new THREE.Quaternion(),wristDirection:new THREE.Vector3(),forearmDirection:new THREE.Vector3()};
      arm.userData.foregroundArmFit=fit;fits.push(fit);count++;
    }
    group.userData.foregroundArmFits=fits;
    fitForegroundArms(group);
  }
  installViewmodelDepthBoundary(renderer.weaponRig);
  return count;
}
