import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';
import {createAfterlifeModel,animateAfterlifeModel} from '../npc-afterlife-model.js';
import {cutSkinnedMesh,anatomyCutFrame,anatomyRegion} from '../enemy-cut-geometry.js';
import {applyAnatomyDamage,traceEnemyBody,beginReanimation,advanceReanimation,isThreat,ANATOMY_LIMITS} from '../enemy-anatomy.js';
import {newRun,makeCourse,shoot,switchWeapon,tick,parry} from '../engine.js';
let asset;
test.before(async()=>{
 const bitmap=globalThis.createImageBitmap,self=globalThis.self;globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
 const b=readFileSync(new URL('../assets/models/afterlife-ash-witness-rig-v05.glb',import.meta.url));
 try{const g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');asset={template:g.scene,clips:g.animations};}
 finally{if(bitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=bitmap;if(self===undefined)delete globalThis.self;else globalThis.self=self;}
});
const enemy=extra=>({id:42,kind:0,variant:'stalker',x:6,y:6,hp:100,maxHp:100,dead:false,phase:0,moveSpeed:.6,baseMoveSpeed:.6,facing:Math.PI/2,attack:99,flash:0,hits:0,wounds:{arm:false,leg:false},...extra});
const hit=(part,z,extra={})=>({x:6,y:6,z,part,angle:-Math.PI/2,pitch:-.4,...extra});
function fresh(){const r=newRun(makeCourse());Object.assign(r,{mode:'play',x:6,y:7,angle:-Math.PI/2,pitch:0,waveDelay:999});return r;}
test('targeted shots sever the aimed leg with repeatable authority and stop hitting its missing end',()=>{
 const e=enemy();const cut=applyAnatomyDamage(e,6.5,hit('leftLeg',.12),0);assert.equal(cut.part,'leftLeg');assert.equal(e.wounds.rightLeg,undefined);assert.equal(e.locomotion,'crawl');assert.equal(e.moveSpeed,.6*.32);assert(e.hp>0);assert.equal(e.attacking,false);
 const left=traceEnemyBody(enemy(),{x:5.965,y:7,z:.10},{x:0,y:-1,z:0},2);assert.equal(left?.part,'leftLeg');
 const gap=traceEnemyBody(enemy(),{x:6,y:7,z:.10},{x:0,y:-1,z:0},2);assert.equal(gap,null,'the space between legs is not a solid cylinder');
});
test('head chunks can leave brain alive; lower cuts or central repeated head shots permanently destroy it',()=>{
 const e=enemy({reanimates:true});const crown=applyAnatomyDamage(e,9,hit('head',.435),0,'slice');assert(crown.fraction>.6);assert(e.brainIntegrity>0);assert(e.hp>0);
 const lower=applyAnatomyDamage(e,9,hit('head',.405),1,'slice');assert(lower.fraction<crown.fraction);assert.equal(e.brainIntegrity,0);assert.equal(e.hp,0);assert.equal(beginReanimation(e,1),false);
 const body=enemy({reanimates:true,hp:0});assert(beginReanimation(body,0));assert(isThreat(body));applyAnatomyDamage(body,11,hit('head',.40),.1);assert.equal(body.brainIntegrity,0);assert.equal(advanceReanimation(body,10),false);assert.equal(isThreat(body),false);
});
test('angled repeat cuts cannot regrow a limb and a partial head remains targetable without render pose data',()=>{
 const e=enemy();const first=applyAnatomyDamage(e,9,hit('leftLeg',.15,{fraction:.4,pitch:0}),0,'slice');
 const angled=applyAnatomyDamage(e,9,hit('leftLeg',.15,{fraction:.75,pitch:1.2}),1,'slice');assert(angled);assert.equal(angled.fraction,first.fraction);
 const head=enemy();applyAnatomyDamage(head,9,hit('head',.435,{fraction:.72}),0,'slice');
 const trace=traceEnemyBody(head,{x:6,y:7,z:.408},{x:0,y:-1,z:0},2);assert.equal(trace?.part,'head');assert(trace.fraction>=0&&trace.fraction<=.72);assert.equal(trace.hit.fraction,trace.fraction);
});
test('the bounded cut budget reserves a final visible brain destruction and cannot grow indefinitely',()=>{
 const e=enemy({reanimates:true});for(let i=0;i<8;i++)assert(applyAnatomyDamage(e,9,hit('leftLeg',.15,{fraction:.86-i*.11}),i,'slice'));
 const finish=applyAnatomyDamage(e,11,hit('head',.40,{fraction:.25}),9);assert.equal(finish.part,'head');assert.equal(finish.fraction,.05);assert.equal(e.brainIntegrity,0);assert.equal(beginReanimation(e,10),false);assert.equal(e.anatomy.cuts.length,9);
 for(let i=0;i<10;i++)applyAnatomyDamage(e,11,hit('head',.4,{pitch:i}),10+i);assert.equal(e.anatomy.cuts.length,9);
});
test('a collapsed hunter rises once, hunts faster, retains missing parts and cannot clear progression while down',()=>{
 const e=enemy({reanimates:true});applyAnatomyDamage(e,6,hit('rightArm',.27),0);e.hp=0;const speed=e.moveSpeed;assert(beginReanimation(e,0));assert.equal(advanceReanimation(e,1),false);assert.equal(advanceReanimation(e,8),true);assert(e.hp>0);assert.equal(e.dead,false);assert(e.moveSpeed>speed);assert(e.enraged);assert(e.wounds.rightArm);assert.equal(beginReanimation(e,9),false);
 const r=fresh();const down=enemy({hp:1,reanimates:true,facing:Math.PI/2});r.course.enemies=[down];r.pitch=Math.atan2(.31-.4,1);shoot(r);assert.equal(down.reanimate.phase,'down');assert.equal(r.kills,0);
 r.waveCount=r.wave;for(let i=0;i<500;i++)tick(r,1/120);assert.equal(down.dead,false);assert.equal(down.reanimations,1);assert.equal(r.mode,'play');
});
test('aiming low with the real marksman rifle and hand slice removes a specific leg',()=>{
 for(const weapon of [5,'slice']){
  const r=fresh(),e=enemy();e.y=6.5;r.course.enemies=[e];r.x=5.965;r.pitch=Math.atan2(.12-.4,.5);
  if(weapon==='slice')parry(r);else{switchWeapon(r,weapon);shoot(r);}
  assert.equal(e.anatomy?.cuts[0]?.part,'leftLeg',String(weapon));assert.equal(e.wounds.arm,false);assert.equal(r.limbs.length,0);assert.equal(e.dead,false);
 }
});
test('a hand slice beyond grab range cuts the aimed arm without committing a counter',()=>{
 const r=fresh(),e=enemy();e.y=6.5;r.course.enemies=[e];r.x=6.073;r.pitch=Math.atan2(.29-.4,.5);parry(r);assert.equal(e.anatomy?.cuts[0]?.part,'rightArm');assert.equal(e.wounds.leftArm,undefined);assert.equal(r.brutal.phase,'idle');
});
test('region semantics preserve shoulders and distinguish feet and legs',()=>{assert.equal(anatomyRegion('LeftUpLeg'),1);assert.equal(anatomyRegion('RightToeBase'),2);assert.equal(anatomyRegion('LeftShoulder'),0);assert.equal(ANATOMY_LIMITS.cutsPerEnemy,8);});
test('actual skinned body supports cuts at different angles, closed caps, UVs and normalized skin weights without mutating the source',()=>{
 const root=createAfterlifeModel(asset,0,3);animateAfterlifeModel(root,enemy(),0,3);root.updateMatrixWorld(true);
 const meshes=[];root.traverse(m=>{if(m.isSkinnedMesh)meshes.push(m);});const mesh=meshes[0],source=mesh.geometry,originalIndex=source.index.array.slice();
 const records=[];
 for(const [part,fraction,tilt]of [['leftLeg',.42,[0,1,0]],['leftLeg',.68,[.35,1,.5]],['rightArm',.58,[.5,1,-.2]],['head',.68,[.2,1,.25]],['torso',.15,[.2,1,.35]]]){
  const region={leftLeg:1,rightArm:4,head:5,torso:0}[part],frame=anatomyCutFrame(root,{part,fraction,region,tilt});
  const t=performance.now(),cut=cutSkinnedMesh(mesh,{...frame,capMaterialIndex:1});records.push({part,fraction,loops:cut.loops,removed:cut.removedTriangles,ms:performance.now()-t});
  assert(cut.detached,part);assert(cut.loops>0,part+' has a closed cross-section');assert(cut.retained.userData.anatomyCut.capTriangles>0);
  for(const g of [cut.retained,cut.detached]){for(const [name,a]of Object.entries(g.attributes))assert.equal(a.count,g.attributes.position.count,name+' covers every indexed vertex');assert([...g.attributes.position.array].every(Number.isFinite));}
  const weights=cut.retained.attributes.skinWeight;for(let i=0;i<weights.count;i++)assert(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-5);
  assert(cut.retained.index.count<source.index.count+2000,'cuts do not explode triangle count');cut.retained.dispose();cut.detached.dispose();
 }
 assert.notEqual(records[0].removed,records[1].removed);assert.deepEqual(source.index.array,originalIndex);console.log('cut compile measurements',JSON.stringify(records));
});
