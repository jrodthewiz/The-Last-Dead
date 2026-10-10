import * as THREE from './vendor/three.module.js';
import {createCoastalInstances} from './coastal-instancing.js';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';

const FIXED_NAMES=new Set(['SignMount','CastMooringBollard','MooringReflectiveBand','NavigationBuoy','EntranceJamb','EntranceLintel','EntranceThreshold','EntranceRainHood','EntranceIdentityBand','EntranceLuminaire']);
export function isFixedHarborDetail(object,world){
 if(!FIXED_NAMES.has(object.name))return false;
 if(object.parent===world.root)return true;
 return object.parent?.parent===world.root&&object.parent.name.startsWith('HarborEntrance:');
}
function attributesKey(g){return Object.keys(g.attributes).sort().map(k=>{const a=g.attributes[k];return`${k}:${a.itemSize}:${a.normalized}:${a.array?.constructor.name}`;}).join('|');}

// Only explicitly static sources are admitted by the caller. Borrow exact
// geometry/material identities; world teardown still owns those resources.
export function instanceHarborStaticDetails(root,{eligible,mergeEligible,chunkSize=32,maxExtent=32}={}){
 const buckets=new Map(),records=[],meshes=[],mergeBuckets=new Map(),ownedGeometries=[],inverse=new THREE.Matrix4(),matrix=new THREE.Matrix4();
 root.updateMatrixWorld(true);inverse.copy(root.matrixWorld).invert();
 const box=new THREE.Box3(),centre=new THREE.Vector3(),size=new THREE.Vector3();
 root.traverse(o=>{
  if(!o.isMesh||o.isInstancedMesh||o.isSkinnedMesh||!o.visible||!eligible?.(o))return;
  const g=o.geometry,materials=Array.isArray(o.material)?o.material:[o.material];
  if(o.children.length||o.customDepthMaterial||o.customDistanceMaterial||g.userData.noBatch||g.userData.dynamic||o.userData.noBatch||o.userData.dynamic||o.userData.animated||materials.some(m=>m?.userData?.noBatch||m?.userData?.dynamic))return;
  if(Object.keys(g.morphAttributes).length||o.morphTargetInfluences||materials.some(m=>!m||m.transparent))return;
  if(['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow'].some(k=>o[k]!==THREE.Object3D.prototype[k]))return;
  const total=g.index?.count??g.attributes.position.count;if(g.drawRange.start!==0||g.drawRange.count<total)return;
  for(let p=o.parent;p;p=p.parent){if(!p.visible||p.userData.noBatch||p.userData.dynamic||p.userData.animated)return;if(p===root)break;}
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
  if(sources.length<2){
   const o=sources[0],g=o.geometry;
   if(!mergeEligible?.(o)||Array.isArray(o.material)||Object.values(g.attributes).some(a=>a.isInterleavedBufferAttribute||a.isInstancedBufferAttribute)||g.isInstancedBufferGeometry)continue;
   box.copy(g.boundingBox).applyMatrix4(o.matrixWorld);box.getCenter(centre);
   const key=[Math.floor(centre.x/chunkSize),Math.floor(centre.z/chunkSize),o.material.uuid,o.layers.mask,o.castShadow,o.receiveShadow,o.renderOrder,o.frustumCulled,!!g.index,attributesKey(g)].join('/');
   if(!mergeBuckets.has(key))mergeBuckets.set(key,[]);mergeBuckets.get(key).push(o);continue;
  }
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
 for(const sources of mergeBuckets.values()){
  if(sources.length<2)continue;
  const source=sources[0],pieces=sources.map(o=>{matrix.multiplyMatrices(inverse,o.matrixWorld);return o.geometry.clone().applyMatrix4(matrix);});
  const geometry=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());
  if(!geometry)throw new Error('Fixed harbor detail attribute merge failed');
  geometry.clearGroups();geometry.computeBoundingBox();geometry.computeBoundingSphere();ownedGeometries.push(geometry);
  const mesh=new THREE.Mesh(geometry,source.material);mesh.name='HarborFixedDetails';mesh.userData.noBatch=true;mesh.userData.harborStaticDetails=true;mesh.userData.sourceNames=sources.map(o=>o.name);
  mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;mesh.layers.mask=source.layers.mask;mesh.renderOrder=source.renderOrder;mesh.frustumCulled=source.frustumCulled;
  mesh.matrixAutoUpdate=false;root.add(mesh);meshes.push(mesh);for(const o of sources){records.push({object:o,visible:o.visible});o.visible=false;}
 }
 let disposed=false,enabled=true;
 const materialDraws=o=>Array.isArray(o.material)?o.geometry.groups.length:1;
 const diagnostics={sourceMeshes:records.length,instanceMeshes:meshes.length,
  sourceDraws:records.reduce((n,r)=>n+materialDraws(r.object),0),
  instanceDraws:meshes.reduce((n,m)=>n+materialDraws(m),0),chunkSize,maxExtent,
  mergedMeshes:ownedGeometries.length,mergedBufferBytes:ownedGeometries.reduce((n,g)=>n+(g.index?.array.byteLength||0)+Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0),0),
  sourceNames:records.reduce((counts,r)=>(counts[r.object.name]=(counts[r.object.name]||0)+1,counts),{}),
  strategy:'exact identity instancing; explicit fixed-name compatible geometry merges;32m chunks;borrowed materials'};
 return{meshes,diagnostics,setEnabled(value){
  if(disposed)return;enabled=!!value;
  for(const r of records)r.object.visible=enabled?false:r.visible;
  for(const m of meshes)m.visible=enabled;
 },dispose(){
  if(disposed)return;disposed=true;
  for(const r of records)r.object.visible=r.visible;
  for(const mesh of meshes){mesh.removeFromParent();mesh.dispose?.();}
  for(const geometry of ownedGeometries)geometry.dispose();
 }};
}

export function isStaticHarborDetail(object,world){
 // Direct authored slabs/paint and the immutable imported placement tree.
 // Truck, chapter mechanisms, six toggled rooms and Blackwater stay separate.
 if(object.parent===world.root&&object.geometry===world.unitBox)return true;
 if(isFixedHarborDetail(object,world))return true;
 for(let p=object.parent;p&&p!==world.root;p=p.parent){if(p===world.thaiWorld.root)return true;}
 return false;
}
