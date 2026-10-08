import * as THREE from './vendor/three.module.js';
import {makeMaritimeKit,createMaritimeMaterials,mergeMaritimeParts,MARITIME_PALETTE} from './assets/blackwater-kit/maritime-vehicles.js';

// Static global per-material merging: all vessels, cars and mooring lines fit
// nine submissions, independent of prop count. Owned buffers release once.
export function buildCoastalMaritime(world,{lightSources=[]}={}){
 const layout=world.course.coastal?.maritime;
 if(!layout)return null;
 const root=new THREE.Group();root.name='CoastalMaritime';root.userData.noBatch=true;
 const parts=new Map(Object.keys(MARITIME_PALETTE).map(k=>[k,[]]));
 for(const p of [...layout.boats,...layout.cars]){
  const kit=makeMaritimeKit(p.kind),matrix=new THREE.Matrix4().compose(new THREE.Vector3(p.x,p.y,p.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p.yaw),new THREE.Vector3(1,1,1));
  for(const [s,list]of kit)for(const g of list){g.applyMatrix4(matrix);const tint=new THREE.Color(s==='paint'?(p.paint||MARITIME_PALETTE.paint):'#ffffff'),colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3){colors[i]=tint.r;colors[i+1]=tint.g;colors[i+2]=tint.b;}g.setAttribute('color',new THREE.BufferAttribute(colors,3));parts.get(s).push(g);}
  for(const [i,bollard]of (p.mooring||[]).entries()){
   const a=new THREE.Vector3(p.x+(i?1:-1)*p.length*.29,p.y+.75,p.z-p.beam*.40),b=new THREE.Vector3(bollard.x,1,bollard.z);
   // Two rope spans meet a sagged midpoint; each lands on an existing bollard.
   const mid=a.clone().lerp(b,.5);mid.y-=.20;
   for(const [start,end]of [[a,mid],[mid,b]]){const d=end.clone().sub(start),g=new THREE.CylinderGeometry(.026,.026,d.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate(...start.clone().add(end).multiplyScalar(.5).toArray());parts.get('rope').push(g);}
  }
 }
 const materials=createMaritimeMaterials(lightSources),geometries=mergeMaritimeParts(parts);
 materials.get('paint').color.set('#ffffff');for(const m of materials.values())m.vertexColors=true;
 let triangles=0;
 for(const [s,g]of geometries){g.computeBoundingBox();g.computeBoundingSphere();const mesh=new THREE.Mesh(g,materials.get(s));mesh.name=`Maritime:${s}`;mesh.layers.set(1);mesh.receiveShadow=true;mesh.castShadow=true;root.add(mesh);triangles+=(g.index?.count||g.attributes.position.count)/3;}
 world.root.add(root);
 const diagnostics={boats:layout.boats.length,cars:layout.cars.length,drawCalls:root.children.length,triangles,materials:materials.size,stationary:true};
 world.diagnostics.maritime=diagnostics;
 let disposed=false;
 return{root,diagnostics,dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const g of geometries.values())g.dispose();for(const m of materials.values())m.dispose();}};
}
