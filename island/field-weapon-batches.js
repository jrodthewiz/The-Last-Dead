import * as T from '../vendor/three.module.js';
import {mergeGeometries} from '../vendor/utils/BufferGeometryUtils.js';

// A found weapon is a rigid snapshot, independently captured from the live
// viewmodel. Flatten only compatible opaque surfaces of that snapshot. Shared
// source geometry/materials, transparent effects and mirrored parts stay owned.
export function batchFieldWeapon(root){
 root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),matrix=new T.Matrix4(),buckets=new Map();let before=0,removed=0,added=0;
 root.traverseVisible(mesh=>{
  if(!mesh.isMesh)return;before++;const material=mesh.material,g=mesh.geometry;
  if(mesh===root||mesh.children.length||mesh.isSkinnedMesh||mesh.isInstancedMesh||Array.isArray(material)||material.transparent||material.depthWrite===false||material.opacity<.999||Object.keys(g.morphAttributes).length||g.drawRange.start!==0||g.drawRange.count!==Infinity)return;
  matrix.multiplyMatrices(inverse,mesh.matrixWorld);if(matrix.determinant()<0)return;
  const signature=Object.keys(g.attributes).sort().map(k=>{const a=g.attributes[k];return`${k}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`;}).join('|');
  let byState=buckets.get(material);if(!byState){byState=new Map();buckets.set(material,byState);}const key=`${signature}:${mesh.renderOrder}:${mesh.castShadow}:${mesh.receiveShadow}:${mesh.layers.mask}`;
  if(!byState.has(key))byState.set(key,[]);byState.get(key).push({mesh,matrix:matrix.clone()});
 });
 for(const [material,states]of buckets)for(const pieces of states.values()){
  if(pieces.length<2)continue;const geometries=pieces.map(p=>{const g=p.mesh.geometry.clone().applyMatrix4(p.matrix);if(!g.index)return g;const expanded=g.toNonIndexed();g.dispose();return expanded;});
  const geometry=mergeGeometries(geometries);for(const g of geometries)g.dispose();if(!geometry)continue;
  geometry.computeBoundingBox();geometry.computeBoundingSphere();const first=pieces[0].mesh,mesh=new T.Mesh(geometry,material);mesh.name='Field weapon surfaces';mesh.renderOrder=first.renderOrder;mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;mesh.layers.mask=first.layers.mask;
  for(const p of pieces)p.mesh.removeFromParent();root.add(mesh);removed+=pieces.length;added++;
 }
 return{before,after:before-removed+added,merged:removed};
}

export function updateWeaponFinds(caches,state,camera){
 for(const c of caches)c.mesh.visible=!state.armory[c.weapon].owned&&c.mesh.position.distanceToSquared(camera)<110**2;
}
