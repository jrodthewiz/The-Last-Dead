import * as T from '../vendor/three.module.js';
import {loadGlb} from '../assets/load-glb.js';
import {fitBodySpearFrame} from '../body-spear-visuals.js';
import {consoleMaterial} from './retro-materials.js';

// Own at most eight wounds. Fit once against the posed skin at contact, then
// follow the chest bone; no per-frame skin scans or full-scene raycasts.
export async function createCrimsonVisuals(scene){
 const asset=await loadGlb(new URL('../assets/models/body-spear-anatomy-v1.glb',import.meta.url).href),wounds=[];
 const vector=new T.Vector3(),inverse=new T.Matrix4();
 function remove(w){w.group.removeFromParent();for(const [mesh,original,owned]of w.materials){mesh.material=original;owned.forEach(m=>m.dispose());}w.group.traverse(o=>{if(o.isMesh)for(const m of(Array.isArray(o.material)?o.material:[o.material]))m.dispose();});}
 function updateWound(w){const f=w.frame;f.anchor.localToWorld(f.entry.copy(f.entryLocal));f.anchor.localToWorld(f.exit.copy(f.exitLocal));f.anchor.getWorldQuaternion(f.rotation);f.front.set(0,0,1).applyQuaternion(f.rotation);w.group.position.copy(f.entry);w.group.quaternion.copy(f.rotation);w.group.updateMatrixWorld(true);w.inverse.value.copy(w.group.matrixWorld).invert();w.group.visible=w.enemy.root.visible;}
 return {wounds,fit(enemy){return fitBodySpearFrame(enemy.root);},add(enemy,frame){
  const group=new T.Group(),uniform={value:new T.Matrix4()},materials=[];scene.add(group);
  for(const name of ['BodySpear_Entry','BodySpear_Exit','BodySpear_Tunnel']){const source=asset.scene.getObjectByName(name);if(!source)throw new Error('Missing body spear anatomy: '+name);const m=source.clone(true);m.position.set(0,0,0);m.quaternion.identity();m.scale.setScalar(1);m.traverse(o=>{if(o.isMesh){o.material=o.material.clone();consoleMaterial(o.material);o.frustumCulled=false;}});if(name.endsWith('Exit')){m.position.z=-frame.depth-.002;m.rotation.y=Math.PI;}if(name.endsWith('Tunnel')){m.position.z=-.005;m.scale.z=Math.max(.1,(frame.depth-.006)/.2);}group.add(m);}
  enemy.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const original=mesh.material,owned=(Array.isArray(original)?original:[original]).map(m=>{const copy=m.clone(),prior=m.onBeforeCompile,key=m.customProgramCacheKey();copy.onBeforeCompile=(shader,renderer)=>{prior.call(copy,shader,renderer);shader.uniforms.crimsonInverse=uniform;shader.vertexShader='varying vec3 crimsonWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\ncrimsonWorld=(modelMatrix*vec4(transformed,1.)).xyz;');shader.fragmentShader='uniform mat4 crimsonInverse;varying vec3 crimsonWorld;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nvec3 bore=(crimsonInverse*vec4(crimsonWorld,1.)).xyz; if(dot(bore.xy/vec2(.073,.092),bore.xy/vec2(.073,.092))<1. && bore.z<.08 && bore.z>-.75)discard;');};copy.customProgramCacheKey=()=>key+'-blackwater-crimson-v1';return copy;});mesh.material=Array.isArray(original)?owned:owned[0];materials.push([mesh,original,owned]);});
  const wound={enemy,frame,group,inverse:uniform,materials};wounds.push(wound);updateWound(wound);if(wounds.length>8)remove(wounds.shift());return wound;
 },update(){for(const w of wounds)updateWound(w);},clear(){for(const w of wounds)remove(w);wounds.length=0;}};
}
