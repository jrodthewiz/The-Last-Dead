import {createHash} from 'node:crypto';
import {coastalShelfWindowRoles,geologicalSample} from '../coastal-shoreline-art.js';
export function shelfGeometrySignature(art){
 const hash=createHash('sha256');
 for(const mesh of art.root.children){
  hash.update(mesh.name);hash.update(JSON.stringify([mesh.position.toArray(),mesh.quaternion.toArray(),mesh.scale.toArray()]));
  for(const [name,a]of Object.entries(mesh.geometry.attributes)){if(name==='color')continue;hash.update(JSON.stringify([name,a.itemSize,a.normalized,a.array.constructor.name]));hash.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));}
  const index=mesh.geometry.index;if(index)hash.update(Buffer.from(index.array.buffer,index.array.byteOffset,index.array.byteLength));
  const contours=mesh.geometry.userData.geologicalContourEdges;if(contours)hash.update(Buffer.from(contours.buffer,contours.byteOffset,contours.byteLength));
  hash.update(JSON.stringify([mesh.geometry.boundingBox,mesh.geometry.boundingSphere]));
 }
 return hash.digest('hex');
}
export function shelfProtectedColorSignature(art){
 const hash=createHash('sha256');
 for(const mesh of art.root.children){
  const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal,c=mesh.geometry.attributes.color;
  for(let i=0;i<p.count;i++){
   if(mesh.name==='ContinuousErodedCoast'){
    const x=p.getX(i),z=p.getZ(i),wrack=Math.max(0,1-Math.hypot((x-344)/20,(z-441)/7)/1.1);
    if(coastalShelfWindowRoles(x,p.getY(i),z,n.getY(i),n.getZ(i),geologicalSample(x,z),wrack).weight>0)continue;
   }
   hash.update(Buffer.from(c.array.buffer,c.array.byteOffset+i*3*4,12));
  }
 }
 return hash.digest('hex');
}
