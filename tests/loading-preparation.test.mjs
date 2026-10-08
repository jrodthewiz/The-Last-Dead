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
    bodycam:{_ensureTarget(){},target:{}},
    renderer:{backend:{device:{queue:{onSubmittedWorkDone:async()=>{}}}},compileAsync:async()=>{},getRenderTarget:()=>null,setRenderTarget(){}},
    _prepareCoastalEnemies:async()=>{},
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

test('open coast prepares the visible scene without uploading every campaign weapon, and honors cancellation',async()=>{
  for(const cancel of [false,true]){
    const {r,course,calls,world}=warmupFixture(),previous=globalThis.requestAnimationFrame;
    course.coastal={};
    globalThis.requestAnimationFrame=cb=>{if(cancel)r._course={};setImmediate(cb);};
    try{
      await r._prepareWeaponResources(course);
      assert.deepEqual(calls,cancel?[]:[4]);
      assert.equal(r._equipmentUploaded,undefined);
      assert.equal(r._weaponsPrepared,cancel?undefined:true);
      assert.equal(world.visible,false);
      r.weaponGroups.forEach((g,i)=>assert.equal(g.visible,i===4));
    }finally{globalThis.requestAnimationFrame=previous;}
  }
});

test('coastal startup skips the dungeon-only warden; a dungeon transition awaits it',async()=>{
  const {r,course}=warmupFixture(),previous=globalThis.requestAnimationFrame;
  let loads=0;r._loadBloodworksWarden=()=>{loads++;return Promise.resolve();};
  globalThis.requestAnimationFrame=cb=>setImmediate(cb);
  try{
    course.coastal={};await r._prepareWeaponResources(course);assert.equal(loads,0);
    r._course={dungeon:false};await r._prepareWeaponResources(r._course);assert.equal(loads,1);
  }finally{globalThis.requestAnimationFrame=previous;}
});

test('Start keeps the title frame still during preparation and resumes it when ready',()=>{
 const {r,course}=warmupFixture();let draws=0,updates=0;
 r._warmupCourse=course;r._beginPending=true;r._weaponsPrepared=false;
 r.menuCinematic={setAsset(){},update(){updates++;},render(){draws++;},actors:[]};r.canvas={dataset:{}};r.settings={};
 r.render=()=>{throw Error('the pending course is already preparing');};
 r.renderMenu({course},0);assert.equal(draws,0);assert.equal(updates,0);
 r._weaponsPrepared=true;r.renderMenu({course},100);assert.equal(draws,1);assert.equal(updates,1);
});

test('loaded visual bindings refresh once before compilation without restarting preparation or drawing',async()=>{
 const {r,course}=warmupFixture(),previous=globalThis.requestAnimationFrame;course.coastal={};
 const run={course},events=[];let preparationCalls=0,ready=false;
 r._warmupCourse=course;r._weaponsPrepared=false;
 r._survivorReady=Promise.resolve().then(()=>{ready=true;events.push('assets');});
 const original=r._prepareWeaponResources;r._prepareWeaponResources=function(...args){preparationCalls++;return original.apply(this,args);};
 r.render=function(value){assert.equal(value,run);assert(ready);events.push('bind');if(this._warmupCourse!==value.course)this._prepareWeaponResources(value.course,value);if(this._weaponsPrepared)throw Error('loading visual update drew too early');};
 r.renderer.compileAsync=async()=>{assert(events.includes('bind'));events.push('compile');};
 globalThis.requestAnimationFrame=callback=>setImmediate(callback);
 try{await r._prepareWeaponResources(course,run);assert.equal(preparationCalls,1);assert.deepEqual(events,['assets','bind','compile']);assert.equal(r._weaponsPrepared,true);}finally{globalThis.requestAnimationFrame=previous;}
});

test('coastal NPC preparation retains only three real profile actors and restores them after GPU upload',async()=>{
 for(const fail of [false,true]){
  const {r,course}=warmupFixture();course.coastal={};course.enemies=[];
  const template={},created=[],originalTarget={};let target=originalTarget,drawn=0;
  r.scene.add(r.worldRoot);r.camera.position.set(3,2,4);
  r._enemySource=enemy=>({useAfterlife:true,template,makeActor(){const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()));created.push({...enemy,root});return root;}});
  r.renderer.getRenderTarget=()=>target;r.renderer.setRenderTarget=value=>{target=value;};
  r.renderer.compileAsync=async()=>{assert.equal(created.length,3);for(const entry of created){assert.equal(entry.root.visible,true);assert.equal(entry.root.children[0].frustumCulled,false);}if(fail)throw Error('NPC compile failed');};
  r._renderScene=()=>{drawn++;};
  const previous=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=callback=>setImmediate(callback);
  try{
   const prepare=()=>Renderer.prototype._prepareCoastalEnemies.call(r,course);
   if(fail)await assert.rejects(prepare(),/NPC compile failed/);else{await prepare();await prepare();}
   assert.deepEqual(created.map(actor=>[actor.kind,actor.variant]),[[0,'stalker'],[1,'caster'],[2,'brute']]);assert.equal(target,originalTarget);assert.equal(drawn,fail?0:1);assert.equal(course.enemies.length,0);
   for(const actor of created){assert.equal(actor.root.visible,false);assert(actor.root.position.equals(new THREE.Vector3()));assert.equal(actor.root.children[0].frustumCulled,true);assert.equal(r._preparedEnemyVisuals.get(`${actor.kind}:${actor.variant}`)[0].root,actor.root);}
  }finally{globalThis.requestAnimationFrame=previous;}
 }
});

test('coast preparation includes offscreen exterior meshes and restores culling after failures',async()=>{
 for(const fail of [false,true]){
  const {r,course}=warmupFixture();course.coastal={};
  const offscreen=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());offscreen.position.x=1000;r.scene.add(offscreen);
  r.renderer.compileAsync=async()=>{assert.equal(offscreen.frustumCulled,false);if(fail)throw Error('compile failed');};
  const previous=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=cb=>setImmediate(cb);
  try{if(fail)await assert.rejects(r._prepareWeaponResources(course),/compile failed/);else await r._prepareWeaponResources(course);
   assert.equal(offscreen.frustumCulled,true);assert.equal(offscreen.visible,true);
  }finally{globalThis.requestAnimationFrame=previous;offscreen.geometry.dispose();offscreen.material.dispose();}
 }
});

test('material preparation never renders shadow maps with expanded warmup culling',async()=>{
 for(const fail of [false,true]){
  const {r}=warmupFixture(),light=new THREE.DirectionalLight();light.castShadow=true;light.shadow.autoUpdate=true;light.shadow.needsUpdate=true;r.scene.add(light);
  r.renderer.compileAsync=async()=>{assert.equal(light.shadow.autoUpdate,false);assert.equal(light.shadow.needsUpdate,false);if(fail)throw Error('compile failed');};
  if(fail)await assert.rejects(r._compilePreparedScene(r.renderer),/compile failed/);else await r._compilePreparedScene(r.renderer);
  assert.equal(light.shadow.autoUpdate,true);assert.equal(light.shadow.needsUpdate,true);
 }
});

test('a lost graphics device rejects preparation instead of leaving loading pending',async()=>{
 const {r}=warmupFixture();r.renderer.compileAsync=()=>new Promise(()=>{});
 r.renderer.backend.device.lost=Promise.resolve({reason:'unknown'});
 await assert.rejects(r._compilePreparedScene(r.renderer),/Graphics device lost/);
});

test('interaction preparation restores hidden resources and target on cancellation or compile failure',async()=>{
 for(const mode of ['ready','cancel','error']){
  const {r,course,calls}=warmupFixture();let visible=false,target='screen',restored=0;
  r.verminVisuals.prepareWarmup=()=>{visible=true;return()=>{visible=false;restored++;};};
  r.renderer.getRenderTarget=()=>target;r.renderer.setRenderTarget=value=>{target=value;};
  r.renderer.compileAsync=async()=>{assert.equal(visible,true);assert.equal(target,r.bodycam.target);if(mode==='cancel')r._course={};if(mode==='error')throw Error('compile failed');};
  if(mode==='error')await assert.rejects(r._prepareInteractionResources(course),/compile failed/);
  else await r._prepareInteractionResources(course);
  assert.equal(visible,false);assert.equal(restored,1);assert.equal(target,'screen');
  assert.equal(calls.length,mode==='ready'?1:0);
 }
});

test('interaction preparation includes the player body hidden by the ready menu state',async()=>{
 const {r,course}=warmupFixture(),body=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());body.add(mesh);body.visible=false;r._survivors={local:body};r.scene.add(body);
 r.renderer.compileAsync=async()=>{assert.equal(body.visible,true);assert.equal(mesh.frustumCulled,false);};
 await r._prepareInteractionResources(course);assert.equal(body.visible,false);assert.equal(mesh.frustumCulled,true);mesh.geometry.dispose();mesh.material.dispose();
});

test('anatomy pipelines draw during preparation, release their temporary scene and invalidate on cancellation',async()=>{
  for(const cancel of [false,true]){
    const {r,course}=warmupFixture(),actor=new THREE.Group(),group=new THREE.Group();actor.userData.afterlifeModel=true;r._afterlifeWarmups=[actor];r.brutalCombatVisuals.physics={prepare(){}};
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());mesh.castShadow=true;group.add(mesh);
    let draws=0,releases=0,finishes=0;
    const anatomy={warmup(root){assert.equal(root,actor);return{group,release(){releases++;}};}};r.brutalCombatVisuals.anatomy=anatomy;
    const render=r._renderScene;r._renderScene=function(){if(group.parent===r.scene){draws++;assert.equal(mesh.frustumCulled,false);assert.equal(mesh.castShadow,false);}render.call(r);};
    r.renderer.backend.device.queue.onSubmittedWorkDone=async()=>{finishes++;};
    const previous=globalThis.requestAnimationFrame;let yields=0;
    globalThis.requestAnimationFrame=cb=>{if(cancel&&++yields===9)r._course={};setImmediate(cb);};
    try{await r._prepareWeaponResources(course);assert(draws>0);assert.equal(releases,1);assert.equal(group.parent,null);
      assert.equal(finishes,cancel?0:1);assert.equal(anatomy.warmupCourse,cancel?undefined:course);
    }finally{globalThis.requestAnimationFrame=previous;}
  }
});
