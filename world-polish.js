import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';

// Non-colliding architecture stays on the perimeter or above the movement volume.
export function buildCathedralKit(root, m, course) {
 const kit=new THREE.Group();kit.name='CathedralArchitecture';root.add(kit);
 const add=(g,material,x,y,z)=>{const mesh=new THREE.Mesh(g,material);mesh.position.set(x,y,z);mesh.receiveShadow=true;kit.add(mesh);return mesh;};
 const stone=new THREE.MeshStandardMaterial({color:0x242b2b,roughness:.91,metalness:.12});
 const brass=new THREE.MeshStandardMaterial({color:0x76604a,roughness:.63,metalness:.72});
 const width=course.w*4,depth=course.h*4;
 // Curved roof bays create a real enclosed volume, broken by narrow rib seams.
 const cross=[];for(let i=0;i<=20;i++){const x=i/20*width;cross.push([x,6.65+5.5*Math.sin(Math.PI*i/20)]);}
 for(let bay=0;bay<4;bay++){
  const z0=bay*12+.35,z1=Math.min(depth-.35,z0+11.3),positions=[],uv=[];
  for(let i=0;i<20;i++){const a=cross[i],b=cross[i+1];for(const p of [[...a,z0],[...b,z0],[...b,z1],[...a,z0],[...b,z1],[...a,z1]]){positions.push(...p);uv.push(p[0]/4,p[2]/4);}}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();add(geo,stone,0,0,0).name='VaultBay';
 }
 const glass=new THREE.MeshBasicMaterial({color:course.sectorId==='ossuary'?0x68648b:0x765449});
 // Tapered buttresses and recessed clerestory apertures, repeated as a kit.
 for(const side of [-1,1])for(const z of [6,18,30,42]){
  const x=side<0?.42:width-.42;
  const shaft=add(new THREE.CylinderGeometry(.22,.48,8.2,6),m.metalDark,x,4.1,z);shaft.castShadow=true;
  for(const y of [.4,5.4,7.8]){const collar=add(new THREE.CylinderGeometry(.52,.52,.18,6),brass,x,y,z);collar.rotation.y=Math.PI/6;}
  const backing=add(new THREE.BoxGeometry(.12,2.3,3.4),m.black,x-side*.2,7.3,z);
  for(const dz of [-1.2,-.4,.4,1.2])add(new THREE.BoxGeometry(.14,2.05,.06),brass,x-side*.28,7.3,z+dz);
  add(new THREE.BoxGeometry(.08,1.9,3.1),glass,x-side*.24,7.3,z);
 }
 // Drain rails and bolted maintenance strips run outside the central fire lane.
 for(const x of [4,44]){
  add(new THREE.BoxGeometry(.62,.025,42),m.black,x,.015,24);
  for(let z=3;z<46;z+=.6)add(new THREE.BoxGeometry(.56,.03,.07),m.metalDark,x,.035,z);
  for(const dx of [-.36,.36])add(new THREE.BoxGeometry(.035,.025,42),brass,x+dx,.038,24);
 }
 // Cover fittings follow the actual sector layout, never hard-coded old anchors.
 for(const [cx,cz] of course.blocks||[]){const x=cx*4+2,z=cz*4+2;
  for(const side of [-1,1]){
   for(let row=0;row<7;row++)add(new THREE.BoxGeometry(2.55,.06,.045),m.metalDark,x,.85+row*.18,z+side*1.735);
   for(const dx of [-1.45,1.45])for(const y of [.5,2.8]){const bolt=add(new THREE.CylinderGeometry(.075,.075,.065,6),brass,x+dx,y,z+side*1.755);bolt.rotation.x=Math.PI/2;}
  }
 }
 return kit;
}

// Bake static world transforms by material; keep all animated groups independent.
export function batchStaticWorld(root, protectedRoots=[]) {
 const protectedSet=new Set(protectedRoots.filter(Boolean)),groups=new Map();root.updateMatrixWorld(true);
 root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.isInstancedMesh||mesh.isSkinnedMesh||Array.isArray(mesh.material)||mesh.material.transparent)return;
  for(let p=mesh;p&&p!==root;p=p.parent)if(protectedSet.has(p))return;
  if(!mesh.geometry?.attributes.position||!mesh.geometry.attributes.normal||!mesh.geometry.attributes.uv)return;
  const key=`${mesh.material.uuid}:${mesh.castShadow}:${mesh.receiveShadow}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mesh);
 });
 let removed=0,batches=0;const oldGeometries=new Set();
 for(const meshes of groups.values()){
  if(meshes.length<3)continue;const geos=meshes.map(mesh=>{let g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();for(const name of Object.keys(g.attributes))if(!['position','normal','uv'].includes(name))g.deleteAttribute(name);g.applyMatrix4(mesh.matrixWorld);return g;});
  const merged=mergeGeometries(geos,false);geos.forEach(g=>g.dispose());if(!merged)continue;
  const first=meshes[0],batch=new THREE.Mesh(merged,first.material);batch.name='WorldBatch_'+(first.material.name||first.material.id);batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;root.add(batch);batches++;
  for(const mesh of meshes){oldGeometries.add(mesh.geometry);mesh.removeFromParent();removed++;}
 }
 const retained=new Set();root.traverse(o=>{if(o.geometry)retained.add(o.geometry)});for(const g of oldGeometries)if(!retained.has(g))g.dispose();
 return {removed,batches};
}
