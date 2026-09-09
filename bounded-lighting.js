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
