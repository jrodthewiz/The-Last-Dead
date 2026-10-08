import * as THREE from './vendor/three.module.js';

// A bounded local map follows exploration. This is one cached shadow region,
// not a cascade or an assertion of shadows across the entire coast at once.
export function createHarborShadowCoverage(light,{recenterDistance=4}={}){
 const offset=light.position.clone().sub(light.target.position),back=offset.clone().normalize();
 const right=new THREE.Vector3().crossVectors(light.up,back).normalize();
 const up=new THREE.Vector3().crossVectors(back,right).normalize();
 const basis=new THREE.Matrix4().makeBasis(right,up,back),inverse=basis.clone().invert();
 const desired=new THREE.Vector3(),committed=new THREE.Vector3(),anchor=new THREE.Vector3();
 const texelX=(light.shadow.camera.right-light.shadow.camera.left)/light.shadow.mapSize.x;
 const texelY=(light.shadow.camera.top-light.shadow.camera.bottom)/light.shadow.mapSize.y;
 let initialized=false,updates=0;
 return{update(x,y,z){
  if(![x,y,z].every(Number.isFinite))return false;
  desired.set(x,y,z).applyMatrix4(inverse);
  if(initialized&&Math.abs(desired.x-committed.x)<recenterDistance&&Math.abs(desired.y-committed.y)<recenterDistance&&Math.abs(desired.z-committed.z)<8)return false;
  committed.set(Math.round(desired.x/texelX)*texelX,Math.round(desired.y/texelY)*texelY,Math.round(desired.z/8)*8);
  anchor.copy(committed).applyMatrix4(basis);
  light.target.position.copy(anchor);light.position.copy(anchor).add(offset);
  light.updateMatrixWorld(true);light.target.updateMatrixWorld(true);
  light.shadow.needsUpdate=true;initialized=true;updates++;return true;
 },diagnostics(){return{strategy:'one local cached map;light-space texel snapping;4m recenter guard',
  mapSize:light.shadow.mapSize.toArray(),footprint:[light.shadow.camera.right-light.shadow.camera.left,light.shadow.camera.top-light.shadow.camera.bottom],
  worldTexel:[texelX,texelY],committedLightCenter:committed.toArray(),target:light.target.position.toArray(),updates};}};
}
