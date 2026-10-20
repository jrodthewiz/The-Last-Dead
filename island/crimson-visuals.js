import * as T from '../vendor/three.module.js';
import {loadGlb} from '../assets/load-glb.js';
import {fitBodySpearFrame} from '../body-spear-visuals.js';
import {consoleMaterial} from './retro-materials.js';
import {groundHeight} from './data.js';

// Own at most eight wounds. Fit once against the posed skin at contact, then
// follow the chest bone; no per-frame skin scans or full-scene raycasts.
export async function createCrimsonVisuals(scene,floorAt=groundHeight){
 const asset=await loadGlb(new URL('../assets/models/body-spear-anatomy-v1.glb',import.meta.url).href),wounds=[];
 const vector=new T.Vector3(),inverse=new T.Matrix4();
 const tissue=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),consoleMaterial(new T.MeshLambertMaterial({flatShading:true,color:0xffffff})),24),bits=Array.from({length:24},()=>({life:0,size:0,p:new T.Vector3(),v:new T.Vector3(),turn:new T.Euler()})),dummy=new T.Object3D(),colour=new T.Color(),right=new T.Vector3(),up=new T.Vector3(0,1,0),direction=new T.Vector3(),localAxis=new T.Vector3(),parentRotation=new T.Quaternion(),turn=new T.Quaternion();let nextBit=0,held=null,nextOrgan=0;const organs=[];
 tissue.name='Crimson exit tissue';tissue.frustumCulled=false;tissue.instanceColor=new T.InstancedBufferAttribute(new Float32Array(24*3).fill(1),3);scene.add(tissue);
 const refresh=f=>{f.anchor.localToWorld(f.entry.copy(f.entryLocal));f.anchor.localToWorld(f.exit.copy(f.exitLocal));f.anchor.getWorldQuaternion(f.rotation);f.front.set(0,0,1).applyQuaternion(f.rotation);};
 const restore=()=>{if(held)for(const p of held.pose){p.bone.position.copy(p.position);p.bone.quaternion.copy(p.rotation);}};
 function writeBits(){for(let i=0;i<bits.length;i++){const b=bits[i];dummy.position.copy(b.p);dummy.rotation.copy(b.turn);dummy.scale.setScalar(b.life>0?b.size*Math.min(1,b.life*4):0);dummy.updateMatrix();tissue.setMatrixAt(i,dummy.matrix);}tissue.instanceMatrix.needsUpdate=true;}
 writeBits();
 function remove(w){w.group.removeFromParent();for(const [mesh,original,owned]of w.materials){mesh.material=original;owned.forEach(m=>m.dispose());}w.group.traverse(o=>{if(o.isMesh)for(const m of(Array.isArray(o.material)?o.material:[o.material]))m.dispose();});}
 function updateWound(w){const f=w.frame;refresh(f);w.group.position.copy(f.entry);w.group.quaternion.copy(f.rotation);w.group.updateMatrixWorld(true);w.inverse.value.copy(w.group.matrixWorld).invert();w.group.visible=w.enemy.root.visible;}
 const api={wounds,fit(enemy){return fitBodySpearFrame(enemy.root);},begin(enemy){
  api.end();const pose=[];for(const name of ['Spine','Spine01','Spine02','neck','Head','LeftShoulder','RightShoulder']){const bone=enemy.root.getObjectByName(name);if(bone)pose.push({bone,position:bone.position.clone(),rotation:bone.quaternion.clone()});}held={enemy,pose};
 },pose(enemy,frame,time){
  if(held?.enemy!==enemy)return;restore();enemy.root.updateMatrixWorld(true);
  // World-relative impulses respect each imported skeleton's bind basis.
  const hit=T.MathUtils.smoothstep(time,.22,.265)*(1-T.MathUtils.smoothstep(time,.34,.62)),strain=T.MathUtils.smoothstep(time,.24,.30)*(1-T.MathUtils.smoothstep(time,.72,.94)),pull=T.MathUtils.smoothstep(time,.61,.72)*(1-T.MathUtils.smoothstep(time,.80,.94));
  right.set(1,0,0).applyQuaternion(enemy.root.quaternion);direction.set(0,0,1).applyQuaternion(enemy.root.quaternion);
  for(const p of held.pose){const name=p.bone.name,shoulder=name.includes('Shoulder'),angle=shoulder?(name.startsWith('Left')?1:-1)*(.10*hit+.045*strain):name==='Head'||name==='neck'?.07*hit-.035*pull:-(.075*hit+.025*strain-.02*pull);
   p.bone.parent.getWorldQuaternion(parentRotation);localAxis.copy(shoulder?direction:right).applyQuaternion(parentRotation.invert());p.bone.quaternion.premultiply(turn.setFromAxisAngle(localAxis,angle));p.bone.updateWorldMatrix(false,true);
  }refresh(frame);
 },end(enemy){if(held&&(!enemy||held.enemy===enemy)){restore();held.enemy.root.updateMatrixWorld(true);held=null;}},burst(frame){
  right.set(1,0,0).applyQuaternion(frame.rotation);
  for(let i=0;i<10;i++){const slot=nextBit++%bits.length,b=bits[slot],exit=i<7;b.p.copy(exit?frame.exit:frame.entry);b.v.copy(frame.front).multiplyScalar(exit?-3.2-i*.18:1.25).addScaledVector(right,Math.sin(i*2.4)*1.1);b.v.y+=.65+(i%3)*.30;b.size=i%4===0?.033:.022;b.life=1.35;b.turn.set(i*.7,i*1.3,i*.4);tissue.setColorAt(slot,colour.setHex(i===2||i===6?0xb6a184:i%2?0x783029:0x983d32));}tissue.instanceColor.needsUpdate=true;writeBits();
 },setOrganSource(source){if(!source||organs.length)return;for(let i=0;i<4;i++){const root=source.clone(true),morphs=[];root.traverse(m=>{if(m.morphTargetInfluences)morphs.push({mesh:m,source:m===root?source:source.getObjectByName(m.name)});});root.name='Extracted organ '+i;root.visible=false;scene.add(root);organs.push({root,morphs,life:0,v:new T.Vector3()});}},releaseOrgan(source,front){
  if(!source||!organs.length)return;const o=organs[nextOrgan++%organs.length];source.updateWorldMatrix(true,true);source.matrixWorld.decompose(o.root.position,o.root.quaternion,o.root.scale);for(const pair of o.morphs)for(let i=0;i<pair.mesh.morphTargetInfluences.length;i++)pair.mesh.morphTargetInfluences[i]=pair.source?.morphTargetInfluences[i]||0;o.root.visible=true;o.life=12;o.v.copy(front).multiplyScalar(.65);o.v.y=.35;
 },get active(){return {tissue:bits.filter(b=>b.life>0).length,organs:organs.filter(o=>o.life>0).length,held:!!held};},add(enemy,frame){
  const group=new T.Group(),uniform={value:new T.Matrix4()},materials=[];scene.add(group);
  for(const name of ['BodySpear_Entry','BodySpear_Exit','BodySpear_Tunnel']){const source=asset.scene.getObjectByName(name);if(!source)throw new Error('Missing body spear anatomy: '+name);const m=source.clone(true);m.position.set(0,0,0);m.quaternion.identity();m.scale.setScalar(1);m.traverse(o=>{if(o.isMesh){o.material=o.material.clone();consoleMaterial(o.material);o.frustumCulled=false;}});if(name.endsWith('Exit')){m.position.z=-frame.depth-.002;m.rotation.y=Math.PI;}if(name.endsWith('Tunnel')){m.position.z=-.005;m.scale.z=Math.max(.1,(frame.depth-.006)/.2);}group.add(m);}
  enemy.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const original=mesh.material,owned=(Array.isArray(original)?original:[original]).map(m=>{const copy=m.clone(),prior=m.onBeforeCompile,key=m.customProgramCacheKey();copy.onBeforeCompile=(shader,renderer)=>{prior.call(copy,shader,renderer);shader.uniforms.crimsonInverse=uniform;shader.vertexShader='varying vec3 crimsonWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\ncrimsonWorld=(modelMatrix*vec4(transformed,1.)).xyz;');shader.fragmentShader='uniform mat4 crimsonInverse;varying vec3 crimsonWorld;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nvec3 bore=(crimsonInverse*vec4(crimsonWorld,1.)).xyz; if(dot(bore.xy/vec2(.073,.092),bore.xy/vec2(.073,.092))<1. && bore.z<.08 && bore.z>-.75)discard;');};copy.customProgramCacheKey=()=>key+'-blackwater-crimson-v1';return copy;});mesh.material=Array.isArray(original)?owned:owned[0];materials.push([mesh,original,owned]);});
  const wound={enemy,frame,group,inverse:uniform,materials};wounds.push(wound);updateWound(wound);if(wounds.length>8)remove(wounds.shift());return wound;
 },update(dt=0){for(const w of wounds)updateWound(w);for(const b of bits)if(b.life>0){b.life=Math.max(0,b.life-dt);b.v.y-=8*dt;b.p.addScaledVector(b.v,dt);const floor=floorAt(b.p.x,b.p.z)+b.size;if(b.p.y<floor){b.p.y=floor;b.v.set(0,0,0);}else{b.turn.x+=dt*6;b.turn.z+=dt*4;}}writeBits();for(const o of organs)if(o.life>0){for(const pair of o.morphs)for(let i=0;i<pair.mesh.morphTargetInfluences.length;i++)pair.mesh.morphTargetInfluences[i]*=Math.exp(-8*dt);o.life=Math.max(0,o.life-dt);o.v.y-=7*dt;o.root.position.addScaledVector(o.v,dt);const floor=floorAt(o.root.position.x,o.root.position.z)+.045;if(o.root.position.y<floor){o.root.position.y=floor;o.v.set(0,0,0);}else o.root.rotation.z+=dt*2.4;o.root.visible=o.life>0;}},clear(){api.end();for(const w of wounds)remove(w);wounds.length=0;for(const b of bits)b.life=0;for(const o of organs){o.life=0;o.root.visible=false;}writeBits();}};
 return api;
}
