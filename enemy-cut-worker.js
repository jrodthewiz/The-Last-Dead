import * as THREE from './vendor/three.module.js';
import {cutSkinnedMesh} from './enemy-cut-geometry.js';
const pack=g=>g?{attributes:Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,{array:a.array,itemSize:a.itemSize}])),index:g.index.array,groups:g.groups,userData:g.userData}:null;
self.onmessage=({data})=>{
 try{
  const output=data.meshes.map(input=>{
   const g=new THREE.BufferGeometry();for(const [name,a]of Object.entries(input.attributes))g.setAttribute(name,new THREE.BufferAttribute(a.array,a.itemSize));g.setIndex(new THREE.BufferAttribute(input.index,1));g.groups=input.groups;
   const bones=input.names.map((name,i)=>{const b=new THREE.Bone();b.name=name;b.matrixWorld.fromArray(input.boneMatrices,i*16);return b;}),skeleton=new THREE.Skeleton(bones,bones.map(()=>new THREE.Matrix4()));skeleton.boneMatrices=input.boneMatrices;skeleton.update=()=>{};
   const mesh=new THREE.SkinnedMesh(g,new THREE.MeshBasicMaterial());mesh.skeleton=skeleton;mesh.matrixAutoUpdate=false;mesh.matrix.fromArray(input.matrixWorld);mesh.matrixWorld.copy(mesh.matrix);mesh.bindMatrix.fromArray(input.bindMatrix);mesh.bindMatrixInverse.fromArray(input.bindMatrixInverse);
   const result=cutSkinnedMesh(mesh,{region:data.frame.region,point:new THREE.Vector3().fromArray(data.frame.point),normal:new THREE.Vector3().fromArray(data.frame.normal),capMaterialIndex:data.frame.capMaterialIndex});
   return{retained:pack(result.retained),detached:pack(result.detached),loops:result.loops,removedTriangles:result.removedTriangles};
  });
  const buffers=[];for(const result of output)for(const g of [result.retained,result.detached])if(g){buffers.push(g.index.buffer);for(const a of Object.values(g.attributes))buffers.push(a.array.buffer);}
  self.postMessage({id:data.id,output},buffers);
 }catch(error){self.postMessage({id:data.id,error:String(error.stack||error)});}
};
