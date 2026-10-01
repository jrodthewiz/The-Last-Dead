import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {counterRegion,counterRegions,counterCutBoundary,captureCounterPart,BrutalCombatVisuals,BRUTAL_VISUAL_LIMITS} from '../brutal-combat-visuals.js';

test('anatomy classification includes oral/grip support bones but preserves shoulders and torso',()=>{
  for(const name of ['neck','Head','Jaw','Tongue','headfront','head_end'])assert.equal(counterRegion(name),5);
  for(const name of ['LeftArm','LeftForeArm','LeftHand','LeftGrip'])assert.equal(counterRegion(name),3);
  for(const name of ['RightArm','RightGrip'])assert.equal(counterRegion(name),4);
  for(const name of ['LeftShoulder','Spine','Hips'])assert.equal(counterRegion(name),0);
});

test('detached skin uses weighted region, posed world vertices and source UVs without changing the shared asset',()=>{
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0,3,0,0,4,0,0,3,1,0],3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,.1,.1,.2,.1,.1,.2],2));g.setIndex([0,1,2,3,4,5]);
  g.setAttribute('normal',new THREE.Float32BufferAttribute(Array.from({length:6},()=>[0,0,1]).flat(),3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(Array.from({length:6},()=>[.6,.4,.3]).flat(),3));
  g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(Array.from({length:6},(_,i)=>[i<3?1:0,0,0,0]).flat(),4));
  g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(Array.from({length:6},()=>[1,0,0,0]).flat(),4));
  const torso=new THREE.Bone(),head=new THREE.Bone();torso.name='Hips';head.name='Head';torso.add(head);
  const mesh=new THREE.SkinnedMesh(g,new THREE.MeshStandardMaterial());mesh.add(torso);mesh.bind(new THREE.Skeleton([torso,head]));
  mesh.position.set(10,0,-2);head.position.y=.4;mesh.updateMatrixWorld(true);mesh.skeleton.update();
  const regions=counterRegions(mesh),piece=captureCounterPart(mesh,regions,5,new THREE.Vector3(10,0,-2));
  assert.deepEqual([...regions],[5,5,5,0,0,0]);assert.equal(piece.geometry.index.count,3);assert.equal(piece.geometry.attributes.position.count,3);
  assert(Math.abs(piece.geometry.attributes.position.getY(0)-.4)<1e-6);assert.equal(piece.geometry.attributes.uv.getX(1),1);
  assert.equal(g.index.count,6);assert.equal(g.attributes.position.getY(0),0);assert.notEqual(piece.material,mesh.material);
  assert(Math.abs(piece.geometry.attributes.normal.getZ(0)-1)<1e-6);assert(Math.abs(piece.geometry.attributes.color.getX(0)-.6)<1e-6);
  assert.equal(captureCounterPart(mesh,regions,4,new THREE.Vector3()),null);
  piece.geometry.dispose();piece.material.dispose();mesh.material.dispose();g.dispose();mesh.skeleton.dispose();
});

test('counter visual allocation budgets remain bounded independently of horde size',()=>{
  assert.equal(BRUTAL_VISUAL_LIMITS.woundedActors,12);assert.equal(BRUTAL_VISUAL_LIMITS.fragments,6);assert.equal(BRUTAL_VISUAL_LIMITS.spray,48);
});

test('detachment clips connecting skin at the body mask boundary and interpolates the imported surface',()=>{
  for(const members of [[1,1,0],[1,0,0]]){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,2,0,0,0,2,0],3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1],2));
    g.setAttribute('normal',new THREE.Float32BufferAttribute([0,0,1,0,0,1,0,0,1],3));g.setIndex([0,1,2]);
    g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(members.flatMap(v=>[v,0,0,0]),4));
    g.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
    const torso=new THREE.Bone(),head=new THREE.Bone();torso.name='Hips';head.name='Head';torso.add(head);
    const mesh=new THREE.SkinnedMesh(g,new THREE.MeshStandardMaterial());mesh.add(torso);mesh.bind(new THREE.Skeleton([torso,head]));mesh.updateMatrixWorld(true);
    const regions=counterRegions(mesh),boundary=counterCutBoundary(mesh,regions,5,new THREE.Vector3());
    assert(boundary.center.distanceTo(new THREE.Vector3(.5,members[1]?1:.5,0))<1e-7);
    assert(Math.abs(boundary.length-(members[1]?1:Math.SQRT2))<1e-7);
    const part=captureCounterPart(mesh,regions,5,new THREE.Vector3()),p=part.geometry.attributes.position,uv=part.geometry.attributes.uv;
    assert.equal(part.geometry.index.count,members[1]?6:3);
    for(let i=0;i<p.count;i++){
      assert(p.getY(i)<=1+1e-6,'connecting torso corner must never enter the detached piece');
      if(!members[1])assert(p.getX(i)<=1+1e-6);
      assert(Math.abs(uv.getX(i)-p.getX(i)/2)<1e-6);assert(Math.abs(uv.getY(i)-p.getY(i)/2)<1e-6);
      assert(Math.abs(part.geometry.attributes.normal.getZ(i)-1)<1e-6);
    }
    assert.equal(g.attributes.position.getY(2),2,'shared source retains its original connecting triangle');
    part.geometry.dispose();part.material.dispose();mesh.skeleton.dispose();mesh.material.dispose();g.dispose();
  }
});

test('pose restoration preserves an upright Euler frame across rearward yaw angles',()=>{
  const visuals=Object.create(BrutalCombatVisuals.prototype);visuals.poseRestore=[];
  const root=new THREE.Group();root.position.set(2,0,3);root.rotation.set(0,2.7,0);
  visuals.save(root);root.position.set(9,9,9);root.rotation.set(.4,-.2,.7);visuals.beginFrame();
  assert.deepEqual(root.position.toArray(),[2,0,3]);assert.equal(root.rotation.x,0);assert.equal(root.rotation.z,0);assert.equal(root.rotation.y,2.7);
  root.rotation.y=2.4;root.updateMatrixWorld(true);
  const forward=new THREE.Vector3(0,0,-1).applyQuaternion(root.quaternion);
  assert(forward.distanceTo(new THREE.Vector3(-Math.sin(2.4),0,-Math.cos(2.4)))<1e-10);
});

test('cut caps use the posed seam centroid through centimetre sockets and later actor rotation',()=>{
  const root=new THREE.Group();root.scale.setScalar(.0125);root.userData.afterlife={normalization:1.25};
  const torso=new THREE.Bone(),head=new THREE.Bone();torso.name='Hips';head.name='Head';head.position.y=100;torso.add(head);
  const anchor=new THREE.Object3D();anchor.name='Socket_Neck';anchor.position.set(0,90,5);torso.add(anchor);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,100,0,10,100,0,0,80,0],3));g.setIndex([0,1,2]);
  g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute([1,0,0,0,1,0,0,0,0,0,0,0],4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
  const mesh=new THREE.SkinnedMesh(g,new THREE.MeshStandardMaterial());mesh.add(torso);root.add(mesh);root.updateMatrixWorld(true);mesh.bind(new THREE.Skeleton([torso,head]));
  const cap=new THREE.Mesh(new THREE.BoxGeometry(.16,.14,.08)),attachments=new THREE.Group();attachments.add(cap);
  const state={root,wound:{type:'twist'},meshes:[{mesh,regions:counterRegions(mesh)}],attachments,uniforms:{}};
  for(const name of ['uBrutalKind','uBrutalRegion'])state.uniforms[name]={value:0};
  for(const name of ['uBrutalCenter','uBrutalRight','uBrutalUp','uBrutalFront'])state.uniforms[name]={value:new THREE.Vector3()};
  const visuals=Object.create(BrutalCombatVisuals.prototype);Object.assign(visuals,{status:'ready',point:new THREE.Vector3(),axis:new THREE.Vector3(),rotation:new THREE.Quaternion()});
  visuals.fitCut(state);assert(state.cutCenterLocal.distanceTo(new THREE.Vector3(2.5,0,-5))<1e-6);
  visuals.placeWound(state,true);assert(attachments.position.distanceTo(new THREE.Vector3(.03125,1.125,0))<1e-6);
  root.position.set(2,0,3);root.rotation.set(0,2.7,0);root.updateMatrixWorld(true);visuals.placeWound(state,true);
  assert(attachments.position.distanceTo(anchor.localToWorld(new THREE.Vector3(2.5,0,-5)))<1e-6);
  assert.deepEqual(anchor.position.toArray(),[0,90,5],'source socket is never moved');
  cap.geometry.dispose();cap.material.dispose();mesh.skeleton.dispose();mesh.material.dispose();g.dispose();
});

test('a large wounded horde reuses its selected attachments and releases replaced entries',()=>{
  const visuals=Object.create(BrutalCombatVisuals.prototype),camera=new THREE.PerspectiveCamera();
  const enemies=Array.from({length:32},(_,id)=>({id,x:id,y:0,dead:false,brutalWound:{type:'rip',sequence:1,playerId:'host',at:0}}));
  const roots=enemies.map(()=>{const root=new THREE.Group();root.userData.afterlifeModel=true;return root;});
  const run={x:0,y:0,time:1,course:{enemies},brutal:{phase:'idle'},health:100};
  Object.assign(visuals,{renderer:{camera,settings:{gore:false},_enemyVisuals:new Map(roots.map((root,id)=>[id,{root}]))},
    root:new THREE.Group(),actors:new Map(),fragments:[],seen:new Map(),drops:[],status:'ready',poseRestore:[],
    point:new THREE.Vector3(),axis:new THREE.Vector3(),rotation:new THREE.Quaternion(),
    spray:{count:0,instanceMatrix:{needsUpdate:false}}});
  visuals.update(run);const first=[...visuals.actors.entries()];
  assert.equal(first.length,12);assert.equal(visuals.root.children.length,12);
  for(let i=0;i<10;i++)visuals.update(run);
  assert.deepEqual([...visuals.actors.keys()],roots.slice(0,12));
  for(const [root,state]of first)assert.equal(visuals.actors.get(root),state,'unchanged selection must retain its allocation');
  run.x=31;visuals.update(run);
  assert.equal(visuals.actors.size,12);assert.equal(visuals.root.children.length,12);
  assert.deepEqual(new Set(visuals.actors.keys()),new Set(roots.slice(20)));
  for(const [,state]of first)assert.equal(state.attachments.parent,null,'unselected attachments leave the scene');
  visuals.harvestRoots=new Set([roots[0]]);visuals.update(run);
  assert(visuals.actors.has(roots[0]),'persistent harvested source skin survives a distant full wound pool');
  const harvested=visuals.actors.get(roots[0]);visuals.bindActor(roots[19]);
  assert.equal(visuals.actors.get(roots[0]),harvested,'adding a wound evicts an unharvested actor first');
  run.course={enemies:[]};visuals.update(run);assert.equal(visuals.actors.size,0);assert.equal(visuals.root.children.length,0);
});
