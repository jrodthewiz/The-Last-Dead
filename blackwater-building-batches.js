import * as THREE from './vendor/three.module.js';
import {BundleGroup} from './vendor/three.webgpu.js';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';

const INTERIOR_SLOTS=new Set(['furnitureWood','interiorWood','interiorTile','rug','fabric']);
function fullTriangleCount(geometry){return(geometry.index?.count??geometry.attributes.position.count)/3;}
function attributesKey(geometry){
 return Object.keys(geometry.attributes).sort().map(name=>{
  const attribute=geometry.attributes[name];
  return`${name}:${attribute.itemSize}:${attribute.normalized}:${attribute.array?.constructor.name||attribute.data?.array.constructor.name}`;
 }).join('|');
}
function exclusionReason(object,modelRoot){
 for(let ancestor=object;ancestor;ancestor=ancestor.parent){
  if(!ancestor.visible)return'hidden';
  if(ancestor.userData.noBatch||ancestor.userData.dynamic||ancestor.userData.animated)return'protected';
  if(ancestor===modelRoot)break;
 }
 if(object.isSkinnedMesh||object.isInstancedMesh||object.geometry.isInstancedBufferGeometry||object.children.length)return'dynamic-or-attached';
 if(object.geometry.userData.noBatch||object.geometry.userData.dynamic||object.material.userData?.noBatch||object.material.userData?.dynamic)return'protected';
 if(Object.keys(object.geometry.morphAttributes).some(key=>object.geometry.morphAttributes[key].length)||object.morphTargetInfluences?.length)return'morph';
 if(['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow'].some(key=>object[key]!==THREE.Object3D.prototype[key]))return'object-hook';
 if(object.customDepthMaterial||object.customDistanceMaterial)return'custom-shadow';
 if(Array.isArray(object.material))return'material-array';
 const count=object.geometry.index?.count??object.geometry.attributes.position.count;
 if(object.geometry.drawRange.start!==0||object.geometry.drawRange.count<count)return'partial-draw';
 return null;
}

// Static architecture only. Models remain the owners of source buffers,
// materials, semantic roots and gameplay plans. This helper owns merged buffers.
export function createBlackwaterBuildingBatches(root,models,{chunkSize=48,downtownBuildingIds=[],maxVertices=256000,nativeBundles=false}={}){
 if(!Number.isFinite(chunkSize)||chunkSize<=0)throw new RangeError('Building chunkSize must be positive');
 if(!Number.isSafeInteger(maxVertices)||maxVertices<3)throw new RangeError('Building maxVertices must be a positive triangle-capable integer');
 root.updateWorldMatrix(true,true);
 const inverseRoot=root.matrixWorld.clone().invert(),groups=new Map(),states=[],ownedGeometries=[],meshes=[],records=[],excluded={};
 const batchRoot=new THREE.Group();batchRoot.name='Blackwater-static-building-batches';batchRoot.userData.noBatch=true;
 const downtownIds=new Set(downtownBuildingIds),chunks=new Map();
 let sourceDraws=0,sourceTriangles=0,protectedDraws=0,mergedSourceDraws=0,hiddenSources=0;
 try{
  for(const [modelIndex,model]of models.entries()){
   const modelRoot=model.root||model,buildingId=modelRoot.userData.blackwaterPlacement||modelRoot.name||`building-${modelIndex}`;
   modelRoot.traverse(object=>{
    if(!object.isMesh||!object.geometry?.attributes.position)return;
    let reason=exclusionReason(object,modelRoot);
    if(reason==='hidden'){hiddenSources++;return;}
    sourceDraws++;sourceTriangles+=fullTriangleCount(object.geometry);
    if(object.geometry.attributes.position.count>maxVertices)reason='oversized-source';
    if(reason){excluded[reason]=(excluded[reason]||0)+1;protectedDraws++;return;}
    const matrix=inverseRoot.clone().multiply(object.matrixWorld),geometry=object.geometry.clone().applyMatrix4(matrix);
    if(!geometry.index)geometry.setIndex(Array.from({length:geometry.attributes.position.count},(_,i)=>i));
    // A baked reflection loses the renderer's per-object front-face reversal.
    // Encode it in the index winding while retaining the transformed normals.
    if(matrix.determinant()<0){
     const index=geometry.index;for(let i=0;i<index.count;i+=3){const b=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,b);}
     const tangent=geometry.attributes.tangent;
     if(tangent?.itemSize===4)for(let i=0;i<tangent.count;i++)tangent.setW(i,-tangent.getW(i));
    }
    geometry.computeBoundingBox();
    const bounds=geometry.boundingBox,center=bounds.getCenter(new THREE.Vector3());
    if(![...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite)){geometry.dispose();throw new Error(`Nonfinite architecture bounds: ${buildingId}`);}
    const chunk=`${Math.floor(center.x/chunkSize)}/${Math.floor(center.z/chunkSize)}`;
    const slot=object.userData.blackwaterSlot||'architecture',category=INTERIOR_SLOTS.has(slot)?'interior':'envelope';
    const key=`${chunk}/${category}/${object.material.uuid}/${object.layers.mask}/${object.renderOrder}/${Number(object.castShadow)}/${Number(object.receiveShadow)}/${Number(object.frustumCulled)}/${attributesKey(geometry)}`;
    if(!groups.has(key))groups.set(key,{chunk,category,slot,material:object.material,layers:object.layers.mask,renderOrder:object.renderOrder,castShadow:object.castShadow,receiveShadow:object.receiveShadow,frustumCulled:object.frustumCulled,pieces:[],vertices:0});
    const group=groups.get(key);
    // Split compatible groups before appending a source that exceeds the cap.
    if(group.vertices+geometry.attributes.position.count>maxVertices)flush(group);
    group.pieces.push({geometry,buildingId,slot});group.vertices+=geometry.attributes.position.count;
    states.push({object,visible:object.visible});mergedSourceDraws++;
   });
  }
  for(const group of groups.values())flush(group);
  root.add(batchRoot);
  for(const state of states)state.object.visible=false;
 }catch(error){
  for(const group of groups.values())for(const piece of group.pieces)piece.geometry.dispose();
  for(const geometry of ownedGeometries)geometry.dispose();batchRoot.removeFromParent();throw error;
 }

 function flush(group){
  if(!group.pieces.length)return;
  const geometry=mergeGeometries(group.pieces.map(piece=>piece.geometry),false);
  if(!geometry)throw new Error(`Architecture merge failed in chunk ${group.chunk}`);
  ownedGeometries.push(geometry);
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const ids=[...new Set(group.pieces.map(piece=>piece.buildingId))],slots=[...new Set(group.pieces.map(piece=>piece.slot))];
  const mesh=new THREE.Mesh(geometry,group.material);
  mesh.name=`BlackwaterBuildingBatch:${group.chunk}:${group.category}:${group.slot}:${meshes.length}`;
  mesh.layers.mask=group.layers;mesh.renderOrder=group.renderOrder;mesh.castShadow=group.castShadow;mesh.receiveShadow=group.receiveShadow;mesh.frustumCulled=group.frustumCulled;
  mesh.userData.blackwaterBuildingBatch=true;mesh.userData.blackwaterSlot=group.slot;mesh.userData.sourceBuildingIds=ids;
  mesh.userData.downtownBuildingIds=ids.filter(id=>downtownIds.has(id));mesh.userData.blackwaterChunk=group.chunk;
  // Local transforms are baked into merged vertices. Keep parent/world
  // propagation live, but avoid recomposing immutable identity leaves per draw.
  mesh.updateMatrix();mesh.matrixAutoUpdate=false;
  batchRoot.add(mesh);meshes.push(mesh);
  const record={chunk:group.chunk,category:group.category,slots,buildingIds:ids,sourceDraws:group.pieces.length,vertices:geometry.attributes.position.count,triangles:fullTriangleCount(geometry),bounds:{min:geometry.boundingBox.min.toArray(),max:geometry.boundingBox.max.toArray()}};
  records.push(record);
  if(!chunks.has(group.chunk))chunks.set(group.chunk,{key:group.chunk,bounds:new THREE.Box3(),draws:0,triangles:0,buildingIds:new Set()});
  const data=chunks.get(group.chunk);data.bounds.union(geometry.boundingBox);data.draws++;data.triangles+=record.triangles;ids.forEach(id=>data.buildingIds.add(id));
  for(const piece of group.pieces)piece.geometry.dispose();group.pieces=[];group.vertices=0;
 }
 const bounds=new THREE.Box3();for(const mesh of meshes)bounds.union(mesh.geometry.boundingBox);
 const diagnostics={chunkSize,maxVertices,sourceDraws,mergedSourceDraws,protectedDraws,hiddenSources,excluded,batchedDraws:meshes.length+protectedDraws,mergedDraws:meshes.length,triangles:sourceTriangles,mergedTriangles:records.reduce((n,b)=>n+b.triangles,0),chunkCount:chunks.size,
  bounds:bounds.isEmpty()?null:{min:bounds.min.toArray(),max:bounds.max.toArray()},
  chunks:[...chunks.values()].map(c=>({key:c.key,draws:c.draws,triangles:c.triangles,buildingIds:[...c.buildingIds],bounds:{min:c.bounds.min.toArray(),max:c.bounds.max.toArray()}})),batches:records,
  ownership:'owns merged geometry only; borrows exact model material identities; models retain source buffers and collision plans'};
 // Commands cache only immutable opaque merged leaves. Transparent sorting,
 // dynamic source attachments and all lights remain outside this group.
 const opaqueBundle=nativeBundles?new BundleGroup():null;
 const bundled=opaqueBundle?meshes.filter(m=>!Array.isArray(m.material)&&!m.material.transparent&&!m.material.transmission):[];
 if(opaqueBundle){opaqueBundle.name='BlackwaterOpaqueCommands';opaqueBundle.userData.noBatch=true;for(const mesh of bundled)opaqueBundle.add(mesh);batchRoot.add(opaqueBundle);}
 const selected=new Uint8Array(bundled.length),frustum=new THREE.Frustum(),projection=new THREE.Matrix4(),depthPoint=new THREE.Vector4(),depths=new Map(),ordered=[...bundled],visibleMembers=new Set(),commandOrder=[];
 const bundleDiagnostics={enabled:!!opaqueBundle,opaqueMeshes:bundled.length,invalidations:0,visibleMeshes:0,invalidationReasons:{first:0,membership:0,visibleOrder:0,shadow:0},invalidationReasonScope:'Nonexclusive causes; multiple causes can accompany one invalidation.',counterScope:'Native raw draw counters exclude cached bundle replay commands; retained geometry is not removed.'};
 let disposed=false,firstBundle=true;
 function prepareRenderBundles(camera,shadowRefresh=false){
  if(disposed||!opaqueBundle)return;
  camera.updateWorldMatrix(true,false);batchRoot.updateWorldMatrix(true,true);
  projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(projection,camera.coordinateSystem,camera.reversedDepth);
  let dirty=firstBundle||shadowRefresh,visible=0,membershipChanged=false,commandChanged=false;visibleMembers.clear();
  for(let i=0;i<bundled.length;i++){
   const mesh=bundled[i],next=Number(mesh.visible&&mesh.layers.test(camera.layers)&&(!mesh.frustumCulled||frustum.intersectsObject(mesh)));
   if(selected[i]!==next){selected[i]=next;dirty=true;membershipChanged=true;}visible+=next;if(next)visibleMembers.add(mesh);
   depthPoint.copy(mesh.geometry.boundingSphere.center).applyMatrix4(mesh.matrixWorld).applyMatrix4(projection);depths.set(mesh,depthPoint.z);
  }
  // Native bundle render lists are not sorted by the vendor renderer. Retain
  // its opaque renderOrder/clip-depth/id ordering before commands are recorded.
  // A changed command order must invalidate even with identical membership.
  ordered.sort((a,b)=>a.renderOrder-b.renderOrder||depths.get(a)-depths.get(b)||a.id-b.id);
  // Off-screen leaves emit no main-camera commands. Their depth crossings do
  // not invalidate a cache whose visible command sequence remains identical.
  let commandIndex=0;
  for(const mesh of ordered)if(visibleMembers.has(mesh)){if(commandOrder[commandIndex]!==mesh)commandChanged=true;commandIndex++;}
  if(commandOrder.length!==commandIndex)commandChanged=true;
  dirty=dirty||commandChanged;
  if(ordered.some((mesh,i)=>opaqueBundle.children[i]!==mesh))opaqueBundle.children.splice(0,opaqueBundle.children.length,...ordered);
  if(dirty){commandOrder.length=0;for(const mesh of ordered)if(visibleMembers.has(mesh))commandOrder.push(mesh);}
  if(dirty){opaqueBundle.needsUpdate=true;bundleDiagnostics.invalidations++;const reasons=bundleDiagnostics.invalidationReasons;reasons.first+=Number(firstBundle);reasons.membership+=Number(membershipChanged);reasons.visibleOrder+=Number(commandChanged);reasons.shadow+=Number(shadowRefresh);}firstBundle=false;bundleDiagnostics.visibleMeshes=visible;
 }
 return{root:batchRoot,meshes,diagnostics,bundleDiagnostics,prepareRenderBundles,dispose(){
  if(disposed)return;disposed=true;
  batchRoot.removeFromParent();for(const geometry of ownedGeometries)geometry.dispose();
  for(const state of states)state.object.visible=state.visible;
  states.length=0;
 }};
}
