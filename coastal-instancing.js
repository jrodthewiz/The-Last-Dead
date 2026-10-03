import * as THREE from './vendor/three.module.js';

// Native Three embeds uniform matrix capacity in WGSL. Sharing power-of-two
// capacities reduces shader variants across otherwise identical spatial bins.
// Draw count and bounds still use only the actual populated instances.
export function createCoastalInstances(geometry,material,count){
 if(!Number.isSafeInteger(count)||count<=0)throw new RangeError('Coastal instance count must be a positive safe integer');
 const capacity=2**Math.ceil(Math.log2(count));
 const mesh=new THREE.InstancedMesh(geometry,material,capacity);
 mesh.count=count;
 mesh.userData.coastalInstanceCapacity=capacity;
 return mesh;
}
