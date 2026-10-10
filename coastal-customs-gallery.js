import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';

// These bearings were ray-checked against the fitted Customs frame/cladding,
// not its wider four-metre collision footprint. No ground columns are added.
export function customsGalleryParts(){
 const parts=[];
 const box=(name,x,y,z,w,h,d,material='rust',rotationZ=0)=>parts.push({name,position:[x,y,z],size:[w,h,d],material,rotationZ});
 box('weather-sheet',37.85,4.08,33.95,6.64,.12,5.90,'dark',-.10);
 box('eave-fascia',41.16,3.70,33.95,.16,.44,5.92);
 box('wall-ledger',34.54,4.30,33.95,.26,.27,5.90);
 for(const z of [32,33.5,35.5]){
  box('wall-anchor',34.54,3.18,z,.20,1.72,.48,'concrete');
  box('carried-rafter',37.85,3.96,z,6.64,.18,.16,'rust',-.10);
  const a=new THREE.Vector3(34.54,2.40,z),b=new THREE.Vector3(39.80,3.765,z),direction=b.clone().sub(a);
  parts.push({name:'triangle-knee',position:a.clone().add(b).multiplyScalar(.5).toArray(),size:[.14,direction.length(),.16],material:'rust',quaternion:new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()).toArray()});
  box('anchor-shoe',34.54,2.43,z,.25,.18,.46);
 }
 for(const z of [31.7,33.1,34.5,35.9])box('standing-seam',37.85,4.155,z,6.64,.045,.04,'rust',-.10);
 return parts;
}

export function buildCustomsServiceGallery(world){
 if(!world.course?.harbor||!world.course?.coastal||!world.course?.basementPortal)return null;
 for(const slot of ['dark','rust','concrete'])if(!world.materials?.[slot]?.isMaterial)throw new Error(`Missing world-owned Customs gallery material: ${slot}`);
 const parts=customsGalleryParts(),buckets=new Map(),pose=new THREE.Object3D();
 const root=new THREE.Group();root.name='CustomsServiceGallery';root.userData.coastalBasementGallery=true;
 const owned=[],released=new Set();
 try{
  for(const part of parts){
   const geometry=new THREE.BoxGeometry(...part.size);
   pose.position.set(...part.position);pose.rotation.set(0,0,part.rotationZ||0);
   if(part.quaternion)pose.quaternion.fromArray(part.quaternion);
   pose.updateMatrix();geometry.applyMatrix4(pose.matrix);
   if(!buckets.has(part.material))buckets.set(part.material,[]);
   buckets.get(part.material).push(geometry);
  }
  for(const [slot,geometries]of buckets){
   const geometry=mergeGeometries(geometries,false);
   if(!geometry)throw new Error(`Could not merge Customs gallery ${slot}`);
   owned.push(geometry);geometry.addEventListener('dispose',()=>released.add(geometry));
   const mesh=new THREE.Mesh(geometry,world.materials[slot]);mesh.name=`CustomsServiceGallery:${slot}`;
   mesh.receiveShadow=true;mesh.castShadow=slot==='dark';
   mesh.updateMatrix();mesh.matrixAutoUpdate=false;
   root.add(mesh);
  }
 }catch(error){for(const geometry of owned)geometry.dispose();throw error;}
 finally{for(const geometries of buckets.values())for(const geometry of geometries)geometry.dispose();}
 world.root.add(root);
 const bounds=new THREE.Box3().setFromObject(root),diagnostics={triangles:owned.reduce((n,g)=>n+g.index.count/3,0),colourSubmissions:root.children.length,shadowSubmissions:root.children.filter(m=>m.castShadow).length,materialSlots:[...buckets.keys()],bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},ownership:'three world-owned merged geometries; borrowed world materials'};
 world.diagnostics.basementGallery=diagnostics;
 let disposed=false;
 // Ordinary world traversal disposes these geometries. The event tracking also
 // makes explicit early removal safe after, or before, that same teardown.
 return {root,diagnostics,dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const geometry of owned)if(!released.has(geometry))geometry.dispose();}};
}
