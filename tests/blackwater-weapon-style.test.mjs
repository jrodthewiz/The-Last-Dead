import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';
import {Renderer} from '../renderer.js';
import {installForegroundArms,fitForegroundArms} from '../assets/survivor/foreground-arms.js';
import {FIRST_PERSON_HOLD_POSES} from '../assets/survivor/viewmodel-hold-poses.js';
import {applyBlackwaterWeaponStyle} from '../blackwater-weapon-style.js';
import {PlayerInjuryVisuals} from '../player-injury-visuals.js';
import {geometryUv} from '../webgpu-shaders.js';

const hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=a=>Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength);
function fingerprint(g){const h=createHash('sha256');for(const a of Object.values(g.attributes))h.update(bytes(a));if(g.index)h.update(bytes(g.index));return h.digest('hex');}
let asset;
test.before(async()=>{
 const bitmap=globalThis.createImageBitmap,self=globalThis.self;globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
 try{const b=readFileSync(new URL('../assets/survivor/viewmodel-arms-v2.glb',import.meta.url));assert.equal(hash(b),'beba75aa9a173532af038c67c286fde96e1149275e4fe0a496a31cdd86f23fcf');asset=(await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;}
 finally{if(bitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=bitmap;if(self===undefined)delete globalThis.self;else globalThis.self=self;}
});

function realRig(){
 const r=Object.create(Renderer.prototype);r.materials={};r.weaponRig=new T.Group();r.camera=new T.PerspectiveCamera(75,16/10,.025,220);r.camera.add(r.weaponRig);
 r.weaponGroups=[r._makePulseRevolver(),r._makeBreachShotgun(),r._makeArcLance(),r._makeReliquaryAsset(),r._makeRifle('carrion',4),r._makeRifle('mourning',5),r._makeMelee('bat',6),r._makeMelee('chainsaw',7)];
 for(const [i,g]of r.weaponGroups.entries()){const p=FIRST_PERSON_HOLD_POSES[i];g.position.set(...p.position);g.rotation.set(...p.rotation);g.scale.setScalar(p.scale);r.weaponRig.add(g);}installForegroundArms(r,asset);return r;
}
function fixture(){const root=new T.Group(),g=new T.BoxGeometry(.4,.6,.2),m=new T.MeshStandardMaterial({color:'#657383'}),mesh=new T.Mesh(g,m);mesh.name='painted-steel';mesh.renderOrder=1000;root.add(mesh);return{root,mesh,g,m};}
const inkOf=mesh=>mesh.children.find(o=>o.userData.blackwaterWeaponInk);

test('Blender FPS surfaces retain physical shading without an occluding ink shell',()=>{
 const f=fixture();f.mesh.userData.authoredFPSMesh=true;f.m.userData.authoredHeroSurface=true;
 const before=fingerprint(f.g),style=applyBlackwaterWeaponStyle(f.root);
 try{assert.equal(inkOf(f.mesh),undefined);assert.equal(f.mesh.material.type,'MeshStandardNodeMaterial');assert.equal(f.mesh.material.roughness,f.m.roughness);assert(f.mesh.material.depthNode.isNode);assert.equal(fingerprint(f.g),before);style.setEnabled(false);assert.equal(f.mesh.material,f.m);}finally{style.dispose();f.g.dispose();f.m.dispose();}
});

test('all eight real gun and Blender glove assemblies keep exact source buffers, poses, mapped material state and grip contact',()=>{
 const r=realRig(),records=[],sockets=[];r.weaponRig.traverse(mesh=>{if(mesh.isMesh)records.push({mesh,geometry:mesh.geometry,fingerprint:fingerprint(mesh.geometry),material:mesh.material,matrix:mesh.matrix.clone()});});
 for(const group of r.weaponGroups){fitForegroundArms(group);for(const f of group.userData.foregroundArmFits)sockets.push({f,position:f.grip.getWorldPosition(new T.Vector3())});}
 const key=new T.DirectionalLight(),fill=new T.HemisphereLight(),rim=new T.DirectionalLight();key.name='ViewmodelWarmKey';fill.name='ViewmodelFill';rim.name='ViewmodelCoolRim';
 const style=applyBlackwaterWeaponStyle(r.weaponRig,{lightSources:[fill,key,rim]});
 try{
  assert(style.diagnostics.meshes>100);assert(style.diagnostics.inkShells>100);assert.equal(style.diagnostics.generatedTextures,0);assert.equal(style.diagnostics.generatedGeometries,0);
  assert(style.diagnostics.roles.some(r=>r.role==='bone'));assert(style.diagnostics.roles.some(r=>r.role==='brass'));assert(style.diagnostics.roles.some(r=>r.role==='steel'));assert(style.diagnostics.roles.some(r=>r.role==='authored-glove'));
  for(const saved of records){assert.equal(saved.mesh.geometry,saved.geometry);assert.equal(fingerprint(saved.geometry),saved.fingerprint);if(saved.mesh.material!==saved.material){const source=Array.isArray(saved.material)?saved.material[0]:saved.material;const target=Array.isArray(saved.mesh.material)?saved.mesh.material[0]:saved.mesh.material;assert.equal(target.type,source.userData.authoredHeroSurface?'MeshStandardNodeMaterial':'MeshToonNodeMaterial');if(source.userData.authoredHeroSurface){assert.equal(target.roughness,source.roughness);assert.equal(target.metalness,source.metalness);}assert.deepEqual(target.lightsNode.getLights(),[fill,key,rim]);assert(target.depthNode?.isNode);assert.equal(target.map,source.map);assert.equal(target.normalMap,source.normalMap);assert.equal(target.vertexColors,source.vertexColors);}}
  for(const {f,position}of sockets){fitForegroundArms(f.arm.parent);assert(f.arm.userData.gripSocket.getWorldPosition(new T.Vector3()).distanceTo(position)<1e-6);}
  for(const group of r.weaponGroups)assert(group.children.some(o=>{let found=false;o.traverse(m=>{found||=!!m.userData.blackwaterWeaponStyle||!!m.material?.userData.blackwaterWeaponStyle;});return found;}),'each gun has a native painted surface');
  style.setEnabled(false);for(const saved of records)assert.equal(saved.mesh.material,saved.material);
 }finally{style.dispose();}
});

test('identity child ink follows animated nonuniform transforms without baking source geometry',()=>{
 const f=fixture();f.mesh.position.set(.3,-.4,-1);f.mesh.rotation.set(.02,.3,.1);f.mesh.scale.set(.4,.6,.8);const before=fingerprint(f.g),style=applyBlackwaterWeaponStyle(f.root),shell=inkOf(f.mesh);
 try{assert(shell);assert.equal(shell.parent,f.mesh);assert.equal(shell.geometry,f.g);assert.equal(shell.position.length(),0);assert.deepEqual(shell.scale.toArray(),[1,1,1]);assert(shell.material.positionNode.isNode);assert(shell.material.depthNode.isNode);assert.equal(shell.material.side,T.BackSide);assert.equal(shell.material.depthWrite,false);
  for(let i=0;i<15;i++){f.mesh.rotation.y+=.15;f.mesh.position.z-=.01;f.root.updateMatrixWorld(true);assert.deepEqual(shell.matrixWorld.elements,f.mesh.matrixWorld.elements);assert.equal(fingerprint(f.g),before);}
  f.mesh.visible=false;style.syncState();assert.equal(shell.visible,false);f.mesh.visible=true;style.syncState();assert.equal(shell.visible,true);
  f.mesh.layers.set(2);f.mesh.renderOrder=1010;style.syncState();assert.equal(shell.layers.mask,f.mesh.layers.mask);assert.equal(shell.renderOrder,1010);
 }finally{style.dispose();f.g.dispose();f.m.dispose();}
});

test('skinned and morphed ink borrows live skeleton, native bind graph and morph weights',()=>{
 const f=fixture(),bone=new T.Bone();f.root.add(bone);const count=f.g.attributes.position.count,weights=new Float32Array(count*4);for(let i=0;i<count;i++)weights[i*4]=1;
 f.g.setAttribute('skinIndex',new T.Uint16BufferAttribute(new Uint16Array(count*4),4));f.g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
 const morph=f.g.attributes.position.clone();for(let i=0;i<morph.count;i++)morph.setY(i,morph.getY(i)*1.2);f.g.morphAttributes.position=[morph];
 f.mesh.removeFromParent();const mesh=new T.SkinnedMesh(f.g,f.m),skeleton=new T.Skeleton([bone]);f.root.add(mesh);mesh.bind(skeleton);mesh.renderOrder=1010;mesh.morphTargetInfluences[0]=.36;
 const originalBind=mesh.bindMatrix.clone(),style=applyBlackwaterWeaponStyle(f.root),shell=inkOf(mesh);
 try{assert(shell.isSkinnedMesh);assert.equal(shell.skeleton,skeleton);assert.equal(shell.morphTargetInfluences,mesh.morphTargetInfluences);assert.equal(shell.morphTargetDictionary,mesh.morphTargetDictionary);assert.deepEqual(shell.bindMatrix.elements,originalBind.elements);
  for(const angle of [0,.2,-.5,.8]){bone.rotation.z=angle;mesh.morphTargetInfluences[0]=angle*.2+.4;f.root.updateMatrixWorld(true);assert.deepEqual(shell.getVertexPosition(2,new T.Vector3()).toArray(),mesh.getVertexPosition(2,new T.Vector3()).toArray());assert.deepEqual(shell.matrixWorld.elements,mesh.matrixWorld.elements);}
 }finally{style.dispose();skeleton.dispose();f.g.dispose();f.m.dispose();}
});

test('instanced shell borrows current placements and respects live instance counts',()=>{
 const f=fixture();f.mesh.removeFromParent();const mesh=new T.InstancedMesh(f.g,f.m,2);mesh.renderOrder=1000;mesh.setMatrixAt(1,new T.Matrix4().makeTranslation(.4,0,0));f.root.add(mesh);const style=applyBlackwaterWeaponStyle(f.root),shell=inkOf(mesh);
 try{assert(shell.isInstancedMesh);assert.equal(shell.instanceMatrix,mesh.instanceMatrix);assert.equal(shell.count,2);mesh.count=1;style.syncState();assert.equal(shell.count,1);assert.equal(shell.geometry,f.g);}finally{style.dispose();f.g.dispose();f.m.dispose();}
});

test('held depthWrite-false Blender surfaces retain native first-person depth and their far-side depthTest selection',()=>{
 const f=fixture();f.m.depthWrite=false;f.m.depthTest=false;f.m.userData.viewmodelDepth=true;
 const other=f.m.clone();other.depthTest=true;const second=new T.Mesh(f.g,other);second.renderOrder=1010;f.root.add(second);
 const style=applyBlackwaterWeaponStyle(f.root);
 try{const near=inkOf(f.mesh),far=inkOf(second);assert(near&&far);assert.equal(near.material.depthTest,false);assert.equal(far.material.depthTest,true);assert.notEqual(near.material,far.material);assert.equal(near.material.depthWrite,false);assert(near.material.depthNode.isNode);assert.equal(f.mesh.material.depthTest,false);assert.equal(second.material.depthTest,true);assert.equal(style.diagnostics.inkMaterialVariants,2);}
 finally{style.dispose();f.g.dispose();f.m.dispose();other.dispose();}
});

test('mapped alpha, transparent and additive flash/HUD/masked/hidden surfaces do not receive silhouette shells',()=>{
 const f=fixture(),alpha=new T.Texture(),glass=f.m.clone();glass.alphaMap=alpha;glass.alphaTest=.25;const masked=new T.Mesh(f.g,glass);masked.renderOrder=1000;f.root.add(masked);
 const flash=new T.Mesh(f.g,new T.MeshBasicMaterial({transparent:true,blending:T.AdditiveBlending}));flash.name='MuzzlePressureFlare';f.root.add(flash);
 const hidden=new T.Mesh(f.g,f.m);hidden.visible=false;f.root.add(hidden);const mask=new T.Mesh(f.g,f.m);mask.userData.sourceGameMeshMask=true;f.root.add(mask);
 const style=applyBlackwaterWeaponStyle(f.root);
 try{assert.equal(inkOf(masked),undefined);assert.equal(masked.material.alphaMap,alpha);assert.equal(masked.material.alphaTest,.25);assert(masked.material.opacityNode.isNode);assert(masked.material.alphaTestNode.isNode);assert.equal(flash.material.type,'MeshBasicMaterial');assert.equal(inkOf(flash),undefined);assert.equal(hidden.material,f.m);assert.equal(mask.material,f.m);
  const shell=inkOf(f.mesh);f.m.transparent=true;f.m.opacity=.3;style.syncState();assert.equal(shell.visible,false);assert.equal(f.mesh.material.opacity,.3);assert.equal(f.mesh.material.transparent,true);
 }finally{style.dispose();alpha.dispose();glass.dispose();flash.material.dispose();f.g.dispose();f.m.dispose();}
});

test('toggle/reapply/dispose restore exact source material identities and release only owned materials',()=>{
 const f=fixture(),borrowed=new Set([f.g,f.m]),style=applyBlackwaterWeaponStyle(f.root,{enabled:false}),shell=inkOf(f.mesh);let borrowDisposes=0,ownedDisposes=0;for(const r of borrowed)r.addEventListener('dispose',()=>borrowDisposes++);
 assert.equal(applyBlackwaterWeaponStyle(f.root),style);assert.equal(f.mesh.material,f.m);assert.equal(shell.visible,false,'enabled:false leaves no visible ink on original materials');style.setEnabled(true);const painted=f.mesh.material;for(const m of [painted,shell.material])m.addEventListener('dispose',()=>ownedDisposes++);
 const version=painted.version;for(let i=0;i<50;i++){style.setEnabled(false);assert.equal(f.mesh.material,f.m);assert.equal(shell.visible,false);style.setEnabled(true);style.syncState();assert.equal(f.mesh.material,painted);}assert.equal(painted.version,version);
 f.m.color.set('#b12828');f.m.emissive.set('#420808');f.m.emissiveIntensity=.4;style.syncState();assert(painted.colorNode.isNode);assert(painted.emissiveNode.isNode);assert(painted.emissive.equals(f.m.emissive));
 style.dispose();style.dispose();style.setEnabled(true);assert.equal(f.mesh.material,f.m);assert.equal(shell.parent,null);assert.equal(borrowDisposes,0);assert.equal(ownedDisposes,2);assert.equal(f.m.color.getHexString(),'b12828');assert.equal(style.diagnostics.disposed,true);f.g.dispose();f.m.dispose();
});

test('ink settings stay bounded, and an external material replacement is preserved during disposal',()=>{
 const f=fixture(),style=applyBlackwaterWeaponStyle(f.root,{inkPixels:Infinity});assert.equal(style.diagnostics.inkPixels,2.5);style.setInkPixels(-8);assert.equal(style.diagnostics.inkPixels,0);assert.equal(inkOf(f.mesh).visible,false);style.setInkPixels(50);assert.equal(style.diagnostics.inkPixels,4);
 const replacement=new T.MeshStandardMaterial({color:'#cc2222'});f.mesh.material=replacement;style.dispose();assert.equal(f.mesh.material,replacement);replacement.dispose();f.g.dispose();f.m.dispose();
});

test('real injury binding precedes cel adaptation; wound hooks and shared sever masks survive toggles without tinting ink',()=>{
 const r=realRig();r.scene=new T.Scene();r.scene.add(r.weaponRig);r.settings={gore:true,reducedMotion:false};r._survivors={viewSleeves:1};
 const injury=new PlayerInjuryVisuals(r);injury.bind();const records=[];
 r.weaponRig.traverse(mesh=>{if(mesh.isMesh&&mesh.geometry.attributes.playerRegion)records.push({mesh,source:mesh.material,geometry:mesh.geometry,fingerprint:fingerprint(mesh.geometry),region:mesh.geometry.attributes.playerRegion.getX(0)});});
 assert(records.length>100,'actual loaded full glove and sleeve surfaces received the real wound hook');
 const native={migration:{hooks:[]},toneMappingExposure:1},style=applyBlackwaterWeaponStyle(r.weaponRig,{renderer:native});
 try{
  assert.equal(style.diagnostics.woundUniformGroups,1,'all fingers and both arms share the player global wound uniforms');
  assert.equal(style.diagnostics.woundedMaterialHooksPorted,records.length);
  assert.equal(native.migration.hooks.length,records.length,'real GLSL wound surface was ported into the native variants');
  const inks=new Set();
  for(const saved of records){
   const target=saved.mesh.material,shell=inkOf(saved.mesh);assert(target.isNodeMaterial);assert.notEqual(target,saved.source);
   assert(target.colorNode.isNode&&target.positionNode.isNode,'blood/discard and playerRegion varyings were ported');
   assert(target.maskNode.isNode);assert.equal(target.blackwaterWoundMask.a,injury.uniforms.a);assert.equal(target.blackwaterWoundMask.b,injury.uniforms.b);
   assert.equal(saved.mesh.geometry,saved.geometry);assert.equal(fingerprint(saved.geometry),saved.fingerprint);assert(shell);inks.add(shell.material);
   assert.equal(shell.material.maskNode,target.blackwaterWoundMask.mask);assert.equal(shell.material.blackwaterWoundMask,target.blackwaterWoundMask);
   assert.equal(shell.material.color.getHexString(),'111b32');assert.equal(shell.material.colorNode,null,'ink uses only sever discard, not blood mixing');
  }
  assert.equal(inks.size,new Set(records.map(r=>r.source.depthTest!==false)).size,'wounded ink is shared by actual depthTest selection, not multiplied per digit');
  injury.uniforms.a.value.w=1;injury.uniforms.b.value.x=1;
  for(const saved of records){const m=saved.mesh.material.blackwaterWoundMask;assert.equal(m.a.value.w,1);assert.equal(m.b.value.x,1);assert.equal(m.regionAttribute,'playerRegion');}
  const boundOwned=injury.owned.length;injury.bind();assert.equal(injury.owned.length,boundOwned,'stable binding does not traverse or clone later ink children');
  style.setEnabled(false);for(const saved of records)assert.equal(saved.mesh.material,saved.source);
  style.setEnabled(true);style.dispose();for(const saved of records){assert.equal(saved.mesh.material,saved.source);assert(saved.source.customProgramCacheKey().includes('player-organic-wounds'));assert.equal(inkOf(saved.mesh),undefined);}
 }finally{style.dispose();injury.dispose();}
});

test('UV-less textured caps use explicit zero-fallback sampling without adding attributes or losing texture transforms',()=>{
 const f=fixture();f.g.deleteAttribute('uv');const maps=Array.from({length:5},()=>new T.Texture());
 [f.m.map,f.m.alphaMap,f.m.emissiveMap,f.m.aoMap,f.m.normalMap]=maps;f.m.alphaTest=.2;
 maps[0].repeat.set(2,3);maps[0].offset.set(.17,.26);const before=fingerprint(f.g),style=applyBlackwaterWeaponStyle(f.root),material=f.mesh.material;
 try{
  for(const [key,index]of [['albedo',0],['alpha',1],['emissive',2],['ao',3]]){
   const node=material.blackwaterTextureSamples[key];assert.equal(node.value,maps[index]);assert.equal(node.uvNode,geometryUv,'existing geometryUv chooses actual UVs or zero per rendered geometry');assert.equal(node.updateMatrix,true,'explicit fallback retains authored repeat/offset matrices');
  }
  assert(material.normalNode.isNode,'UV-less normal-mapped caps use the undeformed geometry-normal fallback');
  assert.equal(material.normalMap,maps[4]);assert.equal(material.map,maps[0]);assert.equal(f.mesh.geometry,f.g);assert.equal(f.g.attributes.uv,undefined);assert.equal(fingerprint(f.g),before);assert.deepEqual(maps[0].repeat.toArray(),[2,3]);assert.deepEqual(maps[0].offset.toArray(),[.17,.26]);
 }finally{style.dispose();f.g.dispose();f.m.dispose();maps.forEach(m=>m.dispose());}
});
