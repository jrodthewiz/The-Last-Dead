import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createBlackwaterCheckpoint} from '../assets/blackwater-kit/checkpoint.js';
import {createBlackwaterMaterials} from '../assets/blackwater-kit/materials.js';
import {makeHarborCourse} from '../harbor-course.js';
import {blackwaterObstacle} from '../blackwater-district-layout.js';
import {applyBlackwaterGraphicStyle} from '../blackwater-graphic-style.js';

const course=makeHarborCourse({openWorld:true});
const placements=course.coastal.blackwaterSlice.props.filter(p=>p.kind==='barricade');
const EPS=2e-6;
function fixture(p=placements[0],index=0){
 const parent=new THREE.Group(),materials=createBlackwaterMaterials({loadTextures:false});
 const checkpoint=createBlackwaterCheckpoint(parent,p,materials,index);
 return{parent,materials,checkpoint,dispose(){checkpoint.dispose();materials.dispose();}};
}
function rays(checkpoint,origin,direction,far=2){
 checkpoint.root.updateMatrixWorld(true);
 return new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(...direction),0,far).intersectObject(checkpoint.root,true);
}
function printedCheckpoint(p=placements[0]){
 const previous=globalThis.document,draw=()=>{},calls=[];
 const context={fillRect:draw,strokeRect:draw,fillText:text=>calls.push(text)};
 let f;
 try{
  // This canvas stub validates texture lifetime and printed API calls. Actual
  // native screenshots, taken by the parent task, validate the visible pixels.
  const materials=createBlackwaterMaterials({loadTextures:false}),parent=new THREE.Group();
  globalThis.document={createElement(name){assert.equal(name,'canvas');return{width:0,height:0,getContext:()=>context};}};
  const checkpoint=createBlackwaterCheckpoint(parent,p,materials);
  f={parent,materials,checkpoint,calls,dispose(){checkpoint.dispose();materials.dispose();}};
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
 return f;
}

test('both authored checkpoints fit the actual relocated collision footprints without mutating the world',()=>{
 const before=JSON.stringify({props:course.coastal.blackwaterSlice.props,obstacles:course.obstacles});
 assert.deepEqual(placements.map(p=>[p.id,p.x,p.z]),[
  ['blackwater-east-checkpoint',222,50.3],['blackwater-west-checkpoint',164.4,61.1],
 ]);
 for(const [index,p]of placements.entries()){
  const f=fixture(p,index),c=f.checkpoint,proxy=blackwaterObstacle(p);
  try{
   assert.deepEqual(c.root.position.toArray(),[p.x,p.y??.15,p.z]);assert.equal(c.root.rotation.y,p.yaw);
   assert.equal(c.diagnostics.addedCollisionSolids,0);
   c.root.updateMatrixWorld(true);const local=new THREE.Box3();
   c.root.traverse(mesh=>{
    assert.ok(!mesh.isLight,'the checkpoint adds no dynamic light');
    if(!mesh.isMesh)return;
    mesh.geometry.computeBoundingBox();local.union(mesh.geometry.boundingBox);
    for(let i=0;i<mesh.geometry.attributes.position.count;i++){
     const v=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i);
     assert.ok(v.x>=-p.width/2-EPS&&v.x<=p.width/2+EPS,`${p.id}/${mesh.name} fits local width`);
     assert.ok(v.z>=-p.depth/2-EPS&&v.z<=p.depth/2+EPS,`${p.id}/${mesh.name} fits local depth`);
     v.applyMatrix4(mesh.matrixWorld);
     assert.ok(v.x>=proxy.minX*4-EPS&&v.x<=proxy.maxX*4+EPS,`${p.id}/${mesh.name} fits world collision X`);
     assert.ok(v.z>=proxy.minY*4-EPS&&v.z<=proxy.maxY*4+EPS,`${p.id}/${mesh.name} fits world collision Z`);
    }
   });
   assert.deepEqual(c.bounds,{min:local.min.toArray(),max:local.max.toArray()});
   const world=new THREE.Box3().setFromObject(c.root);
   assert.deepEqual(c.diagnostics.worldBounds,{min:world.min.toArray(),max:world.max.toArray()});
   assert.equal(local.min.y,0,'feet rest on the placement plane');
  }finally{f.dispose();}
 }
 assert.equal(JSON.stringify({props:course.coastal.blackwaterSlice.props,obstacles:course.obstacles}),before);
});

test('actual buffers have finite unit normals, consistent winding and no degenerate triangles within the model budget',()=>{
 for(const [index,p]of [...placements,{id:'minimum',x:0,z:0,width:3.5,depth:.5}].entries()){
  const f=fixture(p,index),c=f.checkpoint;
  try{
   const meshes=c.root.children.filter(m=>m.isMesh);let triangles=0,vertices=0;
   assert.ok(meshes.length<=8);assert.ok(c.triangles<=3000);
   assert.equal(new Set(meshes.map(m=>m.material)).size,meshes.length,'one submission for each semantic material batch');
   for(const mesh of meshes){
    const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
    for(const name of ['position','normal','uv'])assert.ok(g.attributes[name].array.every(Number.isFinite),`${mesh.name}: finite ${name}`);
    assert.equal(n.count,p.count);assert.equal(uv.count,p.count);
    assert.ok(Number.isFinite(g.boundingSphere.radius)&&g.boundingSphere.radius>0);
    for(let i=0;i<n.count;i++)assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(n,i).length()-1)<EPS,`${mesh.name}: unit normal ${i}`);
    for(let i=0;i<g.index.count;i+=3){
     const ids=[g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)];assert.ok(ids.every(id=>id>=0&&id<p.count));
     const [a,b,d]=ids.map(id=>new THREE.Vector3().fromBufferAttribute(p,id));
     const geometric=b.sub(a).cross(d.sub(a));
     assert.ok(geometric.lengthSq()>1e-16,`${mesh.name}: nondegenerate triangle ${i/3}`);
     for(const id of ids)assert.ok(geometric.clone().normalize().dot(new THREE.Vector3().fromBufferAttribute(n,id))>.999,`${mesh.name}: matching face winding ${i/3}`);
    }
    triangles+=g.index.count/3;vertices+=p.count;
   }
   assert.equal(c.triangles,triangles);assert.equal(c.drawCalls,meshes.length);
   assert.equal(c.diagnostics.vertices,vertices);assert.equal(c.diagnostics.triangles,triangles);
   assert.equal(Object.values(c.diagnostics.moduleTriangles).reduce((n,v)=>n+v,0),triangles);
   assert.ok(c.bounds.min[0]>=-p.width/2-EPS&&c.bounds.max[0]<=p.width/2+EPS);
   assert.ok(c.bounds.min[2]>=-p.depth/2-EPS&&c.bounds.max[2]<=p.depth/2+EPS);
  }finally{f.dispose();}
 }
});

test('the registration folio and sign have actual support surfaces and the shallow feet contact the ground',()=>{
 const f=fixture({...placements[0],x:0,y:0,z:0,yaw:0}),c=f.checkpoint;
 try{
  const d=c.diagnostics,metal=c.root.children.find(m=>m.userData.blackwaterSlot==='metal');
  for(const support of d.supports){
   const placement=d.placements.find(p=>p.id===support.placementId);
   const [x,z]=[0,2].map(axis=>(placement.bounds.min[axis]+placement.bounds.max[axis])/2);
   const hits=new THREE.Raycaster(new THREE.Vector3(x,placement.bounds.min[1]+.002,z),new THREE.Vector3(0,-1,0),0,.012).intersectObject(metal);
   assert.ok(hits.length,'binding is supported by real tray geometry');
   assert.ok(Math.abs(hits[0].point.y-placement.bounds.min[1])<EPS,'binding bottom touches the real tray top');
  }
  for(const contact of d.contacts){
   const hit=rays(c,[contact.probe[0],-.02,contact.probe[2]],[0,1,0],.10)[0];
   assert.ok(hit);assert.ok(Math.abs(hit.point.y)<EPS,'real chamfered foot has a ground face at Y0');
  }
  const identifier=d.placements.find(p=>p.id===d.sign.placementId),center=identifier.bounds.min.map((n,i)=>(n+identifier.bounds.max[i])/2);
  const backing=c.root.children.find(m=>m.userData.blackwaterSlot==='dark');
  const supportHit=new THREE.Raycaster(new THREE.Vector3(center[0],center[1],identifier.bounds.max[2]+.001),new THREE.Vector3(0,0,-1),0,.010).intersectObject(backing)[0];
  assert.ok(supportHit,'the identifier has a real supporting backing within two millimetres');
  const signOffset=identifier.bounds.max[2]-supportHit.point.z;
  assert.ok(signOffset>=-EPS&&signOffset<=.002,'the printed face has a deliberate shallow anti-z-fighting offset');
  assert.ok(rays(c,d.document.center.map((n,i)=>i===1?n+.04:n),[0,-1,0],.10).some(h=>h.object.material===f.materials.paper),'opened folio is actual paper geometry');
 }finally{f.dispose();}
});

test('hanging gate damage makes a real slat opening while neighbouring slats and hinges remain physical',()=>{
 const f=fixture({...placements[0],x:0,y:0,z:0,yaw:0}),c=f.checkpoint;
 try{
  const {hinge,tip}=c.diagnostics.damage;
  const probe=t=>{const x=hinge[0]+(tip[0]-hinge[0])*t,top=hinge[1]+(tip[1]-hinge[1])*t;return[x,top-.28,.5];};
  assert.equal(rays(c,probe(.48),[0,0,-1],1).length,0,'missing middle slat is an opening in the merged mesh');
  for(const t of [.20,.78])assert.ok(rays(c,probe(t),[0,0,-1],1).some(h=>h.object.material===f.materials.wood),'retained neighbouring slat remains');
  for(const y of [.585,1.01])assert.ok(rays(c,[hinge[0]-.045,y,.4],[0,0,-1],.7).some(h=>h.object.material===f.materials.rust),'real pivot barrel remains attached');
  assert.equal(c.moduleCounts['taut-gate-retention-strap'],1);
  assert.equal(c.moduleCounts['broken-gate-bottom-splinter'],1);assert.equal(c.moduleCounts['broken-gate-top-splinter'],1);
 }finally{f.dispose();}
});

test('the original two-sided sign keeps its canvas through the actual graphic adapter',()=>{
 const f=printedCheckpoint(),c=f.checkpoint,signMesh=c.root.children.find(m=>m.userData.blackwaterSlot==='sign'),source=signMesh.material,map=source.map;
 let style;
 try{
  assert.deepEqual(f.calls,['EVACUATION','CHECKPOINT / DOCK ROAD']);
  assert.ok(map?.isCanvasTexture);assert.equal(map.colorSpace,THREE.SRGBColorSpace);
  assert.equal(map.image.width,512);assert.equal(map.image.height,128);
  const g=signMesh.geometry;assert.equal(g.index.count/3,4);
  assert.ok(g.attributes.uv.array.every(v=>v>=0&&v<=1),'each sign face samples the full owned canvas');
  assert.equal(source.userData.lookRole,'sign');
  style=applyBlackwaterGraphicStyle(c.root);
  assert.notEqual(signMesh.material,source);assert.equal(signMesh.material.type,'MeshToonNodeMaterial');
  assert.equal(signMesh.material.map,map);assert.equal(signMesh.material.userData.lookRole,'sign');
  const identifier=c.diagnostics.placements.find(p=>p.id===c.diagnostics.sign.placementId);
  c.root.updateMatrixWorld(true);
  const localCenter=identifier.bounds.min.map((n,i)=>(n+identifier.bounds.max[i])/2),front=new THREE.Vector3(localCenter[0],localCenter[1],.40).applyMatrix4(c.root.matrixWorld),back=new THREE.Vector3(localCenter[0],localCenter[1],-.40).applyMatrix4(c.root.matrixWorld);
  for(const [origin,dir]of [[front,[0,0,-1]],[back,[0,0,1]]]){
   const direction=new THREE.Vector3(...dir).transformDirection(c.root.matrixWorld);
   const hit=new THREE.Raycaster(origin,direction,0,1).intersectObject(signMesh)[0];
   assert.ok(hit,'both road approaches have a correctly wound identifier face');
   assert.ok(Math.abs(hit.uv.x-.5)<EPS&&Math.abs(hit.uv.y-.5)<EPS);
  }
  style.dispose();style.dispose();assert.equal(signMesh.material,source);style=null;
 }finally{style?.dispose();f.dispose();}
});

test('retiring the checkpoint releases each owned resource once and leaves borrowed district materials alive',()=>{
 const f=printedCheckpoint(),c=f.checkpoint,sign=c.root.children.find(m=>m.userData.blackwaterSlot==='sign').material;
 let ownedMaterial=0,ownedTexture=0,geometries=0,borrowed=0;
 sign.addEventListener('dispose',()=>ownedMaterial++);sign.map.addEventListener('dispose',()=>ownedTexture++);
 for(const material of Object.values(f.materials))material.addEventListener('dispose',()=>borrowed++);
 for(const mesh of c.root.children){
  mesh.geometry.addEventListener('dispose',()=>geometries++);
  if(mesh.material!==sign)assert.equal(mesh.material,f.materials[mesh.userData.blackwaterSlot],'semantic batches borrow the exact district palette instance');
 }
 c.dispose();c.dispose();
 assert.equal(f.parent.children.length,0);assert.equal(c.root.children.length,0);
 assert.equal(ownedMaterial,1);assert.equal(ownedTexture,1);assert.equal(geometries,c.drawCalls);assert.equal(borrowed,0);
 f.materials.dispose();assert.equal(borrowed,Object.keys(f.materials).length);
});

test('invalid dimensions, poses and missing material roles fail before attaching a checkpoint',()=>{
 const parent=new THREE.Group(),materials=createBlackwaterMaterials({loadTextures:false}),p=placements[0];
 try{
  for(const change of [{width:3.49},{depth:.49},{width:Infinity},{x:NaN},{z:Infinity},{y:NaN},{yaw:NaN}]){
   assert.throws(()=>createBlackwaterCheckpoint(parent,{...p,...change},materials),RangeError);
   assert.equal(parent.children.length,0);
  }
  assert.throws(()=>createBlackwaterCheckpoint(parent,p,{...materials,paper:null}),TypeError);
  assert.equal(parent.children.length,0);
 }finally{materials.dispose();}
});
