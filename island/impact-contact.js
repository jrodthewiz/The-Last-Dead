import * as T from '../vendor/three.module.js';
import {bodySpearCandidates,bodySpearRaycast} from '../body-spear-ray-tree.js';

// Damage keeps its forgiving gameplay volume. Presentation meets the posed
// coat/skin instead. Reuse the conservative bone tree already warmed for gore;
// each candidate vertex is skinned once per query, not once per triangle.
const roots=new WeakMap(),geometries=new WeakMap();
const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),vertexPoint=new T.Vector3(),intersection=new T.Vector3();
const ray=new T.Ray(),right=new T.Vector3(),up=new T.Vector3(),direction=new T.Vector3(),center=new T.Vector3(),worldUp=new T.Vector3(0,1,0);
function surfaces(root){
 let list=roots.get(root);if(list)return list;
 list=[];root.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;let data=geometries.get(mesh.geometry);
  if(!data){const g=mesh.geometry,index=g.index,n=index?.count||g.attributes.position.count,triangles=new Uint32Array(n);for(let i=0;i<n;i++)triangles[i]=index?index.getX(i):i;
   data={triangles,vertices:new Float64Array(g.attributes.position.count*3),visited:new Uint32Array(g.attributes.position.count),stamp:0};geometries.set(g,data);}
  list.push({mesh,data});
 });roots.set(root,list);return list;
}
function cast(root,origin,target,out){
 direction.subVectors(target,origin).normalize();ray.set(origin,direction);
 let nearest=Infinity,found=false;
 root.parent?.updateWorldMatrix(true,false);root.updateMatrixWorld(true);
 for(const {mesh,data}of surfaces(root)){
  mesh.skeleton.update();const stamp=++data.stamp;
  const vertex=(id,p)=>{const offset=id*3;if(data.visited[id]!==stamp){mesh.getVertexPosition(id,vertexPoint).applyMatrix4(mesh.matrixWorld);vertexPoint.toArray(data.vertices,offset);data.visited[id]=stamp;}return p.fromArray(data.vertices,offset);};
  const visit=i=>{vertex(data.triangles[i],a);vertex(data.triangles[i+1],b);vertex(data.triangles[i+2],c);
   if(!ray.intersectTriangle(a,b,c,false,intersection))return Infinity;const distance=origin.distanceTo(intersection);if(distance<nearest){nearest=distance;out.copy(intersection);found=true;}return distance;
  };
  if(bodySpearRaycast(mesh,data.triangles,origin,direction,visit,nearest)===null)for(let i=0;i<data.triangles.length;i+=3)visit(i);
 }
 return found;
}
export function prepareImpactContacts(enemies){
 const seen=new Set();for(const enemy of enemies){const list=surfaces(enemy.root);if(list.every(({mesh})=>seen.has(mesh.geometry)))continue;
  enemy.root.updateMatrixWorld(true);for(const {mesh,data}of list){if(seen.has(mesh.geometry))continue;seen.add(mesh.geometry);mesh.skeleton.update();bodySpearCandidates(mesh,data.triangles,right.set(1,0,0),up.set(0,1,0),center.set(0,0,0),0,0);}
 }
}
export function impactContact(enemy,origin,point,out=new T.Vector3()){
 out.copy(point);if(cast(enemy.root,origin,point,out))return out;
 // A grazing melee volume may miss the visible body on its original ray.
 // Aim that presentation ray into the same torso height, never another actor.
 center.set(enemy.x,T.MathUtils.clamp(point.y,enemy.root.position.y+.45,enemy.root.position.y+1.70),enemy.z);
 cast(enemy.root,origin,center,out);return out;
}
