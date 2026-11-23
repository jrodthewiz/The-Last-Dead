import * as T from '../vendor/three.module.js';

// CC0 Poly Haven sets copied from the Opus 5.5 parkour reference. The kit keeps
// its authored vertex palette; these add albedo grain, tangent relief and an
// ARM response instead of replacing the art direction with a photo texture.
const base='assets/pbr/';
const white=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1);white.needsUpdate=true;
const flat=new T.DataTexture(new Uint8Array([128,128,255,255]),1,1);flat.needsUpdate=true;
const armFlat=new T.DataTexture(new Uint8Array([255,210,0,255]),1,1);armFlat.needsUpdate=true;
const loader=new T.TextureLoader();
const load=(file,srgb)=>{
 const t=loader.load(base+file,undefined,undefined,()=>{});
 t.wrapS=t.wrapT=T.RepeatWrapping;
 t.anisotropy=8;
 if(srgb)t.colorSpace=T.SRGBColorSpace;
 return t;
};
const set=(name)=>({diff:{value:load(name+'-diff.jpg',true)},nor:{value:load(name+'-nor.jpg',false)},arm:{value:load(name+'-arm.jpg',false)}});
export const pbrTextures={
 plaster:set('plaster_grey_04'),
 brick:set('red_brick_03'),
 asphalt:set('asphalt_02'),
 concrete:set('concrete_floor_worn_001'),
 fallback:{diff:{value:white},nor:{value:flat},arm:{value:armFlat}},
};
export function attachPbrUniforms(shader){
 shader.uniforms.uPlasterD=pbrTextures.plaster.diff;shader.uniforms.uPlasterN=pbrTextures.plaster.nor;shader.uniforms.uPlasterA=pbrTextures.plaster.arm;
 shader.uniforms.uBrickD=pbrTextures.brick.diff;shader.uniforms.uBrickN=pbrTextures.brick.nor;shader.uniforms.uBrickA=pbrTextures.brick.arm;
 shader.uniforms.uAsphaltD=pbrTextures.asphalt.diff;shader.uniforms.uAsphaltN=pbrTextures.asphalt.nor;shader.uniforms.uAsphaltA=pbrTextures.asphalt.arm;
 shader.uniforms.uConcreteD=pbrTextures.concrete.diff;shader.uniforms.uConcreteN=pbrTextures.concrete.nor;shader.uniforms.uConcreteA=pbrTextures.concrete.arm;
}
