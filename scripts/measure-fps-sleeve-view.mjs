// Measure a camera-facing cloth panel in the actual installed rig. This is
// authoring evidence, not a runtime writer or visual acceptance test.
import {readFile,writeFile} from 'node:fs/promises';
import * as T from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';
import {Renderer} from '../renderer.js';
import {installFPSArms} from '../assets/survivor/fps-arms.js';
import {FIRST_PERSON_HOLD_POSES} from '../assets/survivor/viewmodel-hold-poses.js';
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
const b=await readFile(new URL('../assets/survivor/fps-arms-v3.glb',import.meta.url));
const asset=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
const r=Object.create(Renderer.prototype);r.materials={};r.camera=new T.PerspectiveCamera(75,16/10,.025,220);r.weaponRig=new T.Group();r.camera.add(r.weaponRig);
r.weaponGroups=[r._makePulseRevolver(),r._makeBreachShotgun(),r._makeArcLance(),r._makeReliquaryAsset(),r._makeRifle('carrion',4),r._makeRifle('mourning',5),r._makeMelee('bat',6),r._makeMelee('chainsaw',7)];
r.weaponGroups.forEach((g,i)=>{const p=FIRST_PERSON_HOLD_POSES[i];g.position.set(...p.position);g.rotation.set(...p.rotation);g.scale.setScalar(p.scale);r.weaponRig.add(g);});
installFPSArms(r,asset);const records={};
for(const group of r.weaponGroups){const state=group.userData.authoredFPS;records[state.name]={};
 for(const arm of state.arms){
  const mesh=state.rig.getObjectByName(`FPSSleeve_${state.name}_${arm.side}`);
  const bind=bone=>new T.Quaternion().setFromRotationMatrix(mesh.skeleton.boneInverses[mesh.skeleton.bones.indexOf(bone)].clone().invert().extractRotation(mesh.skeleton.boneInverses[mesh.skeleton.bones.indexOf(bone)].clone().invert()));
  const rigRotation=state.rig.getWorldQuaternion(new T.Quaternion());
  const delta=arm.upper.getWorldQuaternion(new T.Quaternion()).multiply(rigRotation.clone().multiply(bind(arm.upper)).invert());
  const axis=arm.bindUpper.clone(),tangent=axis.clone().negate();
  const normal=new T.Vector3(1,0,0).applyQuaternion(bind(arm.hand));normal.addScaledVector(axis,-normal.dot(axis)).normalize();
  const cross=tangent.clone().cross(normal).normalize();
  const view=r.camera.getWorldPosition(new T.Vector3()).sub(arm.lower.getWorldPosition(new T.Vector3())).applyQuaternion(delta.invert()).applyQuaternion(rigRotation.invert()).normalize();
  let angle=Math.atan2(view.dot(cross),view.dot(normal));if(angle<0)angle+=Math.PI*2;
  records[state.name][arm.side]={facingAngle:angle,seamAngle:angle+.34};
 }
}
await writeFile(new URL('../output/fps-sleeve-v4/view-panels.json',import.meta.url),JSON.stringify(records,null,2));console.log(JSON.stringify(records));
