import * as T from '../vendor/three.module.js';
import {mergeGeometries} from '../vendor/utils/BufferGeometryUtils.js';
import {stylizeModel} from './retro-materials.js';
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
 stylizeModel(model);let material;model.traverseVisible(mesh=>{if(mesh.isMesh)material=mesh.material;});
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 // Separate the existing dark wreck material from intact cars. Merging rigid
 // geometry avoids introducing instancing shader variants during startup.
 const wreckMaterial=material.clone();wreckMaterial.color.multiplyScalar(.65);
 const tiles=new Map();
 for(const p of placements){const x=Math.floor(p.x/192),z=Math.floor(p.z/192),key=x+','+z+':'+(p.wreck?'wreck':'parked');if(!tiles.has(key))tiles.set(key,{x,z,wreck:!!p.wreck,items:[]});tiles.get(key).items.push(p);}
 const dummy=new T.Object3D(),meshes=[];
 for(const [key,{x,z,wreck,items}]of tiles){
  const surfaces=[];
  for(const p of items){
   dummy.position.set(p.x-x*192,floorAt(p.x,p.z)+.12,p.z-z*192);dummy.rotation.set(0,p.angle+Math.PI,0);dummy.updateMatrix();
   surfaces.push(geometry.clone().applyMatrix4(dummy.matrix));
  }
  const merged=mergeGeometries(surfaces);for(const g of surfaces)g.dispose();
  const mesh=new T.Mesh(merged,wreck?wreckMaterial:material);
  mesh.name='Parked sedans '+key;mesh.position.set(x*192,0,z*192);mesh.castShadow=mesh.receiveShadow=true;
  merged.computeBoundingSphere();scene.add(mesh);freezeLocalTransforms(mesh);meshes.push(mesh);
 }
 geometry.dispose();
 return {meshes,stats:{cars:placements.length,batches:meshes.length,sourcePieces:pieces.length,strategy:'merged'}};
}
