import * as T from './vendor/three.module.js';

const trees=new WeakMap(),point=new T.Vector3();
let rayStamp=0;
// Skin weights are non-negative convex weights. The union of each influencing
// bone's transformed vertex bounds therefore encloses every posed triangle.
// Unlike a remembered hit neighbourhood, this can reject distant triangles
// without missing a nearer coat fold when an animation changes.
function build(mesh,triangles){
 const geometry=mesh.geometry,p=geometry.attributes.position,indices=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight;
 const transforms=mesh.skeleton.boneInverses.map(m=>new T.Matrix4().copy(m).multiply(mesh.bindMatrix)),centers=new Float32Array(triangles.length);
 for(let f=0;f<triangles.length/3;f++)for(let k=0;k<3;k++){const i=triangles[f*3+k];centers[f*3]+=p.getX(i)/3;centers[f*3+1]+=p.getY(i)/3;centers[f*3+2]+=p.getZ(i)/3;}
 function node(faces){
  if(faces.length<=24){
   const bounds=new Map(),visited=new Set();for(const f of faces)for(let k=0;k<3;k++){const i=triangles[f*3+k];if(visited.has(i))continue;visited.add(i);
    for(let c=0;c<4;c++){if(weights.getComponent(i,c)<=0)continue;const bone=indices.getComponent(i,c);point.fromBufferAttribute(p,i).applyMatrix4(transforms[bone]);let b=bounds.get(bone);if(!b){b={bone,minX:Infinity,minY:Infinity,minZ:Infinity,maxX:-Infinity,maxY:-Infinity,maxZ:-Infinity};bounds.set(bone,b);}b.minX=Math.min(b.minX,point.x);b.minY=Math.min(b.minY,point.y);b.minZ=Math.min(b.minZ,point.z);b.maxX=Math.max(b.maxX,point.x);b.maxY=Math.max(b.maxY,point.y);b.maxZ=Math.max(b.maxZ,point.z);}
   }return {faces:faces.map(f=>f*3),bounds:Array.from(bounds.values()),rayStamp:0,rayNear:Infinity};
  }
  const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];for(const f of faces)for(let c=0;c<3;c++){low[c]=Math.min(low[c],centers[f*3+c]);high[c]=Math.max(high[c],centers[f*3+c]);}let axis=0;for(let c=1;c<3;c++)if(high[c]-low[c]>high[axis]-low[axis])axis=c;
  faces.sort((a,b)=>centers[a*3+axis]-centers[b*3+axis]);const mid=faces.length>>1,left=node(faces.slice(0,mid)),right=node(faces.slice(mid)),bounds=new Map();
  for(const child of[left,right])for(const b of child.bounds){let target=bounds.get(b.bone);if(!target){target={...b};bounds.set(b.bone,target);}else{target.minX=Math.min(target.minX,b.minX);target.minY=Math.min(target.minY,b.minY);target.minZ=Math.min(target.minZ,b.minZ);target.maxX=Math.max(target.maxX,b.maxX);target.maxY=Math.max(target.maxY,b.maxY);target.maxZ=Math.max(target.maxZ,b.maxZ);}}
  return {left,right,bounds:Array.from(bounds.values()),rayStamp:0,rayNear:Infinity};
 }
 return node(Array.from({length:triangles.length/3},(_,i)=>i));
}

export function bodySpearCandidates(mesh,triangles,right,up,center,halfWidth,halfHeight){
 if(mesh.bindMode!=='attached')return null;
 let tree=trees.get(mesh.geometry);if(!tree){tree=build(mesh,triangles);trees.set(mesh.geometry,tree);}
 const result=[],centerRight=center.dot(right),centerUp=center.dot(up);
 function visit(n){
  let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
  for(const b of n.bounds){const m=mesh.skeleton.bones[b.bone].matrixWorld.elements,x=(b.minX+b.maxX)/2,y=(b.minY+b.maxY)/2,z=(b.minZ+b.maxZ)/2,ex=(b.maxX-b.minX)/2,ey=(b.maxY-b.minY)/2,ez=(b.maxZ-b.minZ)/2;
   const cx=m[0]*x+m[4]*y+m[8]*z+m[12],cy=m[1]*x+m[5]*y+m[9]*z+m[13],cz=m[2]*x+m[6]*y+m[10]*z+m[14],rx=Math.abs(m[0])*ex+Math.abs(m[4])*ey+Math.abs(m[8])*ez,ry=Math.abs(m[1])*ex+Math.abs(m[5])*ey+Math.abs(m[9])*ez,rz=Math.abs(m[2])*ex+Math.abs(m[6])*ey+Math.abs(m[10])*ez;
   minX=Math.min(minX,cx-rx);maxX=Math.max(maxX,cx+rx);minY=Math.min(minY,cy-ry);maxY=Math.max(maxY,cy+ry);minZ=Math.min(minZ,cz-rz);maxZ=Math.max(maxZ,cz+rz);
  }
  const x=(minX+maxX)/2,y=(minY+maxY)/2,z=(minZ+maxZ)/2,ex=(maxX-minX)/2,ey=(maxY-minY)/2,ez=(maxZ-minZ)/2;
  const r=x*right.x+y*right.y+z*right.z-centerRight,re=ex*Math.abs(right.x)+ey*Math.abs(right.y)+ez*Math.abs(right.z),u=x*up.x+y*up.y+z*up.z-centerUp,ue=ex*Math.abs(up.x)+ey*Math.abs(up.y)+ez*Math.abs(up.z);
  if(r-re>halfWidth+.0001||r+re< -halfWidth-.0001||u-ue>halfHeight+.0001||u+ue< -halfHeight-.0001)return;
  if(n.faces){for(const i of n.faces)result.push(i);}else{visit(n.left);visit(n.right);}
 }
 visit(tree);return result;
}

// Ordinary impacts need only the nearest surface, whereas a Crimson bore
// needs a whole ray bundle. Visit posed bounds front-to-back and stop behind
// the nearest exact triangle instead of skinning every candidate in the body.
export function bodySpearRaycast(mesh,triangles,origin,direction,visitFace,limit=Infinity){
 if(mesh.bindMode!=='attached')return null;
 let tree=trees.get(mesh.geometry);if(!tree){tree=build(mesh,triangles);trees.set(mesh.geometry,tree);}
 const stamp=++rayStamp;let closest=limit;
 function near(n){
  if(n.rayStamp===stamp)return n.rayNear;n.rayStamp=stamp;
  let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
  for(const b of n.bounds){const m=mesh.skeleton.bones[b.bone].matrixWorld.elements,x=(b.minX+b.maxX)/2,y=(b.minY+b.maxY)/2,z=(b.minZ+b.maxZ)/2,ex=(b.maxX-b.minX)/2,ey=(b.maxY-b.minY)/2,ez=(b.maxZ-b.minZ)/2;
   const cx=m[0]*x+m[4]*y+m[8]*z+m[12],cy=m[1]*x+m[5]*y+m[9]*z+m[13],cz=m[2]*x+m[6]*y+m[10]*z+m[14],rx=Math.abs(m[0])*ex+Math.abs(m[4])*ey+Math.abs(m[8])*ez,ry=Math.abs(m[1])*ex+Math.abs(m[5])*ey+Math.abs(m[9])*ez,rz=Math.abs(m[2])*ex+Math.abs(m[6])*ey+Math.abs(m[10])*ez;
   minX=Math.min(minX,cx-rx);maxX=Math.max(maxX,cx+rx);minY=Math.min(minY,cy-ry);maxY=Math.max(maxY,cy+ry);minZ=Math.min(minZ,cz-rz);maxZ=Math.max(maxZ,cz+rz);
  }
  let lo=0,hi=Infinity;
  function slab(o,d,min,max){
   if(Math.abs(d)<1e-12)return o>=min-.0001&&o<=max+.0001;
   const a=(min-.0001-o)/d,b=(max+.0001-o)/d;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));return lo<=hi;
  }
  if(!slab(origin.x,direction.x,minX,maxX)||!slab(origin.y,direction.y,minY,maxY)||!slab(origin.z,direction.z,minZ,maxZ))return n.rayNear=Infinity;
  return n.rayNear=lo;
 }
 function visit(n){const distance=near(n);if(!Number.isFinite(distance)||distance>closest)return;
  if(n.faces){for(const face of n.faces)closest=Math.min(closest,visitFace(face));return;}
  if(near(n.left)<=near(n.right)){visit(n.left);visit(n.right);}else{visit(n.right);visit(n.left);}
 }
 visit(tree);return closest;
}
