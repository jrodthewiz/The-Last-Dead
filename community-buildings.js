import * as THREE from './vendor/three.module.js';
import {createGeometry} from './assets/community/night-street-geometry.js';

export function createHarborTenement(options={}) {
 for(const [key,min,max] of [['width',8,18],['floors',1,3],['seed',0,1]]){
  if(options[key]!==undefined&&(!Number.isFinite(options[key])||options[key]<min||options[key]>max))throw new RangeError(`Invalid tenement ${key}`);
 }
 if(options.floors!==undefined&&!Number.isInteger(options.floors))throw new RangeError('Tenement floors must be an integer');
 const kit=createGeometry(options),root=new THREE.Group();root.name='CommunityHarborTenement';
 const wall=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.91,vertexColors:true});
 const colors=new Float32Array(kit.wall.attributes.position.count*3),roles=kit.wall.attributes.aRole;
 const palette=[0xb0a698,0x777567,0xc5c0ac,0x777970,0x53615c,0x8f7857,0x4c5452,0x999584,0x928c7d,0x858d85];
 const color=new THREE.Color();for(let i=0;i<roles.count;i++){color.set(palette[Math.round(roles.getX(i))]??palette[0]);color.toArray(colors,i*3);}
 kit.wall.setAttribute('color',new THREE.BufferAttribute(colors,3));
 const materials={wall,glass:new THREE.MeshStandardMaterial({color:0x344442,roughness:.24,metalness:.38}),trim:new THREE.MeshStandardMaterial({color:0x647068,roughness:.75}),metal:new THREE.MeshStandardMaterial({color:0x514c40,roughness:.71,metalness:.5})};
 for(const key of ['wall','glass','trim','metal']){const mesh=new THREE.Mesh(kit[key],materials[key]);mesh.name='Tenement:'+key;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}
 root.userData={source:'StarKnightt/night-street (MIT)',triangles:kit.triangles,draws:4};
 return root;
}
