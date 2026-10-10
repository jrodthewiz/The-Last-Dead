import * as THREE from './vendor/three.module.js';
import {createCoastalInstances} from './coastal-instancing.js';

// Levels and bearings are measured from the unchanged uniformly fitted kit.
// These are physical rendered galleries, not additional actor floor authority.
export const SERVICE_GALLERY_LEVELS=Object.freeze({power:5.200035028188095,dispatch:5.269473563895006});
export const SERVICE_ACCESS=Object.freeze([
 Object.freeze({id:'power-west-front',minX:57.4,maxX:59.1,minZ:73.75,maxZ:74.65}),
 Object.freeze({id:'power-west-turn',minX:58.25,maxX:59.1,minZ:74.4,maxZ:75.05}),
 Object.freeze({id:'power-east-front',minX:68.9,maxX:70.6,minZ:73.75,maxZ:74.65}),
 Object.freeze({id:'power-east-turn',minX:68.9,maxX:69.75,minZ:74.4,maxZ:75.05}),
 Object.freeze({id:'dispatch-existing-balcony-entry',minX:101.35,maxX:102.55,minZ:77.15,maxZ:78.05}),
]);

export function harborServiceFrontagePlan(course){
 if(!course.coastal)return{bays:[],parts:[],access:[]};
 const bays=[
  {id:'power-west',buildingId:'harbor-block-4',minX:52.4,maxX:57.6,minZ:72.35,maxZ:74.74,level:SERVICE_GALLERY_LEVELS.power},
  {id:'power-east',buildingId:'harbor-block-4',minX:70.4,maxX:75.6,minZ:72.35,maxZ:74.74,level:SERVICE_GALLERY_LEVELS.power},
  {id:'dispatch',buildingId:'harbor-block-5',minX:96.4,maxX:111.6,minZ:73.2,maxZ:77.27,level:SERVICE_GALLERY_LEVELS.dispatch},
 ];
 const parts=[],add=(bayId,role,slot,position,size)=>parts.push({bayId,role,slot,position,size});
 for(const b of bays){
  const width=b.maxX-b.minX,depth=b.maxZ-b.minZ,x=(b.minX+b.maxX)/2,z=(b.minZ+b.maxZ)/2;
  add(b.id,'raised-receiving-floor','concrete',[x,1.20,z],[width,.10,depth]);
  // Full-depth concrete cheeks carry a real receiving recess. No invented
  // opaque back panel is placed over the kit's existing windows or stair void.
  for(const side of [-1,1]){
   const px=x+side*(width/2-.24);
   add(b.id,'deep-bearing-return','concrete',[px,(.13+b.level-.17)/2,z],[.48,b.level-.30,depth]);
   add(b.id,'gallery-return-cap','concrete',[px,b.level-.09,z],[.62,.18,depth+.10]);
  }
  for(const pz of [b.minZ+.12,b.maxZ-.04]){
   add(b.id,'gallery-transfer-web','rust',[x,b.level-.25,pz],[width,.32,.14]);
   for(const y of [b.level-.41,b.level-.09])add(b.id,'gallery-transfer-flange','dark',[x,y,pz],[width,.055,.31]);
  }
  for(let i=0;i<4;i++){
   const px=b.minX+.65+(width-1.30)*i/3;
   add(b.id,'gallery-carried-joist','rust',[px,b.level-.22,z],[.14,.30,depth]);
  }
  add(b.id,'gallery-bearing-deck','concrete',[x,b.level-.075,z],[width,.15,depth]);
  // Open guards preserve the existing openings behind the gallery.
  const stations=Math.ceil(width/1.15);
  for(let i=0;i<=stations;i++)add(b.id,'gallery-open-guard-post','dark',[b.minX+.10+(width-.20)*i/stations,b.level+.55,b.minZ+.10],[.065,1.1,.065]);
  for(const y of [.12,.55,1.08])add(b.id,'gallery-open-guard-rail','dark',[x,b.level+y,b.minZ+.10],[width,.055,.065]);
  const outerX=b.id==='power-west'?b.minX:b.id==='power-east'?b.maxX:null;
  if(outerX!==null)for(const y of [.12,.55,1.08])add(b.id,'gallery-outside-return-guard','dark',[outerX,b.level+y,z],[.065,.055,depth]);
 }
 for(const a of SERVICE_ACCESS){
  const level=a.id.startsWith('dispatch')?SERVICE_GALLERY_LEVELS.dispatch:SERVICE_GALLERY_LEVELS.power;
  const x=(a.minX+a.maxX)/2,z=(a.minZ+a.maxZ)/2,w=a.maxX-a.minX,d=a.maxZ-a.minZ;
  add(a.id,'actual-floor-access-deck','concrete',[x,level-.06,z],[w,.12,d]);
  // These carrier ribs terminate in the gallery and the old landing/floor;
  // an access slab is never inferred from a façade-colored rectangle.
  add(a.id,'actual-floor-access-bearing','rust',[x,level-.17,z],[w,.18,d*.7]);
 }
 return{bays,parts,access:SERVICE_ACCESS,physics:'existing sealed lots and Power Cut authority unchanged; galleries are rendered service architecture'};
}

export function openDispatchGalleryRail(thaiRoot,template){
 const placement=thaiRoot.getObjectByName('Placement:thai-harbor-block-5');if(!placement)return null;
 placement.updateMatrixWorld(true);let mesh;placement.traverse(o=>{if(o.name==='Balcony railings'&&o.isInstancedMesh)mesh=o;});
 if(!mesh)throw new Error('Dispatch gallery requires actual original balcony rail');
 if(mesh.userData.harborGalleryOpening)return mesh.userData.harborGalleryOpening;
 const templateRails=[];template?.traverse(o=>{if(o.name==='Balcony railings')templateRails.push(o);});
 if(templateRails.some(o=>o.instanceMatrix===mesh.instanceMatrix))throw new Error('Dispatch rail matrix must be owned by the placement clone');
 const localBounds=mesh.geometry.boundingBox?.clone()||new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position),matrix=new THREE.Matrix4();
 let chosen=-1,error=Infinity;
 for(let i=0;i<mesh.count;i++){
  mesh.getMatrixAt(i,matrix);const bounds=localBounds.clone().applyMatrix4(mesh.matrixWorld.clone().multiply(matrix)),center=bounds.getCenter(new THREE.Vector3());
  const score=Math.abs(center.x-101.955)+Math.abs(bounds.min.y-(SERVICE_GALLERY_LEVELS.dispatch+.0553))+Math.abs(center.z-77.35);
  if(score<error){error=score;chosen=i;}
 }
 if(chosen<0||error>.20)throw new Error('Dispatch gallery actual first upper front rail could not be identified');
 const removed=new THREE.Matrix4();mesh.getMatrixAt(chosen,removed);const oldCount=mesh.count;
 // Compact only this clone's active instances. Other physical rails retain
 // their exact original matrices; no zero-scaled ghost rail is submitted.
 for(let i=chosen;i<oldCount-1;i++){mesh.getMatrixAt(i+1,matrix);mesh.setMatrixAt(i,matrix);}
 mesh.count--;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
 const triangles=(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3;
 const diagnostics={placement:'thai-harbor-block-5',oldCount,newCount:mesh.count,removedIndex:chosen,removedMatrix:removed.toArray(),removedTriangles:triangles,borrowedGeometry:true,borrowedMaterial:true,newResources:0};
 mesh.userData.harborGalleryOpening=diagnostics;return diagnostics;
}

export function buildHarborServiceFrontages(world){
 const plan=harborServiceFrontagePlan(world.course);if(!plan.parts.length)return null;
 const opening=openDispatchGalleryRail(world.thaiWorld.root,world.thaiWorld.templates.get('bangkok-apartment-block'));
 const root=new THREE.Group();root.name='AuthoredHarborServiceFrontages';
 const buckets=new Map();for(const p of plan.parts){if(!buckets.has(p.slot))buckets.set(p.slot,[]);buckets.get(p.slot).push(p);}
 const meshes=[],pose=new THREE.Object3D();let matrixBytes=0;
 for(const [slot,parts]of buckets){
  const mesh=createCoastalInstances(world.unitBox,world.materials[slot],parts.length);mesh.name='HarborServiceFrontage:'+slot;
  parts.forEach((p,i)=>{pose.position.fromArray(p.position);pose.scale.fromArray(p.size);pose.rotation.set(0,0,0);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);});
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.updateMatrix();mesh.matrixAutoUpdate=false;mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);meshes.push(mesh);matrixBytes+=mesh.instanceMatrix.array.byteLength;
 }
 world.root.add(root);
 const diagnostics={bays:3,parts:plan.parts.length,triangles:plan.parts.length*12,draws:meshes.length,shadowCasters:meshes.length,ownedGeometryViews:meshes.length,matrixBytes,ownedMaterials:0,ownedPrimitives:0,railOpening:opening,physics:plan.physics};
 if(world.diagnostics)world.diagnostics.serviceFrontages=diagnostics;
 let disposed=false;return{root,plan,diagnostics,dispose(){if(disposed)return;disposed=true;for(const mesh of meshes)mesh.dispose();root.removeFromParent();}};
}
