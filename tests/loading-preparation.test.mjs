import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {Renderer} from '../renderer.js';
import {BodycamPass} from '../bodycam-pass.js';

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

test('dungeon equipment and concealed world resources compile before their first upload draw',async()=>{
  const {r,course,calls,world}=warmupFixture(),previous=globalThis.requestAnimationFrame;
  const target={};let activeTarget=target,compiled=false;
  r.renderer.getRenderTarget=()=>activeTarget;r.renderer.setRenderTarget=value=>{activeTarget=value;};
  r.renderer.compileAsync=async()=>{
    assert.equal(calls.length,0,'no synchronous cold draw before compilation');
    assert.equal(activeTarget,r.bodycam.target,'compile the actual HDR output');
    assert.equal(world.visible,true);assert.equal(world.frustumCulled,false);
    for(const group of r.weaponGroups){assert.equal(group.visible,true);assert.equal(group.children[0].visible,true);assert.equal(group.children[0].frustumCulled,false);}
    compiled=true;
  };
  const draw=r._renderScene;r._renderScene=function(){assert.equal(compiled,true);assert.equal(world.visible,false);assert.equal(world.frustumCulled,true,'real draws restore world culling before shadow rendering');draw.call(this);};
  globalThis.requestAnimationFrame=cb=>setImmediate(cb);
  try{await r._prepareWeaponResources(course);assert.equal(activeTarget,target);assert.equal(r._weaponsPrepared,true);}
  finally{globalThis.requestAnimationFrame=previous;}
});

test('a rejected equipment pipeline restores resources without drawing or marking the map ready',async()=>{
  const {r,course,calls,world}=warmupFixture(),previous=globalThis.requestAnimationFrame;
  let target='screen';r.renderer.getRenderTarget=()=>target;r.renderer.setRenderTarget=value=>{target=value;};
  r.renderer.compileAsync=async()=>{throw Error('equipment pipeline rejected');};
  globalThis.requestAnimationFrame=cb=>setImmediate(cb);
  try{
    await assert.rejects(r._prepareWeaponResources(course),/equipment pipeline rejected/);
    assert.deepEqual(calls,[]);assert.equal(target,'screen');assert.equal(world.visible,false);assert.equal(world.frustumCulled,true);
    r.weaponGroups.forEach((group,i)=>{assert.equal(group.visible,i===4);assert.equal(group.children[0].visible,false);assert.equal(group.children[0].frustumCulled,true);});
    assert.equal(r._equipmentUploaded,undefined);assert.equal(r._weaponsPrepared,undefined);
  }finally{globalThis.requestAnimationFrame=previous;}
});

test('a dungeon prepares its current inventory instead of every unavailable gun',async()=>{
  const {r,course,calls}=warmupFixture(),previous=globalThis.requestAnimationFrame;course.dungeon=true;r.render=()=>{};
  r.renderer.compileAsync=async()=>{assert.deepEqual(r.weaponGroups.map((group,index)=>group.visible?index:null).filter(index=>index!==null),[0,5]);};
  globalThis.requestAnimationFrame=cb=>setImmediate(cb);
  try{
    await r._prepareWeaponResources(course,{course,weapon:5,ownedWeapons:[0,5]});
    assert.deepEqual(calls,[0,5,4]);assert.equal(r._weaponsPrepared,true);
    assert.equal(r._equipmentUploaded,undefined,'a partial inventory never marks the full eight-gun cache uploaded');
  }finally{globalThis.requestAnimationFrame=previous;}
});

test('disabled adaptive exposure prepares the direct output used by gameplay',async()=>{
  for(const coastal of [false,true]){
    const {r,course}=warmupFixture(),previous=globalThis.requestAnimationFrame;
    if(coastal)course.coastal={};r.settings={bodycam:false};let target=null;
    r.renderer.getRenderTarget=()=>target;r.renderer.setRenderTarget=value=>{target=value;};
    r.renderer.compileAsync=async()=>{assert.equal(target,null,'no HDR target when rendering directly to the canvas');};
    globalThis.requestAnimationFrame=cb=>setImmediate(cb);
    try{await r._prepareWeaponResources(course);assert.equal(r._weaponsPrepared,true);}
    finally{globalThis.requestAnimationFrame=previous;}
  }
});

test('underground batches use capacity-independent shader attributes and retain live matrix uploads',async()=>{
  const {r,course}=warmupFixture(),previous=globalThis.requestAnimationFrame;
  const geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial(),batch=new THREE.InstancedMesh(geometry,material,612);
  r.scene.add(batch);
  r.renderer.compileAsync=async()=>{assert.equal(batch.geometry.hasAttribute('coastalMatrix0'),true);assert.equal(batch.count,612);};
  globalThis.requestAnimationFrame=cb=>setImmediate(cb);
  try{
    await r._prepareWeaponResources(course);
    batch.setMatrixAt(0,new THREE.Matrix4().makeTranslation(7,2,3));batch.instanceMatrix.needsUpdate=true;
    const matrices=batch.geometry.getAttribute('coastalMatrix0').data;assert.equal(matrices.array,batch.instanceMatrix.array);assert.equal(matrices.array[12],7);assert.equal(matrices.version,1);
  }finally{globalThis.requestAnimationFrame=previous;batch.dispose();geometry.dispose();material.dispose();}
});

test('camera preparation warms the real exposure and output targets without advancing exposure state',async()=>{
  for(const fail of [false,true]){
    let target='screen',calls=0;
    const renderer={toneMapping:THREE.ACESFilmicToneMapping,capabilities:{maxSamples:4},getDrawingBufferSize:size=>size.set(1280,800),getRenderTarget:()=>target,setRenderTarget:value=>{target=value;}};
    const pass=new BodycamPass(renderer);
    try{
      const compile=async (native,scene,camera)=>{
        calls++;assert.equal(native,renderer);assert.equal(scene,pass.scene);assert.equal(camera,pass.camera);
        if(calls===1){assert.equal(target,pass.exposureTargets[1]);assert.equal(pass.quad.material,pass.exposureMaterial);}
        else{assert.equal(target,'screen');assert.equal(renderer.toneMapping,THREE.NoToneMapping);assert.equal(pass.quad.material,pass.material);if(fail)throw Error('camera pipeline failed');}
      };
      if(fail)await assert.rejects(pass.prepare(compile),/camera pipeline failed/);
      else{await pass.prepare(compile);await pass.prepare(compile);}
      assert.equal(calls,2);assert.equal(target,'screen');assert.equal(renderer.toneMapping,THREE.ACESFilmicToneMapping);
      assert.equal(pass.quad.material,pass.material);assert.equal(pass.exposureIndex,0);assert.equal(pass._resetExposure,true);
      assert.equal(pass.exposureMaterial.uniforms.tPrev.value,null);assert.equal(pass.material.uniforms.tExposure.value,null);
      assert.equal(pass._prepared,fail?undefined:true);
    }finally{pass.dispose();}
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

test('interaction pools created during warmup receive capacity-independent instance attributes before compilation',async()=>{
 const {r,course}=warmupFixture();let pool;
 r.extractionVFX={async prepareWarmup(){
   pool=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial(),73);
   pool.count=1;r.scene.add(pool);return()=>{pool.visible=false;};
 }};
 r.renderer.compileAsync=async()=>{
   assert.equal(pool.userData.coastalInstanceCapacity,73);
   for(let i=0;i<4;i++)assert(pool.geometry.hasAttribute(`coastalMatrix${i}`));
   assert.equal(pool.count,1);
 };
 await r._prepareInteractionResources(course);assert.equal(pool.visible,false);
 pool.geometry.dispose();pool.material.dispose();pool.dispose();
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
