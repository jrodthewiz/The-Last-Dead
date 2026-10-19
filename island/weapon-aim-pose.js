import * as T from '../vendor/three.module.js';

// Model-space sight lines, not camera-ray adjustments. The marksman aperture
// and revolver/rifle posts retain their real authored heights.
export const AIM_LINES={
 ossuary:{rear:[0,.2235,.213],front:[0,.2185,-1.015]},
 breach:{rear:[0,.130,.18],front:[0,.130,-.98]},
 arc:{rear:[0,.30,.12],front:[0,.30,-1.10]},
 reliquary:{rear:[0,.30,.18],front:[0,.30,-1.06]},
 carrion:{rear:[0,.286,.259],front:[0,.262,-.802]},
 mourning:{rear:[0,.39,.16],front:[0,.39,-.46]},
};
const aimRotation=new T.Quaternion(),kickRotation=new T.Quaternion(),axis=new T.Vector3(1,0,0),rear=new T.Vector3(),direction=new T.Vector3(),forward=new T.Vector3(0,0,-1);
export function applySightPose(group,id,scale,weight,recoil=0){
 const line=AIM_LINES[id];if(!line||weight<=0)return;
 rear.fromArray(line.rear);direction.fromArray(line.front).sub(rear).normalize();aimRotation.setFromUnitVectors(direction,forward);
 rear.multiplyScalar(scale).applyQuaternion(aimRotation);
 group.position.x=T.MathUtils.lerp(group.position.x,-rear.x,weight);
 group.position.y=T.MathUtils.lerp(group.position.y,-rear.y,weight);
 kickRotation.setFromAxisAngle(axis,T.MathUtils.smoothstep(recoil,0,1)*.045);aimRotation.multiply(kickRotation);group.quaternion.slerp(aimRotation,weight);
}

export function installAimingReferences(models){
 for(const [index,id]of [[1,'breach'],[2,'arc'],[3,'reliquary']]){
  const model=models[index],line=AIM_LINES[id],iron=new T.MeshLambertMaterial({color:0x465b52,flatShading:true}),bead=new T.MeshLambertMaterial({color:0xc7c29a,flatShading:true});
  const add=(name,p,size,material,parent=model)=>{const m=new T.Mesh(new T.BoxGeometry(...size),material);m.name=name;m.position.fromArray(p);if(parent!==model){m.position.divide(parent.scale);m.scale.set(1/parent.scale.x,1/parent.scale.y,1/parent.scale.z);}parent.add(m);};
  const frontParent=id==='reliquary'?model.userData.reliquary.recoilCarriage:model;
  add(id+' front aiming bead',[0,line.front[1]-.009,line.front[2]],[.016,.018,.024],bead,frontParent);
  if(id==='reliquary'){
   // The resized chamber sits below the sight line. Solid feet seat the
   // references in its steel; the front foot travels with the barrel.
   add('reliquary front sight pedestal',[0,.23,line.front[2]],[.034,.11,.045],iron,frontParent);
   add('reliquary rear sight bridge',[0,.23,line.rear[2]],[.085,.10,.055],iron);
  }
  for(const x of [-.030,.030])add(id+' rear aiming notch',[x,line.rear[1]-.006,line.rear[2]],[.018,.032,.035],iron);
 }
}
