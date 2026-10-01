import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';
import {createSurvivorViewArm} from '../assets/survivor/player-survivor.js';
import {HorrorCuffVisuals,HORROR_CUFF_LIMITS} from '../horror-cuff-visuals.js';

let authored;
test.before(async()=>{
  const bitmap=globalThis.createImageBitmap,self=globalThis.self;
  globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
  try{
    const bytes=readFileSync(new URL('../assets/survivor/viewmodel-arms-v1.glb',import.meta.url));
    authored=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
  }finally{
    if(bitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=bitmap;
    if(self===undefined)delete globalThis.self;else globalThis.self=self;
  }
});

function fixture({fallback=false,scale=.896}={}){
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(92,16/9,.02,200),group=new THREE.Group();
  scene.add(camera);camera.add(group);group.scale.setScalar(scale);
  let arm,mesh;
  if(fallback){
    arm=createSurvivorViewArm(1);mesh=arm.getObjectByName('RuggedJacketSleeve');group.add(arm);
  }else{
    arm=new THREE.Group();group.add(arm);
    const forearm=new THREE.Group();forearm.position.set(.30,-.30,-.55);arm.add(forearm);
    const source=authored.getObjectByName('TLD_ViewSleeve_Right');
    forearm.add(source.clone(true));forearm.traverse(node=>{if(node.isMesh&&node.name==='TLD_ViewSleeve_Right')mesh=node;});
    const wrist=new THREE.Object3D();wrist.position.copy(forearm.position);arm.add(wrist);
    arm.userData.foregroundArmFit={forearm,wrist};
  }
  group.userData.viewArms={rightArm:arm,leftArm:null};
  const renderer={scene,camera,weaponGroups:[group],settings:{gore:true,reducedMotion:false}},visual=new HorrorCuffVisuals(renderer);
  const run={mode:'play',health:100,weapon:0,time:20,x:0,y:0,course:{enemies:[]},playerWounds:{rightArm:'intact'},bite:{phase:'idle'},brutal:{phase:'idle'},extraction:{phase:'idle'},verminHand:{phase:'idle'}};
  const state={enabled:true,active:{id:'cuff-1',kind:'cuff',elapsed:2.3,duration:4.5}};
  scene.updateMatrixWorld(true);
  return {scene,camera,renderer,visual,group,arm,mesh,run,state};
}
const positions=mesh=>Float32Array.from(mesh.geometry.attributes.position.array);
const normals=mesh=>Float32Array.from(mesh.geometry.attributes.normal.array);
const nodes=root=>{let count=0;root.traverse(()=>count++);return count;};
const next=(state,n)=>{state.active={id:'cuff-'+n,kind:'cuff',elapsed:2.3,duration:4.5};};

test('the actual visible authored sleeve owns its deformation and restores exact source positions and normals',()=>{
  const f=fixture(),original=f.mesh.geometry,baseline=positions(f.mesh),normalBaseline=normals(f.mesh),material=f.mesh.material,nodeCount=nodes(f.scene);
  const sibling=new THREE.Mesh(original,material),sharedBaseline=positions(sibling);
  assert.equal(f.visual.update(f.run,1/60,f.state),true);
  assert.notEqual(f.mesh.geometry,original,'source geometry remains shared and untouched');
  assert.equal(f.mesh.geometry.userData.horrorCuffOwned,true);
  assert.deepEqual(positions(sibling),sharedBaseline);
  assert.deepEqual(original.attributes.position.array,baseline);
  assert.deepEqual(original.attributes.normal.array,normalBaseline);
  assert.equal(f.mesh.material,material);assert.equal(nodes(f.scene),nodeCount,'no overlay or proxy mesh');
  const first=positions(f.mesh);assert.notDeepEqual(first,baseline);
  assert.equal(f.visual.update(f.run,1/120,f.state),true);
  assert.deepEqual(positions(f.mesh),first,'the same semantic age never accumulates displacement');
  assert(f.visual.diagnostics().movedVertices>30);
  assert(f.visual.diagnostics().maxDisplacementMeters<=HORROR_CUFF_LIMITS.maxLiftMeters+1e-7);
  f.state.active=null;f.visual.update(f.run,1/60,f.state);
  assert.equal(f.mesh.geometry,original);
  assert.deepEqual(positions(f.mesh),baseline);assert.deepEqual(normals(f.mesh),normalBaseline);
  assert.deepEqual(f.visual.record.geometry.attributes.position.array,baseline,'owned buffer is also restored');
  f.visual.dispose();assert.equal(f.visual.record,null);
});

test('one localized fold travels along cloth and cannot displace the whole arm or weapon',()=>{
  const f=fixture(),base=positions(f.mesh),mesh=f.mesh;
  f.state.active.elapsed=2.1;f.visual.update(f.run,.016,f.state);
  const first=f.visual.diagnostics(),start=positions(mesh),record=f.visual.record;
  f.state.active.elapsed=3.2;f.visual.update(f.run,.016,f.state);
  const later=f.visual.diagnostics();assert(later.foldPathFraction>first.foldPathFraction+.1);assert.notDeepEqual(start,positions(mesh));
  let significant=0;
  for(let i=0;i<base.length;i+=3){
    const delta=Math.hypot(mesh.geometry.attributes.position.array[i]-base[i],mesh.geometry.attributes.position.array[i+1]-base[i+1],mesh.geometry.attributes.position.array[i+2]-base[i+2])*.896;
    if(delta>.0003)significant++;
    assert(delta<=HORROR_CUFF_LIMITS.maxLiftMeters+1e-7);
    if(record.angular[i/3]===0)assert.equal(delta,0,'back-side vertices retain their exact base positions');
  }
  assert(significant>10&&significant<base.length/3*.25,'the visible patch remains small');
  assert.equal(later.drawCallsAdded,0);assert.equal(later.materialsAdded,0);assert.equal(later.skinMutation,false);
  f.visual.dispose();
});

test('current procedural fallback uses its own fabric while skinned or absent surfaces suppress safely',()=>{
  const f=fixture({fallback:true}),source=f.mesh.geometry;
  assert.equal(f.visual.update(f.run,.016,f.state),true);assert.equal(f.visual.diagnostics().source,'RuggedJacketSleeve');
  f.visual.dispose();assert.equal(f.mesh.geometry,source);
  for(const kind of ['missing','skinned']){
    const q=fixture();if(kind==='missing')q.mesh.removeFromParent();else q.mesh.isSkinnedMesh=true;
    assert.equal(q.visual.update(q.run,.016,q.state),false);assert.equal(q.visual.diagnostics().suppression,'missing-sleeve');
    assert.equal(q.visual.diagnostics().ownedGeometries,0);q.visual.dispose();
  }
});

test('reduced motion holds one subtle static fabric fold, independent of gore setting',()=>{
  const f=fixture();f.state.active.elapsed=2.2;
  f.visual.update(f.run,.016,f.state,{reducedMotion:true,gore:false});const first=positions(f.mesh),diagnostics=f.visual.diagnostics();
  assert.equal(diagnostics.phase,'static-fold');assert(diagnostics.maxDisplacementMeters<=.0025+1e-7);
  f.state.active.elapsed=3.1;f.visual.update(f.run,.016,f.state,{reducedMotion:true,gore:true});
  assert.deepEqual(positions(f.mesh),first,'static fold has no travelling offset');
  assert.equal(f.visual.diagnostics().foldPathFraction,.24);
  f.visual.dispose();
});

test('roach entry precedes the fold and pause restores fabric while the same encounter can resume',()=>{
  const f=fixture(),source=f.mesh.geometry,base=positions(f.mesh);
  f.state.active.elapsed=.8;assert.equal(f.visual.update(f.run,.016,f.state),false);
  assert.equal(f.visual.diagnostics().phase,'entry');assert.equal(f.mesh.geometry,source);
  assert.equal(f.visual.diagnostics().ownedGeometries,0);
  f.state.active.elapsed=2.3;assert.equal(f.visual.update(f.run,.016,f.state),true);
  const fold=positions(f.mesh);assert.equal(f.visual.diagnostics().elapsed,2.3);
  f.run.mode='pause';assert.equal(f.visual.update(f.run,.016,f.state),false);
  assert.equal(f.mesh.geometry,source);assert.deepEqual(positions(f.mesh),base);
  f.run.mode='play';assert.equal(f.visual.update(f.run,.016,f.state),true);
  assert.deepEqual(positions(f.mesh),fold,'semantic age resumes without advancement from frame dt');
  assert.equal(f.visual.update(f.run,.1,f.state,{playing:false}),false);
  assert.equal(f.visual.update(f.run,.1,f.state,{playing:true}),true);
  f.state.active.elapsed=f.state.active.duration;assert.equal(f.visual.update(f.run,.016,f.state),false);
  assert.equal(f.visual.diagnostics().suppression,'settled');assert.equal(f.mesh.geometry,source);
  f.visual.dispose();
});

test('source-limb loss and incompatible actions cancel once and restore rather than blocking controls',()=>{
  const cases=[
    ['missing-limb',run=>{run.playerWounds.rightArm='severed';}],
    ['hand-action',run=>{run.bite.phase='held';}],['hand-action',run=>{run.brutal.phase='windup';}],
    ['hand-action',run=>{run.extraction.phase='rip';}],['hand-action',run=>{run.verminHand.phase='pickup';}],
    ['weapon-action',run=>{run.meleeActive=true;}],['weapon-action',run=>{run.shot=.4;}],
    ['player-action',run=>{run.damage=.2;}],['nearby-threat',run=>{run.course.enemies=[{x:1,y:1,health:100,dead:false}];}],
    ['combat',run=>{run.dungeonProgression={encounter:{active:1}};}],
    ['dead',run=>{run.health=0;}],
  ];
  for(const [reason,change] of cases){
    const f=fixture(),original=f.mesh.geometry,base=positions(f.mesh);
    f.visual.update(f.run,.016,f.state);change(f.run);const snapshot=JSON.stringify(f.run);
    assert.equal(f.visual.update(f.run,.016,f.state,{gore:false}),false,reason);
    assert.equal(f.visual.diagnostics().suppression,reason);
    assert.equal(JSON.stringify(f.run),snapshot,'presentation never writes gameplay or control state');
    assert.equal(f.mesh.geometry,original);assert.deepEqual(positions(f.mesh),base);
    f.run.mode='play';f.run.health=100;f.run.damage=0;f.run.shot=0;f.run.meleeActive=false;f.run.playerWounds.rightArm='intact';
    f.run.course.enemies=[];delete f.run.dungeonProgression;for(const key of ['bite','brutal','extraction','verminHand'])f.run[key].phase='idle';
    assert.equal(f.visual.update(f.run,.016,f.state),false,'stale event cannot restart after a cancellation');
    next(f.state,2);assert.equal(f.visual.update(f.run,.016,f.state),true);f.visual.dispose();
  }
});

test('pause settings, floor transition, restart and asset swaps cannot retain displaced or stale geometry',()=>{
  const f=fixture(),source=f.mesh.geometry,baseline=positions(f.mesh);
  f.visual.update(f.run,.016,f.state);
  assert.equal(f.visual.update(f.run,.016,f.state,{playing:false}),false);
  assert.equal(f.mesh.geometry,source);assert.deepEqual(positions(f.mesh),baseline);
  next(f.state,2);f.visual.update(f.run,.016,f.state);
  f.run.course={enemies:[]};assert.equal(f.visual.update(f.run,.016,f.state),false);
  assert.equal(f.visual.diagnostics().suppression,'transition');assert.equal(f.visual.record,null);
  next(f.state,3);f.visual.update(f.run,.016,f.state);const oldOwned=f.visual.record.geometry;
  let ownedDisposes=0;oldOwned.addEventListener('dispose',()=>ownedDisposes++);
  const replacement=source.clone();f.mesh.geometry=replacement;
  assert.equal(f.visual.update(f.run,.016,f.state),false);
  assert.equal(f.mesh.geometry,replacement,'concurrent asset replacement survives cleanup');assert.equal(ownedDisposes,1);
  next(f.state,4);assert.equal(f.visual.update(f.run,.016,f.state),true);
  f.run.time=0;assert.equal(f.visual.update(f.run,.016,f.state),false);assert.equal(f.mesh.geometry,replacement);
  assert.equal(f.visual.diagnostics().suppression,'transition');
  f.visual.dispose();replacement.dispose();
});

test('repeated activation reuses a single clone and reset/dispose release only owned resources',()=>{
  const f=fixture(),source=f.mesh.geometry,nodeCount=nodes(f.scene);let sourceDisposes=0;
  source.addEventListener('dispose',()=>sourceDisposes++);
  for(let i=0;i<100;i++){
    next(f.state,i);assert.equal(f.visual.update(f.run,.016,f.state),true);
    assert.equal(f.visual.diagnostics().ownedGeometries,1);
    f.state.active=null;f.visual.update(f.run,.016,f.state);
    assert.equal(f.mesh.geometry,source);assert.equal(nodes(f.scene),nodeCount);
  }
  assert.equal(f.visual.diagnostics().geometryCreates,1);assert.equal(f.visual.diagnostics().geometryDisposals,0);
  f.visual.reset();assert.equal(f.visual.diagnostics().ownedGeometries,0);assert.equal(f.visual.diagnostics().geometryDisposals,1);
  next(f.state,101);assert.equal(f.visual.update(f.run,.016,f.state),true);
  f.visual.dispose();f.visual.dispose();assert.equal(f.visual.update(f.run,.016,f.state),false);
  assert.equal(f.visual.diagnostics().geometryCreates,f.visual.diagnostics().geometryDisposals);assert.equal(sourceDisposes,0);
});

