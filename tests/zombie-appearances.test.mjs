import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {Renderer,disposeObject} from '../renderer.js';
import {createAfterlifeModel} from '../npc-afterlife-model.js';
import {ASH_WITNESS_APPEARANCE,ZOMBIE_APPEARANCES,GENERATED_ZOMBIE_APPEARANCES,ZombieAppearanceLibrary,coastalZombieAppearance,zombieAppearance,zombieEnemyPoolKey} from '../zombie-appearances.js';
import {makeCourse,newRun,tick} from '../engine.js';
import {makeHarborCourse} from '../harbor-course.js';

const clipNames=['Idle','Shuffle','Chase','AttackLunge','HitRecoil','Collapse','Run','Crawl','CrawlIdle','Contort'].map(name=>'AshWitness_'+name);
function assetFixture(appearance=ASH_WITNESS_APPEARANCE){
 const template=new THREE.Group(),hips=new THREE.Bone();hips.name='Hips';template.add(hips);
 const geometry=new THREE.BoxGeometry(.6,1.86,.3),count=geometry.attributes.position.count,weights=new Float32Array(count*4);
 for(let i=0;i<count;i++)weights[i*4]=1;
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(count*4),4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));geometry.userData.sharedAsset=true;
 const texture=new THREE.Texture();texture.userData.sharedAsset=true;
 const material=new THREE.MeshStandardMaterial({map:texture,roughnessMap:texture,metalnessMap:texture});material.userData.sharedLibrary=true;
 const mesh=new THREE.SkinnedMesh(geometry,material);template.add(mesh);mesh.bind(new THREE.Skeleton([hips]));
 return {template,appearance,appearancePalette:ZOMBIE_APPEARANCES[appearance]?.palette,clips:clipNames.map(name=>new THREE.AnimationClip(name,name==='AshWitness_AttackLunge'?.8:1,[])),mesh,geometry,material,texture};
}
const enemy=(id,appearance=ASH_WITNESS_APPEARANCE)=>({id,appearance,kind:0,variant:'stalker',x:6,y:6,hp:10,maxHp:10,attack:99,dead:false,flash:0,locomotion:'shambler',facing:0});

test('appearance identity has a deterministic coastal mix and explicit requests remain authoritative',()=>{
 const kinds=['stalker','bloodhound','stalker','skitter','stalker','bloodhound','stalker','skitter'];
 const assigned=kinds.map((variant,order)=>coastalZombieAppearance({kind:0,variant},order));
 assert.deepEqual(assigned,['drowned-dockworker','fever-runner','ash-witness','crooked-crawler','drowned-dockworker','fever-runner','ash-witness','crooked-crawler']);
 assert.equal(coastalZombieAppearance({kind:0,variant:'bloodhound',appearance:'crooked-crawler'},4),'crooked-crawler');
 assert.equal(coastalZombieAppearance({kind:0,variant:'stalker'},0,'custom-saved-skin'),'custom-saved-skin');
 assert.equal(coastalZombieAppearance({kind:1,variant:'caster'},0),ASH_WITNESS_APPEARANCE);
 assert.equal(zombieAppearance('unknown').id,ASH_WITNESS_APPEARANCE);
 assert.equal(new Set(GENERATED_ZOMBIE_APPEARANCES.map(a=>a.palette.skin)).size,3);
});

test('actual harbor spawning assigns the mix, preserves explicit appearance, and serializes it through injury',()=>{
 const course=makeHarborCourse(makeCourse()),run=newRun(course);run.mode='play';tick(run,1/60);
 assert.deepEqual(course.enemies.map(e=>e.appearance),['drowned-dockworker','fever-runner','ash-witness','crooked-crawler'].slice(0,course.harborSpawns.length));
 const e=course.enemies.find(e=>e.appearance==='fever-runner');e.locomotion='crawl';tick(run,1/60);assert.equal(e.appearance,'fever-runner');assert.equal(JSON.parse(JSON.stringify(e)).appearance,e.appearance);
 const explicitCourse=makeHarborCourse(makeCourse());explicitCourse.harborSpawns[0].appearance='crooked-crawler';const explicitRun=newRun(explicitCourse);explicitRun.mode='play';tick(explicitRun,1/60);assert.equal(explicitCourse.enemies[0].appearance,'crooked-crawler');
});

test('one library load per generated appearance supplies complete sources and useful diagnostics',async()=>{
 const calls=[],assets=[];
 const library=new ZombieAppearanceLibrary(async url=>{calls.push(url);const asset=assetFixture();assets.push(asset);return asset;},asset=>disposeObject(asset.template,true));
 await library.ready;assert.deepEqual(calls,GENERATED_ZOMBIE_APPEARANCES.map(a=>a.url));
 for(const descriptor of GENERATED_ZOMBIE_APPEARANCES){const asset=library.get(descriptor.id);assert(asset);assert.equal(asset.appearance,descriptor.id);assert.equal(asset.appearancePalette,descriptor.palette);assert.equal(asset.preserveAtlasColors,true);assert.equal(library.get(descriptor.id),asset);}
 const root=createAfterlifeModel(library.get('drowned-dockworker'));assert.equal(root.userData.afterlife.preserveAtlasColors,true);const diagnostic=library.diagnostics([root]);assert.equal(diagnostic[0].instances,1);assert(diagnostic.every(d=>d.status==='ready'&&d.clips.length===10&&d.error===null));disposeObject(root);library.dispose();
});

test('missing or incomplete generated assets fall back to Ash and retain per-appearance errors',async()=>{
 let released=0;
 const library=new ZombieAppearanceLibrary(async url=>{if(url.includes('dockworker'))throw Error('404 dockworker');const asset=assetFixture();asset.clips.pop();return asset;},asset=>{released++;disposeObject(asset.template,true);});
 await library.ready;assert.equal(released,2);assert(library.diagnostics().every(d=>d.status==='error'&&!d.loaded&&d.error));assert.match(library.diagnostics()[0].error,/404/);assert.match(library.diagnostics()[1].error,/AshWitness_Contort/);
 const r=Object.create(Renderer.prototype),ash=assetFixture();Object.assign(r,{_ashWitnessAsset:ash,_zombieAppearanceLibrary:library});const source=r._enemySource(enemy(1,'fever-runner'));assert.equal(source.template,ash.template);assert.equal(source.requestedAppearance,'fever-runner');const root=source.makeActor();assert.equal(root.userData.afterlife.appearance,ASH_WITNESS_APPEARANCE);disposeObject(root);library.dispose();assert.equal(released,2);disposeObject(ash.template,true);
});

test('actor clones share geometry and atlases while owning materials, mixers and their rest template',()=>{
 const asset=assetFixture('crooked-crawler'),a=createAfterlifeModel(asset),b=createAfterlifeModel(asset);
 const ma=a.userData.afterlife.model.children.find(m=>m.isSkinnedMesh),mb=b.userData.afterlife.model.children.find(m=>m.isSkinnedMesh);
 assert.equal(ma.geometry,asset.geometry);assert.equal(mb.geometry,asset.geometry);assert.equal(ma.material.map,asset.texture);assert.equal(mb.material.map,asset.texture);assert.notEqual(ma.material,mb.material);assert.notEqual(ma.material,asset.material);assert.notEqual(ma.skeleton,mb.skeleton);assert.notEqual(a.userData.afterlife.mixer,b.userData.afterlife.mixer);
 assert.equal(a.userData.afterlife.sourceTemplate,asset.template);assert.equal(a.userData.afterlife.appearance,'crooked-crawler');assert.equal(a.userData.afterlife.appearancePalette,asset.appearancePalette);
 let geometryDisposals=0,textureDisposals=0,sourceMaterialDisposals=0;asset.geometry.addEventListener('dispose',()=>geometryDisposals++);asset.texture.addEventListener('dispose',()=>textureDisposals++);asset.material.addEventListener('dispose',()=>sourceMaterialDisposals++);
 disposeObject(a);disposeObject(b);assert.equal(geometryDisposals,0);assert.equal(textureDisposals,0);assert.equal(sourceMaterialDisposals,0);disposeObject(asset.template,true);assert.equal(geometryDisposals,1);assert.equal(textureDisposals,1,'one shared atlas is released once across material map slots');assert.equal(sourceMaterialDisposals,1);
});

test('appearance-specific preparation pools cannot consume Ash or another generated body',()=>{
 const ash=assetFixture(),dock=assetFixture('drowned-dockworker'),r=Object.create(Renderer.prototype),e=enemy(1,'drowned-dockworker'),course=makeCourse();course.enemies=[e];
 const ashRoot=createAfterlifeModel(ash),dockRoot=createAfterlifeModel(dock),ashKey=zombieEnemyPoolKey(enemy(1)),dockKey=zombieEnemyPoolKey(e);assert.notEqual(ashKey,dockKey);assert.notEqual(dockKey,zombieEnemyPoolKey(enemy(1,'fever-runner')));
 Object.assign(r,{_ashWitnessAsset:ash,_zombieAppearanceLibrary:{get:id=>id===dock.appearance?dock:null},_preparedEnemyVisuals:new Map([[ashKey,[{root:ashRoot,template:ash.template}]],[dockKey,[{root:dockRoot,template:dock.template}]]]),_enemyVisuals:new Map(),worldRoot:new THREE.Group(),enemyContactShadows:{setMatrixAt(){},instanceMatrix:{}}});
 r._updateEnemies({course,x:6,y:6},1000);assert.equal(r._enemyVisuals.get(e.id).root,dockRoot);assert.equal(r._preparedEnemyVisuals.get(dockKey).length,0);assert.equal(r._preparedEnemyVisuals.get(ashKey).length,1);assert.equal(dockRoot.userData.afterlife.sourceTemplate,dock.template);
 e.locomotion='crawl';r._updateEnemies({course,x:6,y:6},1020);assert.equal(r._enemyVisuals.get(e.id).root,dockRoot);assert.equal(dockRoot.userData.afterlife.appearance,dock.appearance);
 disposeObject(ashRoot);disposeObject(dockRoot);disposeObject(ash.template,true);disposeObject(dock.template,true);
});

test('disposal releases each source once and also catches loads completing after renderer disposal',async()=>{
 const pending=[],released=[];
 const library=new ZombieAppearanceLibrary(url=>new Promise(resolve=>pending.push({url,resolve})),asset=>{released.push(asset.template);disposeObject(asset.template,true);});
 pending[0].resolve(assetFixture());await new Promise(resolve=>setImmediate(resolve));assert(library.get('drowned-dockworker'));
 library.dispose();library.dispose();for(const entry of pending.slice(1))entry.resolve(assetFixture());await library.ready;
 assert.equal(released.length,3);assert.equal(new Set(released).size,3);assert(library.diagnostics().every(d=>d.status==='disposed'&&!d.loaded));assert.equal(library.get('drowned-dockworker'),null);
});

test('coastal GPU preparation retains every generated appearance and primes the crawler low',async()=>{
 const r=Object.create(Renderer.prototype),course={coastal:{},enemies:[]},ash=assetFixture(),assets=new Map(GENERATED_ZOMBIE_APPEARANCES.map(d=>[d.id,assetFixture(d.id)])),scene=new THREE.Scene(),worldRoot=new THREE.Group();scene.add(worldRoot);
 let target=null,draws=0,compiles=0;
 Object.assign(r,{scene,worldRoot,_course:course,camera:new THREE.PerspectiveCamera(),_ashWitnessAsset:ash,_zombieAppearanceLibrary:{get:id=>assets.get(id)||null},bodycam:{_ensureTarget(){},target:{}},renderer:{getRenderTarget:()=>target,setRenderTarget:value=>{target=value;},backend:{device:{queue:{onSubmittedWorkDone:async()=>{}}}}},_reportPreparation(){},_renderScene(){draws++;},_syncBlackwaterActorStyle(){}});
 const source=r._enemySource;r._enemySource=function(e){return e.kind===0?source.call(this,e):{makeActor:()=>new THREE.Group()};};
 r._compilePreparedScene=async()=>{compiles++;assert.equal(worldRoot.children.length,6);for(const root of worldRoot.children)assert.equal(root.visible,true);const crawler=worldRoot.children.find(root=>root.userData.afterlife?.appearance==='crooked-crawler');assert.equal(crawler.userData.afterlife.motionClass,'crawler');assert.equal(crawler.userData.afterlife.crawlIdleAction.getEffectiveWeight(),1);};
 const raf=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=callback=>setImmediate(callback);
 try{await r._prepareCoastalEnemies(course);await r._prepareCoastalEnemies(course);assert.equal(compiles,1);assert.equal(draws,1);assert.equal(target,null);assert.equal(r._preparedEnemyVisuals.size,6);for(const descriptor of GENERATED_ZOMBIE_APPEARANCES){const variant=descriptor.id==='fever-runner'?'bloodhound':descriptor.id==='crooked-crawler'?'skitter':'stalker',entry=r._preparedEnemyVisuals.get(zombieEnemyPoolKey({kind:0,variant,appearance:descriptor.id}))[0];assert.equal(entry.root.userData.afterlife.appearance,descriptor.id);assert.equal(entry.root.visible,false);assert.equal(entry.root.userData.afterlife.sourceTemplate,assets.get(descriptor.id).template);}}
 finally{globalThis.requestAnimationFrame=raf;disposeObject(worldRoot);disposeObject(ash.template,true);for(const asset of assets.values())disposeObject(asset.template,true);}
});
