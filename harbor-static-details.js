import * as THREE from './vendor/three.module.js';
import {createCoastalInstances} from './coastal-instancing.js';

// Only explicitly static sources are admitted by the caller. Borrow exact
// geometry/material identities; world teardown still owns those resources.
export function instanceHarborStaticDetails(root,{eligible,chunkSize=32,maxExtent=32}={}){
 const buckets=new Map(),records=[],meshes=[],inverse=new THREE.Matrix4(),matrix=new THREE.Matrix4();
 root.updateMatrixWorld(true);inverse.copy(root.matrixWorld).invert();
 const box=new THREE.Box3(),centre=new THREE.Vector3(),size=new THREE.Vector3();
 root.traverse(o=>{
  if(!o.isMesh||o.isInstancedMesh||o.isSkinnedMesh||!o.visible||!eligible?.(o))return;
  const g=o.geometry,materials=Array.isArray(o.material)?o.material:[o.material];
  if(Object.keys(g.morphAttributes).length||o.morphTargetInfluences||materials.some(m=>!m||m.transparent))return;
  if(o.onBeforeRender!==THREE.Object3D.prototype.onBeforeRender||o.onAfterRender!==THREE.Object3D.prototype.onAfterRender)return;
  for(let p=o.parent;p;p=p.parent){if(!p.visible||p.userData.noBatch)return;if(p===root)break;}
  // Negative scale reverses face winding and cannot share an ordinary batch.
  if(o.matrixWorld.determinant()<=0)return;
  if(!g.boundingBox)g.computeBoundingBox();box.copy(g.boundingBox).applyMatrix4(o.matrixWorld);
  box.getSize(size);if(Math.max(size.x,size.y,size.z)>maxExtent)return;
  box.getCenter(centre);
  const key=[Math.floor(centre.x/chunkSize),Math.floor(centre.z/chunkSize),g.uuid,
   ...materials.map(m=>m.uuid),o.layers.mask,o.castShadow,o.receiveShadow,o.renderOrder,o.frustumCulled].join('/');
  if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(o);
 });
 for(const sources of buckets.values()){
  if(sources.length<2)continue;
  const source=sources[0],mesh=createCoastalInstances(source.geometry,source.material,sources.length);
  mesh.name='HarborStaticDetails';mesh.userData.harborStaticDetails=true;
  mesh.userData.sourceNames=sources.map(o=>o.name);mesh.userData.noBatch=true;
  mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;
  mesh.layers.mask=source.layers.mask;mesh.renderOrder=source.renderOrder;mesh.frustumCulled=source.frustumCulled;
  sources.forEach((o,index)=>{
   matrix.multiplyMatrices(inverse,o.matrixWorld);mesh.setMatrixAt(index,matrix);
   records.push({object:o,visible:o.visible});o.visible=false;
  });
  mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);meshes.push(mesh);
 }
 let disposed=false,enabled=true;
 const materialDraws=o=>Array.isArray(o.material)?o.geometry.groups.length:1;
 const diagnostics={sourceMeshes:records.length,instanceMeshes:meshes.length,
  sourceDraws:records.reduce((n,r)=>n+materialDraws(r.object),0),
  instanceDraws:meshes.reduce((n,m)=>n+materialDraws(m),0),chunkSize,maxExtent,
  strategy:'exact static geometry/material identity;32m chunks;borrowed resources'};
 return{meshes,diagnostics,setEnabled(value){
  if(disposed)return;enabled=!!value;
  for(const r of records)r.object.visible=enabled?false:r.visible;
  for(const m of meshes)m.visible=enabled;
 },dispose(){
  if(disposed)return;disposed=true;
  for(const r of records)r.object.visible=r.visible;
  for(const mesh of meshes){mesh.removeFromParent();mesh.dispose();}
 }};
}

export function isStaticHarborDetail(object,world){
 // Direct authored slabs/paint and the immutable imported placement tree.
 // Truck, chapter mechanisms, six toggled rooms and Blackwater stay separate.
 if(object.parent===world.root&&object.geometry===world.unitBox)return true;
 for(let p=object.parent;p&&p!==world.root;p=p.parent){if(p===world.thaiWorld.root)return true;}
 return false;
}
