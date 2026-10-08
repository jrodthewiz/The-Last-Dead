import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {createModel,architectureColliders} from '../assets/blackwater-kit/architecture.js';
import {createBlackwaterMaterials} from '../assets/blackwater-kit/materials.js';
import {createBlackwaterWreck,buildBlackwaterDressing} from '../assets/blackwater-kit/set-dressing.js';

function fingerprint(model){
 const hash=createHash('sha256');
 model.root.traverse(mesh=>{if(mesh.isMesh)hash.update(Buffer.from(mesh.geometry.attributes.position.array.buffer));});
 return hash.digest('hex');
}

test('Blackwater models produce finite, bounded meshes with a measured batch budget',()=>{
 for(const kind of ['shop','corner','house'])for(const seed of [1400,1401,1402]){
  const model=createModel({kind,width:16,depth:12,height:kind==='house'?6.4:15,seed});
  try{
   let meshes=0;
   model.root.traverse(mesh=>{
    if(!mesh.isMesh)return;meshes++;
    for(const attribute of ['position','normal','uv']){
     assert.ok(mesh.geometry.attributes[attribute],`${kind} has ${attribute}`);
     assert.ok(mesh.geometry.attributes[attribute].array.every(Number.isFinite),`${kind} has finite ${attribute}`);
    }
   });
   assert.ok(meshes<=12);assert.ok(model.diagnostics.triangleCount<15000);
   const {min,max}=model.diagnostics.bounds;
   assert.ok(min[0]>=-8.001&&max[0]<=8.001);assert.ok(min[2]>=-6.001&&max[2]<=6.87);
   assert.ok(min[1]>=-.001&&max[1]<(kind==='house'?16:18.5));
   assert.equal(model.sockets.entrance,model.parts.entrance);
  }finally{model.dispose();}
 }
});

test('a real ray can pass through the pharmacy portal and reach the supply path',()=>{
 const model=createModel({kind:'shop',width:16,depth:12,height:11,seed:1405,label:'BELL PHARMACY',enterable:true,doorOffset:2});
 try{
  model.root.updateMatrixWorld(true);
  for(const x of [.35,2,3.65])for(const y of [.6,1.4,2.2]){
   const ray=new THREE.Raycaster(new THREE.Vector3(x,y,8),new THREE.Vector3(0,0,-1),0,11);
   assert.equal(ray.intersectObject(model.root,true).length,0,`portal at x=${x}, y=${y}`);
  }
  const wallRay=new THREE.Raycaster(new THREE.Vector3(-7,1.4,8),new THREE.Vector3(0,0,-1),0,4);
  assert.ok(wallRay.intersectObject(model.root,true).length>0,'closed facade next to portal remains solid');
 }finally{model.dispose();}
});

test('house variants repeat deterministically and have different geometry',()=>{
 const models=[1408,1409,1410,1408].map(seed=>createModel({kind:'house',width:16,depth:12,height:6.4,seed}));
 try{
  const hashes=models.map(fingerprint);
  assert.equal(hashes[0],hashes[3]);assert.equal(new Set(hashes.slice(0,3)).size,3);
  assert.equal(new Set(models.slice(0,3).map(m=>m.diagnostics.plan.residentialVariant)).size,3);
  for(const model of models)assert.ok(model.diagnostics.bounds.max[1]<7.1);
 }finally{models.forEach(m=>m.dispose());}
});

test('furnished family house exposes two unobstructed real portals with finite budgeted geometry',()=>{
 const options={kind:'house',width:16,depth:16,height:6.4,seed:1410,enterable:true,doorOffset:-2,label:'18 MAIN STREET'},model=createModel(options);
 try{
  assert.equal(model.colliders.length,12);assert.deepEqual(model.colliders,architectureColliders(options));
  assert.equal(model.diagnostics.plan.rooms.length,2);assert.ok(model.diagnostics.drawCalls<=15);assert.ok(model.diagnostics.triangleCount<22000);
  const {min,max}=model.diagnostics.bounds;
  assert.ok(min[0]>=-8.001&&max[0]<=8.001);assert.ok(min[2]>=-8.001&&max[2]<=8.001);assert.ok(min[1]>=-.001&&max[1]<7.1);
  model.root.traverse(mesh=>{if(mesh.isMesh)for(const a of Object.values(mesh.geometry.attributes))assert.ok(a.array.every(Number.isFinite));});
  model.root.updateMatrixWorld(true);
  for(const x of [-3.3,-2,-.7])for(const y of [.6,1.4,2.10]){
   const front=new THREE.Raycaster(new THREE.Vector3(x,y,10),new THREE.Vector3(0,0,-1),0,20);
   const rear=new THREE.Raycaster(new THREE.Vector3(x,y,-10),new THREE.Vector3(0,0,1),0,20);
   assert.equal(front.intersectObject(model.root,true).length,0,`front-to-back aperture${x},${y}`);assert.equal(rear.intersectObject(model.root,true).length,0,`back-to-front aperture${x},${y}`);
  }
  const block=new THREE.Raycaster(new THREE.Vector3(4.25,.70,6),new THREE.Vector3(0,0,-1),0,5);
  assert.ok(block.intersectObject(model.root,true).some(h=>h.object.material===model.materials.fabric),'sofa visibly occupies the livingroom collision region');
  for(const [point,slot]of [[[0,1,3],'interiorWood'],[[0,1,-3],'interiorTile'],[[3,1,2],'rug']]){
   const floorRay=new THREE.Raycaster(new THREE.Vector3(...point),new THREE.Vector3(0,-1,0),0,2),hit=floorRay.intersectObject(model.root,true)[0];
   assert.equal(hit.object.material,model.materials[slot]);assert.ok(Math.abs(hit.point.y-(slot==='rug'?.074:.07))<.00001,'both substrate floors retain the original .07 m top');
  }
  const rightWindowZ=2.005;
  for(const [z,slot]of [[rightWindowZ,'furnitureWood'],[rightWindowZ+.24,'glass']]){
   const windowRay=new THREE.Raycaster(new THREE.Vector3(5,1.90,z),new THREE.Vector3(1,0,0),0,4),hit=windowRay.intersectObject(model.root,true)[0];
   assert.equal(hit.object.material,model.materials[slot],'inward sash and secondary glazing are visible from the room');
   assert.ok(hit.point.x<7.5,'window features project inwards from the wall');
  }
  const shutterRay=new THREE.Raycaster(new THREE.Vector3(3.9,1.36,4.3),new THREE.Vector3(0,0,1),0,4),shutter=shutterRay.intersectObject(model.root,true)[0];
  assert.equal(shutter.object.material,model.materials.furnitureWood);assert.ok(shutter.point.z<5.8,'boarded window closure is visible in front of its glass');
  assert.equal(model.diagnostics.moduleCounts['interior-window-projecting-sill'],14);
  assert.ok(model.diagnostics.moduleCounts['interior-boarded-shut-window']>=3);
  for(const role of ['furnitureWood','interiorWood','interiorTile','rug'])assert.equal(model.materials[role].userData.lookRole,role);
 }finally{model.dispose();}
});

test('disposing a model once or twice preserves borrowed district materials',()=>{
 for(const enterable of [false,true]){
 const shared=createBlackwaterMaterials(),model=createModel({kind:'house',width:16,depth:16,enterable,doorOffset:-2,materials:shared});
 let borrowed=0,owned=0,geometry=0,meshCount=0;
 for(const material of Object.values(shared))material.addEventListener('dispose',()=>borrowed++);
 for(const role of ['render',...(enterable?['furnitureWood','interiorWood','interiorTile','rug']:[])]){
  model.materials[role].addEventListener('dispose',()=>owned++);
  if(role==='furnitureWood'||role==='interiorWood')assert.equal(model.materials[role].map,shared.wood.map,'owned material clone borrows its source texture');
 }
 model.root.traverse(mesh=>{if(mesh.isMesh){meshCount++;mesh.geometry.addEventListener('dispose',()=>geometry++);}});
 model.dispose();model.dispose();
 assert.equal(borrowed,0);assert.equal(owned,enterable?5:1);assert.equal(geometry,meshCount);
 shared.dispose();assert.equal(borrowed,Object.keys(shared).length);
 }
});

test('authored wreck fenders leave real wheel apertures and resources retain their owner',()=>{
 const shared=createBlackwaterMaterials(),parent=new THREE.Group();let borrowed=0;
 for(const mat of Object.values(shared))mat.addEventListener('dispose',()=>borrowed++);
 for(const length of [4.7,5.5]){
  const wreck=createBlackwaterWreck(parent,{id:'test',x:0,z:0,width:1.9,depth:length},shared,4);
  let releases=0;
  try{
   assert.ok(wreck.triangles<5000);assert.ok(wreck.drawCalls<=10);
   wreck.root.traverse(mesh=>{if(!mesh.isMesh)return;
    for(const name of ['position','normal','uv'])assert.ok(mesh.geometry.attributes[name].array.every(Number.isFinite));
    mesh.geometry.addEventListener('dispose',()=>releases++);
   });
   wreck.root.updateMatrixWorld(true);
   const wheel=new THREE.Raycaster(new THREE.Vector3(2,.69,length*.31),new THREE.Vector3(-1,0,0),0,2);
   const hits=wheel.intersectObject(wreck.root,true);
   assert.ok(hits.length>0);assert.equal(hits[0].object.material,shared.rubber,'visible tyre through the side fender aperture');
   const glass=new THREE.Raycaster(new THREE.Vector3(0,1.38,3.3),new THREE.Vector3(0,0,-1),0,5);
   assert.ok(glass.intersectObject(wreck.root,true).some(h=>h.object.material===shared.glass),'outward windshield winding admits an exterior ray');
  }finally{wreck.dispose();wreck.dispose();}
  assert.equal(releases,wreck.drawCalls);assert.equal(borrowed,0);
 }
 shared.dispose();assert.equal(borrowed,Object.keys(shared).length);
});

test('street detailing stays finite, bounded by a support-mesh budget and disposes once',()=>{
 const materials=createBlackwaterMaterials(),parent=new THREE.Group();
 const dressing=buildBlackwaterDressing(parent,{buildings:[]},materials);let releases=0;
 try{
  assert.ok(dressing.drawCalls<45);assert.ok(dressing.triangles<25000);
  dressing.root.traverse(mesh=>{if(!mesh.isMesh)return;
   for(const attribute of Object.values(mesh.geometry.attributes))assert.ok(attribute.array.every(Number.isFinite));
   mesh.geometry.addEventListener('dispose',()=>releases++);
  });
  assert.equal(dressing.moduleCounts['storm-drain-recess'],10);
 }finally{dressing.dispose();dressing.dispose();materials.dispose();}
 assert.equal(releases,dressing.drawCalls);assert.equal(parent.children.length,0);
});
