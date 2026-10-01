import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';
import {addSoftTissueCompliance} from '../soft-tissue-compliance.js';
import {PlayerInjuryVisuals} from '../player-injury-visuals.js';

let bundle, heart;
const files=['../assets/models/brutal-anatomy-v1.glb','../assets/models/chest-anatomy-v2.glb'];
const raws=files.map(path=>readFileSync(new URL(path,import.meta.url)));
const hash=value=>createHash('sha256').update(value).digest('hex');
const rawHashes=raws.map(hash);
test.before(async()=>{
  const savedBitmap=globalThis.createImageBitmap,savedSelf=globalThis.self;
  globalThis.self=globalThis;
  // Only bitmap decode is stubbed; the shipped GLBs and loader remain actual.
  globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
  try {
    const loader=new GLTFLoader();
    const parsed=[];
    for(const raw of raws)parsed.push(await loader.parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),''));
    bundle=parsed[0].scene.getObjectByName('IntestinalBundle');
    heart=parsed[1].scene.getObjectByName('Heart');
    assert(bundle?.isMesh&&heart?.isMesh);
  }finally{
    if(savedBitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=savedBitmap;
    if(savedSelf===undefined)delete globalThis.self;else globalThis.self=savedSelf;
  }
});

function attributeHashes(geometry){
  const digest=attribute=>hash(Buffer.from(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength));
  return {index:geometry.index?digest(geometry.index):null,
    attributes:Object.fromEntries(Object.entries(geometry.attributes).map(([name,attribute])=>[name,digest(attribute)])),
    morphs:Object.fromEntries(Object.entries(geometry.morphAttributes).map(([name,attributes])=>[name,attributes.map(digest)]))};
}
function positions(mesh){
  const result=[],point=new THREE.Vector3();
  for(let i=0;i<mesh.geometry.attributes.position.count;i++)result.push(mesh.getVertexPosition(i,point).clone());
  return result;
}
function difference(before,after){return before.map((p,i)=>after[i].distanceTo(p));}
function nearPoints(a,b,tolerance=1e-7){
  assert.equal(a.length,b.length);
  for(let i=0;i<a.length;i++)assert(a[i].distanceTo(b[i])<=tolerance,`vertex ${i}: ${a[i].distanceTo(b[i])}`);
}
function tissueStrands(){
  // Exact current PlayerInjuryVisuals path/topology, in its local metre frame.
  const path=Array.from({length:17},(_,i)=>{
    const t=i/16,a=t*Math.PI*4.8,radius=(.10+t*.07)*(1+.15*Math.sin(a*1.3));
    return new THREE.Vector3(Math.sin(a)*radius,Math.sin(a*1.7)*.025,Math.cos(a)*radius+t*.43);
  });
  const geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path),48,.034,7,false);
  const mesh=new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial(),3);
  mesh.name='PlayerIntestinalStrands';mesh.count=0;
  return mesh;
}
function instanceWeights(mesh,index){
  const holder={morphTargetInfluences:new Array(mesh.geometry.morphAttributes.position.length).fill(0)};
  mesh.getMorphAt(index,holder);
  return holder.morphTargetInfluences;
}
function instancePositions(mesh,index){
  const proxy=new THREE.Mesh(mesh.geometry,mesh.material);
  proxy.morphTargetInfluences=instanceWeights(mesh,index);
  return positions(proxy);
}

test('actual IntestinalBundle keeps base topology, maps and attributes while receiving measured local morphs',()=>{
  const mesh=bundle.clone(),source=mesh.geometry,before=attributeHashes(source),material=mesh.material;
  const rig=addSoftTissueCompliance(mesh,{anchorEnd:'max'});
  assert.equal(rig.diagnostics.axis,'y');
  assert(Math.abs(rig.diagnostics.lengthMeters-.38609951734542847)<1e-6);
  assert.notEqual(mesh.geometry,source);
  assert.equal(mesh.material,material);
  assert.deepEqual(attributeHashes(mesh.geometry).attributes,before.attributes);
  assert.equal(attributeHashes(mesh.geometry).index,before.index);
  assert.deepEqual(attributeHashes(source),before);
  assert.deepEqual(mesh.morphTargetDictionary,{TissueSag:0,BendLeft:1,BendRight:2});
  assert.equal(mesh.geometry.morphTargetsRelative,true);
  assert.equal(mesh.geometry.morphAttributes.normal.length,3);
  rig.dispose();
});

test('actual bowel anchor band stays exact, distal bend is visible and combined displacement stays within 25mm',()=>{
  const mesh=bundle.clone(),rig=addSoftTissueCompliance(mesh,{axis:'y',anchorEnd:'max'}),base=positions(mesh);
  rig.set({sag:1,bend:1});
  const moved=positions(mesh),distances=difference(base,moved);
  assert(Math.max(...distances)>.024&&Math.max(...distances)<=.02500001);
  const threshold=rig.diagnostics.baseBounds.max.y-rig.diagnostics.lengthMeters*.12;
  let pinned=0,moving=0;
  for(let i=0;i<base.length;i++){
    if(base[i].y>=threshold){assert.deepEqual(moved[i],base[i]);pinned++;}
    if(distances[i]>.012)moving++;
    assert(rig.ownedGeometry.boundingBox.containsPoint(moved[i]));
  }
  assert(pinned>50&&moving>500);
  rig.set({sag:0,bend:0});
  nearPoints(base,positions(mesh),0);
  rig.dispose();
});

test('sag normals use the field Jacobian and preserve authored normals at the anchor',()=>{
  const mesh=bundle.clone(),rig=addSoftTissueCompliance(mesh,{axis:'y',anchorEnd:'max'});
  const normal=mesh.geometry.attributes.normal,target=mesh.geometry.morphAttributes.normal[0],position=mesh.geometry.attributes.position;
  let changed=0,pinned=0;
  for(let i=0;i<normal.count;i++){
    const base=new THREE.Vector3().fromBufferAttribute(normal,i),delta=new THREE.Vector3().fromBufferAttribute(target,i);
    const result=base.clone().add(delta);
    const t=(rig.diagnostics.baseBounds.max.y-position.getY(i))/rig.diagnostics.lengthMeters;
    assert(Number.isFinite(result.length()));
    if(t<=.12){assert.equal(delta.length(),0);assert.deepEqual(result,base);pinned++;}
    else assert(Math.abs(result.length()-1)<2e-5);
    if(delta.length()>.015)changed++;
  }
  assert(pinned>50&&changed>200);
  rig.dispose();
});

test('local compliance is invariant under imported wrapper scale, yaw and translation',()=>{
  const a=bundle.clone(),b=bundle.clone(),wrapper=new THREE.Group();
  wrapper.scale.setScalar(.01);wrapper.rotation.set(.2,2.15,-.13);wrapper.position.set(23,7,-14);wrapper.add(b);
  wrapper.updateMatrixWorld(true);
  const ra=addSoftTissueCompliance(a,{axis:'y',anchorEnd:'max'}),rb=addSoftTissueCompliance(b,{axis:'y',anchorEnd:'max'});
  ra.set({sag:.7,bend:-.8});rb.set({sag:.7,bend:-.8});
  const inverse=b.matrixWorld.clone().invert();
  nearPoints(positions(a),positions(b).map(p=>p.applyMatrix4(b.matrixWorld).applyMatrix4(inverse)),1e-10);
  assert.equal(ra.diagnostics.lengthMeters,rb.diagnostics.lengthMeters);
  ra.dispose();rb.dispose();
});

test('real native setMorphAt initializes all three hidden pool slots and bends instances independently',()=>{
  const mesh=tissueStrands(),source=mesh.geometry,base=positions(new THREE.Mesh(source,mesh.material));
  assert.equal(typeof mesh.setMorphAt,'function');
  const rig=addSoftTissueCompliance(mesh,{axis:'z',anchorEnd:'min'});
  assert.equal(mesh.count,0);
  assert.equal(mesh.morphTexture.source.data.width,4);
  assert.equal(mesh.morphTexture.source.data.height,3);
  assert.equal(rig.diagnostics.instanceMode,'native-per-instance-morph-texture');
  rig.set({sag:1,bend:1},0);rig.set({sag:.3,bend:-.5},1);
  assert(instanceWeights(mesh,0)[2]>0&&instanceWeights(mesh,0)[1]===0);
  assert(instanceWeights(mesh,1)[1]>0&&instanceWeights(mesh,1)[2]===0);
  assert.deepEqual(instanceWeights(mesh,2),[0,0,0]);
  nearPoints(instancePositions(mesh,2),base,0);
  const zero=instancePositions(mesh,0),one=instancePositions(mesh,1);
  assert(Math.max(...difference(base,zero))<=.02500001);
  assert(Math.max(...difference(zero,one))>.015);
  const threshold=rig.diagnostics.baseBounds.min.z+rig.diagnostics.lengthMeters*.12;
  for(let i=0;i<base.length;i++)if(base[i].z<=threshold)assert.deepEqual(zero[i],base[i]);
  rig.dispose();
});

test('steady instanced updates reuse one geometry, texture, storage and influence holder',()=>{
  const mesh=tissueStrands(),native=mesh.setMorphAt,holders=new Set();
  mesh.setMorphAt=function(index,holder){holders.add(holder);return native.call(this,index,holder);};
  const rig=addSoftTissueCompliance(mesh,{axis:'z',anchorEnd:'min'});
  const geometry=mesh.geometry,texture=mesh.morphTexture,data=texture.source.data.data,version=texture.version;
  const state={sag:0,bend:0};
  for(let i=0;i<600;i++){state.sag=(i%7)/7;state.bend=Math.sin(i);rig.set(state,i%3);}
  assert.equal(holders.size,1);
  assert.equal(mesh.geometry,geometry);assert.equal(mesh.morphTexture,texture);assert.equal(texture.source.data.data,data);
  assert(texture.version>version);
  assert.equal(mesh.count,0);
  rig.dispose();
});

test('existing actual GLB morph names, weights and appearance survive adding and resetting compliance',()=>{
  const mesh=heart.clone(),source=mesh.geometry;
  mesh.morphTargetInfluences[0]=.35;mesh.morphTargetInfluences[1]=.2;
  const originalInfluences=mesh.morphTargetInfluences,originalDictionary=mesh.morphTargetDictionary,before=positions(mesh),hashes=attributeHashes(source);
  const rig=addSoftTissueCompliance(mesh,{axis:'y',anchorEnd:'max'});
  assert.equal(mesh.morphTargetDictionary.GripCompress,0);assert.equal(mesh.morphTargetDictionary.VesselLagLeft,1);
  assert.equal(rig.controls.TissueSag,3);
  nearPoints(before,positions(mesh),0);
  rig.set({sag:1,bend:-1});rig.set({sag:0,bend:0});
  nearPoints(before,positions(mesh),0);
  assert.equal(mesh.morphTargetInfluences[0],.35);assert.equal(mesh.morphTargetInfluences[1],.2);
  assert.deepEqual(attributeHashes(source),hashes);
  rig.dispose();
  assert.equal(mesh.geometry,source);assert.equal(mesh.morphTargetInfluences,originalInfluences);assert.equal(mesh.morphTargetDictionary,originalDictionary);
});

test('absolute existing morphs convert to equivalent relative deltas without changing their source',()=>{
  const mesh=tissueStrands(),geometry=mesh.geometry,target=geometry.attributes.position.clone();
  for(let i=0;i<target.count;i++)target.setX(i,target.getX(i)+.003*(target.getZ(i)+.2));
  target.name='ExistingShape';geometry.morphAttributes.position=[target];geometry.morphTargetsRelative=false;
  mesh.morphTargetInfluences=[.4];mesh.morphTargetDictionary={ExistingShape:0};
  const proxy=new THREE.Mesh(geometry,mesh.material);proxy.morphTargetInfluences=[.4];
  const before=positions(proxy),sourceHash=attributeHashes(geometry);
  const rig=addSoftTissueCompliance(mesh,{axis:'z',anchorEnd:'min'});
  nearPoints(instancePositions(mesh,0),before,2e-8);
  assert.equal(mesh.geometry.morphAttributes.normal.length,4);
  rig.set({sag:.5,bend:.5},0);rig.set({sag:0,bend:0},0);
  nearPoints(instancePositions(mesh,0),before,2e-8);
  assert.deepEqual(attributeHashes(geometry),sourceHash);
  assert.equal(geometry.morphTargetsRelative,false);
  rig.dispose();
});

test('disposal restores original per-instance texture, properties and bounds while disposing only owned resources once',()=>{
  const mesh=tissueStrands(),source=mesh.geometry,target=new THREE.Float32BufferAttribute(new Float32Array(source.attributes.position.count*3),3);
  source.morphAttributes.position=[target];source.morphTargetsRelative=true;
  mesh.count=3;for(let i=0;i<3;i++)mesh.setMorphAt(i,{morphTargetInfluences:[i*.2]});mesh.count=0;
  const sourceTexture=mesh.morphTexture,textureHash=hash(sourceTexture.source.data.data),bbox=new THREE.Box3(),sphere=new THREE.Sphere();
  const originalInfluences={own:Object.hasOwn(mesh,'morphTargetInfluences'),value:mesh.morphTargetInfluences};
  const originalDictionary={own:Object.hasOwn(mesh,'morphTargetDictionary'),value:mesh.morphTargetDictionary};
  mesh.boundingBox=bbox;mesh.boundingSphere=sphere;
  let sourceDisposed=0,materialDisposed=0,sourceTextureDisposed=0,ownedDisposed=0,ownedTextureDisposed=0;
  source.addEventListener('dispose',()=>sourceDisposed++);mesh.material.addEventListener('dispose',()=>materialDisposed++);sourceTexture.addEventListener('dispose',()=>sourceTextureDisposed++);
  const rig=addSoftTissueCompliance(mesh,{axis:'z',anchorEnd:'min'}),ownedTexture=mesh.morphTexture;
  rig.ownedGeometry.addEventListener('dispose',()=>ownedDisposed++);ownedTexture.addEventListener('dispose',()=>ownedTextureDisposed++);
  for(let i=0;i<3;i++)assert(Math.abs(instanceWeights(mesh,i)[0]-i*.2)<1e-7);
  rig.set({sag:1,bend:1});rig.dispose();rig.dispose();rig.set({sag:1,bend:1});
  assert.equal(mesh.geometry,source);assert.equal(mesh.morphTexture,sourceTexture);assert.equal(hash(sourceTexture.source.data.data),textureHash);
  assert.equal(mesh.boundingBox,bbox);assert.equal(mesh.boundingSphere,sphere);assert.equal(mesh.count,0);
  assert.equal(Object.hasOwn(mesh,'morphTargetInfluences'),originalInfluences.own);assert.equal(mesh.morphTargetInfluences,originalInfluences.value);
  assert.equal(Object.hasOwn(mesh,'morphTargetDictionary'),originalDictionary.own);assert.equal(mesh.morphTargetDictionary,originalDictionary.value);
  assert.equal(ownedDisposed,1);assert.equal(ownedTextureDisposed,1);
  assert.equal(sourceDisposed+sourceTextureDisposed+materialDisposed,0);
});

test('unsupported instance API has an explicit shared-weight fallback',()=>{
  const mesh=tissueStrands();mesh.setMorphAt=undefined;mesh.getMorphAt=undefined;
  const originalInfluences={own:Object.hasOwn(mesh,'morphTargetInfluences'),value:mesh.morphTargetInfluences};
  const rig=addSoftTissueCompliance(mesh,{axis:'z',anchorEnd:'min'});
  assert.equal(rig.diagnostics.instanceMode,'shared-pool-weights');assert.equal(mesh.morphTexture,null);
  rig.set({sag:.5,bend:-.25},2);
  assert.deepEqual(mesh.morphTargetInfluences,[.5,.25,0]);
  rig.dispose();assert.equal(Object.hasOwn(mesh,'morphTargetInfluences'),originalInfluences.own);assert.equal(mesh.morphTargetInfluences,originalInfluences.value);
});

test('native setup failure rolls back a partly initialized hidden pool without leaking owned resources',()=>{
  const mesh=tissueStrands(),source=mesh.geometry,native=mesh.setMorphAt;
  const original={texture:mesh.morphTexture,influences:mesh.morphTargetInfluences,dictionary:mesh.morphTargetDictionary,
    influencesOwn:Object.hasOwn(mesh,'morphTargetInfluences'),dictionaryOwn:Object.hasOwn(mesh,'morphTargetDictionary')};
  let ownedTextureDisposed=0,sourceDisposed=0,materialDisposed=0;
  source.addEventListener('dispose',()=>sourceDisposed++);mesh.material.addEventListener('dispose',()=>materialDisposed++);
  mesh.setMorphAt=function(index,holder){
    if(index===1)throw new Error('Intentional native texture setup failure');
    native.call(this,index,holder);this.morphTexture.addEventListener('dispose',()=>ownedTextureDisposed++);
  };
  assert.throws(()=>addSoftTissueCompliance(mesh,{axis:'z',anchorEnd:'min'}),/Intentional native texture setup failure/);
  assert.equal(mesh.count,0);assert.equal(mesh.geometry,source);assert.equal(mesh.morphTexture,original.texture);
  assert.equal(mesh.morphTargetInfluences,original.influences);assert.equal(mesh.morphTargetDictionary,original.dictionary);
  assert.equal(Object.hasOwn(mesh,'morphTargetInfluences'),original.influencesOwn);assert.equal(Object.hasOwn(mesh,'morphTargetDictionary'),original.dictionaryOwn);
  assert.equal(ownedTextureDisposed,1);assert.equal(sourceDisposed+materialDisposed,0);
  mesh.setMorphAt=native;
  addSoftTissueCompliance(mesh,{axis:'z',anchorEnd:'min'}).dispose();
});

test('player strands adopt the already loaded authored surface without disposing its shared maps or geometry',()=>{
  const asset=new THREE.Group();asset.add(bundle.clone());
  const source=asset.getObjectByName('IntestinalBundle'),before=attributeHashes(source.geometry);let sourceDisposed=0;
  source.geometry.addEventListener('dispose',()=>sourceDisposed++);source.material.addEventListener('dispose',()=>sourceDisposed++);
  const fx=new PlayerInjuryVisuals({scene:new THREE.Scene(),brutalCombatVisuals:{asset}});
  const fallback=fx.entrailRig;fx.bindEntrailsAsset();assert.equal(fallback.status,'disposed');assert(fx.importedEntrails);
  assert.notEqual(fx.entrails.geometry,source.geometry);assert.notEqual(fx.entrails.material,source.material);assert.equal(fx.entrails.material.map,source.material.map);
  assert.equal(fx.entrailRig.diagnostics.instanceMode,'native-per-instance-morph-texture');assert.equal(fx.entrails.count,0);
  const geometry=fx.entrails.geometry;fx.bindEntrailsAsset();assert.equal(fx.entrails.geometry,geometry,'ready adoption is performed once');
  fx.dispose();assert.equal(sourceDisposed,0);assert.deepEqual(attributeHashes(source.geometry),before);
});

test('bounds conservatively contain both bend directions and invalid inputs never mutate the source',()=>{
  const mesh=bundle.clone(),original=mesh.geometry;
  assert.throws(()=>addSoftTissueCompliance(mesh,{axis:'x'}),RangeError);assert.equal(mesh.geometry,original);
  const rig=addSoftTissueCompliance(mesh,{axis:'y',anchorEnd:'max'});
  assert.throws(()=>addSoftTissueCompliance(mesh),/already active/);
  for(const bend of [-1,1]){
    rig.set({sag:1,bend});
    for(const p of positions(mesh))assert(rig.ownedGeometry.boundingBox.containsPoint(p));
  }
  assert.throws(()=>rig.set({sag:1,bend:1},3),RangeError);
  rig.set({sag:Infinity,bend:NaN});assert.deepEqual(mesh.morphTargetInfluences,[0,0,0]);
  rig.dispose();assert.equal(mesh.geometry,original);
  assert(raws.every((raw,index)=>hash(raw)===rawHashes[index]));
  for(let i=0;i<files.length;i++)assert.equal(hash(readFileSync(new URL(files[i],import.meta.url))),rawHashes[i]);
});
