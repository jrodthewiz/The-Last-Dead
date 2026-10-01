import * as THREE from './vendor/three.module.js';

// A cut is compiled once at impact into per-instance bind-space topology.
// Intersections are measured on the current posed skin. Retained vertices keep
// UVs and normalized joint weights; the offcut snapshots that exact pose.
export function anatomyRegion(name=''){
 if(/^(neck|Head|headfront|head_end|Jaw|Tongue)$/i.test(name))return 5;
 if(/^Left(Arm|ForeArm|Hand|Grip|Finger|Thumb)/i.test(name))return 3;
 if(/^Right(Arm|ForeArm|Hand|Grip|Finger|Thumb)/i.test(name))return 4;
 if(/^Left(UpLeg|Leg|Foot|Toe)/i.test(name))return 1;
 if(/^Right(UpLeg|Leg|Foot|Toe)/i.test(name))return 2;
 return 0;
}
const v1=new THREE.Vector3(),v2=new THREE.Vector3(),skin=new THREE.Matrix4(),bone=new THREE.Matrix4();
const regionCache=new WeakMap();
function meshRegions(mesh){
 const attributes=mesh.geometry.attributes,key=attributes.position.array;if(regionCache.has(key))return regionCache.get(key);
 const regions=new Uint8Array(attributes.position.count),indices=attributes.skinIndex.array,weights=attributes.skinWeight.array,bones=mesh.skeleton.bones.map(b=>anatomyRegion(b.name));
 for(let i=0;i<regions.length;i++){const sums=[0,0,0,0,0,0];for(let j=0;j<4;j++)sums[bones[indices[i*4+j]]||0]+=weights[i*4+j];let best=0;for(let j=1;j<6;j++)if(sums[j]>sums[best])best=j;regions[i]=best;}
 regionCache.set(key,regions);return regions;
}
function blendVertex(a,b,t){
 const attrs={};for(const key of Object.keys(a.attrs)){
  if(key==='skinIndex'||key==='skinWeight')continue;
  attrs[key]=a.attrs[key].map((x,i)=>x+(b.attrs[key][i]-x)*t);
 }
 const weights=new Map();for(const [v,w]of [[a,1-t],[b,t]])for(let i=0;i<4;i++)weights.set(v.attrs.skinIndex?.[i]||0,(weights.get(v.attrs.skinIndex?.[i]||0)||0)+(v.attrs.skinWeight?.[i]||0)*w);
 const best=[...weights.entries()].sort((x,y)=>y[1]-x[1]).slice(0,4),total=best.reduce((s,v)=>s+v[1],0)||1;
 attrs.skinIndex=Array.from({length:4},(_,i)=>best[i]?.[0]||0);attrs.skinWeight=Array.from({length:4},(_,i)=>(best[i]?.[1]||0)/total);
 return {attrs,p:a.p.clone().lerp(b.p,t),posedNormal:a.posedNormal&&b.posedNormal?new THREE.Vector3().fromArray(a.posedNormal).lerp(new THREE.Vector3().fromArray(b.posedNormal),t).normalize().toArray():null,member:a.member+(b.member-a.member)*t,plane:a.plane+(b.plane-a.plane)*t};
}
function split(polygon,key){
 const yes=[],no=[];
 for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length],da=key(a),db=key(b),inside=da>=-1e-9,next=db>=-1e-9;
  (inside?yes:no).push(a);
  if(inside!==next){const edge=blendVertex(a,b,da/(da-db));yes.push(edge);no.push(edge);}
 }
 return {yes,no};
}
function writer(skinned){return{skinned,attributes:{},sizes:{},unique:new Map(),indices:[],groups:[],triangles:0,capTriangles:0};}
function append(w,polygon,material,cap=false){
 if(polygon.length<3)return;
 for(let j=1;j<polygon.length-1;j++){
  const tri=[polygon[0],polygon[j],polygon[j+1]];
  if(v1.subVectors(tri[1].p,tri[0].p).cross(v2.subVectors(tri[2].p,tri[0].p)).lengthSq()<1e-16)continue;
  const start=w.indices.length;
  for(const vertex of tri){
   if(w.base&&vertex.id!==undefined){w.indices.push(vertex.id);continue;}
   if(vertex.key&&w.unique.has(vertex.key)){w.indices.push(w.unique.get(vertex.key));continue;}
   const index=(w.base?.attributes.position.count||0)+(w.attributes.position?.length/3||0);if(vertex.key)w.unique.set(vertex.key,index);
   const data=w.skinned?vertex.attrs:{...vertex.attrs,position:vertex.p.toArray(),normal:vertex.posedNormal||vertex.attrs.normal};
   for(const [name,values]of Object.entries(data)){if(!values||!w.skinned&&(name==='skinIndex'||name==='skinWeight'))continue;w.sizes[name]=values.length;(w.attributes[name]||=[]).push(...values);}
   w.indices.push(index);
  }
  const group=w.groups.at(-1);if(group?.materialIndex===material)group.count+=3;else w.groups.push({start,count:3,materialIndex:material});
  w.triangles++;if(cap)w.capTriangles++;
 }
}
function finish(w){
 const g=new THREE.BufferGeometry();
 for(const name of new Set([...Object.keys(w.base?.attributes||{}),...Object.keys(w.attributes)])){
  if(name==='brutalMembership')continue;const base=w.base?.attributes[name],extra=w.attributes[name]||[],size=base?.itemSize||w.sizes[name],type=name==='skinIndex'?Uint16Array:Float32Array;
  const baseLength=base?.array.length||(w.base?w.base.attributes.position.count*size:0),array=new type(baseLength+extra.length);
  if(base)array.set(base.array);else if(name==='color')array.fill(1,0,baseLength);
  array.set(extra,baseLength);
  g.setAttribute(name,new THREE.BufferAttribute(array,size));
 }
 g.setIndex(w.indices);for(const group of w.groups)g.addGroup(group.start,group.count,group.materialIndex);
 if(!g.attributes.normal)g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
 g.userData.anatomyCut={triangles:w.triangles,capTriangles:w.capTriangles};return g;
}
function loopsFromSegments(segments){
 const vertices=new Map(),edges=new Map(),key=v=>v.p.toArray().map(x=>Math.round(x*1e5)).join(',');
 for(const [a,b]of segments){const ka=key(a),kb=key(b);if(ka===kb)continue;vertices.set(ka,a);vertices.set(kb,b);const k=[ka,kb].sort().join('|'),old=edges.get(k);if(old)edges.delete(k);else edges.set(k,[ka,kb]);}
 const adjacency=new Map();for(const [a,b]of edges.values()){if(!adjacency.has(a))adjacency.set(a,new Set());if(!adjacency.has(b))adjacency.set(b,new Set());adjacency.get(a).add(b);adjacency.get(b).add(a);}
 const loops=[];
 while(edges.size){const [first,edge]=edges.entries().next().value;edges.delete(first);const start=edge[0],ids=[start];let previous=start,current=edge[1];
  for(let i=0;i<=segments.length;i++){
   if(current===start){if(ids.length>=3)loops.push(ids.map(id=>vertices.get(id)));break;}
   ids.push(current);const next=[...(adjacency.get(current)||[])].find(id=>id!==previous&&edges.has([current,id].sort().join('|')));if(!next)break;
   edges.delete([current,next].sort().join('|'));previous=current;current=next;
  }
 }
 return loops;
}
function capLoop(loop,retained,removed,material,planeNormal,head=false){
 const center=loop.reduce((p,v)=>p.add(v.p),new THREE.Vector3()).divideScalar(loop.length),normal=new THREE.Vector3();
 for(let i=0;i<loop.length;i++){const a=loop[i].p,b=loop[(i+1)%loop.length].p;normal.x+=(a.y-b.y)*(a.z+b.z);normal.y+=(a.z-b.z)*(a.x+b.x);normal.z+=(a.x-b.x)*(a.y+b.y);}
 if(normal.lengthSq()<1e-12)return;
 normal.normalize();if(normal.dot(planeNormal)<0)normal.negate();
 const right=new THREE.Vector3().crossVectors(Math.abs(normal.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0),normal).normalize(),up=new THREE.Vector3().crossVectors(normal,right);
 const contour=loop.map(v=>{const d=v.p.clone().sub(center);return new THREE.Vector2(d.dot(right),d.dot(up));}),faces=THREE.ShapeUtils.triangulateShape(contour,[]);
 const radius=Math.max(...contour.map(p=>p.length()),.005);
 const vertices=loop.map((v,i)=>{
  const radial=contour[i].length()/radius,grain=.07*Math.sin(contour[i].x*240+contour[i].y*130);
  const color=head?[.28,.13,.115]:[.24+grain,.014+grain*.08,.024+grain*.12];if(v.attrs.color?.length===4)color.push(1);
  const out={...v,id:undefined,key:undefined,attrs:{...v.attrs,uv:[contour[i].x*8,contour[i].y*8],color},posedNormal:normal.toArray()};
  // Cap normals own a hard edge instead of smoothing across the coat seam.
  out.attrs.normal=v.attrs.normal?.slice()||normal.toArray();return out;
 });
 for(const face of faces){
  const tri=face.map(i=>vertices[i]);if(v1.subVectors(tri[1].p,tri[0].p).cross(v2.subVectors(tri[2].p,tri[0].p)).dot(normal)<0)tri.reverse();
  const bindNormal=new THREE.Vector3().fromArray(tri[1].attrs.position).sub(new THREE.Vector3().fromArray(tri[0].attrs.position)).cross(new THREE.Vector3().fromArray(tri[2].attrs.position).sub(new THREE.Vector3().fromArray(tri[0].attrs.position))).normalize();
  const kept=tri.map(v=>({...v,attrs:{...v.attrs,normal:bindNormal.toArray()},posedNormal:normal.toArray()}));append(retained,kept,material,true);
  const other=kept.slice().reverse().map(v=>({...v,attrs:{...v.attrs,normal:bindNormal.clone().negate().toArray()},posedNormal:normal.clone().negate().toArray()}));append(removed,other,material,true);
 }
}

export function cutSkinnedMesh(mesh,{region,point,normal,capMaterialIndex=1}){
 const source=mesh.geometry,regions=meshRegions(mesh),cache=new Map(),segments=[],kept=writer(true),offcut=writer(false),normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);kept.base=source;
 mesh.updateWorldMatrix(true,false);mesh.skeleton.update();
 const vertex=id=>{
  if(cache.has(id))return cache.get(id);
  const attrs={};for(const [name,a]of Object.entries(source.attributes)){if(name==='brutalMembership')continue;attrs[name]=Array.from({length:a.itemSize},(_,k)=>a.getComponent(id,k));}
  attrs.color ||= [1,1,1];
  const member=region===-1?1:regions[id]===region?1:0;
  const p=mesh.getVertexPosition(id,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
  skin.elements.fill(0);for(let j=0;j<4;j++){bone.fromArray(mesh.skeleton.boneMatrices,attrs.skinIndex[j]*16);for(let k=0;k<16;k++)skin.elements[k]+=bone.elements[k]*attrs.skinWeight[j];}
  skin.premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix);
  const posedNormal=new THREE.Vector3().fromArray(attrs.normal||[0,1,0]).transformDirection(skin).applyMatrix3(normalMatrix).normalize().toArray();
  const out={id,key:'source:'+id,attrs,p,posedNormal,member,plane:normal.dot(p.clone().sub(point))};cache.set(id,out);return out;
 };
 const count=source.index?.count||source.attributes.position.count;
 for(let i=0;i<count;i+=3){
  const ids=[0,1,2].map(j=>source.index?source.index.getX(i+j):i+j),group=source.groups.find(g=>i>=g.start&&i<g.start+g.count),material=group?.materialIndex||0;
  if(region!==-1&&ids.every(id=>regions[id]!==region)){
   const start=kept.indices.length;kept.indices.push(...ids);const previous=kept.groups.at(-1);if(previous?.materialIndex===material)previous.count+=3;else kept.groups.push({start,count:3,materialIndex:material});kept.triangles++;continue;
  }
  const triangle=ids.map(vertex);
  const membership=split(triangle,v=>v.member-.5),plane=split(membership.yes,v=>v.plane);
  append(kept,membership.no,material);append(kept,plane.no,material);append(offcut,plane.yes,material);
  const poly=plane.yes;for(let j=0;j<poly.length;j++){const a=poly[j],b=poly[(j+1)%poly.length];if(Math.abs(a.plane)<1e-7&&Math.abs(b.plane)<1e-7||Math.abs(a.member-.5)<1e-7&&Math.abs(b.member-.5)<1e-7)segments.push([a,b]);}
 }
 const loops=loopsFromSegments(segments);for(const loop of loops)capLoop(loop,kept,offcut,capMaterialIndex,normal,region===5);
 return {retained:finish(kept),detached:offcut.indices.length?finish(offcut):null,loops:loops.length,removedTriangles:offcut.triangles};
}

const PATHS={leftArm:['LeftArm','LeftForeArm','LeftHand','LeftGrip'],rightArm:['RightArm','RightForeArm','RightHand','RightGrip'],leftLeg:['LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase'],rightLeg:['RightUpLeg','RightLeg','RightFoot','RightToeBase'],head:['neck','Head','head_end'],torso:['Hips','Spine02','Spine01','neck']};
export function anatomyCutFrame(root,cut){
 const positions=PATHS[cut.part]?.map(name=>root.getObjectByName(name)?.getWorldPosition(new THREE.Vector3())).filter(Boolean);if(!positions||positions.length<2)return null;
 const lengths=positions.slice(1).map((p,i)=>p.distanceTo(positions[i])),total=lengths.reduce((s,v)=>s+v,0);let distance=total*cut.fraction,index=0;
 while(index<lengths.length-1&&distance>lengths[index]){distance-=lengths[index++];}
 const point=positions[index].clone().lerp(positions[index+1],Math.min(1,distance/Math.max(.0001,lengths[index]))),axis=positions[index+1].clone().sub(positions[index]).normalize();
 const tilt=new THREE.Vector3().fromArray(cut.tilt||[0,1,0]);tilt.y=0;tilt.applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));
 const normal=axis.clone().addScaledVector(tilt,.6).normalize();return{point,normal,region:cut.part==='torso'?-1:cut.region};
}
