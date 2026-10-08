import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import * as CANNON from '../vendor/cannon-es.js';
import {CorpsePhysics} from '../corpse-physics.js';
import {makeHarborCourse} from '../harbor-course.js';

const LOWER=.20,UPPER=2.6475;
const near=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected}`);
const box=(id,kind,x0,x1,z0,z1,bottom,top,support=false)=>({id,kind,minX:x0/4,maxX:x1/4,minY:z0/4,maxY:z1/4,minZ:bottom/4,maxZ:top/4,support});
function structure(){
  const solids=[
    box('lower-floor','floor',152.25,163.75,240.25,255.75,.13,LOWER,true),
    box('upper-left','slab',152.25,156,240.25,255.75,UPPER-.075,UPPER,true),
    box('upper-right','slab',159,163.75,240.25,255.75,UPPER-.075,UPPER,true),
    box('upper-front','slab',156,159,240.25,248,UPPER-.075,UPPER,true),
    box('upper-back','landing',156,159,252,255.75,UPPER-.075,UPPER,true),
    box('left-wall','wall',152,152.25,240,256,.13,5.08),
    box('right-wall','wall',163.75,164,240,256,.13,5.08),
    box('front-left','wall',152,156,240,240.25,.13,2.57),
    box('front-right','wall',160,164,240,240.25,.13,2.57),
    box('front-upper','wall',152,164,240,240.25,2.57,5.08),
    box('back-left','wall',152,156,255.75,256,.13,2.57),
    box('back-right','wall',160,164,255.75,256,.13,2.57),
    box('back-upper','wall',152,164,255.75,256,2.57,5.08),
    box('upper-cabinet','furniture',154.5,155.5,242,243,UPPER,UPPER+.85),
    box('upper-rail','rail',155.94,156,248,252,UPPER,UPPER+.9),
  ];
  for(let i=0;i<15;i++)solids.push(box(`stair-${i}`,'stair',156.15,157.05,248+i*4/15,248+(i+1)*4/15,LOWER,LOWER+(UPPER-LOWER)*(i+1)/15,true));
  return{id:'coast-lot-4-0-0-0',bounds:{minX:38,maxX:41,minY:60,maxY:64},solids};
}
function course(){
  const w=112,h=104,cells=Array.from({length:w*h},()=>[0,0,0,0]);
  const edge=(x,y,d)=>{cells[y*w+x][d]=1;const nx=x+[0,1,0,-1][d],ny=y+[-1,0,1,0][d];cells[ny*w+nx][(d+2)%4]=1;};
  for(let y=60;y<64;y++){edge(38,y,3);edge(40,y,1);}
  for(let x=38;x<41;x++)if(x!==39){edge(x,60,0);edge(x,63,2);}
  edge(20,20,3); // An unrelated finite course wall must retain its old proxy.
  return{w,h,cells,coastal:{terrain:true,structures:[structure()]}};
}
function advance(physics,seconds,start=0){for(let i=1;i<=Math.round(seconds*120);i++){physics.update({time:start+i/120,mode:'play'});physics.sync();}}
function drop(physics,x,y,z,{size=.10,velocity=new THREE.Vector3(0,-8,0)}={}){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(size,size,size),new THREE.MeshStandardMaterial());mesh.position.set(x,y,z);
  return{mesh,handle:physics.addDrop(mesh,{velocity,lifetime:12})};
}
function disposeMeshes(drops){for(const{mesh}of drops){mesh.geometry.dispose();mesh.material.dispose();}}
function actualSkeleton(x,y,z){
  const raw=readFileSync(new URL('../assets/models/afterlife-ash-witness-rig-v05.glb',import.meta.url));
  const asset=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12))),joints=new Set(asset.skins[0].joints);
  const objects=asset.nodes.map((node,index)=>{const object=joints.has(index)?new THREE.Bone():new THREE.Group();object.name=node.name||'';
    if(node.matrix)new THREE.Matrix4().fromArray(node.matrix).decompose(object.position,object.quaternion,object.scale);
    else{if(node.translation)object.position.fromArray(node.translation);if(node.rotation)object.quaternion.fromArray(node.rotation);if(node.scale)object.scale.fromArray(node.scale);}return object;});
  asset.nodes.forEach((node,index)=>node.children?.forEach(child=>objects[index].add(objects[child])));
  const root=new THREE.Group();for(const index of asset.scenes[asset.scene||0].nodes)root.add(objects[index]);root.position.set(x,y,z);root.rotation.y=.3;root.updateMatrixWorld(true);return root;
}

test('shared course-cell boxes retain exact vertical bounds and replace only the scoped house grid walls',()=>{
  const c=course(),physics=new CorpsePhysics();physics.rebuild(c);
  assert.equal(physics.structureBodies.length,c.coastal.structures[0].solids.length);
  for(const solid of c.coastal.structures[0].solids){
    const body=physics.structureBodies.find(b=>b.userData.solidId===solid.id);body.updateAABB();
    assert.ok(body.shapes[0] instanceof CANNON.Box);near(body.aabb.lowerBound.x,solid.minX*4);near(body.aabb.upperBound.x,solid.maxX*4);
    near(body.aabb.lowerBound.y,solid.minZ*4);near(body.aabb.upperBound.y,solid.maxZ*4);near(body.aabb.lowerBound.z,solid.minY*4);near(body.aabb.upperBound.z,solid.maxY*4);
  }
  assert.equal(physics.diagnostics().structure.skippedCourseWallSegments,12);
  assert.ok(physics.statics.some(b=>!b.userData?.structureId&&b.shapes[0] instanceof CANNON.Box&&b.position.x===80&&b.position.z===82),'unrelated course wall remains owned by the legacy grid');
  assert.equal(physics.structureSupports.some(s=>s.body.userData.kind==='furniture'),false);
  assert.equal(physics.groundHeightAt(154,244),0,'terrain authority is unchanged beneath both floors');
  physics.dispose();
});

test('actual drops settle on both floors at identical X/Z, on a stair tread and on finite upper furniture',()=>{
  const physics=new CorpsePhysics();physics.rebuild(course());physics.update({time:0});let contacts=0;
  const drops=[drop(physics,154,UPPER+.8,244),drop(physics,154,LOWER+.8,244),drop(physics,156.6,2,249),drop(physics,155,UPPER+1.5,242.5),drop(physics,155,LOWER+.8,242.5)];
  for(const{handle}of drops)handle.body.addEventListener('collide',event=>{if(physics.structureBodies.includes(event.body))contacts++;});
  advance(physics,3);
  const expected=[UPPER,LOWER,LOWER+(UPPER-LOWER)*4/15,UPPER+.85,LOWER];
  for(let i=0;i<drops.length;i++){const{mesh,handle}=drops[i];near(handle.body.position.y,expected[i]+.05,.025);assert.ok(handle.body.velocity.length()<.16);near(mesh.position.y,handle.body.position.y,1e-7);}
  assert.ok(contacts>=drops.length,'native Cannon contacts resolve the shared finite geometry');physics.dispose();disposeMeshes(drops);
});

test('thin high-speed drops cross the stair opening but cannot tunnel through the upper slab or its walls',()=>{
  const physics=new CorpsePhysics();physics.rebuild(course());physics.update({time:0});
  const drops=[drop(physics,154,UPPER+.06,244,{size:.01}),drop(physics,158,UPPER+.3,250,{size:.03}),drop(physics,158,3.25,240.7,{velocity:new THREE.Vector3(0,0,-8)}),drop(physics,158,1.15,240.7,{velocity:new THREE.Vector3(0,0,-8)}),drop(physics,158.85,UPPER+.035,250,{size:.01,velocity:new THREE.Vector3(8,-8,0)})];
  advance(physics,.75);
  assert.ok(drops[4].handle.body.position.x>159,'a diagonal fall leaves the opening and travels beneath the upper floor');near(drops[4].handle.body.position.y,LOWER+.015,.02);
  advance(physics,1.25,.75);
  near(drops[0].handle.body.position.y,UPPER+.015,.02);near(drops[1].handle.body.position.y,LOWER+.015,.02);
  assert.ok(drops[2].handle.body.position.z>=240.25,'upper wall above the open doorway blocks an upper object');
  assert.ok(drops[3].handle.body.position.z<240,'the same lower doorway remains open');
  assert.ok(physics.diagnostics().structureSweepCorrections>0,'a complete high-speed slab crossing uses previous-side swept repair');
  physics.dispose();disposeMeshes(drops);
});

test('the actual fifteen-body imported hierarchy settles upstairs and below the same slab without moving its renderer-owned roots',()=>{
  const physics=new CorpsePhysics();physics.rebuild(course());physics.update({time:0});
  const upper=actualSkeleton(154,UPPER,246),lower=actualSkeleton(154,LOWER,246),states=[physics.ensureRagdoll(upper,{id:1,dead:true}),physics.ensureRagdoll(lower,{id:2,dead:true})];
  for(const state of states)assert.equal(state.nodes.length,15);advance(physics,4);
  for(let i=0;i<states.length;i++)for(const node of states[i].nodes){
    const floor=i===0?UPPER:LOWER;assert.ok([...node.body.position.toArray(),...node.body.velocity.toArray(),...node.body.quaternion.toArray()].every(Number.isFinite));
    assert.ok(node.body.position.y>=floor-.04,`${node.key} stays on its own floor`);if(i===1)assert.ok(node.body.position.y<UPPER-.1,'lower-floor bodies are never raised above the slab');
  }
  for(const state of states)for(const joint of state.constraints)assert.ok(joint.bodyA.pointToWorldFrame(joint.pivotA).distanceTo(joint.bodyB.pointToWorldFrame(joint.pivotB))<.055);
  assert.equal(upper.position.y,UPPER);assert.equal(lower.position.y,LOWER);physics.dispose();
});

test('tissue support correction keeps the previous floor and a moving anchored chain passes down the real opening',()=>{
  const physics=new CorpsePhysics();physics.rebuild(course());physics.update({time:0});const radius=.018;
  const upper=physics.addTissueChain([new THREE.Vector3(154,UPPER+.035,244),new THREE.Vector3(154.18,UPPER+.035,244)],{radius});
  const lower=physics.addTissueChain([new THREE.Vector3(154,LOWER+.035,244),new THREE.Vector3(154.18,LOWER+.035,244)],{radius});
  advance(physics,.5);
  assert.ok(upper.bodies[1].position.y>=UPPER+radius*.9-1e-6);assert.ok(lower.bodies[1].position.y<1);
  physics._captureTerrainSupport();upper.bodies[1].position.y=UPPER-.1;physics._boundTissueChain(upper);
  assert.ok(upper.bodies[1].position.y>=UPPER+radius*.9-1e-9,'post-contact length guard cannot pull a particle through its prior upper floor');
  physics.removeTissueChain(upper);physics.removeTissueChain(lower);
  const hole=physics.addTissueChain([new THREE.Vector3(158,UPPER+.035,250),new THREE.Vector3(158.18,UPPER+.035,250)],{radius});
  for(let i=1;i<=240;i++){const y=UPPER+.035-(UPPER-LOWER)*i/240;physics.setTissueChain(hole,{anchor:new THREE.Vector3(158,y,250)});physics.update({time:.5+i/120,mode:'play'});}
  assert.ok(hole.bodies[1].position.y<LOWER+.12,'the opening has no unconditional upper-floor safety clamp');assert.ok(hole.bodies[1].position.y>=LOWER+radius*.9-1e-6);
  physics.dispose();
});

test('structure refresh retains live bodies and reset/disposal releases owned colliders and support history',()=>{
  const c=course(),physics=new CorpsePhysics();physics.rebuild(c);physics.update({time:0});const d=drop(physics,154,UPPER+.8,244),old=physics.structureBodies.slice();
  advance(physics,.2);const snapshotArray=physics.supportSnapshots,snapshot=physics.supportHistory.get(d.handle.body),bodyId=d.handle.body.id;
  advance(physics,.2,.2);assert.equal(physics.supportSnapshots,snapshotArray);assert.equal(physics.supportHistory.get(d.handle.body),snapshot,'fixed ticks reuse bounded body snapshots');
  c.coastal.structures=JSON.parse(JSON.stringify(c.coastal.structures));assert.equal(physics.syncCourseWalls(c),true);assert.equal(d.handle.body.id,bodyId);assert.ok(old.every(b=>!physics.world.bodies.includes(b)));
  assert.equal(physics.syncCourseWalls(c),false);advance(physics,2,.4);near(d.handle.body.position.y,UPPER+.05,.025);
  let releases=0;d.mesh.geometry.addEventListener('dispose',()=>releases++);d.mesh.material.addEventListener('dispose',()=>releases++);
  physics.rebuild({w:3,h:3,cells:[]});assert.equal(physics.structureBodies.length,0);assert.equal(physics.structureSupports.length,0);assert.equal(physics.supportSnapshots.length,0);assert.equal(physics.drops.size,0);
  physics.dispose();physics.dispose();assert.equal(physics.world.bodies.length,0);assert.equal(physics.groundBodies.length,0);assert.equal(releases,0,'borrowed visible resources remain caller-owned');disposeMeshes([d]);
});

test('the actual generated Cape75 supports live rigs and drops on both storeys and a drop falls through its authored stair opening',()=>{
  const c=makeHarborCourse({openWorld:true}),s=c.coastal.structures.find(q=>q.id==='coast-lot-4-0-0-0');assert.ok(s,'the authored Cape75 plan is serialized into the actual course');
  assert.equal(c.coastal.structures.length,1,'other buildings retain their existing authority');
  const upper=s.solids.find(q=>q.id==='cape75-upper-slab-main-room'),lower=s.solids.find(q=>q.id==='cape75-lower-living-floor'),tread=s.solids.find(q=>q.id==='cape75-lower-tread-4');assert.ok(upper&&lower&&tread);
  const x=158,z=246.8,upperHeight=upper.maxZ*4,lowerHeight=lower.maxZ*4,treadHeight=tread.maxZ*4,tx=(tread.minX+tread.maxX)*2,tz=(tread.minY+tread.maxY)*2;
  const physics=new CorpsePhysics();physics.rebuild(c);physics.update({time:0});assert.equal(physics.structureBodies.length,s.solids.length);assert.equal(physics.diagnostics().structure.rejectedSolids,0);assert.equal(physics.diagnostics().structure.skippedCourseWallSegments,12);
  const drops=[drop(physics,x,upperHeight+.55,z),drop(physics,x,lowerHeight+.55,z),drop(physics,tx,upperHeight+.30,tz)];
  const roots=[actualSkeleton(157,upperHeight,246.8),actualSkeleton(157,lowerHeight,246.8)],states=roots.map((root,i)=>physics.ensureRagdoll(root,{id:91+i,dead:true}));
  const chains=[upperHeight,lowerHeight].map(height=>physics.addTissueChain([new THREE.Vector3(158.3,height+.035,246.8),new THREE.Vector3(158.48,height+.035,246.8)],{radius:.018}));let tissueContacts=0;
  for(const chain of chains)chain.bodies[1].addEventListener('collide',event=>{if(physics.structureBodies.includes(event.body))tissueContacts++;});
  for(const state of states)assert.equal(state.nodes.length,15);advance(physics,4);
  near(drops[0].handle.body.position.y,upperHeight+.05,.025);near(drops[1].handle.body.position.y,lowerHeight+.05,.025);near(drops[2].handle.body.position.y,treadHeight+.05,.025);
  assert.ok(drops[2].handle.body.position.y<upperHeight-1,'the source stair opening has no hidden continuous slab');
  for(let i=0;i<states.length;i++)for(const node of states[i].nodes){assert.ok([...node.body.position.toArray(),...node.body.velocity.toArray()].every(Number.isFinite));assert.ok(node.body.position.y>=(i===0?upperHeight:lowerHeight)-.04);if(i===1)assert.ok(node.body.position.y<upperHeight-.1);}
  near(chains[0].bodies[1].position.y,upperHeight+.018,.015);near(chains[1].bodies[1].position.y,lowerHeight+.018,.015);assert.ok(tissueContacts>=2,'both actual-source tissue chains receive native structure contacts');
  assert.equal(roots[0].position.y,upperHeight);assert.equal(roots[1].position.y,lowerHeight);physics.dispose();disposeMeshes(drops);
});
