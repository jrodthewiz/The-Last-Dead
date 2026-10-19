import * as T from '../vendor/three.module.js';
import {createMeshySurvivor} from '../assets/survivor/meshy-survivor.js';
import {stylizeModel} from './retro-materials.js';
import {dressSurvivor} from './character-craft.js';

// The on-foot body lives in world space. Camera pitch belongs only to the view
// and its weapon/arms; it must never tip the survivor's legs through the floor.
export function createFirstPersonBody(scene,gltf){
 const actor=createMeshySurvivor(gltf.scene,gltf.animations),rig=actor.userData;
 actor.name='Blackwater local survivor';
 stylizeModel(actor);dressSurvivor(actor);
 const bounds=new T.Box3().setFromObject(actor),scale=1.83/(bounds.max.y-bounds.min.y),base=-bounds.min.y*scale;
 // Tailor the upper jacket behind the eye, preserving hips, knees and boots.
 // Imported POSITION is in skin bind units, so deform through each vertex's
 // actual rest-pose skin transform rather than assuming metre-sized vertices.
 const body=rig.body,geometry=body.geometry.clone(),positions=geometry.attributes.position;
 const indices=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight;
 const skin=new T.Matrix4(),bone=new T.Matrix4(),transform=new T.Matrix4(),inverse=new T.Matrix4(),point=new T.Vector3();
 body.skeleton.update();
 for(let i=0;i<positions.count;i++){
  skin.elements.fill(0);
  for(let k=0;k<4;k++){
   const weight=weights.getComponent(i,k);if(!weight)continue;
   bone.fromArray(body.skeleton.boneMatrices,indices.getComponent(i,k)*16);
   for(let j=0;j<16;j++)skin.elements[j]+=bone.elements[j]*weight;
  }
  transform.copy(body.matrixWorld).multiply(body.bindMatrixInverse).multiply(skin).multiply(body.bindMatrix);
  point.fromBufferAttribute(positions,i).applyMatrix4(transform);
  const height=(point.y-bounds.min.y)*scale,t=T.MathUtils.smoothstep(height,1.05,1.55);
  point.z+=.38*t/scale;inverse.copy(transform).invert();point.applyMatrix4(inverse);
  positions.setXYZ(i,point.x,point.y,point.z);
 }
 positions.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();body.geometry=geometry;
 rig.head.visible=rig.arms.visible=false;
 actor.scale.setScalar(scale);actor.visible=false;
 // The back-mounted pack/shoulder straps sit outside the local view. Keeping
 // them out also avoids disconnected straps after tailoring the local jacket.
 actor.getObjectByName('Expedition field kit').visible=false;
 actor.traverse(o=>{if(o.isMesh)o.castShadow=false;});
 scene.add(actor);
 const sole=new T.Vector3();
 return {actor,update(state,movement,stride,dt,{visible=false,vault=null}={}){
  actor.visible=visible;if(!visible)return;
  const grounded=movement.onGround!==false,speed=grounded&&!vault?movement.speed||0:0;
  const moving=T.MathUtils.clamp(speed/.6,0,1),run=movement.sprinting?1:0;
  const weights={Idle_Relaxed:1-moving,Walk_Forward:moving*(1-run),Run_Forward:moving*run};
  for(const [name,action]of Object.entries(rig.actions)){
   action.setEffectiveWeight(T.MathUtils.damp(action.getEffectiveWeight(),weights[name]||0,16,dt));
   // Use distance-driven gait shared with footsteps/weapon sway. A wall cannot
   // make the feet keep running, and sprint cadence remains frame independent.
   if(name!=='Idle_Relaxed')action.time=(stride.phase/(Math.PI*2)%1)*action.getClip().duration;
  }
  rig.mixer.update(speed>.08?0:dt);
  actor.rotation.set(0,-state.yaw,0);
  actor.position.set(state.x-Math.sin(state.yaw)*.12,state.y+base,state.z+Math.cos(state.yaw)*.12);
  actor.updateMatrixWorld(true);body.skeleton.update();
  let floor=Infinity;
  for(const index of rig.soleSamples){body.getVertexPosition(index,sole);sole.applyMatrix4(body.matrixWorld);floor=Math.min(floor,sole.y);}
  if(Number.isFinite(floor))actor.position.y+=state.y-floor;
  actor.updateMatrixWorld(true);
 }};
}
