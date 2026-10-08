import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js';
import { applyBlackwaterActorStyle } from '../blackwater-actor-style.js';
import { createAfterlifeModel, disposeAfterlifeModel } from '../npc-afterlife-model.js';

async function actualWitness() {
  const texture = new THREE.Texture({ width:512,height:512 });texture.colorSpace=THREE.SRGBColorSpace;
  const loader=new GLTFLoader();
  // Parse the actual GLB rig/buffers/materials/clips in Node. Only bitmap
  // decoding is supplied by a borrowed texture stand-in; native browser QA
  // exercises the original WebP pixels and GPU compiler.
  loader.register(()=>({name:'EXT_texture_webp',loadTexture:()=>Promise.resolve(texture)}));
  const bytes=readFileSync(new URL('../assets/models/afterlife-ash-witness-motion-v06.glb',import.meta.url));
  const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const root=createAfterlifeModel({template:gltf.scene,clips:gltf.animations},0,3);
  return {root,texture,gltf,dispose(){disposeAfterlifeModel(root);const materials=new Set(),geometries=new Set(),skeletons=new Set();for(const r of [root,gltf.scene])r.traverse(o=>{if(!o.isMesh)return;geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o.skeleton)skeletons.add(o.skeleton);});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const s of skeletons)s.dispose();texture.dispose();}};
}

function simpleRig(material,{shared=true,morph=false}={}) {
  const root=new THREE.Group(),bone=new THREE.Bone();bone.name='Head';root.add(bone);
  const geometry=new THREE.BoxGeometry(.45,1.8,.3),count=geometry.attributes.position.count;
  const weights=new Float32Array(count*4);for(let i=0;i<count;i++)weights[i*4]=1;
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(count*4),4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  if(morph){const p=geometry.attributes.position.clone();for(let i=0;i<p.count;i++)p.setX(i,p.getX(i)*.9);geometry.morphAttributes.position=[p];}
  const skeleton=new THREE.Skeleton([bone]);
  const meshes=[new THREE.SkinnedMesh(geometry,material),new THREE.SkinnedMesh(shared?geometry:geometry.clone(),material)];
  for(const mesh of meshes){mesh.name='ImportedBody';root.add(mesh);mesh.bind(skeleton);}
  return {root,meshes,geometry,skeleton,dispose(){for(const g of new Set(meshes.map(m=>m.geometry)))g.dispose();skeleton.dispose();material.dispose();}};
}

function buffers(mesh){
  const hash=createHash('sha256');for(const a of Object.values(mesh.geometry.attributes))hash.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));
  if(mesh.geometry.index)hash.update(Buffer.from(mesh.geometry.index.array.buffer,mesh.geometry.index.array.byteOffset,mesh.geometry.index.array.byteLength));
  return hash.digest('hex');
}

test('owned wound material clones retain the graphic actor lighting parameters',()=>{
 const source=new THREE.MeshStandardMaterial(),f=simpleRig(source),style=applyBlackwaterActorStyle(f.root);
 const material=f.meshes[0].material,clone=material.clone();
 try{assert.equal(clone.actorParameters,material.actorParameters);assert.equal(clone.setupLightingModel().parameters,material.setupLightingModel().parameters);assert.ok(clone.actorParameters.thresholds.length===2);}
 finally{clone.dispose();style.dispose();f.dispose();}
});

test('real v06 actor retains its exact GLB buffers, skeletons and borrowed atlas, with deliberate oral/cloth semantics',async()=>{
  const f=await actualWitness(),snapshots=[];
  f.root.traverse(mesh=>{if(mesh.isSkinnedMesh)snapshots.push({mesh,geometry:mesh.geometry,skeleton:mesh.skeleton,bind:mesh.bindMatrix.clone(),material:mesh.material,color:mesh.material.color.clone(),fingerprint:buffers(mesh),bones:[...mesh.skeleton.bones]});});
  assert.equal(snapshots.length,3);assert.equal(snapshots[0].material.color.r,.55,'actual runtime source is darkened before adaptation');
  const sun=new THREE.DirectionalLight(),fill=new THREE.HemisphereLight();sun.name='BlackwaterSun';fill.name='HarborSkyFill';
  const style=applyBlackwaterActorStyle(f.root,{kind:0,lightSources:[sun,fill]});
  try {
    assert.equal(style.diagnostics.materialVariants,3);assert.equal(style.diagnostics.meshes,3);assert.equal(style.diagnostics.skinnedMeshes,3);
    assert.equal(style.diagnostics.sourceTriangles,31905);assert.equal(style.diagnostics.addedDrawCalls,0);assert.equal(style.diagnostics.addedTriangles,0);
    assert.equal(style.diagnostics.generatedTextures,0);assert.equal(style.diagnostics.generatedGeometries,0);assert.equal(style.diagnostics.ink,'none');
    assert.deepEqual(style.diagnostics.semantics.map(s=>s.role),['exterior','oral','teeth']);
    assert.deepEqual(style.diagnostics.semantics[0].runs,[[15,15],[19,27]],'real rig supplies a compact skin-weight mask');
    assert.equal(style.diagnostics.semantics[0].ash,true);
    for(const saved of snapshots) {
      const m=saved.mesh;
      assert.equal(m.geometry,saved.geometry);assert.equal(m.skeleton,saved.skeleton);assert.deepEqual(m.skeleton.bones,saved.bones);
      assert.deepEqual(m.bindMatrix.elements,saved.bind.elements);assert.equal(buffers(m),saved.fingerprint);
      assert.equal(m.material.type,'MeshToonNodeMaterial');assert.equal(m.material.map,saved.material.map);
      assert.equal(m.material.side,saved.material.side);assert.equal(m.material.vertexColors,saved.material.vertexColors);
      assert.deepEqual(m.material.lightsNode.getLights(),[sun,fill]);
      assert.ok(saved.material.color.equals(saved.color),'borrowed color stays unchanged');
    }
    const warning=f.root.userData.afterlife.warningRing;
    assert.equal(warning.material.type,'MeshBasicMaterial','existing gameplay warning material is excluded');
    style.setEnabled(false);for(const saved of snapshots)assert.equal(saved.mesh.material,saved.material);
    style.setEnabled(true);assert.equal(style.diagnostics.materialVariants,3);
  }finally{style.dispose();f.dispose();}
});

test('repeated source materials reuse one owned variant and toggles allocate no material arrays or resources',()=>{
  const source=new THREE.MeshStandardMaterial({color:'#89938d'}),f=simpleRig(source),style=applyBlackwaterActorStyle(f.root,{enabled:false});
  const adapted=[];
  try {
    assert.equal(style.diagnostics.sourceMaterials,1);assert.equal(style.diagnostics.materialVariants,1);
    assert.equal(f.meshes[0].material,source);assert.equal(f.meshes[1].material,source);
    style.setEnabled(true);adapted.push(...f.meshes.map(m=>m.material));assert.equal(adapted[0],adapted[1]);
    const version=adapted[0].version;
    for(let i=0;i<100;i++){style.syncState();style.setEnabled(false);for(const mesh of f.meshes)assert.equal(mesh.material,source);style.setEnabled(true);for(const mesh of f.meshes)assert.equal(mesh.material,adapted[0]);}
    assert.equal(adapted[0].version,version,'stable flags do not trigger repeated shader rebuilds');
    assert.equal(style.diagnostics.materialVariants,1);assert.equal(f.root.children.length,3,'no static outline or replacement rig was added');
  }finally{style.dispose();f.dispose();}
});

test('native morph and multi-material state survives reversible adaptation',()=>{
  const source=new THREE.MeshStandardMaterial({color:'#a0a0a0'}),f=simpleRig(source,{morph:true});
  const other=new THREE.MeshStandardMaterial({color:'#663b37'});other.userData.surfaceRole='oral-tissue';
  const original=[source,other];f.meshes[0].material=original;f.meshes[0].geometry.clearGroups();f.meshes[0].geometry.addGroup(0,18,0);f.meshes[0].geometry.addGroup(18,18,1);
  f.meshes[0].morphTargetInfluences[0]=.36;
  const influences=f.meshes[0].morphTargetInfluences,attributes=f.geometry.morphAttributes,skeleton=f.skeleton;
  const style=applyBlackwaterActorStyle(f.root);
  try {
    const adapted=f.meshes[0].material;assert.notEqual(adapted,original);assert.equal(style.diagnostics.morphMeshes,2);
    assert.equal(f.meshes[0].morphTargetInfluences,influences);assert.equal(influences[0],.36);assert.equal(f.geometry.morphAttributes,attributes);assert.equal(f.meshes[0].skeleton,skeleton);
    for(let i=0;i<3;i++){style.setEnabled(false);assert.equal(f.meshes[0].material,original);style.setEnabled(true);assert.equal(f.meshes[0].material,adapted);}
  }finally{style.dispose();other.dispose();f.dispose();}
});

test('source alpha, side, maps and gameplay state updates remain connected without changing the source owner',()=>{
  const maps=Array.from({length:5},()=>new THREE.Texture());
  const source=new THREE.MeshStandardMaterial({map:maps[0],alphaMap:maps[1],normalMap:maps[2],roughnessMap:maps[3],emissiveMap:maps[4],color:'#656c6c',opacity:.63,transparent:true,alphaTest:.22,side:THREE.DoubleSide,emissive:'#220000',emissiveIntensity:.1});
  const f=simpleRig(source),style=applyBlackwaterActorStyle(f.root),material=f.meshes[0].material;
  try {
    for(const key of ['map','alphaMap','normalMap','roughnessMap','emissiveMap'])assert.equal(material[key],source[key]);
    assert.equal(material.opacity,.63);assert.equal(material.alphaTest,.22);assert.equal(material.side,THREE.DoubleSide);
    assert.ok(material.colorNode?.isNode && material.opacityNode?.isNode && material.alphaTestNode?.isNode && material.emissiveNode?.isNode,'TSL source references preserve live color/emissive/alpha cues');
    source.opacity=.35;source.alphaTest=.31;source.side=THREE.FrontSide;source.emissive.set('#7d302a');source.emissiveIntensity=.42;const before=material.version;
    style.syncState();assert.equal(material.opacity,.35);assert.equal(material.alphaTest,.31);assert.equal(material.side,THREE.FrontSide);
    assert.equal(material.emissiveIntensity,.42);assert.ok(material.emissive.equals(source.emissive));assert.equal(material.version,before+1);
    style.dispose();assert.equal(f.meshes[0].material,source);assert.equal(source.opacity,.35);assert.equal(source.emissiveIntensity,.42);
  }finally{style.dispose();f.dispose();maps.forEach(m=>m.dispose());}
});

test('idempotent disposal releases only owned native materials, restoring all borrowed actor resources',async()=>{
  const f=await actualWitness(),originals=new Map(),resources=new Set([f.texture]);
  f.root.traverse(o=>{if(!o.isMesh)return;originals.set(o,o.material);resources.add(o.geometry);if(o.skeleton)resources.add(o.skeleton);for(const m of Array.isArray(o.material)?o.material:[o.material])resources.add(m);});
  let borrowed=0,owned=0;for(const resource of resources) {
    if(resource.addEventListener)resource.addEventListener('dispose',()=>borrowed++);
    else {const dispose=resource.dispose;resource.dispose=function(){borrowed++;return dispose.call(this);};}
  }
  const style=applyBlackwaterActorStyle(f.root),ownedMaterials=new Set();f.root.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.userData.blackwaterActorStyle)ownedMaterials.add(m);});
  for(const m of ownedMaterials)m.addEventListener('dispose',()=>owned++);
  style.dispose();style.dispose();style.syncState();style.setEnabled(true);
  assert.equal(owned,style.diagnostics.materialVariants);assert.equal(borrowed,0);assert.equal(style.diagnostics.disposed,true);assert.equal(style.diagnostics.enabled,false);
  for(const [mesh,material]of originals)assert.equal(mesh.material,material);
  f.dispose();assert.ok(borrowed>0,'the original owner can subsequently release its resources');
});

test('actor parameters remain finite and bounded when integration supplies invalid tuning values',()=>{
  const source=new THREE.MeshStandardMaterial(),f=simpleRig(source),style=applyBlackwaterActorStyle(f.root,{kind:NaN,textureDetail:Infinity,bands:[NaN,-4,Infinity],thresholds:[NaN,2],palette:{skin:'invalid',jacket:'#566666'}});
  try {
    const d=style.diagnostics;assert.ok(Number.isFinite(d.kind));assert.ok(Number.isFinite(d.sourceTriangles));
    assert.ok(Number.isFinite(d.parameters.textureDetail));assert.ok(d.parameters.bands.every(Number.isFinite));assert.ok(d.parameters.thresholds.every(Number.isFinite));
    assert.ok(d.parameters.thresholds[0]<d.parameters.thresholds[1]);assert.ok(d.parameters.bands[0]<d.parameters.bands[1]&&d.parameters.bands[1]<d.parameters.bands[2]);
    assert.equal(d.palette.skin,'#c3c5aa');assert.equal(d.palette.jacket,'#566666');
  }finally{style.dispose();f.dispose();}
});

test('colored generated atlases retain RGB garment and skin detail instead of the Ash luminance remap',()=>{
  const atlas=new THREE.DataTexture(new Uint8Array([190,30,35,255,225,228,217,255,35,48,59,255]),3,1);atlas.colorSpace=THREE.SRGBColorSpace;
  const source=new THREE.MeshStandardMaterial({map:atlas,color:'#8c8c8c'}),f=simpleRig(source),before=buffers(f.meshes[0]),pixels=atlas.image.data.slice();
  const graphMethods=node=>{const seen=new WeakSet(),methods=new Set();function visit(value){if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);if(value.isNode){if(value.method)methods.add(value.method);for(const [key,child]of Object.entries(value))if(key!=='nodeMaterial'&&key!=='reference')visit(child);}else if(Array.isArray(value))value.forEach(visit);}visit(node);return methods;};
  const ashStyle=applyBlackwaterActorStyle(f.root);
  assert(graphMethods(f.meshes[0].material.colorNode).has('dot'),'legacy palette intentionally extracts atlas luminance');ashStyle.dispose();
  const style=applyBlackwaterActorStyle(f.root,{preserveAtlasColors:true,palette:{jacket:'#596653'}}),material=f.meshes[0].material;
  try {
    assert.equal(style.diagnostics.parameters.preserveAtlasColors,true);assert.equal(style.diagnostics.semantics[0].albedoSource,'authored-color-atlas');
    assert(!graphMethods(material.colorNode).has('dot'),'the compiled RGB color graph contains no luminance extraction that could erase authored red/white/dark garment separation');
    assert.equal(material.map,atlas);assert.deepEqual(atlas.image.data,pixels);assert.equal(buffers(f.meshes[0]),before);assert.equal(style.diagnostics.generatedTextures,0);assert.equal(style.diagnostics.addedDrawCalls,0);
    source.color.set('#ad3030');source.emissive.set('#640000');style.syncState();assert(material.emissive.equals(source.emissive));assert(material.colorNode.isNode);style.setEnabled(false);assert.equal(f.meshes[0].material,source);style.setEnabled(true);assert.equal(f.meshes[0].material,material);
  }finally{style.dispose();f.dispose();atlas.dispose();}
});
