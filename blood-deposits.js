import * as THREE from './vendor/three.module.js';
import {createBloodSurfaceMaterial} from './blood-surface.js';

/** Cosmetic contact evidence: one draw, fixed slots, no per-hit resources. */
export class BloodDeposits {
 constructor(parent){
  this.capacity=64;this.cursor=0;this.active=0;
  const geometry=new THREE.PlaneGeometry(1,1);
  geometry.setAttribute('bloodState',new THREE.InstancedBufferAttribute(new Float32Array(this.capacity*2),2));
  geometry.setAttribute('depositFade',new THREE.InstancedBufferAttribute(new Float32Array(this.capacity),1));
  const material=createBloodSurfaceMaterial({instanced:true});
  const compile=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
   compile(shader);
   shader.vertexShader='attribute float depositFade; varying float vDepositFade;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvDepositFade=depositFade;');
   shader.fragmentShader='varying float vDepositFade;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a*=vDepositFade;\n#include <alphatest_fragment>');
  };
  material.customProgramCacheKey=()=> 'blood-grounded-deposits-v1';
  this.mesh=new THREE.InstancedMesh(geometry,material,this.capacity);
  this.mesh.name='GroundedBloodSpatter';this.mesh.frustumCulled=false;this.mesh.count=0;
  this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);parent.add(this.mesh);
  this.slots=Array.from({length:this.capacity},()=>({position:new THREE.Vector3(),rotation:new THREE.Quaternion(),age:99,duration:24,size:0,variant:3}));
  this.object=new THREE.Object3D();this.forward=new THREE.Vector3(0,0,1);this.roll=new THREE.Quaternion();
 }
 add(position,normal,size,variant=3,seed=0){
  const slot=this.slots[this.cursor++%this.capacity];
  slot.position.copy(position).addScaledVector(normal,.014+(this.cursor%3)*.0007);
  slot.rotation.setFromUnitVectors(this.forward,normal);
  this.roll.setFromAxisAngle(this.forward,seed*2.399);slot.rotation.multiply(this.roll);
  slot.size=size;slot.variant=variant;slot.age=0;slot.duration=22+(Math.abs(seed)%7);
 }
 update(dt,gore=true){
  let count=0;
  for(const slot of this.slots){
   slot.age+=dt;
   if(slot.age>=slot.duration||!gore)continue;
   this.object.position.copy(slot.position);this.object.quaternion.copy(slot.rotation);
   this.object.scale.setScalar(slot.size*(1+.08*(1-Math.exp(-slot.age*3))));this.object.updateMatrix();
   this.mesh.setMatrixAt(count,this.object.matrix);
   this.mesh.geometry.attributes.bloodState.setXY(count,slot.variant,Math.min(1,slot.age/16));
   this.mesh.geometry.attributes.depositFade.setX(count,Math.min(1,(slot.duration-slot.age)/3));
   count++;
  }
  this.active=count;this.mesh.count=count;this.mesh.instanceMatrix.needsUpdate=true;
  this.mesh.geometry.attributes.bloodState.needsUpdate=true;this.mesh.geometry.attributes.depositFade.needsUpdate=true;
 }
 clear(){for(const slot of this.slots)slot.age=99;this.cursor=0;this.active=0;this.mesh.count=0;}
}
