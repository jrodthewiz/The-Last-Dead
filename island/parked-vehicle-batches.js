import * as T from '../vendor/three.module.js';
import {mergeGeometries} from '../vendor/utils/BufferGeometryUtils.js';
import {stylizeModel} from './retro-materials.js';
import {paintStylizedEntity} from './detail-materials.js';
import {freezeLocalTransforms} from './render-lifecycle.js';

// Parked sedans are rigid scenery. Keep the authored body, wheels and atlas,
// but submit their shared opaque surface once per spatial tile. Trucks that
// can be driven never enter this path. Incompatible future assets fall back
// to the original individual models rather than losing material behavior.
export function createParkedVehicleBatches(scene,template,placements,floorAt){
 const model=template.scene.clone(true),bounds=new T.Box3().setFromObject(model);
 const scale=4.8/Math.max(bounds.max.x-bounds.min.x,bounds.max.z-bounds.min.z);
 model.scale.setScalar(scale);
 model.position.set(-(bounds.max.x+bounds.min.x)*scale/2,-bounds.min.y*scale,-(bounds.max.z+bounds.min.z)*scale/2);
 model.updateMatrixWorld(true);
 const pieces=[];let sourceMaterial=null,compatible=true;
 model.traverseVisible(mesh=>{
  if(!mesh.isMesh)return;
  const m=mesh.material,g=mesh.geometry;
  if(mesh.isSkinnedMesh||mesh.isInstancedMesh||Array.isArray(m)||m.transparent||m.opacity<1||m.depthWrite===false||Object.keys(g.morphAttributes).length||g.drawRange.start!==0||g.drawRange.count!==Infinity||mesh.matrixWorld.determinant()<0){compatible=false;return;}
  if(sourceMaterial&&sourceMaterial!==m){compatible=false;return;}
  sourceMaterial=m;
  pieces.push(g.clone().applyMatrix4(mesh.matrixWorld));
 });
 if(!compatible||!pieces.length){for(const g of pieces)g.dispose();return null;}
 const geometry=mergeGeometries(pieces);
 for(const g of pieces)g.dispose();
 if(!geometry)return null;
 stylizeModel(model,{entity:'vehicle'});let material;model.traverseVisible(mesh=>{if(mesh.isMesh)material=mesh.material;});
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 // Separate the existing dark wreck material from intact cars. Merging rigid
 // geometry avoids introducing instancing shader variants during startup.
 const wreckMaterial=material.clone();wreckMaterial.color.multiplyScalar(.65);paintStylizedEntity(wreckMaterial,'wreck');
 const tiles=new Map();
 for(const p of placements){const x=Math.floor(p.x/192),z=Math.floor(p.z/192),key=x+','+z+':'+(p.wreck?'wreck':'parked');if(!tiles.has(key))tiles.set(key,{x,z,wreck:!!p.wreck,items:[]});tiles.get(key).items.push(p);}
 const dummy=new T.Object3D(),meshes=[];
 for(const [key,{x,z,wreck,items}]of tiles){
  const surfaces=[];
  for(const p of items){
   dummy.position.set(p.x-x*192,floorAt(p.x,p.z)-.015,p.z-z*192);dummy.rotation.set(0,p.angle+Math.PI,0);dummy.updateMatrix();
   surfaces.push(geometry.clone().applyMatrix4(dummy.matrix));
  }
  const merged=mergeGeometries(surfaces);for(const g of surfaces)g.dispose();
  const mesh=new T.Mesh(merged,wreck?wreckMaterial:material);
  mesh.name='Parked sedans '+key;mesh.position.set(x*192,0,z*192);mesh.castShadow=mesh.receiveShadow=true;
  merged.computeBoundingSphere();scene.add(mesh);freezeLocalTransforms(mesh);meshes.push(mesh);
 }
 geometry.dispose();
 if(placements.length){
  const c=document.createElement('canvas');c.width=c.height=64;
  const ctx=c.getContext('2d'),g=ctx.createRadialGradient(32,32,2,32,32,32);
  g.addColorStop(0,'rgba(8,12,10,.64)');g.addColorStop(.5,'rgba(8,12,10,.30)');g.addColorStop(1,'rgba(8,12,10,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,64,64);
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
  const sGeo=new T.PlaneGeometry(5.4,2.5).rotateX(-Math.PI/2);
  const sMat=new T.MeshBasicMaterial({map:tex,transparent:true,opacity:.74,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  const sMesh=new T.InstancedMesh(sGeo,sMat,placements.length);
  for(let i=0;i<placements.length;i++){
   const p=placements[i];dummy.position.set(p.x,floorAt(p.x,p.z)+.012,p.z);dummy.rotation.set(0,p.angle+Math.PI,0);dummy.updateMatrix();
   sMesh.setMatrixAt(i,dummy.matrix);
  }
  sMesh.instanceMatrix.needsUpdate=true;sMesh.computeBoundingSphere();sMesh.name='Parked sedan contact shadows';scene.add(sMesh);freezeLocalTransforms(sMesh);
 }
 return {meshes,stats:{cars:placements.length,batches:meshes.length,sourcePieces:pieces.length,strategy:'merged'}};
}
