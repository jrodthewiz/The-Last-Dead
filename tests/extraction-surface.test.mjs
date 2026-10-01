import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';
import {createAfterlifeModel} from '../npc-afterlife-model.js';
import {BrutalCombatVisuals} from '../brutal-combat-visuals.js';
import {HarvestSurface} from '../extraction-surface.js';

test('real imported coat is split, retracts with skinning, and restores original buffers',async()=>{
  const previous={self:globalThis.self,createImageBitmap:globalThis.createImageBitmap,ProgressEvent:globalThis.ProgressEvent};let gltf;
  try{
    globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});globalThis.ProgressEvent=class{constructor(t,p){Object.assign(this,p);}};
    const raw=readFileSync(new URL('../assets/models/afterlife-ash-witness-rig-v05.glb',import.meta.url));gltf=await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
  }finally{for(const [k,v]of Object.entries(previous))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
  const body=createAfterlifeModel({template:gltf.scene,clips:gltf.animations},0,2),combat=Object.create(BrutalCombatVisuals.prototype);Object.assign(combat,{root:new T.Group(),actors:new Map()});
  body.position.set(3,1,2);body.rotation.set(.2,.7,.3);body.updateMatrixWorld(true);
  const chest=body.getObjectByName('Socket_Chest'),abdomen=body.getObjectByName('Socket_Abdomen'),frame=new T.Group();
  function place(){body.updateMatrixWorld(true);frame.position.copy(chest.getWorldPosition(new T.Vector3())).lerp(abdomen.getWorldPosition(new T.Vector3()),.42);const up=chest.getWorldPosition(new T.Vector3()).sub(abdomen.getWorldPosition(new T.Vector3())).normalize(),front=new T.Vector3(0,0,1).applyQuaternion(chest.getWorldQuaternion(new T.Quaternion()));front.addScaledVector(up,-front.dot(up)).normalize();const right=new T.Vector3().crossVectors(up,front).normalize();front.crossVectors(right,up).normalize();frame.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right,up,front));frame.updateMatrixWorld(true);}
  place();const actor=combat.bindActor(body),saved=actor.meshes.map(e=>({entry:e,position:e.geometry.attributes.position,index:e.geometry.index,uv:e.geometry.attributes.uv,skeleton:e.mesh.skeleton,material:e.mesh.material}));
  const surface=new HarvestSurface(actor,frame);surface.update(0);
  const report=surface.diagnostics();assert(report.splitTriangles>report.sourceTriangles);assert(report.seamVertices>50);assert(report.affectedVertices<15000,JSON.stringify(report));
  for(const e of surface.entries){
    assert.equal(e.mesh.skeleton,saved.find(s=>s.entry===e.entry).skeleton);assert.equal(e.mesh.material,saved.find(s=>s.entry===e.entry).material);
    for(let i=0;i<e.geometry.attributes.position.count;i++){const weights=e.geometry.attributes.skinWeight;assert(Math.abs([0,1,2,3].reduce((s,j)=>s+weights.getComponent(i,j),0)-1)<1e-5);}
    for(let i=0;i<e.saved.attributes.uv.count;i++)assert.equal(e.geometry.attributes.uv.getX(i),e.saved.attributes.uv.getX(i));
  }
  surface.update(.4);const partial=surface.diagnostics().maxDisplacement;assert(partial>.01&&partial<.13);
  surface.update(1);assert(surface.diagnostics().maxDisplacement>partial);assert(surface.diagnostics().maxDisplacement<.16);
  for(const e of surface.entries){const affected=new Set(e.affected),p=e.geometry.attributes.position;for(let i=0;i<p.count;i++)if(!affected.has(i))assert.deepEqual([p.getX(i),p.getY(i),p.getZ(i)],Array.from(e.basePositions.slice(i*3,i*3+3)));}
  // A settled cut must retain its GPU buffers and scratch storage without
  // uploading or recalculating the seam again.
  const edgeVersion=surface.edgeGeometry.attributes.position.version;
  const normalVersion=surface.edgeGeometry.attributes.normal.version;
  const posedPoints=surface.entries.map(e=>[...e.posed.values()]);
  const poseBuffers=surface.entries.map(e=>e.lastPose);
  surface.update(1);
  assert.equal(surface.edgeGeometry.attributes.position.version,edgeVersion);
  assert.equal(surface.edgeGeometry.attributes.normal.version,normalVersion);
  surface.entries.forEach((e,i)=>{
    assert.equal(e.lastPose,poseBuffers[i]);
    [...e.posed.values()].forEach((point,j)=>assert.equal(point,posedPoints[i][j]));
  });
  // Individually tiny frame movements must eventually invalidate the cut.
  const beforeTinyMotion=surface.edgeGeometry.attributes.position.version;
  for(let i=0;i<20;i++){frame.position.x+=1e-8;surface.update(1);}
  assert(surface.edgeGeometry.attributes.position.version>beforeTinyMotion);
  place();
  body.position.x+=.2;body.getObjectByName('Spine01').rotateZ(.1);place();surface.update(1);
  for(const e of surface.entries)for(const attr of Object.values(e.geometry.attributes))for(const value of attr.array)assert(Number.isFinite(value));
  surface.update(0);assert.equal(surface.diagnostics().maxDisplacement,0);
  for(const e of surface.entries)for(let i=0;i<e.basePositions.length;i++)assert(Math.abs(e.geometry.attributes.position.array[i]-e.basePositions[i])<1e-4);
  surface.dispose();for(const s of saved){assert.equal(s.entry.geometry.attributes.position,s.position);assert.equal(s.entry.geometry.index,s.index);assert.equal(s.entry.geometry.attributes.uv,s.uv);assert(!s.entry.geometry.attributes.harvestSide);}
  combat.releaseActor(body);
});
