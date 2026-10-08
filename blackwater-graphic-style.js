import * as THREE from './vendor/three.module.js';
import {MeshBasicNodeMaterial} from './vendor/three.webgpu.js';
import {positionLocal,normalLocal,positionView,screenSize,cameraProjectionMatrix,lights} from './vendor/three.tsl.js';
import {BLACKWATER_LOOKS,makeBlackwaterBands,makeBlackwaterGraphicMaterial} from './blackwater-render-looks.js';

// Ground, road, seawall and bridge materials share the district's painted
// palette. Keep their original resources recoverable; large land slabs do
// not need duplicate silhouette geometry.
export function applyBlackwaterCoastalSurfaces(root,materials,{lightSources=[]}={}){
 const roles={asphalt:'asphalt',concrete:'paving',rust:'rust',stripe:'paint',dark:'metal',signal:'carPaint',coastGrass:'ground',coastStone:'masonry',coastWhite:'pale',coastRed:'brick',capeBridgeWood:'wood',capeBridgeRail:'metal'};
 const sources=new Map(Object.entries(roles).filter(([key])=>materials[key]).map(([key,role])=>[materials[key],role]));
 const variants=new Map(),records=[],bands=makeBlackwaterBands(BLACKWATER_LOOKS.cartoon.bands),lighting=lights(lightSources);
 const swap=source=>{
  const role=sources.get(source);if(!role)return source;
  if(!variants.has(source)){
   const descriptor={...source,name:`coastal-${role}`,userData:{...source.userData,lookRole:role}};
   const material=makeBlackwaterGraphicMaterial(descriptor,bands);material.lightsNode=lighting;variants.set(source,material);
  }
  return variants.get(source);
 };
 root.traverse(object=>{if(!object.isMesh)return;const original=object.material,next=Array.isArray(original)?original.map(swap):swap(original);if(next!==original){records.push({object,original});object.material=next;}});
 let disposed=false;
 return{diagnostics:{materialVariants:variants.size,sourceMeshes:records.length,palette:'painted coast, road and bridge',extraDraws:0},dispose(){if(disposed)return;disposed=true;for(const {object,original}of records)object.material=original;for(const material of variants.values())material.dispose();bands.dispose();}};
}

// Game adapter for the chosen look. Bake scale into the ink geometry so a
// pixel-width extrusion stays stable on scaled and instanced source meshes.
// Spatial chunks retain culling without a second full-scene depth/normal pass.
export function applyBlackwaterGraphicStyle(root,{inkPixels=1.1,lightSources=null}={}){
 const originals=[],variants=new Map(),bands=makeBlackwaterBands(BLACKWATER_LOOKS.cartoon.bands),chunks=new Map();
 const lighting=lightSources?lights(lightSources):null;
 const ink=new MeshBasicNodeMaterial({color:'#101b2b',side:THREE.BackSide,depthWrite:false});
 const worldPixel=positionView.z.abs().mul(2).div(screenSize.y).div(cameraProjectionMatrix.element(1).element(1));
 ink.positionNode=positionLocal.add(normalLocal.mul(worldPixel.mul(inkPixels)));
 root.updateMatrixWorld(true);const inverseRoot=root.matrixWorld.clone().invert(),instance=new THREE.Matrix4(),matrix=new THREE.Matrix4();
 const sources=[];root.traverse(o=>{if(o.isMesh&&!o.userData.graphicInk)sources.push(o);});
 let triangles=0;
 for(const object of sources){
  const original=object.material;originals.push({object,material:original});
  const swap=source=>{
   if(!source?.isMeshStandardMaterial)return source;
   if(!variants.has(source)){const material=makeBlackwaterGraphicMaterial(source,bands);if(lighting)material.lightsNode=lighting;variants.set(source,material);}
   return variants.get(source);
  };
  object.material=Array.isArray(original)?original.map(swap):swap(original);
  // Very small paper scraps and alpha cards do not need a silhouette shell.
  if(!object.geometry?.attributes.normal||object.visible===false)continue;
  const source=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
  for(const key of Object.keys(source.attributes))if(key!=='position'&&key!=='normal')source.deleteAttribute(key);
  for(let i=0;i<(object.isInstancedMesh?object.count:1);i++){
   matrix.copy(inverseRoot).multiply(object.matrixWorld);
   if(object.isInstancedMesh){object.getMatrixAt(i,instance);matrix.multiply(instance);}
   const part=source.clone().applyMatrix4(matrix);part.computeBoundingBox();
   const bounds=part.boundingBox,size=bounds.getSize(new THREE.Vector3());
   if(Math.max(size.x,size.y,size.z)<.35){part.dispose();continue;}
   const center=bounds.getCenter(new THREE.Vector3()),key=`${Math.floor(center.x/32)}/${Math.floor(center.z/32)}`;
   if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push(part);triangles+=part.attributes.position.count/3;
  }
  source.dispose();
 }
 const outlines=[];
 for(const [key,parts]of chunks){
  const count=parts.reduce((n,g)=>n+g.attributes.position.count,0),positions=new Float32Array(count*3),normals=new Float32Array(count*3);let offset=0;
  for(const part of parts){positions.set(part.attributes.position.array,offset);normals.set(part.attributes.normal.array,offset);offset+=part.attributes.position.array.length;part.dispose();}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,ink);mesh.name=`BlackwaterGraphicInk:${key}`;mesh.castShadow=false;mesh.receiveShadow=false;mesh.userData.graphicInk=true;mesh.userData.noBatch=true;mesh.layers.set(1);root.add(mesh);outlines.push(mesh);
 }
 let disposed=false;
 return{diagnostics:{direction:'graphic-horror',materialVariants:variants.size,inkChunks:outlines.length,inkTriangles:triangles,inkPixels,sourceGeometryPreserved:true,authoredLights:lightSources?.map(o=>o.name)||null,postProcessing:'existing game renderer; spatially batched silhouette ink'},dispose(){
  if(disposed)return;disposed=true;
  for(const {object,material}of originals)object.material=material;
  for(const mesh of outlines){mesh.removeFromParent();mesh.geometry.dispose();}
  for(const material of variants.values())material.dispose();ink.dispose();bands.dispose();
 }};
}
