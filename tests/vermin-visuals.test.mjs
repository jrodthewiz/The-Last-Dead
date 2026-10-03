import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from '../vendor/utils/SkeletonUtils.js';
import {VerminVisuals,VERMIN_VISUAL_LIMITS,verminHandPose,verminMorphPose,createVerminPool,writeVerminMorph,sampleVerminSurface,isolateVerminLeftArm,createVerminStomachWound,verminMouthFrame} from '../vermin-visuals.js';
import {createAfterlifeModel} from '../npc-afterlife-model.js';
import {applyCharacterArticulation,restoreCharacterArticulation} from '../character-articulation.js';
import {Renderer} from '../renderer.js';

let vermin,survivor,anatomy,zombie;
const raw=new Map(),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
test.before(async()=>{
  const previousBitmap=globalThis.createImageBitmap,previousSelf=globalThis.self;globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
  try{
    for(const [key,path] of [['vermin','assets/models/vermin-v1.glb'],['survivor','assets/survivor/tld-survivor-v02.glb'],['anatomy','assets/models/brutal-anatomy-v1.glb'],['zombie','assets/models/afterlife-ash-witness-rig-v05.glb']]){
      const bytes=readFileSync(new URL('../'+path,import.meta.url));raw.set(path,sha(bytes));const asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
      if(key==='vermin')vermin=asset.scene;else if(key==='survivor')survivor=asset.scene;else if(key==='zombie')zombie=asset.scene;else anatomy=asset.scene;
    }
  }finally{if(previousBitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=previousBitmap;if(previousSelf===undefined)delete globalThis.self;else globalThis.self=previousSelf;}
});
function ownedAsset(){
  const copy=vermin.clone(true),materials=new Map(),textures=new Map();copy.traverse(mesh=>{if(!mesh.isMesh)return;mesh.geometry=mesh.geometry.clone();if(!materials.has(mesh.material)){const m=mesh.material.clone();for(const [name,value] of Object.entries(m))if(value?.isTexture){if(!textures.has(value))textures.set(value,value.clone());m[name]=textures.get(value);}materials.set(mesh.material,m);}mesh.material=materials.get(mesh.material);});return copy;
}
async function fixture(){
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(92,16/9,.02,200);camera.position.set(0,1.6,0);scene.add(camera);
  const groups=Array.from({length:8},(_,i)=>{const group=new THREE.Group(),model=new THREE.Group(),leftArm=new THREE.Group(),rightArm=new THREE.Group();model.name='FixtureReceiver'+i;rightArm.name='FixtureSleeve'+i;model.add(new THREE.Mesh(new THREE.BoxGeometry(.08,.09,.42),new THREE.MeshStandardMaterial()));model.position.set(.24,-.28,-.46);rightArm.add(new THREE.Mesh(new THREE.BoxGeometry(.08,.35,.09),new THREE.MeshStandardMaterial()));rightArm.position.set(.22,-.58,-.17);group.add(model,leftArm,rightArm);group.userData={model,viewArms:{leftArm,rightArm}};camera.add(group);group.visible=i===4;return group;});
  const renderer={scene,camera,weaponGroups:groups,settings:{gore:true,reducedMotion:false},_survivors:{template:survivor},_enemyVisuals:new Map(),brutalCombatVisuals:{asset:anatomy}},visual=new VerminVisuals(renderer,{assetPromise:Promise.resolve(ownedAsset())});await visual.ready;
  const run={x:0,y:0,z:0,angle:-Math.PI/2,pitch:0,time:5,mode:'play',health:100,playerId:'host',weapon:4,course:{enemies:[]},vermin:{rats:[],roaches:[],swarm:{phase:'idle'}},verminHand:{phase:'idle'},verminCrawl:{phase:'idle'}};
  scene.updateMatrixWorld(true);return {scene,camera,renderer,visual,run,groups};
}
const matrix=(pool,index=0)=>{const result=new THREE.Matrix4();pool.getMatrixAt(index,result);return result;};
const morph=(pool,index=0)=>{const holder={morphTargetInfluences:Array(pool.userData.morphHolder.morphTargetInfluences.length).fill(0)};pool.getMorphAt(index,holder);return holder.morphTargetInfluences;};

test('preparation exposes cold hand and instanced variants and restores active visual state',async()=>{
 const {visual}=await fixture();visual.setupArm();visual.viewRats.count=2;visual.viewRoot.visible=false;
 const before=[visual.root,visual.viewRoot,visual.arms,...visual.pools,visual.spray].map(object=>({object,visible:object.visible,count:object.count}));
 const restore=visual.prepareWarmup();
 assert.equal(visual.arms.visible,true);assert.equal(visual.viewRoot.visible,true);
 for(const pool of visual.pools)assert(pool.count>0);
 assert.equal(visual.viewRats.count,2);
 restore();restore();
 for(const entry of before){assert.equal(entry.object.visible,entry.visible);assert.equal(entry.object.count,entry.count);}
 visual.dispose();
});

test('canonical grab, contact, hand bite and recovery use phase seconds at 30/60/120 Hz',()=>{
  assert.equal(verminHandPose({phase:'pickup',elapsed:0}).pickup,0);assert.equal(verminHandPose({phase:'pickup',elapsed:.36}).pickup,1);
  assert.equal(verminHandPose({phase:'release',elapsed:.3}).visible,false);
  const hand={phase:'held',elapsed:90,holdAge:1.35,bites:1};assert.equal(verminHandPose(hand,false,12).bite,1);assert.equal(verminHandPose({...hand,holdAge:1.51},false,12).bite,0);
  assert.equal(verminHandPose({...hand,holdAge:2.75,bites:2},false,300).bite,1,'simulated hold age controls the beat, independent of render or peer world clock');
  for(const phase of ['pickup','stuff','release','idle'])assert.equal(verminHandPose({...hand,phase,holdAge:1.35},false,12).bite,0,'a frozen held bite cannot leak into another phase');
  for(const fps of [30,60,120])for(let i=0;i<fps*2;i++){
    const elapsed=i/fps,pose=verminHandPose({phase:'stuff',elapsed,bites:0},false,12);assert(Object.values(pose).filter(v=>typeof v==='number').every(Number.isFinite));assert(pose.grip>=0&&pose.grip<=1);assert(pose.reach>=0&&pose.reach<=1);
    for(const kind of ['rat','roach']){const full=verminMorphPose(kind,elapsed,.43),reduced=verminMorphPose(kind,elapsed,.43,{reducedMotion:true});assert(Object.values(full).every(v=>v>=0&&v<=1));assert.equal(full.ScurryA*full.ScurryB,0);assert(reduced.ScurryA<=full.ScurryA);assert(reduced.ScurryB<=full.ScurryB);}
  }
});

test('real v05 mouth contact follows the authored lips below its Jaw hinge, including posed jaw and exact recovery',()=>{
  const actor=createAfterlifeModel(zombie),position=new THREE.Vector3(),quaternion=new THREE.Quaternion();actor.updateMatrixWorld(true);const jaw=actor.getObjectByName('Jaw'),hinge=jaw.getWorldPosition(new THREE.Vector3());
  assert.equal(verminMouthFrame(actor,position,quaternion),jaw);const neutral=position.clone();assert(neutral.y<hinge.y-.039&&neutral.y>hinge.y-.041);assert(Math.abs(neutral.z-hinge.z)>.110);assert(Math.abs(neutral.y-1.698)<.003);
  applyCharacterArticulation(actor.userData.afterlife.articulation,{jawOpen:.64,tongueLift:.2,lipCurl:.2});actor.updateMatrixWorld(true);verminMouthFrame(actor,position,quaternion);assert(position.distanceTo(neutral)>.03);assert(position.y<neutral.y,'opened lower mouth follows the source jaw instead of jumping to the forehead');
  restoreCharacterArticulation(actor.userData.afterlife.articulation);actor.updateMatrixWorld(true);verminMouthFrame(actor,position,quaternion);assert(position.distanceTo(neutral)<1e-8);actor.traverse(node=>node.skeleton?.dispose());
});

test('real imported species retain their measured scale and independent native per-instance morph palette',()=>{
  const source=vermin.getObjectByName('Rat'),roach=vermin.getObjectByName('Cockroach'),geometry=source.geometry,material=source.material,weights=source.morphTargetInfluences.slice();
  assert.deepEqual(source.morphTargetDictionary,{ScurryA:0,ScurryB:1,Bite:2,TailLeft:3,TailRight:4});assert.deepEqual(roach.morphTargetDictionary,{ScurryA:0,ScurryB:1,AntennaLeft:2,AntennaRight:3});
  const neutralBounds=mesh=>{const bounds=new THREE.Box3(),point=new THREE.Vector3(),position=mesh.geometry.attributes.position;for(let i=0;i<position.count;i++)bounds.expandByPoint(point.fromBufferAttribute(position,i));return bounds;};
  const size=neutralBounds(source).getSize(new THREE.Vector3()),roachSize=neutralBounds(roach).getSize(new THREE.Vector3());assert(size.y>.10&&size.y<.12);assert(roachSize.y<.010&&roachSize.z<.082);
  const pool=createVerminPool(source,4);assert.equal(pool.count,0);assert.equal(pool.morphTexture.image.height,4);assert.equal(pool.geometry,geometry);assert.equal(pool.material,material);
  writeVerminMorph(pool,0,{Bite:1,TailLeft:.4});writeVerminMorph(pool,1,{ScurryB:.72,TailRight:.2});assert.deepEqual(morph(pool,0),[0,0,1,.4000000059604645,0]);assert(Math.abs(morph(pool,1)[1]-.72)<1e-6);assert.equal(morph(pool,1)[2],0);assert.deepEqual(source.morphTargetInfluences,weights);assert.equal(writeVerminMorph(pool,4,{Bite:1}),false);
  let buffer=0,texture=0;pool.addEventListener('dispose',()=>buffer++);pool.morphTexture.addEventListener('dispose',()=>texture++);pool.dispose();assert.equal(buffer,1);assert.equal(texture,1);assert.equal(pool.morphTexture,null);
});

test('left-only source arm topology has no right-arm vertices and preserves skin, UV, and source bind data',()=>{
  const mesh=survivor.getObjectByName('TLD_Remote_Arms'),before=sha(Buffer.from(mesh.geometry.index.array.buffer)),weights=sha(Buffer.from(mesh.geometry.attributes.skinWeight.array.buffer)),owned=isolateVerminLeftArm(mesh);
  assert(owned.index.count>10000&&owned.index.count<mesh.geometry.index.count);assert.notEqual(owned,mesh.geometry);assert.deepEqual(owned.attributes.uv.array,mesh.geometry.attributes.uv.array);
  const left=new Set(mesh.skeleton.bones.map((bone,i)=>/^Left(?:Shoulder|Arm|ForeArm|Hand)/.test(bone.name)?i:-1));for(const vertex of owned.index.array){let amount=0;for(let j=0;j<4;j++)if(left.has(owned.attributes.skinIndex.getComponent(vertex,j)))amount+=owned.attributes.skinWeight.getComponent(vertex,j);assert(amount>.45);}
  assert.equal(sha(Buffer.from(mesh.geometry.index.array.buffer)),before);assert.equal(sha(Buffer.from(mesh.geometry.attributes.skinWeight.array.buffer)),weights);owned.dispose();
});

test('holding uses original survivor IK and fitted scruff, restores all eight source support arms exactly, and never moves aim',async()=>{
  const f=await fixture(),{visual,run,camera,groups}=f,position=camera.position.toArray(),quaternion=camera.quaternion.toArray();
  run.vermin.rats=[{id:10,x:0,y:-.14,z:.005,state:'held',ownerId:'host',age:0,pickupX:0,pickupY:-.14,pickupZ:.005}];run.verminHand={phase:'held',ratId:10,elapsed:0,holdAge:1.35,bites:1};
  groups[2].userData.viewArms.leftArm.visible=false;const visibility=groups.map(g=>g.userData.viewArms.leftArm.visible);
  visual.beginFrame();visual.update(run);assert.equal(visual.viewRats.count,1);assert.equal(visual.rats.count,0);assert.equal(visual.arms.visible,true);assert.equal(visual.counterGrip.status,'ready');assert.equal(visual.counterGrip.hands.left.grip,.8);assert(visual.gripGap<1e-10);assert.notEqual(visual.handContactVertex,undefined);assert(groups.every(g=>!g.userData.viewArms.leftArm.visible));
  const mesh=visual.arms.getObjectByName('TLD_Remote_Arms');assert.notEqual(mesh.geometry,survivor.getObjectByName('TLD_Remote_Arms').geometry);assert(matrix(visual.viewRats).elements.every(Number.isFinite));assert.equal(morph(visual.viewRats)[2],1);
  const first=matrix(visual.viewRats).toArray();visual.beginFrame();visual.update(run);assert.deepEqual(matrix(visual.viewRats).toArray(),first,'same canonical pose cannot accumulate wrist or grip transforms');
  run.verminHand.phase='release';run.verminHand.elapsed=.18;run.vermin.rats[0].state='thrown';visual.beginFrame();visual.update(run);assert.equal(visual.viewRats.count,0,'release hand cannot duplicate an airborne rat');
  visual.beginFrame();run.verminHand={phase:'idle'};visual.update(run);assert.deepEqual(groups.map(g=>g.userData.viewArms.leftArm.visible),visibility);assert.equal(visual.arms.visible,false);assert.deepEqual(camera.position.toArray(),position);assert.deepEqual(camera.quaternion.toArray(),quaternion);
  for(const [path,hash] of raw)assert.equal(sha(readFileSync(new URL('../'+path,import.meta.url))),hash);visual.dispose();
});

test('canonical peak hand bite turns authored incisors toward actual fingertips while the scruff remains attached and poses restore',async()=>{
  const f=await fixture(),{visual,run}=f;run.vermin.rats=[{id:10,state:'held',ownerId:'host',z:.3}];run.verminHand={phase:'held',ratId:10,elapsed:0,holdAge:1,bites:0};visual.beginFrame();visual.update(run);
  const neutral=matrix(visual.viewRats).toArray(),originalFinger=visual.armBones.LeftHand.quaternion.toArray();assert.equal(visual.diagnostics().handBite.twistRadians,0);
  run.verminHand.holdAge=1.35;run.verminHand.bites=1;visual.beginFrame();visual.update(run);const peak=matrix(visual.viewRats).toArray(),receipt=visual.diagnostics();assert(receipt.handBite.twistRadians>.4&&receipt.handBite.twistRadians<=1.25);assert(receipt.handBite.contactDistanceMeters<.05,'the real incisor reaches within5cm of the sampled fused fingertip');assert(receipt.handBite.recoilMeters>.005&&receipt.handBite.recoilMeters<.02);assert(visual.gripGap<1e-10);assert.equal(morph(visual.viewRats)[2],1);assert.notDeepEqual(peak,neutral);
  for(let i=0;i<120;i++){visual.beginFrame();visual.update(run);assert.deepEqual(matrix(visual.viewRats).toArray(),peak);assert(visual.gripGap<1e-10);}
  f.renderer.settings.reducedMotion=true;visual.beginFrame();visual.update(run);const reduced=visual.diagnostics();assert(reduced.handBite.twistRadians<receipt.handBite.twistRadians);assert(reduced.handBite.recoilMeters<receipt.handBite.recoilMeters);assert.equal(run.verminHand.bites,1,'visual pose cannot introduce another damage beat');
  f.renderer.settings.reducedMotion=false;run.verminHand.holdAge=1.6;visual.beginFrame();visual.update(run);assert.deepEqual(matrix(visual.viewRats).toArray(),neutral);assert.deepEqual(visual.armBones.LeftHand.quaternion.toArray(),originalFinger);visual.dispose();
});

test('mouth and abdomen insertion keep the shoulder anchored, bound victim and camera lean, and restore all source transforms each frame',async()=>{
  const f=await fixture(),{visual,renderer,run,camera,scene,groups}=f,rig=new THREE.Group();scene.add(rig);rig.add(camera);renderer.cameraRig=rig;
  const actor=createAfterlifeModel(zombie);actor.position.set(0,0,-1.2);actor.rotation.y=Math.PI;scene.add(actor);renderer._enemyVisuals.set(7,{root:actor});scene.updateMatrixWorld(true);const initial=actor.position.clone(),rigPosition=rig.position.clone(),actorQuaternion=actor.quaternion.clone(),cameraQuaternion=camera.quaternion.clone();
  run.vermin.rats=[{id:10,x:0,y:-.14,z:.3,state:'held',ownerId:'host',age:0}];run.verminHand={phase:'stuff',ratId:10,enemyId:7,elapsed:.30,channel:'mouth',bites:0};
  const ordinary=groups.map(group=>({group,p:group.position.toArray(),q:group.quaternion.toArray(),s:group.scale.toArray(),leftP:group.userData.viewArms.leftArm.position.toArray(),leftQ:group.userData.viewArms.leftArm.quaternion.toArray(),visible:group.userData.viewArms.leftArm.visible}));
  for(const channel of ['mouth','stomach']){
    run.verminHand.channel=channel;visual.beginFrame();visual.update(run);assert(visual.arms.position.length()<=.18001,'source shoulder root follows only a bounded body lean');assert(visual.victimPull<=.35);assert(visual.shoulderLean<=.18);assert(actor.position.distanceTo(initial)<=.35001);assert(rig.position.distanceTo(rigPosition)<=.18001);assert(camera.quaternion.angleTo(cameraQuaternion)<1e-8);
    const positions={arm:visual.arms.position.toArray(),actor:actor.position.toArray(),camera:rig.position.toArray(),rat:matrix(visual.viewRats).toArray()};
    for(let i=0;i<120;i++){visual.beginFrame();visual.update(run);assert.deepEqual(visual.arms.position.toArray(),positions.arm);assert.deepEqual(actor.position.toArray(),positions.actor);assert.deepEqual(rig.position.toArray(),positions.camera);assert.deepEqual(matrix(visual.viewRats).toArray(),positions.rat);}
    visual.beginFrame();assert(actor.position.distanceTo(initial)<1e-8);assert(actor.quaternion.angleTo(actorQuaternion)<1e-8);assert(rig.position.distanceTo(rigPosition)<1e-8);assert.equal(visual.arms.visible,false);
    for(const base of visual.armBase){assert.deepEqual(base.node.position.toArray(),base.p.toArray());assert.deepEqual(base.node.quaternion.toArray(),base.q.toArray());assert.deepEqual(base.node.scale.toArray(),base.s.toArray());}
    for(const saved of ordinary){assert.deepEqual(saved.group.position.toArray(),saved.p);assert.deepEqual(saved.group.quaternion.toArray(),saved.q);assert.deepEqual(saved.group.scale.toArray(),saved.s);assert.deepEqual(saved.group.userData.viewArms.leftArm.position.toArray(),saved.leftP);assert.deepEqual(saved.group.userData.viewArms.leftArm.quaternion.toArray(),saved.leftQ);assert.equal(saved.group.userData.viewArms.leftArm.visible,saved.visible);}
  }
  visual.dispose();actor.traverse(node=>node.skeleton?.dispose());
});

test('crawling follows actual receiver vertices at true roach scale and stays under the attachment cap',async()=>{
  const f=await fixture(),{visual,run,groups}=f,path=sampleVerminSurface(groups[4].userData.model,{excludeArms:true});assert(path);assert.equal(path.path.length,24);assert(path.path.every(sample=>sample.normal.y>.1));
  run.verminCrawl={phase:'active',kind:'roach',count:8,weapon:true,elapsed:1.5,duration:4.2,sequence:8};visual.beginFrame();visual.update(run);assert.equal(visual.viewRoaches.count,3);assert.equal(visual.viewRats.count,0);
  for(let i=0;i<3;i++){const value=matrix(visual.viewRoaches,i),scale=new THREE.Vector3().setFromMatrixScale(value),position=new THREE.Vector3().setFromMatrixPosition(value);assert(Math.abs(scale.x-1)<1e-6&&Math.abs(scale.y-1)<1e-6);assert(position.x>.18&&position.x<.31);assert(position.y>-.24&&position.y<-.20);assert(position.z<-.23&&position.z>-.71);}
  const before=matrix(visual.viewRoaches).toArray();run.verminCrawl.elapsed=2.2;visual.beginFrame();visual.update(run);assert.notDeepEqual(matrix(visual.viewRoaches).toArray(),before);
  f.renderer.settings.reducedMotion=true;visual.beginFrame();visual.update(run);assert.equal(visual.viewRoaches.count,3);run.verminCrawl.phase='idle';visual.beginFrame();visual.update(run);assert.equal(visual.viewRoaches.count,0);visual.dispose();
});

test('rat weapon events sample supported long-gun receivers, with explicit sleeve fallback for shorter tools',async()=>{
  const f=await fixture(),{visual,run,groups}=f;run.verminCrawl={phase:'active',kind:'rat',count:1,weapon:true,elapsed:1.4,duration:4.2,sequence:7};
  for(let weapon=0;weapon<8;weapon++){
    run.weapon=weapon;groups.forEach((group,index)=>group.visible=index===weapon);visual.beginFrame();visual.update(run);const longGun=[1,2,4,5].includes(weapon),receipt=visual.diagnostics();assert.equal(receipt.crawlRoute,longGun?'weapon':'sleeve');assert.equal(receipt.crawlSurface,(longGun?groups[weapon].userData.model:groups[weapon].userData.viewArms.rightArm).name);assert.equal(visual.viewRats.count,1);
    const point=new THREE.Vector3().setFromMatrixPosition(matrix(visual.viewRats));if(longGun){assert(point.z<-.25,'actual receiver vertex route cannot silently use the near-camera sleeve');assert(point.y>-.25);}else{assert(point.z>-.25);assert(point.y<-.30);}assert.equal(visual.viewRoaches.count,0);
  }
  run.verminCrawl.weapon=false;run.weapon=4;groups.forEach((group,index)=>group.visible=index===4);visual.beginFrame();visual.update(run);assert.equal(visual.diagnostics().crawlRoute,'sleeve');visual.dispose();
});

test('crawl routes stop with hidden source arms or ancestors and recover with the source',async()=>{
  const {visual,run,groups,camera}=await fixture(),group=groups[4],arm=group.userData.viewArms.rightArm;
  run.verminCrawl={phase:'active',kind:'rat',count:1,weapon:false,elapsed:1.4,duration:4.2,sequence:7};
  const update=()=>{visual.beginFrame();visual.update(run);};
  update();assert.equal(visual.viewRats.count,1);assert.equal(visual.diagnostics().crawlRoute,'sleeve');
  arm.visible=false;update();assert.equal(visual.viewRats.count,0);assert.equal(visual.diagnostics().crawlRoute,'none');
  run.verminCrawl.kind='roach';update();assert.equal(visual.viewRoaches.count,0);
  run.verminCrawl.weapon=true;update();assert.equal(visual.viewRoaches.count,1);assert.equal(visual.diagnostics().crawlRoute,'weapon');
  run.verminCrawl.kind='rat';update();assert.equal(visual.viewRats.count,1,'a visible receiver remains available with its sleeve absent');
  for(const source of [group.userData.model,group,camera]){source.visible=false;update();assert.equal(visual.viewRats.count,0);assert.equal(visual.diagnostics().crawlRoute,'none');source.visible=true;}
  arm.visible=true;run.verminCrawl.weapon=false;update();assert.equal(visual.viewRats.count,1);assert.equal(visual.diagnostics().crawlRoute,'sleeve');visual.dispose();
});

test('real bat and chainsaw factories expose the same source arms for crawl, injury visibility and support restoration',async()=>{
  const {visual,run,groups,camera}=await fixture(),factory=Object.create(Renderer.prototype);factory.materials={viewSleeve:new THREE.MeshStandardMaterial()};
  for(const [weapon,variant] of [[6,'bat'],[7,'chainsaw']]){
    const source=factory._makeMelee(variant,weapon);camera.remove(groups[weapon]);groups[weapon]=source;camera.add(source);groups.forEach((group,index)=>group.visible=index===weapon);run.weapon=weapon;
    const arms=source.userData.viewArms;assert(arms?.rightArm&&arms.leftArm);assert.equal(arms,source.userData.model.userData.viewArms);assert.equal(arms.rightArm.parent,source);assert.equal(arms.leftArm.parent,source);
    const original=[source,arms.rightArm,arms.leftArm].map(node=>({node,p:node.position.toArray(),q:node.quaternion.toArray(),s:node.scale.toArray(),visible:node.visible}));
    run.verminCrawl={phase:'active',kind:'rat',count:1,weapon:true,elapsed:1.4,duration:4.2,sequence:7};visual.beginFrame();visual.update(run);assert.equal(visual.diagnostics().crawlRoute,'sleeve');assert.equal(visual.diagnostics().crawlSurface,'RightSurvivorArm');assert.equal(visual.viewRats.count,1);
    arms.rightArm.visible=false;visual.beginFrame();visual.update(run);assert.equal(visual.viewRats.count,0,'the injury-visible source arm drives attachments');arms.rightArm.visible=true;
    run.verminCrawl={phase:'idle'};run.vermin.rats=[{id:10,state:'held',ownerId:'host',age:0}];run.verminHand={phase:'held',ratId:10,elapsed:0,holdAge:0,bites:0};visual.beginFrame();visual.update(run);assert.equal(visual.viewRats.count,1);assert.equal(arms.leftArm.visible,false,'the actual melee support arm hides during the source-hand hold');
    visual.beginFrame();run.verminHand={phase:'idle'};visual.update(run);for(const saved of original){assert.deepEqual(saved.node.position.toArray(),saved.p);assert.deepEqual(saved.node.quaternion.toArray(),saved.q);assert.deepEqual(saved.node.scale.toArray(),saved.s);assert.equal(saved.node.visible,saved.visible);}
    run.vermin.rats=[];camera.remove(source);const geometries=new Set(),materials=new Set();source.traverse(node=>{if(node.geometry)geometries.add(node.geometry);for(const m of (Array.isArray(node.material)?node.material:[node.material]))if(m)materials.add(m);});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
  }
  visual.dispose();factory.materials.viewSleeve.dispose();
});

test('canonical infestation resolves current actor IDs, removes held duplicate at contact, and gore toggles only tissue and blood',async()=>{
  const f=await fixture(),{visual,renderer,run,scene}=f,actor=new THREE.Group(),socket=new THREE.Object3D();socket.name='Socket_Mouth';socket.position.set(0,1.6,0);actor.add(socket);scene.add(actor);renderer._enemyVisuals.set(7,{root:actor});
  run.course.enemies=[{id:7,verminInfestation:{channel:'mouth',age:.61,remaining:2.3}}];run.vermin.rats=[{id:10,state:'infesting',ownerId:'host',enemyId:7,age:.61}];run.verminHand={phase:'stuff',elapsed:.34,ratId:10,enemyId:7,channel:'mouth',contactApplied:true,bites:0};
  visual.beginFrame();visual.update(run);assert.equal(visual.viewRats.count,0);assert.equal(visual.tails.count,1);assert.equal(visual.spray.count,3);const before=matrix(visual.tails).toArray();actor.position.x=3;scene.updateMatrixWorld(true);visual.beginFrame();visual.update(run);assert.notDeepEqual(matrix(visual.tails).toArray(),before);
  renderer.settings.gore=false;visual.beginFrame();visual.update(run);assert.equal(visual.tails.count,0);assert.equal(visual.spray.count,0);assert.equal(visual.arms.visible,true,'gore option does not cancel canonical source-arm recovery');visual.dispose();
});

test('stomach tissue uses source anatomy and isolated material hooks, restores ownership without disposing borrowed geometry or maps',()=>{
  const root=cloneSkeleton(survivor),mesh=root.getObjectByName('TLD_Local_Torso_Legs'),source=anatomy.getObjectByName('AbdomenWound'),original=mesh.material,geometry=mesh.geometry,sourceGeometry=source.geometry;
  const oldCompile=original.onBeforeCompile;let inherited=0;original.onBeforeCompile=shader=>{inherited++;shader.fragmentShader+='\n//existing-render-contract';};
  let geometryDisposals=0,textureDisposals=0,materialDisposals=0;sourceGeometry.addEventListener('dispose',()=>geometryDisposals++);original.map?.addEventListener('dispose',()=>textureDisposals++);
  const wound=createVerminStomachWound(root,source);assert(wound);assert.notEqual(mesh.material,original);assert.equal(mesh.geometry,geometry);assert.equal(wound.lip.geometry,sourceGeometry);assert.equal(wound.lip.scale.x,.5);
  mesh.material.addEventListener('dispose',()=>materialDisposals++);const shader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <clipping_planes_fragment>'};mesh.material.onBeforeCompile(shader,{});assert(inherited>0);assert(shader.fragmentShader.includes('//existing-render-contract'));assert(shader.fragmentShader.includes('uVerminWoundEnabled'));assert(shader.vertexShader.includes('vVerminWoundWorld'));assert.equal(shader.uniforms.uVerminWoundCenter,wound.uniforms.uVerminWoundCenter);
  wound.dispose();wound.dispose();assert.equal(mesh.material,original);assert.equal(materialDisposals,1);assert.equal(geometryDisposals,0);assert.equal(textureDisposals,0);original.onBeforeCompile=oldCompile;root.traverse(node=>node.skeleton?.dispose());
});

test('pooled GPU buffers, morph textures and owned source asset are disposed once including an asset completing after shutdown',async()=>{
  const f=await fixture(),{visual}=f;let buffers=0,morphs=0,sourceGeometry=0,maps=0;
  for(const pool of visual.pools){pool.addEventListener('dispose',()=>buffers++);pool.morphTexture?.addEventListener('dispose',()=>morphs++);}
  const geometries=new Set(),textures=new Set();visual.asset.traverse(mesh=>{if(mesh.geometry)geometries.add(mesh.geometry);for(const value of Object.values(mesh.material||{}))if(value?.isTexture)textures.add(value);});for(const g of geometries)g.addEventListener('dispose',()=>sourceGeometry++);for(const texture of textures)texture.addEventListener('dispose',()=>maps++);
  visual.dispose();visual.dispose();assert.equal(buffers,5);assert.equal(morphs,5);assert.equal(sourceGeometry,2);assert.equal(maps,3);assert.equal(visual.root.parent,null);assert.equal(visual.viewRoot.parent,null);
  let resolve;const asset=ownedAsset(),late=new VerminVisuals(f.renderer,{assetPromise:new Promise(r=>resolve=r)});let lateDispose=0;asset.getObjectByName('Rat').geometry.addEventListener('dispose',()=>lateDispose++);late.dispose();resolve(asset);await late.ready;assert.equal(lateDispose,1);assert.equal(late.pools.length,0);
});
