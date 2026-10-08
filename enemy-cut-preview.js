import * as THREE from './vendor/three.module.js';
import {anatomyRegion} from './enemy-cut-geometry.js';
const membershipCache=new WeakMap();
export function previewGeometry(source,mesh){
 // Preview masks never edit the imported skin. Reuse its already-uploaded
 // attributes instead of copying/uploading every full skin at impact time.
 const geometry=new THREE.BufferGeometry();geometry.index=source.index;geometry.attributes={...source.attributes};geometry.morphAttributes={...source.morphAttributes};geometry.morphTargetsRelative=source.morphTargetsRelative;
 geometry.groups=source.groups.map(group=>({...group}));geometry.drawRange={...source.drawRange};geometry.boundingBox=source.boundingBox?.clone()||null;geometry.boundingSphere=source.boundingSphere?.clone()||null;
 geometry.userData={...source.userData};delete geometry.userData.sharedAsset;geometry.userData.corpseSourceGeometry=source.userData.corpseSourceGeometry||source.uuid;
 let attributes=membershipCache.get(source.attributes.position.array);
 if(!attributes){
  const count=source.attributes.position.count,a=new Float32Array(count*3),b=new Float32Array(count*3),weights=source.attributes.skinWeight,indices=source.attributes.skinIndex,names=mesh.skeleton.bones.map(b=>anatomyRegion(b.name));
  for(let i=0;i<count;i++){const sums=[0,0,0,0,0,0];for(let j=0;j<4;j++)sums[names[indices.getComponent(i,j)]||0]+=weights.getComponent(i,j);let region=0;for(let j=1;j<6;j++)if(sums[j]>sums[region])region=j;if(region>=1&&region<=3)a[i*3+region-1]=1;if(region>=4)b[i*3+region-4]=1;}
  attributes=[new THREE.Float32BufferAttribute(a,3),new THREE.Float32BufferAttribute(b,3)];membershipCache.set(source.attributes.position.array,attributes);
 }
 // Each preview owns its small masks. Disposing one preview must not delete
 // buffers owned by another preview or by the still-visible original actor.
 geometry.setAttribute('anatomyA',attributes[0].clone());geometry.setAttribute('anatomyB',attributes[1].clone());
 let disposed=false;geometry.dispose=function(){if(disposed)return;disposed=true;const{anatomyA,anatomyB}=this.attributes;this.index=null;this.attributes={anatomyA,anatomyB};this.morphAttributes={};THREE.BufferGeometry.prototype.dispose.call(this);};
 return geometry;
}
export function cutPreviewMaterial(source,{region,plane,offcut=false}){
 const material=source.clone(),previous=source.onBeforeCompile,cache=source.customProgramCacheKey();
 const uniforms={uAnatomyRegion:{value:region},uAnatomyPlane:{value:plane},uAnatomyOffcut:{value:offcut?1:0}};
 material.onBeforeCompile=shader=>{
  previous.call(material,shader);Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='attribute vec3 anatomyA,anatomyB;varying vec3 vAnatomyA,vAnatomyB,vAnatomyP;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvAnatomyA=anatomyA;vAnatomyB=anatomyB;vAnatomyP=transformed;');
  shader.fragmentShader='uniform float uAnatomyRegion,uAnatomyOffcut;uniform vec4 uAnatomyPlane;varying vec3 vAnatomyA,vAnatomyB,vAnatomyP;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
   float m=uAnatomyRegion<0.?1.:uAnatomyRegion<1.5?vAnatomyA.x:uAnatomyRegion<2.5?vAnatomyA.y:uAnatomyRegion<3.5?vAnatomyA.z:uAnatomyRegion<4.5?vAnatomyB.x:vAnatomyB.y;
   bool sever=m>.5&&dot(vec4(vAnatomyP,1.),uAnatomyPlane)>0.;if(uAnatomyOffcut>.5?!sever:sever)discard;
  `);
 };
 material.customProgramCacheKey=()=>cache+'-anatomy-impact-preview-v1';delete material.userData.sharedAsset;delete material.userData.sharedLibrary;material.userData.afterlifeOwned=true;return material;
}
export const unpackGeometry=data=>{
 if(!data)return null;const g=new THREE.BufferGeometry();for(const [name,a]of Object.entries(data.attributes))g.setAttribute(name,new THREE.BufferAttribute(a.array,a.itemSize));g.setIndex(new THREE.BufferAttribute(data.index,1));g.groups=data.groups;g.userData=data.userData;g.computeBoundingSphere();return g;
};
