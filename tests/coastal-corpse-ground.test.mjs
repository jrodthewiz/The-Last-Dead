import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import * as CANNON from '../vendor/cannon-es.js';
import {CorpsePhysics} from '../corpse-physics.js';
import {groundAt,capeGroundHeight,capeStreamZ,capeStreamLevel,CAPE_TERRAIN} from '../coastal-terrain.js';

const course=()=>({w:112,h:104,cells:[],coastal:{terrain:true}});
const near=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<=tolerance, `${a} differs from ${b} by ${Math.abs(a-b)}`);
function advance(physics,seconds,start=0){for(let i=1;i<=Math.round(seconds*120);i++){physics.update({time:start+i/120,mode:'play'});physics.sync();}}
function sampledPhysicsFloor(physics,x,z){
  let highest=-Infinity;
  for(const body of physics.groundBodies){
    const meta=body.userData,shape=body.shapes[0];
    if(meta?.ground==='bridge-deck'){
      if(Math.abs(x-meta.x)<=meta.width/2&&Math.abs(z-meta.z)<=meta.depth/2)highest=Math.max(highest,body.position.y+shape.halfExtents.y);
    }else if(meta?.ground==='heightfield'&&x>=meta.x&&x<=meta.x+meta.width&&z>=meta.z&&z<=meta.z+meta.depth){
      const local=body.pointToLocalFrame(new CANNON.Vec3(x,0,z));local.z=shape.getHeightAt(local.x,local.y,true);
      highest=Math.max(highest,body.pointToWorldFrame(local).y);
    }
  }
  return highest;
}
function simpleDrop(x,y,z){const mesh=new THREE.Mesh(new THREE.BoxGeometry(.10,.10,.10),new THREE.MeshStandardMaterial());mesh.position.set(x,y,z);return mesh;}
function disposeDropMesh(mesh){mesh.geometry.dispose();mesh.material.dispose();}
function actualSkeleton(x,y,z){
  const raw=readFileSync(new URL('../assets/models/afterlife-ash-witness-rig-v05.glb',import.meta.url));
  const asset=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12))),joints=new Set(asset.skins[0].joints);
  const objects=asset.nodes.map((node,index)=>{const object=joints.has(index)?new THREE.Bone():new THREE.Group();object.name=node.name||'';
    if(node.matrix)new THREE.Matrix4().fromArray(node.matrix).decompose(object.position,object.quaternion,object.scale);
    else{if(node.translation)object.position.fromArray(node.translation);if(node.rotation)object.quaternion.fromArray(node.rotation);if(node.scale)object.scale.fromArray(node.scale);}return object;});
  asset.nodes.forEach((node,index)=>node.children?.forEach(child=>objects[index].add(objects[child])));
  const root=new THREE.Group();for(const index of asset.scenes[asset.scene||0].nodes)root.add(objects[index]);
  root.position.set(x,y,z);root.rotation.y=.3;root.updateMatrixWorld(true);return root;
}

test('coastal cosmetic support replaces the zero plane and preserves the authoritative metre triangle diagonal',()=>{
  const physics=new CorpsePhysics();physics.rebuild(course());
  assert.equal(physics.groundBodies.length,7);assert.equal(physics.groundBodies.filter(b=>b.shapes[0] instanceof CANNON.Heightfield).length,5);
  assert.equal(physics.statics.some(b=>b.shapes.some(s=>s instanceof CANNON.Plane)),false);
  const field=physics.groundBodies[0],points=[[410.23,385.12],[409.18,387.79],[325.83,399.65],[419.67,238.41],[280.20,capeStreamZ(280.20)+.13],[221.9,400.6]];
  for(let i=0;i<300;i++)points.push([129+(i*97.317)%317,121+(i*53.719)%293]);
  for(const[x,z]of points){
    const local=field.pointToLocalFrame(new CANNON.Vec3(x,0,z));local.z=field.shapes[0].getHeightAt(local.x,local.y,true);
    near(field.pointToWorldFrame(local).y,capeGroundHeight(x,z,{bridges:false}));
  }
  const d=physics.diagnostics();assert.equal(d.terrain.spacing,1);assert.equal(d.terrain.samples,197441);assert.equal(d.terrain.sampleBytes,1579528);
  assert.ok(d.collisionScope.includes('cape terrain')&&d.collisionScope.includes('no under-bridge'));
  physics.dispose();
});

test('precise bridge edges do not cover the negative ford, and short approach raster error stays under 3mm',()=>{
  const physics=new CorpsePhysics();physics.rebuild(course());let maximumError=0;
  for(const bx of CAPE_TERRAIN.bridges){
    const center=capeStreamZ(bx),deck=capeStreamLevel(bx)+.65;
    for(const side of [-1,1]){
      near(sampledPhysicsFloor(physics,bx+side*2.14,center),deck);
      const x=bx+side*2.16;near(sampledPhysicsFloor(physics,x,center),capeGroundHeight(x,center));
      assert.ok(sampledPhysicsFloor(physics,x,center)<0,'outside the bridge remains the negative stream bed');
      for(let iz=0;iz<105;iz++)for(let ix=0;ix<20;ix++){
        const x=bx-2.15+(ix+.38)*4.3/20,z=center+side*(5.3+(iz+.31)*5.7/105);
        maximumError=Math.max(maximumError,Math.abs(sampledPhysicsFloor(physics,x,z)-capeGroundHeight(x,z)));
      }
    }
  }
  assert.ok(maximumError<=physics.diagnostics().terrain.approachHeightTolerance,`maximum bridge approach error ${maximumError}m`);
  console.log('coastal corpse approach maximum sampled error metres:',maximumError);
  physics.dispose();
});

test('real dynamic drops contact the hill, negative ford, bridge deck and approach without a blanket zero clamp',()=>{
  const physics=new CorpsePhysics();physics.rebuild(course());physics.update({time:0,mode:'play'});
  const bx=CAPE_TERRAIN.bridges[0],cz=capeStreamZ(bx),sites=[[410,386],[280,capeStreamZ(280)],[bx,cz],[bx,cz+8.1],[bx+2.7,cz]];
  let floorContacts=0;
  const drops=sites.map(([x,z])=>{const mesh=simpleDrop(x,capeGroundHeight(x,z)+1,z),handle=physics.addDrop(mesh,{velocity:new THREE.Vector3(0,-8,0),lifetime:8});
    handle.body.addEventListener('collide',event=>{if(physics.groundBodies.includes(event.body))floorContacts++;});return{mesh,handle};});
  advance(physics,3);
  for(const{mesh,handle}of drops){
    const p=handle.body.position,floor=groundAt(physics.course,p.x/4,p.z/4)*4;
    assert.ok([p.x,p.y,p.z,handle.body.velocity.length()].every(Number.isFinite));
    assert.ok(p.y>=floor+.024&&p.y<floor+.16,`drop must rest on actual surface: body ${p.y}, floor ${floor}`);
    assert.ok(handle.body.velocity.length()<.16,'actual contacts settle the drop');
    near(mesh.getWorldPosition(new THREE.Vector3()).y,p.y,1e-7);
  }
  assert.ok(drops[0].handle.body.position.y>5);
  assert.ok(drops[1].handle.body.position.y<-.3);assert.ok(drops[4].handle.body.position.y<0);
  near(drops[2].handle.body.position.y,capeStreamLevel(bx)+.65+.05,.015);
  assert.ok(floorContacts>=5,'each drop receives an actual Cannon floor contact');
  assert.ok(physics.diagnostics().terrainSweepCorrections>0,'thin high-speed drops exercise the terrain-only sweep safeguard');
  physics.dispose();for(const{mesh}of drops)disposeDropMesh(mesh);
});

test('actual imported joint hierarchy falls on the elevated terrain with bounded finite joints',()=>{
  const physics=new CorpsePhysics();physics.rebuild(course());physics.update({time:0});
  const root=actualSkeleton(410,capeGroundHeight(410,386),386),state=physics.ensureRagdoll(root,{id:23,dead:true});
  assert.equal(state.nodes.length,15);advance(physics,4);
  for(const node of state.nodes){const p=node.body.position,floor=physics.groundHeightAt(p.x,p.z);
    assert.ok([...p.toArray(),...node.body.velocity.toArray(),...node.body.quaternion.toArray()].every(Number.isFinite),node.key);
    assert.ok(p.y>floor-.035,`${node.key} remains above hillside`);assert.ok(node.body.velocity.length()<1.2,`${node.key} settles`);
  }
  for(const joint of state.constraints)assert.ok(joint.bodyA.pointToWorldFrame(joint.pivotA).distanceTo(joint.bodyB.pointToWorldFrame(joint.pivotB))<.055);
  assert.equal(root.position.y,capeGroundHeight(410,386),'renderer keeps ownership of the actor root');
  physics.dispose();
});

test('tissue correction safety bounds query hill, ford and bridge heights including below zero',()=>{
  const physics=new CorpsePhysics();physics.rebuild(course());
  const bx=CAPE_TERRAIN.bridges[1],sites=[[410,386],[280,capeStreamZ(280)],[bx,capeStreamZ(bx)]];
  for(const[x,z]of sites){const floor=physics.groundHeightAt(x,z),radius=.018;
    const handle=physics.addTissueChain([new THREE.Vector3(x,floor+.07,z),new THREE.Vector3(x+.10,floor+.07,z)],{radius});
    handle.bodies[1].position.set(x,floor-1,z);handle.bodies[1].velocity.y=-4;physics._boundTissueChain(handle);
    const body=handle.bodies[1],minimum=physics.groundHeightAt(body.position.x,body.position.z)+radius*.9;
    assert.ok(body.position.y>=minimum-1e-9);assert.equal(body.velocity.y,0);
    if(x===280)assert.ok(body.position.y<0,'the safety correction never raises negative terrain to zero');
    physics.removeTissueChain(handle);
  }
  physics.dispose();
});

test('coastal rebuild and disposal release all old collision bodies and retain legacy flat-plane behavior',()=>{
  const physics=new CorpsePhysics();physics.rebuild(course());const old=physics.statics.slice();
  physics.rebuild(course());assert.equal(physics.groundBodies.length,7);assert.ok(old.every(b=>!physics.world.bodies.includes(b)));
  const mesh=simpleDrop(410,7,386),g=mesh.geometry,m=mesh.material;let releases=0;g.addEventListener('dispose',()=>releases++);m.addEventListener('dispose',()=>releases++);
  physics.addDrop(mesh);physics.rebuild({w:3,h:3,cells:[]});
  assert.equal(physics.groundBodies.length,1);assert.ok(physics.groundBodies[0].shapes[0] instanceof CANNON.Plane);
  assert.equal(physics.diagnostics().terrain,null);assert.equal(physics.drops.size,0);assert.equal(physics.world.constraints.length,0);
  assert.equal(releases,0,'physics releases bodies while leaving borrowed render resources owned by the caller');
  physics.dispose();physics.dispose();assert.equal(physics.world.bodies.length,0);assert.equal(physics.groundBodies.length,0);
  assert.equal(releases,0);disposeDropMesh(mesh);
});
