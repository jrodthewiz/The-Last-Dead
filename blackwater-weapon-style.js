import * as THREE from './vendor/three.module.js';
import {MeshToonNodeMaterial,MeshStandardNodeMaterial,MeshBasicNodeMaterial,LightingModel} from './vendor/three.webgpu.js';
import {Fn,attribute,cameraNear,cameraFar,cameraProjectionMatrix,diffuseColor,float,lights,materialNormal,mix,modelViewMatrix,normalLocal,normalView,normalViewGeometry,positionLocal,positionView,reference,screenSize,texture,uniform,vec3,vec4,viewZToPerspectiveDepth,color} from './vendor/three.tsl.js';
import {portMaterialHooks} from './webgpu-material-hooks.js';
import {geometryUv} from './webgpu-shaders.js';

const active=new WeakMap();
const MAPS=['map','alphaMap','normalMap','bumpMap','aoMap','lightMap','displacementMap','emissiveMap','roughnessMap','metalnessMap','envMap'];
const FLAGS=['side','shadowSide','transparent','opacity','alphaTest','alphaHash','alphaToCoverage','depthTest','depthWrite','colorWrite','blending','blendSrc','blendDst','blendEquation','blendSrcAlpha','blendDstAlpha','blendEquationAlpha','premultipliedAlpha','dithering','fog','toneMapped','vertexColors','visible','wireframe','polygonOffset','polygonOffsetFactor','polygonOffsetUnits','stencilWrite','stencilWriteMask','stencilFunc','stencilRef','stencilFuncMask','stencilFail','stencilZFail','stencilZPass','clippingPlanes','clipIntersection','clipShadows','flatShading'];
const PALETTE=Object.freeze({steel:'#668b9f',steelEdge:'#b1c6c0',panel:'#527992',black:'#30435e',bone:'#f1d492',boneDark:'#b69b64',brass:'#d5a147',wood:'#985347',leather:'#695751',flesh:'#b95a61',accent:'#9a5357',signal:'#dc9246',other:'#8a9b9c'});
const finite=(v,fallback,min,max)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):fallback;
const materialsOf=m=>Array.isArray(m)?m:[m];
const foregroundDepth=()=>viewZToPerspectiveDepth(positionView.z,cameraNear,cameraFar).mul(reference('renderOrder','float').greaterThanEqual(1000).select(.01,1));
// Explicit UV fallback without changing source buffers. Texture matrices still
// own authored repeats/offsets, which explicit TextureNode UVs otherwise bypass.
const sampleAuthoredMap=map=>texture(map,geometryUv).setUpdateMatrix(true);
const mappedNormalWithUV=Fn(builder=>builder.geometry.hasAttribute('uv')?materialNormal:normalViewGeometry)();

class PaintedWeaponLighting extends LightingModel {
 constructor(authoredArms=false){super();this.authoredArms=authoredArms;}
 direct({lightDirection,lightColor,reflectedLight}){
  const n=normalView.dot(lightDirection).mul(.5).add(.5),aa=n.fwidth().max(.001);
  const middle=n.smoothstep(float(.40).sub(aa),float(.40).add(aa));
  const upper=n.smoothstep(float(.73).sub(aa),float(.73).add(aa));
  // Hue-separated discrete planes, with derivative filtering only at edges.
  const shadow=this.authoredArms?vec3(.30,.36,.44):vec3(.075,.12,.22),mid=vec3(.39,.48,.62),high=vec3(1,.94,.80);
  // Foreground anatomy needs continuous curved light across each finger and
  // wrist. Keep the graphic metal bands on the manufactured weapon surfaces.
  const band=this.authoredArms?mix(shadow,high,n.mul(n)):mix(mix(shadow,mid,middle),high,upper);
  reflectedLight.directDiffuse.addAssign(diffuseColor.rgb.mul(band).mul(lightColor).mul(1/Math.PI));
 }
 indirect(builder){
  const {irradiance,ambientOcclusion,reflectedLight}=builder.context;
  // The small leather/fabric surfaces need diffuse fill to show their folds
  // and fingers in the gun's shadow. Keep the weapon's existing painted bands.
  reflectedLight.indirectDiffuse.addAssign(irradiance.mul(diffuseColor.rgb).mul(this.authoredArms?vec3(.78,.82,.90):vec3(.25,.32,.44)).mul(1/Math.PI));
  reflectedLight.indirectDiffuse.mulAssign(ambientOcclusion);
 }
}
class PaintedWeaponMaterial extends MeshToonNodeMaterial {setupLightingModel(){return new PaintedWeaponLighting(['authored-glove','authored-canvas'].includes(this.userData.weaponStyleRole));}}

function roleOf(source,mesh){
 const explicit=String(source.userData?.weaponSurface?.kind||source.userData?.surfaceRole||source.userData?.lookRole||'');
 if(['authored-glove','authored-canvas'].includes(explicit))return explicit;
 const name=`${explicit} ${source.name||''} ${mesh.name||''}`;
 if(/Full_Worn_Leather_Gloves/i.test(name))return'authored-glove';
 if(/Graphic_Canvas|ViewSleeve|UpperSleeve/i.test(name))return'authored-canvas';
 if(/Original_Meshy_Atlas|Remote_Arms/i.test(name))return'authored-interaction';
 if(/bone.?dark|horn/i.test(name))return'boneDark';
 if(/bone|skull|ivory|teeth/i.test(name))return'bone';
 if(/brass|copper|bronze/i.test(name))return'brass';
 if(/wood|timber|walnut/i.test(name))return'wood';
 if(/leather|rubber|grip.?wrap/i.test(name))return'leather';
 if(/flesh|heart|meat|tissue/i.test(name))return'flesh';
 if(/glow|heat|signal|ember|orange/i.test(name))return'signal';
 if(/black|dark|soot/i.test(name))return'black';
 if(/steel.?edge|iron.?edge|frame.?edge|^edge\b/i.test(name))return'steelEdge';
 if(/panel/i.test(name))return'panel';
 if(/steel|iron|metal|frame/i.test(name)||source.metalness>.4)return'steel';
 if(/accent/i.test(name))return'accent';
 return'other';
}

function excluded(mesh,root){
 if(!mesh.isMesh||!mesh.geometry?.attributes.position||!mesh.material||!mesh.visible)return true;
 for(let node=mesh;node;node=node.parent){
  const d=node.userData||{};
  if(d.blackwaterWeaponInk||d.graphicInk||d.lookOutline||d.viewmodelStyleExclude||d.sourceGameMeshMask||d.isUI||d.pooled)return true;
  if(/MuzzleFlash|MuzzleSmoke|MuzzlePressure|MuzzleGas|heat.?haze|reticle|crosshair|weapon.?fx/i.test(node.name||''))return true;
  if(node===root)break;
 }
 return false;
}
function outlineEligible(mesh,source){
 // Expanded back-face shells can cross a flexing garment and cover its
 // cloth shading. These Blender skins keep their authored silhouette.
 if(mesh.userData.authoredFPSMesh)return false;
 return !mesh.isBatchedMesh && !!mesh.geometry.attributes.normal && source.every(m=>m?.isMeshStandardMaterial&&!m.transparent&&m.opacity>=.999&&!m.alphaMap&&!(m.alphaTest>0)&&!m.alphaHash&&(m.depthWrite!==false||m.userData?.viewmodelDepth)&&m.blending===THREE.NormalBlending&&m.visible!==false&&!m.wireframe&&!m.userData?.sourceGameMeshMask&&m.depthTest===source[0].depthTest);
}

/** Native viewmodel-only cel adaptation. Call after all eight groups, the
 * Blender GLB arms and PlayerInjuryVisuals.bind() are ready. Supply the native
 * renderer to port authored blood hooks; ink uses only their live sever mask.
 * Call syncState() after mechanism/injury state
 * updates; toggle allocation-free for comparisons, dispose before rebuilding.
 * Source meshes, materials, texture objects and skeletons remain owned by game.
 */
export function applyBlackwaterWeaponStyle(weaponRig,{renderer=null,lightSources=null,inkPixels=2.5,enabled=true,filter=null}={}){
 if(!weaponRig?.traverse)throw new TypeError('Weapon style requires a Three.js weapon rig');
 const existing=active.get(weaponRig);if(existing&&!existing.diagnostics.disposed)return existing;
 const width=uniform(finite(inkPixels,2.5,0,4)),lighting=Array.isArray(lightSources)?lights(lightSources.filter(l=>l?.isLight)):null;
 const variants=[],sources=new Map(),entries=[],shells=[],roles=[],borrowedMaps=new Set(),woundGroups=[],woundSources=new WeakMap();
 let skipped=0,triangles=0,skinned=0,morphs=0,woundPorts=0;
 const ink=new MeshBasicNodeMaterial({color:'#111b32',side:THREE.BackSide,depthWrite:false,depthTest:true,fog:false,toneMapped:false});
 ink.name='BlackwaterWeaponSilhouetteInk';ink.userData={blackwaterWeaponInk:true,viewmodelDepth:true,sharedLibrary:true};ink.depthNode=foregroundDepth();
 const inkVariants=new Map([[true,ink]]);
 // Native positionLocal/normalLocal are already morphed and skinned here.
 // Convert camera-pixel thickness to the current mesh's local scale without
 // a static world bake, including transformed or instanced weapon parts.
 const viewPoint=modelViewMatrix.mul(vec4(positionLocal,1)),direction=normalLocal.normalize();
 const scale=modelViewMatrix.mul(vec4(direction,0)).xyz.length().max(.0001);
 const pixel=viewPoint.z.abs().mul(2).div(screenSize.y.max(1)).div(cameraProjectionMatrix.element(1).element(1).abs().max(.0001));
 ink.positionNode=positionLocal.add(direction.mul(width.mul(pixel).div(scale)));
 function woundFor(source){
  if(woundSources.has(source))return woundSources.get(source);
  if(!source.customProgramCacheKey?.().includes('player-organic-wounds')){woundSources.set(source,null);return null;}
  const shader={uniforms:{},vertexShader:'#include <common>\nvoid main(){\n#include <begin_vertex>\n}',fragmentShader:'#include <common>\nvoid main(){\n#include <color_fragment>\n#include <lights_fragment_begin>\n#include <lights_fragment_end>\n}'};
  source.onBeforeCompile.call(source,shader,renderer);
  const a=shader.uniforms.uPlayerWoundA,b=shader.uniforms.uPlayerWoundB;
  if(!a?.value?.isVector4||!b?.value?.isVector2)throw new Error('Player wound hook requires its live vec4/vec2 global uniforms');
  let group=woundGroups.find(g=>g.a===a&&g.b===b);
  if(!group){
   const region=attribute('playerRegion','float').toVarying('vBlackwaterWeaponInkRegion').add(.5).floor();
   const wa=reference('value','vec4',a),wb=reference('value','vec2',b);
   const injury=region.lessThan(.5).select(wa.x,region.lessThan(1.5).select(wa.y,region.lessThan(2.5).select(wa.z,region.lessThan(3.5).select(wa.w,region.lessThan(4.5).select(wb.x,wb.y)))));
   const mask=injury.lessThanEqual(.99).or(region.lessThanEqual(.5)).or(region.greaterThanEqual(4.5));
   group={a,b,regionAttribute:'playerRegion',mask,index:woundGroups.length};woundGroups.push(group);
  }
  woundSources.set(source,group);return group;
 }
 function inkFor(source){
  const flag=source.depthTest!==false,wound=woundFor(source);
  const arm=/Full_Worn_Leather_Gloves|Graphic_Canvas/i.test(source.name||'');
  const key=arm?`arm:${flag}`:wound?`wound:${wound.index}:depth:${flag}`:flag;
  if(!inkVariants.has(key)){
   const material=ink.clone();material.color.copy(ink.color);material.depthTest=flag;material.name+=wound?`:wound${wound.index}:depth${flag}`:':depthTestFalse';
   if(arm){material.name=`BlackwaterArmSilhouetteInk:depth${flag}`;material.positionNode=positionLocal.add(direction.mul(width.mul(.4).mul(pixel).div(scale)));}
   if(wound){material.maskNode=source.maskNode?source.maskNode.and(wound.mask):wound.mask;material.blackwaterWoundMask=wound;}
   inkVariants.set(key,material);
  }
  return inkVariants.get(key);
 }

 function variant(source,mesh){
  if(!source?.isMeshStandardMaterial||source.userData?.blackwaterWeaponStyle||source.userData?.sourceGameMeshMask)return source;
  const role=roleOf(source,mesh);if(!sources.has(source))sources.set(source,new Map());
  const byRole=sources.get(source);if(byRole.has(role))return byRole.get(role);
  const hero=source.userData?.authoredHeroSurface===true;
  const material=hero?new MeshStandardNodeMaterial({roughness:source.roughness,metalness:source.metalness}):new PaintedWeaponMaterial();material.name=`BlackwaterWeapon:${role}:${source.name||'surface'}`;
  for(const key of FLAGS)if(key in source)material[key]=source[key];
  for(const key of MAPS)if(key in source){material[key]=source[key];if(source[key]?.isTexture)borrowedMaps.add(source[key]);}
  for(const key of ['normalScale','emissive'])if(source[key])material[key].copy(source[key]);
  for(const key of ['aoMapIntensity','lightMapIntensity','bumpScale','displacementScale','displacementBias','emissiveIntensity'])if(Number.isFinite(source[key]))material[key]=source[key];
  const authored=role.startsWith('authored-'),initial=source.color?.clone()||new THREE.Color(1,1,1);
  const samples={albedo:source.map?sampleAuthoredMap(source.map):null,alpha:source.alphaMap?sampleAuthoredMap(source.alphaMap):null,emissive:source.emissiveMap?sampleAuthoredMap(source.emissiveMap):null,ao:source.aoMap?sampleAuthoredMap(source.aoMap):null};
  const sample=samples.albedo;
  let albedo;
  if(authored){
   // Native vertexColors multiply this node afterwards: Blender leather wear
   // and canvas/wrist zones survive, rather than multiplying a new dark tint.
   albedo=reference('color','color',source).mul(sample?sample.rgb:1).mul(role==='authored-glove'?vec3(1.8,1.7,1.45):vec3(1.04,1.10,1.20));
   material.color.copy(initial);
  }else{
   const tint=(hero?{wood:'#705342',steel:'#576c76',steelEdge:'#9aadb0',brass:'#b49b69',panel:'#52656e',black:'#293039'}[role]:null)||PALETTE[role]||PALETTE.other;material.color.set(tint);
   const luminance=sample?sample.rgb.dot(vec3(.2126,.7152,.0722)).clamp(0,1):float(1);
   const broad=float(.34).add(luminance.smoothstep(.04,.32).mul(.34)).add(luminance.smoothstep(.32,.78).mul(.32));
   const detail=sample?(hero?mix(vec3(1),sample.rgb.mul(.80).add(.20),.12):mix(vec3(broad),sample.rgb.mul(.80).add(.20),.30)):vec3(1);
   const cue=reference('color','color',source).div(color(initial).max(.0001)).clamp(.25,2.5);
   albedo=color(tint).mul(detail).mul(cue);
  }
  material.colorNode=vec4(albedo,sample?sample.a:float(1));
  material.opacityNode=reference('opacity','float',source).mul(samples.alpha?samples.alpha.g:1);
  material.alphaTestNode=reference('alphaTest','float',source);
  if(source.emissive)material.emissiveNode=reference('emissive','color',source).mul(reference('emissiveIntensity','float',source)).mul(samples.emissive?samples.emissive.rgb:1);
  if(source.normalMap||source.bumpMap)material.normalNode=mappedNormalWithUV;
  if(samples.ao)material.aoNode=samples.ao.r.sub(1).mul(reference('aoMapIntensity','float',source)).add(1);
  material.blackwaterTextureSamples=samples;
  if(source.maskNode)material.maskNode=source.maskNode;
  const wound=woundFor(source);
  if(wound){
   material.maskNode=material.maskNode?material.maskNode.and(wound.mask):wound.mask;
   material.blackwaterWoundMask=wound;
   if(renderer){portMaterialHooks(source,material,renderer,{baseColorNode:material.colorNode});woundPorts++;}
  }
  if(lighting)material.lightsNode=lighting;
  material.depthNode=foregroundDepth();
  material.userData={...source.userData,blackwaterWeaponStyle:true,weaponStyleRole:role,viewmodelDepth:true,borrowedTextures:true,sharedLibrary:true};
  delete material.userData.afterlifeOwned;
  byRole.set(role,material);variants.push({source,material});roles.push({source:source.name||'',role,tint:authored?'Blender authored colors':PALETTE[role]});return material;
 }
 const candidates=[];weaponRig.traverse(mesh=>{if(mesh.isMesh)candidates.push(mesh);});
 for(const mesh of candidates){
  if(excluded(mesh,weaponRig)||(filter&&!filter(mesh))){skipped++;continue;}
  const original=mesh.material,all=materialsOf(original),adapted=Array.isArray(original)?original.map(m=>variant(m,mesh)):variant(original,mesh);
  if(materialsOf(adapted).every((m,i)=>m===all[i])){skipped++;continue;}
  entries.push({mesh,original,adapted});skinned+=!!mesh.isSkinnedMesh;morphs+=!!mesh.morphTargetInfluences?.length;
  triangles+=(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3*(mesh.isInstancedMesh?mesh.count:1);
  if(!outlineEligible(mesh,all))continue;
  let shell;const shellInk=inkFor(all[0]);
  if(mesh.isSkinnedMesh){
   shell=new THREE.SkinnedMesh(mesh.geometry,shellInk);shell.skeleton=mesh.skeleton;shell.bindMode=mesh.bindMode;
   shell.bindMatrix.copy(mesh.bindMatrix);shell.bindMatrixInverse.copy(mesh.bindMatrixInverse);
  }else if(mesh.isInstancedMesh){
   shell=new THREE.InstancedMesh(mesh.geometry,shellInk,0);shell.count=mesh.count;shell.instanceMatrix=mesh.instanceMatrix;shell.instanceColor=null;shell.morphTexture=mesh.morphTexture;
  }else shell=new THREE.Mesh(mesh.geometry,shellInk);
  shell.name=`BlackwaterWeaponInk:${mesh.name}`;shell.userData={blackwaterWeaponInk:true,graphicInk:true,weaponBatchIgnore:true,borrowedGeometry:true,borrowedSkeleton:!!mesh.skeleton};
  shell.position.set(0,0,0);shell.quaternion.identity();shell.scale.setScalar(1);
  shell.morphTargetInfluences=mesh.morphTargetInfluences;shell.morphTargetDictionary=mesh.morphTargetDictionary;
  shell.visible=false;shell.castShadow=false;shell.receiveShadow=false;shell.frustumCulled=false;shell.renderOrder=mesh.renderOrder;shell.layers.mask=mesh.layers.mask;
  mesh.add(shell);shells.push({mesh,shell,original,sources:all});
 }
 let disposed=false,isEnabled=false;
 const addedTriangles=shells.reduce((sum,{mesh})=>sum+(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3*(mesh.isInstancedMesh?mesh.count:1),0);
 const diagnostics={direction:'painted-cel-viewmodels',meshes:entries.length,skinnedMeshes:skinned,morphMeshes:morphs,skippedMeshes:skipped,sourceMaterials:sources.size,materialVariants:variants.length,inkMaterialVariants:inkVariants.size,woundUniformGroups:woundGroups.length,woundedMaterialHooksPorted:woundPorts,inkShells:shells.length,sourceTriangles:triangles,addedTriangles,addedDrawCalls:shells.length,generatedTextures:0,generatedGeometries:0,borrowedTextures:borrowedMaps.size,inkPixels:width.value,palette:{...PALETTE},roles,authoredLights:lighting?.getLights().map(l=>l.name||l.type)||null,ink:'identity child shells; native live skin/morph; pixel width compensated for mesh scale; shared live wound discard without blood tint',enabled:false,disposed:false};
 const api={diagnostics,setEnabled(value){
  if(disposed)return false;const next=!!value;if(next===isEnabled)return next;
  for(const {mesh,original,adapted}of entries){if(next){if(mesh.material===original)mesh.material=adapted;}else if(mesh.material===adapted)mesh.material=original;}
  isEnabled=next;diagnostics.enabled=next;api.syncState();return next;
 },setInkPixels(value){if(disposed)return;diagnostics.inkPixels=width.value=finite(value,2.5,0,4);api.syncState();},syncState(){
  if(disposed)return;
  for(const {source,material}of variants){
   const oldSide=material.side,oldTransparent=material.transparent,oldAlphaHash=material.alphaHash,oldColors=material.vertexColors,oldFlat=material.flatShading;
   for(const key of FLAGS)if(key in source)material[key]=source[key];
   if(source.emissive)material.emissive.copy(source.emissive);material.emissiveIntensity=source.emissiveIntensity;
   if(oldSide!==material.side||oldTransparent!==material.transparent||oldAlphaHash!==material.alphaHash||oldColors!==material.vertexColors||oldFlat!==material.flatShading)material.needsUpdate=true;
  }
  for(const {mesh,shell,sources:all}of shells){
   shell.visible=isEnabled&&width.value>0&&mesh.visible&&outlineEligible(mesh,all);
   shell.material=inkFor(all[0]);diagnostics.inkMaterialVariants=inkVariants.size;
   shell.geometry=mesh.geometry;shell.renderOrder=mesh.renderOrder;shell.layers.mask=mesh.layers.mask;
   shell.morphTargetInfluences=mesh.morphTargetInfluences;shell.morphTargetDictionary=mesh.morphTargetDictionary;
   if(mesh.skeleton){shell.skeleton=mesh.skeleton;shell.bindMode=mesh.bindMode;shell.bindMatrix.copy(mesh.bindMatrix);shell.bindMatrixInverse.copy(mesh.bindMatrixInverse);}
   if(mesh.isInstancedMesh){shell.instanceMatrix=mesh.instanceMatrix;shell.count=mesh.count;shell.morphTexture=mesh.morphTexture;}
  }
 },dispose(){
  if(disposed)return;api.setEnabled(false);disposed=true;diagnostics.disposed=true;
  for(const {shell}of shells)shell.removeFromParent();for(const {material}of variants)material.dispose();for(const material of inkVariants.values())material.dispose();active.delete(weaponRig);
 }};
 active.set(weaponRig,api);api.setEnabled(enabled);return api;
}
