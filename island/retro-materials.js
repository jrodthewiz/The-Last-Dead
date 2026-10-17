import * as T from '../vendor/three.module.js';

const textures=new WeakMap();
// Keep authored UVs and palettes; use a small mipmapped atlas with the triangular
// three-sample filter used by the console's characteristic texture interpolation.
export function retroTexture(source,size=128){
  if(!source?.image)return source;if(textures.has(source))return textures.get(source);
  const image=source.image,c=document.createElement('canvas'),ratio=Math.min(1,size/Math.max(image.width,image.height));
  c.width=Math.max(1,Math.round(image.width*ratio));c.height=Math.max(1,Math.round(image.height*ratio));const ctx=c.getContext('2d');ctx.drawImage(image,0,0,c.width,c.height);
  const map=source.clone();map.image=c;map.magFilter=T.NearestFilter;map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;map.anisotropy=1;map.needsUpdate=true;textures.set(source,map);return map;
}
export function consoleMaterial(material,{textureSize=128}={}){
  if(material.userData.consoleSurface)return material;material.userData.consoleSurface=true;
  material.flatShading=true;if('roughness'in material)material.roughness=1;if('metalness'in material)material.metalness=0;
  material.normalMap=null;material.roughnessMap=null;material.metalnessMap=null;material.aoMap=null;material.envMap=null;
  if(material.map&&!material.map.image){console.warn('Texture unavailable for '+(material.name||'an imported surface')+'; using its authored base colour.');material.map=null;}
  if(material.map){material.map=retroTexture(material.map,textureSize);const w=material.map.image.width,h=material.map.image.height,previous=material.onBeforeCompile;
    material.onBeforeCompile=function(shader,renderer){previous.call(this,shader,renderer);shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
      vec2 texel=vMapUv*vec2(${w.toFixed(1)},${h.toFixed(1)})-.5;vec2 fraction=fract(texel);vec2 stepUV=vec2(1./${w.toFixed(1)},1./${h.toFixed(1)});vec2 base=(floor(texel)+.5)*stepUV;
      vec4 a,b,c;if(fraction.x+fraction.y<=1.){a=texture2D(map,base);b=texture2D(map,base+vec2(stepUV.x,0.));c=texture2D(map,base+vec2(0.,stepUV.y));}
      else{base+=stepUV;fraction=1.-fraction;a=texture2D(map,base);b=texture2D(map,base-vec2(stepUV.x,0.));c=texture2D(map,base-vec2(0.,stepUV.y));}
      diffuseColor*=a+fraction.x*(b-a)+fraction.y*(c-a);
      #endif`);};material.customProgramCacheKey=()=>`console-surface-${w}-${h}`;
  }material.needsUpdate=true;return material;
}
export function stylizeModel(root,{emissive=false,textureSize=128}={}){const owned=new Map();root.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;const materials=Array.isArray(o.material)?o.material:[o.material];o.material=materials.map(m=>{if(!owned.has(m)){const copy=m.clone();if(!emissive){copy.emissive?.setHex(0);copy.emissiveMap=null;}consoleMaterial(copy,{textureSize});owned.set(m,copy);}return owned.get(m);});if(o.material.length===1)o.material=o.material[0];});return root;}
