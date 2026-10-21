import * as THREE from './vendor/three.module.js';
import {bodySpearCandidates} from './body-spear-ray-tree.js';
import {loadGlb} from './assets/load-glb.js';
import {BODY_SPEAR_MOTION} from './assets/animations/body-spear-v1.js';

export const BODY_SPEAR_ANATOMY_URL='./assets/models/body-spear-anatomy-v1.glb';
export function prepareBodySpearAnatomy(asset){
 const materials=new Set();
 asset.traverse(mesh=>{if(!mesh.isMesh)return;mesh.geometry.userData.sharedAsset=true;
  for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
   if(materials.has(material)||material.userData.bodySpearLightResponse)continue;materials.add(material);material.userData.bodySpearLightResponse=true;
   material.emissive?.setHex(0);material.emissiveIntensity=0;material.envMapIntensity=.28;material.roughness=Math.max(.38,material.roughness);
   // Use the existing brutal tissue response under the close body lantern.
   // Preserve the red atlas and wet relief instead of clipping it to white.
   material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
    vec3 spearTissueLimit=max(diffuseColor.rgb*.30,vec3(.004));reflectedLight.directDiffuse/=vec3(1.)+reflectedLight.directDiffuse/spearTissueLimit;reflectedLight.directSpecular/=vec3(1.)+reflectedLight.directSpecular/vec3(.025);
   `);};material.customProgramCacheKey=()=> 'body-spear-light-response-v1';
  }
 });return asset;
}
const bindings=new WeakMap(),skinTriangles=new WeakMap(),skinWork=new WeakMap(),q0=new THREE.Quaternion(),q1=new THREE.Quaternion(),hip=new THREE.Vector3(),hipNext=new THREE.Vector3();
const clamp=THREE.MathUtils.clamp;
function sampleIndex(elapsed){const frame=clamp(elapsed,0,BODY_SPEAR_MOTION.duration)*BODY_SPEAR_MOTION.fps,a=Math.floor(frame);return{a,b:Math.min(90,a+1),fraction:frame-a};}
export function bodySpearState(elapsed){
 const {a,b,fraction}=sampleIndex(elapsed),result={};
 for(const [name,values]of Object.entries(BODY_SPEAR_MOTION.controls))result[name]=THREE.MathUtils.lerp(values[a],values[b],fraction);
 return result;
}

// Blender exports each body's own bind basis and constrained limb lengths.
// This is a visual overlay; the host owns impact, damage and release.
export function applyBodySpearReaction(root,elapsed,weight,save=()=>{}){
 const key=root.userData.afterlife?.appearance||'ash-witness',data=BODY_SPEAR_MOTION.bodies[key];if(!data)return false;
 let bound=bindings.get(root);
 if(!bound){bound=Object.entries(data.rotations).map(([name,values])=>({node:root.getObjectByName(name),values})).filter(c=>c.node);bindings.set(root,bound);}
 const {a,b,fraction}=sampleIndex(elapsed);
 for(const control of bound){
  const {node,values}=control;save(node);q0.fromArray(values,a*4);q1.fromArray(values,b*4);q0.slerp(q1,fraction).normalize();
  // Resist from the current locomotion pose. Replacing an arm with the
  // authored bind-basis pose would raise it back toward a T-pose.
  if(/^(Left|Right)(Shoulder|Arm|ForeArm|Hand)$/.test(node.name)){q1.fromArray(values,0).invert().multiply(q0);q0.copy(node.quaternion).multiply(q1).normalize();}
  node.quaternion.slerp(q0,weight);
  if(node.name==='Hips'){hip.fromArray(data.hips,a*3);hip.lerp(hipNext.fromArray(data.hips,b*3),fraction);node.position.lerp(hip,weight);}
 }
 root.parent?.updateWorldMatrix(true,false);root.updateMatrixWorld(true);return true;
}

// Fit both opening planes to actual posed imported skin. Neither a chest
// socket's guessed depth nor one character's proportions defines the tunnel.
export function fitBodySpearFrame(root,{rimFit=false,useCache=true}={}){
 const anchor=root.getObjectByName('Socket_Chest');if(!anchor)return null;
 // SkinnedMesh.updateMatrixWorld refreshes its attached bind inverse. The
 // generic updateWorldMatrix traversal skips that override after reparenting.
 root.parent?.updateWorldMatrix(true,false);root.updateMatrixWorld(true);
 const rotation=anchor.getWorldQuaternion(new THREE.Quaternion()),front=new THREE.Vector3(0,0,1).applyQuaternion(rotation).normalize();
 const right=new THREE.Vector3(1,0,0).applyQuaternion(rotation),up=new THREE.Vector3(0,1,0).applyQuaternion(rotation);
 const center=anchor.getWorldPosition(new THREE.Vector3()).addScaledVector(right,.045).addScaledVector(up,-.048);
 const surfaces=[];
 root.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();const geometry=mesh.geometry;
  let triangles=skinTriangles.get(geometry);
  if(!triangles){
   triangles=[];const {position}=geometry.attributes,index=geometry.index;
   for(let i=0;i<(index?.count||position.count);i+=3)triangles.push(index?index.getX(i):i,index?index.getX(i+1):i+1,index?index.getX(i+2):i+2);
   skinTriangles.set(geometry,triangles);
  }
  // One skin evaluation per vertex serves both rays. Raycaster's
  // generic mesh path skins three vertices for every triangle on each ray.
  let work=skinWork.get(geometry);if(!work){work={vertices:new Float64Array(geometry.attributes.position.count*3),visited:new Uint32Array(geometry.attributes.position.count),stamp:0};skinWork.set(geometry,work);}const {vertices,visited}=work,stamp=++work.stamp,point=new THREE.Vector3();
  const vertex=(id,out)=>{const offset=id*3;if(visited[id]!==stamp){mesh.getVertexPosition(id,point).applyMatrix4(mesh.matrixWorld);point.toArray(vertices,offset);visited[id]=stamp;}return out.fromArray(vertices,offset);};
  const candidates=rimFit&&useCache?bodySpearCandidates(mesh,triangles,right,up,center,.088,.111):null;
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  surfaces.push({triangles,candidates,vertex,groups:geometry.groups,materials});
 });
 const intersection=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),centerRight=center.dot(right),centerUp=center.dot(up),rays=[];
 const addRays=(dx,dy)=>{for(const sign of[1,-1])rays.push({sign,dx,dy,ray:new THREE.Ray(center.clone().addScaledVector(right,dx).addScaledVector(up,dy).addScaledVector(front,sign*1.1),front.clone().multiplyScalar(-sign)),closest:Infinity,hit:false,point:new THREE.Vector3()});};
 addRays(0,0);if(rimFit)for(let i=0;i<8;i++){const angle=i/8*Math.PI*2;addRays(Math.cos(angle)*.087,Math.sin(angle)*.11);}
 // Skin/project each candidate triangle once for the complete ray bundle.
 // Eighteen independent scans repeated all skin-cache reads and projections.
 function trace(filtered){
  for(const surface of surfaces){const {triangles,candidates,vertex,groups,materials}=surface,faces=filtered?candidates:null,total=faces?faces.length:triangles.length/3;for(let face=0;face<total;face++){const i=faces?faces[face]:face*3;
   vertex(triangles[i],a);vertex(triangles[i+1],b);vertex(triangles[i+2],c);
   const ax=a.dot(right)-centerRight,bx=b.dot(right)-centerRight,cx=c.dot(right)-centerRight,minX=Math.min(ax,bx,cx),maxX=Math.max(ax,bx,cx);
   if(minX>.088||maxX<-.088)continue;
   const ay=a.dot(up)-centerUp,by=b.dot(up)-centerUp,cy=c.dot(up)-centerUp,minY=Math.min(ay,by,cy),maxY=Math.max(ay,by,cy);
   if(minY>.111||maxY<-.111)continue;
   const group=materials.length>1?groups.find(g=>i>=g.start&&i<g.start+g.count):null,side=materials[group?.materialIndex||0]?.side??THREE.FrontSide;
   for(const r of rays){if(minX>r.dx||maxX<r.dx||minY>r.dy||maxY<r.dy)continue;
    if(!r.ray.intersectTriangle(side===THREE.BackSide?c:a,b,side===THREE.BackSide?a:c,side!==THREE.DoubleSide,intersection))continue;
    const distance=intersection.distanceToSquared(r.ray.origin);if(distance<r.closest&&distance<=4.84){r.closest=distance;r.hit=true;r.point.copy(intersection);r.surface=surface;r.triangle=i;}
   }
  }}
 }
 trace(useCache);if(!rays[0].hit||!rays[1].hit){for(const r of rays){r.closest=Infinity;r.hit=false;}trace(false);}
 const entry=rays[0].hit?rays[0].point:null,exit=rays[1].hit?rays[1].point:null;if(!entry||!exit)return null;
 const depth=entry.clone().sub(exit).dot(front);if(depth<.07||depth>.65)return null;
 // The bore overlaps the authored entry lip (base radius .073/.092),
 // while remaining under its outer .087/.110 silhouette. This overlap
 // keeps oblique folded coats from covering the inner tissue mouth.
 const rims=rimFit?{entryRim:[],exitRim:[]}:{};
 if(rimFit)for(let i=0;i<8;i++)for(let j=0;j<2;j++){const r=rays[2+i*2+j],origin=j?exit:entry;rims[j?'exitRim':'entryRim'].push(r.hit?clamp(a.copy(r.point).sub(origin).dot(front)*r.sign,-.07,.07):0);}
 return {anchor,rotation,front,entry,exit,depth,...rims,entryLocal:anchor.worldToLocal(entry.clone()),exitLocal:anchor.worldToLocal(exit.clone()),halfExtent:new THREE.Vector2(.073,.092)};
}

export class BodySpearVisuals {
 constructor(combat){
  this.combat=combat;this.frames=new WeakMap();this.status='loading';this.fitted=0;this.failedFits=0;
  this.ready=loadGlb(BODY_SPEAR_ANATOMY_URL).then(gltf=>{
   if(this.disposed){combat.releaseAsset(gltf.scene);return;}
   this.asset=prepareBodySpearAnatomy(gltf.scene);this.status='ready';
  }).catch(error=>{this.status='unavailable';this.error=String(error.message||error);});
 }
 frame(root,sequence=0,contact=false){
  let frame=this.frames.get(root);
  if(!frame||frame.sequence!==sequence||contact&&!frame.locked){
   const fit=fitBodySpearFrame(root);if(!fit){this.failedFits++;return frame?.sequence===sequence?frame:null;}
   frame={...fit,sequence,locked:contact};this.frames.set(root,frame);this.fitted++;
  }
  frame.anchor.localToWorld(frame.entry.copy(frame.entryLocal));frame.anchor.localToWorld(frame.exit.copy(frame.exitLocal));
  frame.anchor.getWorldQuaternion(frame.rotation);frame.front.set(0,0,1).applyQuaternion(frame.rotation).normalize();frame.depth=frame.entry.distanceTo(frame.exit);
  return frame;
 }
 component(name){const source=this.asset?.getObjectByName(name);if(!source)return null;const mesh=source.clone(true);mesh.position.set(0,0,0);mesh.quaternion.identity();mesh.scale.setScalar(1);mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.castShadow=true;return mesh;}
 addWound(state){
  if(this.status!=='ready')return null;
  const frame=this.frame(state.root,state.wound.sequence,true);if(!frame)return null;
  const entry=this.component('BodySpear_Entry'),exit=this.component('BodySpear_Exit'),tunnel=this.component('BodySpear_Tunnel');
  if(!entry||!exit||!tunnel)return null;
  state.attachments.add(entry,exit,tunnel);state.bodySpear={entry,exit,tunnel,frame};return entry;
 }
 placeWound(state,gore){
  const body=state.bodySpear;if(!body)return false;
  const frame=this.frame(state.root,state.wound.sequence,true);if(!frame)return false;
  state.attachments.position.copy(frame.entry).addScaledVector(frame.front,.001);state.attachments.quaternion.copy(frame.rotation);state.attachments.scale.setScalar(1);
  body.exit.position.set(0,0,-frame.depth-.002);body.exit.rotation.y=Math.PI;body.tunnel.position.z=-.005;body.tunnel.scale.z=Math.max(.1,(frame.depth-.006)/.20);
  state.uniforms.uSpearOpen.value=gore?1:0;state.uniforms.uSpearExtent.value.copy(frame.halfExtent);
  state.uniforms.uSpearExitExtent.value.set(.087,.106);
  state.uniforms.uBrutalCenter.value.copy(frame.entry);state.uniforms.uBrutalFront.value.copy(frame.front);
  state.uniforms.uSpearExitCenter.value.copy(frame.exit);state.uniforms.uSpearExitFront.value.copy(frame.front).negate();
  state.attachments.visible=gore&&state.root.visible;return true;
 }
 emitExit(state,wound,time){
  if(!state.bodySpear)return;
  const frame=this.frame(state.root,wound.sequence,true);if(!frame)return;
  // Through-body impulse goes out the back along the driven arm, rather than
  // a radial burst that hides the contact. Reuse the bounded existing pool.
  const combat=this.combat;
  for(let i=0;i<14;i++){
   const drop=combat.drops[(combat.cursor=(combat.cursor||0)+1)%combat.drops.length],angle=i*2.399+wound.sequence;
   drop.start.copy(frame.exit);drop.velocity.copy(frame.front).multiplyScalar(-1.7-(i%4)*.26);
   drop.velocity.add(new THREE.Vector3(Math.cos(angle)*.32,.14+(i%3)*.09,Math.sin(angle)*.32));drop.at=time;drop.size=.003+(i%3)*.001;drop.angle=angle;
  }
 }
 diagnostics(){return{status:this.status,error:this.error||null,assetVersion:1,authoring:'Blender 2.93 / 23 tracks for each of four source rigs',fitted:this.fitted,failedFits:this.failedFits};}
 dispose(){this.disposed=true;this.combat.releaseAsset(this.asset);this.frames=new WeakMap();}
}
