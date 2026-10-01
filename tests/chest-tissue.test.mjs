import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';
import {ChestFinisherVisuals,chestTissueState,combatWorldTime} from '../chest-finisher-visuals.js';
import {enemyFxBegin,enemyFxEnd} from '../enemy-fx.js';
import {cameraRetractionDistance} from '../brutal-combat-visuals.js';

test('tissue yields during the real grasp, settles after release and samples consistently at 30/60/120 Hz',()=>{
  for(const fps of [30,60,120])for(let i=0;i<fps*3;i++){
    const values=chestTissueState(i/fps);
    assert(Object.values(values).every(v=>Number.isFinite(v)&&v>=0&&v<=1));
    assert.equal(values.VesselLagLeft*values.VesselLagRight,0,'opposing vessel shapes cannot cancel one another');
  }
  assert(chestTissueState(.72).GripCompress>.7);
  assert(chestTissueState(.4).TissueTension>.8);
  assert.equal(chestTissueState(1.1).GripCompress,0);
  assert.equal(chestTissueState(1.2).TissueTension,0);
  assert(Math.max(chestTissueState(3).VesselLagLeft,chestTissueState(3).VesselLagRight)<.00001);
  const full=chestTissueState(.72),reduced=chestTissueState(.72,{},true);
  assert.equal(full.GripCompress,reduced.GripCompress);
  assert(Math.max(reduced.VesselLagLeft,reduced.VesselLagRight)<Math.max(full.VesselLagLeft,full.VesselLagRight));
  for(const fps of [30,60,120])assert.deepEqual(chestTissueState(Math.round(.7*fps)/fps),chestTissueState(.7));
});

test('post-release tissue uses the host world clock on an equivalently snapshotted guest',()=>{
  const woundAt=20,host={playerId:'host',time:20.6},guest={playerId:'peer',time:62,peer:{time:20.6}},snapshot={...guest,world:{time:20.6}};
  for(const r of [guest,snapshot])assert.deepEqual(chestTissueState(combatWorldTime(r)-woundAt+.24),chestTissueState(combatWorldTime(host)-woundAt+.24));
  assert.equal(combatWorldTime({time:3}),3);
});

test('actual v2 GLB held tissue deforms locally, resets exactly and leaves the next actor and source unchanged',async()=>{
  const bytes=readFileSync(new URL('../assets/models/chest-anatomy-v2.glb',import.meta.url));
  const previousBitmap=globalThis.createImageBitmap,previousSelf=globalThis.self;
  globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
  let gltf;try{gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}
  finally{if(previousBitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=previousBitmap;if(previousSelf===undefined)delete globalThis.self;else globalThis.self=previousSelf;}
  const visual=Object.create(ChestFinisherVisuals.prototype);visual.asset=gltf.scene;
  const heart=visual.component('Heart'),other=visual.component('Heart'),chestWound=visual.component('ChestWound'),source=gltf.scene.getObjectByName('Heart');
  assert.deepEqual(heart.morphTargetDictionary,{GripCompress:0,VesselLagLeft:1,VesselLagRight:2});
  const root=new THREE.Group(),attachments=new THREE.Group(),hand=new THREE.Bone();root.userData.brutalEnemyId=7;root.userData.afterlife={normalization:1};
  const run={time:2.5,angle:0,brutal:{enemyId:7,kind:'pierce',phase:'extract',elapsed:.72,extractionApplied:true}};
  const state={root,attachments,wound:{at:2,heartRemoved:true},heart,chestWound,heartReleased:false};
  visual.combat={run,armBones:{RightHand:hand}};visual.renderer={settings:{reducedMotion:false}};
  const before=new THREE.Vector3(),after=new THREE.Vector3();let max=0;
  visual.updateWound(state,run,true);
  for(let i=0;i<heart.geometry.attributes.position.count;i++){source.getVertexPosition(i,before);heart.getVertexPosition(i,after);max=Math.max(max,before.distanceTo(after));}
  assert(max>.003&&max<.013,'local compliance stays within the authored millimetre envelope');
  assert.deepEqual(other.morphTargetInfluences,[0,0,0]);assert.deepEqual(source.morphTargetInfluences,[0,0,0]);
  assert.deepEqual(heart.scale.toArray(),[1,1,1],'whole-object scale must not pulse during grasp');
  run.brutal.elapsed=0;visual.updateWound(state,run,false);assert.deepEqual(heart.morphTargetInfluences,[0,0,0]);assert.deepEqual(chestWound.morphTargetInfluences,[0]);
});

test('captured NPC recovery keeps its authored upper-body pose until the action finishes',()=>{
  const root=new THREE.Group();root.userData.afterlife={capturedAttack:true,attackActive:true,attackPhase:'recovery'};
  root.userData.afterlife.attackAction={getEffectiveWeight:()=>root.userData.afterlife.attackActive?1:0};
  const head=new THREE.Bone(),spine=new THREE.Bone(),shoulder=new THREE.Bone();head.name='Head';spine.name='Spine2';shoulder.name='LeftShoulder';root.add(spine);spine.add(head,shoulder);
  const neutral=[head,spine,shoulder].map(b=>b.quaternion.toArray()),enemy={id:3,state:'stalk',look:.7,attacking:false,strike:0};
  enemyFxEnd(root,enemy,{time:1},1000);
  assert.deepEqual([head,spine,shoulder].map(b=>b.quaternion.toArray()),neutral);
  enemyFxBegin(root);root.userData.afterlife.attackActive=false;enemyFxEnd(root,enemy,{time:1.1},1100);
  assert.notDeepEqual([head,spine,shoulder].map(b=>b.quaternion.toArray()),neutral);
  enemyFxBegin(root);[head,spine,shoulder].forEach((b,i)=>assert(b.quaternion.angleTo(new THREE.Quaternion().fromArray(neutral[i]))<1e-7));
});

test('crouched view retreats outside a fitted rotated cloth box with bounded distance and unchanged physical pose',()=>{
  const body={position:new THREE.Vector3(.1,.7,0),quaternion:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.45),shapes:[{halfExtents:new THREE.Vector3(.12,.1,.2)}],shapeOffsets:[new THREE.Vector3(.03,0,0)],shapeOrientations:[new THREE.Quaternion()]};
  const eye=new THREE.Vector3(.12,.72,.11),back=new THREE.Vector3(0,0,1),position=body.position.toArray(),rotation=body.quaternion.toArray(),before=eye.toArray();
  const distance=cameraRetractionDistance(eye,back,[{body}],.12,.42);assert(distance>0&&distance<=.42);
  const moved=eye.clone().addScaledVector(back,distance).sub(body.position).applyQuaternion(body.quaternion.clone().invert()).sub(body.shapeOffsets[0]);
  assert(Math.abs(moved.x)>.24||Math.abs(moved.z)>.32||Math.abs(moved.y)>.22,'camera leaves the inflated fitted box');
  assert.deepEqual(eye.toArray(),before);assert.deepEqual(body.position.toArray(),position);assert.deepEqual(body.quaternion.toArray(),rotation);
  assert.equal(cameraRetractionDistance(new THREE.Vector3(5,2,5),back,[{body}]),0);
  assert.equal(cameraRetractionDistance(eye,back,[{body}],.12,0),0);
});
