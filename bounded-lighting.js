import {ShaderChunk} from './vendor/three.module.js';
// Out-of-range lights have exactly zero radiance. Skip their BRDF evaluation,
// retaining every light, material feature and shadow computation that contributes.
const direct='RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
export function installBoundedLightEvaluation(){
 const source=ShaderChunk.lights_fragment_begin;
 if(source.includes('// bounded-direct-light-v1'))return true;
 const split=source.indexOf('#if ( NUM_DIR_LIGHTS');
 if(split<0||!source.slice(0,split).includes(direct))return false;
 ShaderChunk.lights_fragment_begin='// bounded-direct-light-v1\n'+source.slice(0,split).split(direct).join('if ( directLight.visible ) { '+direct+' }')+source.slice(split);
 return true;
}

const viewmodelMaterials=new WeakSet();
// Camera layers select lights for the whole render, not per receiving mesh.
// Keep the body lantern on the dungeon without flooding nearby gun surfaces;
// viewmodels retain their key/rim, reflected light and point-light muzzle flash.
export function isolateViewmodelSpotlights(material){
 if(!material?.isMeshStandardMaterial||viewmodelMaterials.has(material))return;
 viewmodelMaterials.add(material);
 const previousCompile=material.onBeforeCompile;
 const previousKey=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader,renderer){
  previousCompile.call(this,shader,renderer);
  const spot='getSpotLightInfo( spotLight, geometryPosition, directLight );';
  const lights=ShaderChunk.lights_fragment_begin.replace(spot,spot+'\n directLight.color = vec3( 0.0 ); directLight.visible = false;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',lights);
 };
 material.customProgramCacheKey=()=>previousKey+'|viewmodel-spots-v1';
 material.needsUpdate=true;
}
