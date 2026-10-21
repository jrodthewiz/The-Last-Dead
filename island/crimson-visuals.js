import * as T from '../vendor/three.module.js';
import {loadGlb} from '../assets/load-glb.js';
import {fitBodySpearFrame} from '../body-spear-visuals.js';
import {consoleMaterial} from './retro-materials.js';
import {groundHeight} from './data.js';
import {createCrimsonTissue} from './crimson-tissue.js';
import {CRIMSON} from './close-combat.js';

// Own at most eight wounds. Fit once against the posed skin at contact, then
// follow the chest bone; no per-frame skin scans or full-scene raycasts.
export async function createCrimsonVisuals(scene,floorAt=groundHeight,feedback=null){
 const asset=await loadGlb(new URL('../assets/models/body-spear-anatomy-v1.glb',import.meta.url).href),wounds=[],warmWounds=[],warmMaterials=[];
 const vector=new T.Vector3(),inverse=new T.Matrix4();
 const tissue=createCrimsonTissue(scene,floorAt,frame=>feedback?.arterial(frame.entry,frame.front,1.4)),right=new T.Vector3(),direction=new T.Vector3(),localAxis=new T.Vector3(),parentRotation=new T.Quaternion(),turn=new T.Quaternion();let held=null,nextOrgan=0;const organs=[];
 const refresh=f=>{f.anchor.localToWorld(f.entry.copy(f.entryLocal));f.anchor.localToWorld(f.exit.copy(f.exitLocal));f.anchor.getWorldQuaternion(f.rotation);f.front.set(0,0,1).applyQuaternion(f.rotation);};
 const restore=()=>{if(held)for(const p of held.pose){p.bone.position.copy(p.position);p.bone.quaternion.copy(p.rotation);}};
 function remove(w,retainPrograms=false){w.group.removeFromParent();for(const [mesh,original,owned]of w.materials){mesh.material=original;if(retainPrograms)warmMaterials.push(...owned);else owned.forEach(m=>m.dispose());}w.group.traverse(o=>{if(o.isMesh){if(o.geometry.userData.crimsonOwned)o.geometry.dispose();for(const m of(Array.isArray(o.material)?o.material:[o.material])){if(retainPrograms)warmMaterials.push(m);else m.dispose();}}});}
 function updateWound(w){const f=w.frame;refresh(f);w.group.position.copy(f.entry);w.group.quaternion.copy(f.rotation);w.group.updateMatrixWorld(true);w.inverse.value.copy(w.group.matrixWorld).invert();w.group.visible=w.enemy.root.visible;}
 const api={wounds,fit(enemy){return fitBodySpearFrame(enemy.root,{rimFit:true});},async prepare(enemies){
  if(warmWounds.length||warmMaterials.length)return;const variants=new Set();for(const e of enemies)if(!variants.has(e.variant)){variants.add(e.variant);const frame=api.fit(e);if(frame)warmWounds.push(api.add(e,frame));await new Promise(requestAnimationFrame);}
 },finishWarmup(){
  // Keep one invisible material seed per source variant. Three releases a
  // program when its last material is disposed, so these bounded seeds keep
  // the prepared bore shaders available across journeys and wound evictions.
  for(const w of warmWounds){remove(w,true);const i=wounds.indexOf(w);if(i>=0)wounds.splice(i,1);}warmWounds.length=0;
 },begin(enemy){
  api.end();const pose=[];for(const name of ['Spine','Spine01','Spine02','neck','Head','LeftShoulder','RightShoulder']){const bone=enemy.root.getObjectByName(name);if(bone)pose.push({bone,position:bone.position.clone(),rotation:bone.quaternion.clone()});}held={enemy,pose};
 },pose(enemy,frame,time){
  if(held?.enemy!==enemy)return;held.frame=frame;restore();enemy.root.updateMatrixWorld(true);
  // World-relative impulses respect each imported skeleton's bind basis.
  const hit=T.MathUtils.smoothstep(time,.22,.265)*(1-T.MathUtils.smoothstep(time,.34,.62)),strain=T.MathUtils.smoothstep(time,.24,.30)*(1-T.MathUtils.smoothstep(time,.85,CRIMSON.release)),pull=T.MathUtils.smoothstep(time,.61,.76)*(1-T.MathUtils.smoothstep(time,.94,CRIMSON.release)),tear=T.MathUtils.smoothstep(time,.96,1.01)*(1-T.MathUtils.smoothstep(time,1.04,CRIMSON.release));
  right.set(1,0,0).applyQuaternion(enemy.root.quaternion);direction.set(0,0,1).applyQuaternion(enemy.root.quaternion);
  for(const p of held.pose){const name=p.bone.name,shoulder=name.includes('Shoulder'),angle=shoulder?(name.startsWith('Left')?1:-1)*(.10*hit+.045*strain+.025*tear):name==='Head'||name==='neck'?.07*hit-.035*pull-.045*tear:-(.09*hit+.025*strain-.02*pull-.025*tear);
   p.bone.parent.getWorldQuaternion(parentRotation);localAxis.copy(shoulder?direction:right).applyQuaternion(parentRotation.invert());p.bone.quaternion.premultiply(turn.setFromAxisAngle(localAxis,angle));p.bone.updateWorldMatrix(false,true);
  }refresh(frame);
 },end(enemy){if(held&&(!enemy||held.enemy===enemy)){tissue.sever(held.frame);restore();held.enemy.root.updateMatrixWorld(true);held=null;}},burst(frame){tissue.burst(frame);},extract(frame,source,action){tissue.extract(frame,source,action);},setOrganSource(source){if(!source||organs.length)return;tissue.prepareOrgan(source);for(let i=0;i<4;i++){const root=source.clone(true),morphs=[];root.traverse(m=>{if(m.morphTargetInfluences)morphs.push({mesh:m,source:m===root?source:source.getObjectByName(m.name)});});tissue.prepareOrgan(root);root.name='Extracted organ '+i;root.visible=false;scene.add(root);organs.push({root,morphs,life:0,v:new T.Vector3()});}},releaseOrgan(source,front,frame){
  if(!source||!organs.length)return;const o=organs[nextOrgan++%organs.length];source.updateWorldMatrix(true,true);source.matrixWorld.decompose(o.root.position,o.root.quaternion,o.root.scale);for(const pair of o.morphs)for(let i=0;i<pair.mesh.morphTargetInfluences.length;i++)pair.mesh.morphTargetInfluences[i]=pair.source?.morphTargetInfluences[i]||0;o.root.visible=true;o.life=12;o.v.copy(front).multiplyScalar(.65);o.v.y=.35;o.root.updateMatrixWorld(true);tissue.release(frame,o.root);
 },get active(){return {tissue:tissue.active.fragments,strands:tissue.active.strands,organs:organs.filter(o=>o.life>0).length,held:!!held};},add(enemy,frame){
  const group=new T.Group(),uniform={value:new T.Matrix4()},materials=[];scene.add(group);
  for(const name of ['BodySpear_Entry','BodySpear_Exit','BodySpear_Tunnel']){const source=asset.scene.getObjectByName(name);if(!source)throw new Error('Missing body spear anatomy: '+name);const m=source.clone(true);m.position.set(0,0,0);m.quaternion.identity();m.scale.setScalar(1);m.traverse(o=>{if(o.isMesh){o.material=o.material.clone();consoleMaterial(o.material);o.frustumCulled=false;
   if(!name.endsWith('Tunnel')){o.geometry=o.geometry.clone();o.geometry.userData.crimsonOwned=true;const p=o.geometry.attributes.position,rim=name.endsWith('Exit')?frame.exitRim:frame.entryRim;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),r=Math.hypot(x/.087,y/.11),angle=(Math.atan2(y/.11,x/.087)+Math.PI*2)%(Math.PI*2),u=angle/(Math.PI*2)*8,k=Math.floor(u),seat=rim?T.MathUtils.lerp(rim[k%8],rim[(k+1)%8],u-k):0;p.setZ(i,p.getZ(i)*.52+seat*T.MathUtils.smoothstep(r,.68,1.05));}o.geometry.computeVertexNormals();}
}});if(name.endsWith('Exit')){m.position.z=-frame.depth-.002;m.rotation.y=Math.PI;}if(name.endsWith('Tunnel')){m.position.z=-.005;m.scale.z=Math.max(.1,(frame.depth-.006)/.2);}group.add(m);}
  enemy.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const original=mesh.material,owned=(Array.isArray(original)?original:[original]).map(m=>{const copy=m.clone(),prior=m.onBeforeCompile,key=m.customProgramCacheKey();copy.onBeforeCompile=(shader,renderer)=>{prior.call(copy,shader,renderer);shader.uniforms.crimsonInverse=uniform;shader.vertexShader='varying vec3 crimsonWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\ncrimsonWorld=(modelMatrix*vec4(transformed,1.)).xyz;');shader.fragmentShader='uniform mat4 crimsonInverse;varying vec3 crimsonWorld;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nvec3 bore=(crimsonInverse*vec4(crimsonWorld,1.)).xyz; if(dot(bore.xy/vec2(.073,.092),bore.xy/vec2(.073,.092))<1. && bore.z<.08 && bore.z>-.75)discard;');};copy.customProgramCacheKey=()=>key+'-blackwater-crimson-v1';return copy;});mesh.material=Array.isArray(original)?owned:owned[0];materials.push([mesh,original,owned]);});
  const wound={enemy,frame,group,inverse:uniform,materials,bleedAge:0,drip:0};wounds.push(wound);updateWound(wound);if(wounds.length>8)remove(wounds.shift());return wound;
 },update(dt=0){
  for(const w of wounds){updateWound(w);if(dt>0&&w.bleedAge<3.2){w.bleedAge+=dt;w.drip-=dt;if(w.drip<=0){w.drip=.13+w.bleedAge*.06;feedback?.drip(w.frame.entry,w.frame.front);}}}
  for(const o of organs)if(o.life>0){for(const pair of o.morphs)for(let i=0;i<pair.mesh.morphTargetInfluences.length;i++)pair.mesh.morphTargetInfluences[i]*=Math.exp(-8*dt);o.life=Math.max(0,o.life-dt);o.v.y-=7*dt;o.root.position.addScaledVector(o.v,dt);const floor=floorAt(o.root.position.x,o.root.position.z)+.045;if(o.root.position.y<floor){o.root.position.y=floor;o.v.set(0,0,0);}else o.root.rotation.z+=dt*2.4;o.root.visible=o.life>0;o.root.updateMatrixWorld(true);}
  tissue.update(dt);
 },clear(){api.end();for(const w of wounds)remove(w);wounds.length=0;for(const o of organs){o.life=0;o.root.visible=false;}tissue.clear();}};
 return api;
}
