import * as THREE from './vendor/three.module.js';
import {fluidDropGeometry} from './combat-detail-v2.js';

const UP=new THREE.Vector3(0,1,0),direction=new THREE.Vector3(),color=new THREE.Color();
export const BLOOD_FLIGHT=Object.freeze({gravity:9.81,drag:1.7});
export const BLOOD_DROP_COLORS=Object.freeze([0x991923,0xad202b,0x86121c,0x710e17]);

/** Exact linear-drag trajectory in world metres; sampled age owns the clock. */
export function bloodFlight(start,initialVelocity,age,position,velocity){
  const t=Math.max(0,Number.isFinite(age)?age:0),{gravity:g,drag:k}=BLOOD_FLIGHT;
  const decay=Math.exp(-k*t),travel=-Math.expm1(-k*t)/k;
  position.set(start.x+initialVelocity.x*travel,start.y+(initialVelocity.y+g/k)*travel-g*t/k,start.z+initialVelocity.z*travel);
  velocity.set(initialVelocity.x*decay,(initialVelocity.y+g/k)*decay-g/k,initialVelocity.z*decay);
  return position;
}

/** Fixed pooled volume droplets: wet reflection, without emissive blood cards. */
export function createBloodDropletPool(capacity,name='BloodFluidDroplets'){
  const material=new THREE.MeshPhysicalMaterial({name:'BloodVolumePBR',color:0xffffff,vertexColors:true,roughness:.29,metalness:0,
    clearcoat:0,specularIntensity:.35,envMapIntensity:.38,emissiveIntensity:0});
  // The close camera lamp otherwise turns tiny fluid surfaces silver. Keep
  // their lit red diffuse/body response separate from restrained wet glints.
  material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
    vec3 fluidLimit=max(diffuseColor.rgb*.85,vec3(.002));
    reflectedLight.directDiffuse/=vec3(1.)+reflectedLight.directDiffuse/fluidLimit;
    reflectedLight.directSpecular/=vec3(1.)+reflectedLight.directSpecular/vec3(.045);
  `);};
  material.customProgramCacheKey=()=> 'blood-fluid-volume-v2';
  const mesh=new THREE.InstancedMesh(fluidDropGeometry(1),material,capacity);
  mesh.name=name;mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.setColorAt(0,new THREE.Color(BLOOD_DROP_COLORS[0]));mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  return mesh;
}

/** Orient stretch along velocity, preserving volume and a rounded cross-section. */
export function stampBloodDroplet(mesh,index,marker,position,velocity,radius,seed,remaining=1){
  marker.position.copy(position);
  const speed=velocity.length();
  if(speed>1e-5)marker.quaternion.setFromUnitVectors(UP,direction.copy(velocity).multiplyScalar(1/speed));else marker.quaternion.identity();
  const stretch=1+Math.min(2.1,speed*.32),fade=THREE.MathUtils.smoothstep(remaining,0,.18);
  const width=Math.max(0,radius)*fade/Math.sqrt(stretch);
  marker.scale.set(width,radius*stretch*fade,width);marker.updateMatrix();mesh.setMatrixAt(index,marker.matrix);
  mesh.setColorAt(index,color.setHex(BLOOD_DROP_COLORS[Math.abs(Math.floor(seed))%BLOOD_DROP_COLORS.length]));
}

export function finishBloodDropletPool(mesh,count){mesh.count=count;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
