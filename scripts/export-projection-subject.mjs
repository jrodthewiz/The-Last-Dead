import * as THREE from '../vendor/three.module.js';
import {createAfterlifeMourningCabinet} from '../afterlife-props.js';
import {buildRoomKit} from '../room-kit.js';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const kind=process.argv[2]||'cabinet';
if(!['cabinet','recovery'].includes(kind))throw Error('Choose cabinet or recovery');
const output=path.resolve('.art-source/projection-texture',kind);await mkdir(output,{recursive:true});
let root;
if(kind==='cabinet')root=createAfterlifeMourningCabinet();
else{
  const world=new THREE.Group();
  buildRoomKit(world,{}, {sectorId:'bloodworks',rooms:[{id:'bloodworks-act-i-entry',center:[0,0],size:[5.1,3.25],style:0}]});
  root=new THREE.Group();world.updateMatrixWorld(true);
  world.traverse(node=>{if(node.isMesh&&!node.isInstancedMesh&&/Recovery(?:Bay.*stained|Patch|BayJamb.*stained)/.test(node.name)){
    const copy=new THREE.Mesh(node.geometry,node.material);copy.name=node.name;node.matrixWorld.decompose(copy.position,copy.quaternion,copy.scale);root.add(copy);
  }});
  // The authored panel faces -X on Intake's east wall. Normalize to -Z.
  root.rotation.y=-Math.PI/2;
}
root.updateMatrixWorld(true);
const bounds=new THREE.Box3().setFromObject(root),center=bounds.getCenter(new THREE.Vector3());center.y=bounds.min.y;
const parts=[],p=new THREE.Vector3(),n=new THREE.Vector3(),normalMatrix=new THREE.Matrix3();
root.traverse(mesh=>{if(!mesh.isMesh||mesh.isInstancedMesh)return;
  const g=mesh.geometry,m=mesh.material,positions=[],normals=[],indices=g.index?[...g.index.array]:Array.from({length:g.attributes.position.count},(_,i)=>i);
  normalMatrix.getNormalMatrix(mesh.matrixWorld);
  for(let i=0;i<g.attributes.position.count;i++){
    p.fromBufferAttribute(g.attributes.position,i).applyMatrix4(mesh.matrixWorld).sub(center);positions.push(...p.toArray());
    n.fromBufferAttribute(g.attributes.normal,i).applyMatrix3(normalMatrix).normalize();normals.push(...n.toArray());
  }
  parts.push({name:mesh.name,positions,normals,indices,color:m.color.toArray(),roughness:m.roughness,metalness:m.metalness,role:mesh.userData.afterlifeSurfaceRole||m.userData.roomRole||'surface'});
});
if(!parts.length)throw Error('No source geometry found');
const result={version:1,kind,source:kind==='cabinet'?'afterlife-props.js:createAfterlifeMourningCabinet':'room-kit.js:RecoveryPatch',dimensions:bounds.getSize(new THREE.Vector3()).toArray(),parts,triangles:parts.reduce((s,p)=>s+p.indices.length/3,0),sourceVertices:parts.reduce((s,p)=>s+p.positions.length/3,0)};
await writeFile(path.join(output,'source.json'),JSON.stringify(result));
console.log(JSON.stringify({kind,parts:parts.length,triangles:result.triangles,vertices:result.sourceVertices,output}));
