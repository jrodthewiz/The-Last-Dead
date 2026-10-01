import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {Renderer} from '../renderer.js';

function fixture(){
  const course={dungeon:true,waveSpawns:[Array.from({length:30},(_,i)=>({variant:['stalker','fixture-a','fixture-b','fixture-c','fixture-d','fixture-e','fixture-f','fixture-g','fixture-h','fixture-i'][i%10]}))]};
  const renderer=Object.create(Renderer.prototype);
  let created=0;
  Object.assign(renderer,{renderer:{},_course:course,worldRoot:new THREE.Group(),_preparedEnemyVisuals:new Map(),
    _enemySource:()=>({makeActor:()=>{created++;return new THREE.Group();}})});
  return {renderer,course,count:()=>created};
}
test('enemy preparation yields every three actors and preserves the bounded pool',async()=>{
  const f=fixture(),previous=globalThis.requestAnimationFrame,batches=[];
  globalThis.requestAnimationFrame=cb=>{batches.push(f.count());setImmediate(cb);};
  try{
    await f.renderer._prepareDungeonEnemies(f.course);
    assert.equal(f.count(),24);
    assert.deepEqual(batches,[3,6,9,12,15,18,21,24]);
    for(const entries of f.renderer._preparedEnemyVisuals.values())assert(entries.length<=3);
    for(const actor of f.renderer.worldRoot.children)assert.equal(actor.visible,false);
    await f.renderer._prepareDungeonEnemies(f.course);assert.equal(f.count(),24);
  }finally{globalThis.requestAnimationFrame=previous;}
});
test('a retired course stops preparing after its pending batch',async()=>{
  const f=fixture(),previous=globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame=cb=>{f.renderer._course={};setImmediate(cb);};
  try{
    await f.renderer._prepareDungeonEnemies(f.course);
    assert.equal(f.count(),3);
    await f.renderer._prepareDungeonEnemies(f.course);assert.equal(f.count(),3);
  }finally{globalThis.requestAnimationFrame=previous;}
});
function warmupFixture(){
  const course={dungeon:false},r=Object.create(Renderer.prototype),groups=Array.from({length:8},(_,i)=>{
    const group=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());
    mesh.visible=false;group.visible=i===4;group.add(mesh);return group;
  });
  const pool=()=>new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial(),1);
  const calls=[],stages=[];
  Object.assign(r,{_course:course,worldRoot:new THREE.Group(),weaponGroups:groups,muzzleFlash:new THREE.Group(),
    scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),_bellWarmups:[],_afterlifeWarmups:[],
    brutalCombatVisuals:{ready:Promise.resolve()},verminVisuals:{ready:Promise.resolve(),setupArm(){}},
    rifleCasings:{mesh:pool()},spawnTelegraphRings:pool(),_prepareHorrorScares(){},
    renderer:{compileAsync:async()=>{},getRenderTarget:()=>null,setRenderTarget(){}},
    _renderScene(){calls.push(groups.findIndex(g=>g.visible));},_reportPreparation(stage){stages.push(stage);}
  });
  const world=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());world.visible=false;r.worldRoot.add(world);
  return {r,course,calls,stages,world};
}
test('initial equipment uploads yield and later floors reuse buffers, restoring all visibility',async()=>{
  const {r,course,calls,world}=warmupFixture(),previous=globalThis.requestAnimationFrame;
  let yields=0;globalThis.requestAnimationFrame=cb=>{yields++;setImmediate(cb);};
  try{
    await r._prepareWeaponResources(course);
    assert.deepEqual(calls,[0,1,2,3,4,5,6,7,4]);assert.equal(yields,9);
    assert(r._weaponsPrepared&&r._equipmentUploaded);
    assert.equal(world.visible,false);
    r.weaponGroups.forEach((g,i)=>{assert.equal(g.visible,i===4);assert.equal(g.children[0].visible,false);});
    assert.equal(r.spawnTelegraphRings.count,0);assert.equal(r.rifleCasings.mesh.count,0);
    r._course={dungeon:false};calls.length=0;yields=0;
    await r._prepareWeaponResources(r._course);
    assert.deepEqual(calls,[0,4]);assert.equal(yields,2);
  }finally{globalThis.requestAnimationFrame=previous;}
});
test('course cancellation on the final equipment yield does not mark buffers ready',async()=>{
  const {r,course,world}=warmupFixture(),previous=globalThis.requestAnimationFrame;
  let yields=0;globalThis.requestAnimationFrame=cb=>{if(++yields===9)r._course={};setImmediate(cb);};
  try{
    await r._prepareWeaponResources(course);
    assert.equal(r._equipmentUploaded,undefined);assert.equal(r._weaponsPrepared,undefined);
    assert.equal(world.visible,false);
    r.weaponGroups.forEach((g,i)=>assert.equal(g.visible,i===4));
  }finally{globalThis.requestAnimationFrame=previous;}
});
