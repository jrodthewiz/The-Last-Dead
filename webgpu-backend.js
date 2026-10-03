import * as GPU from './vendor/three.webgpu.js';
import {portShaderMaterial} from './webgpu-shaders.js';
import {portHarborWater} from './webgpu-water.js';
import {portMaterialHooks} from './webgpu-material-hooks.js';
import {positionWorld,positionView,cameraNear,cameraFar,viewZToPerspectiveDepth,reference,vec2,texture} from './vendor/three.tsl.js';

export async function createWebGPUBackend(canvas) {
  if(!navigator.gpu)throw new Error('This browser does not expose WebGPU. Use a current browser with hardware acceleration enabled.');
  const renderer=new GPU.WebGPURenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  // Explicit failure rather than silently comparing WebGL against itself.
  renderer._getFallback=null;
  await renderer.init();
  if(!renderer.backend.isWebGPUBackend)throw new Error('A native WebGPU adapter could not be initialized.');
  renderer.capabilities={getMaxAnisotropy:()=>16,maxSamples:4};
  renderer.createPMREM=()=>new GPU.PMREMGenerator(renderer);
  renderer.backend.device.addEventListener('uncapturederror',event=>console.error('WebGPU validation:',event.error.message));
  const convert=renderer.library.fromMaterial.bind(renderer.library);
  const cache=new WeakMap();
  const configured=new WeakSet();
  const placeholder=document.createElement('canvas');placeholder.width=placeholder.height=1;
  placeholder.getContext('2d').fillStyle='#fff';placeholder.getContext('2d').fillRect(0,0,1,1);
  const updateTexture=renderer._textures.updateTexture.bind(renderer._textures);
  renderer._textures.updateTexture=(texture,...args)=>{
    if(texture.image===null&&!texture.isRenderTargetTexture){renderer.migration.pendingTextureInitializations++;texture.image=placeholder;}
    return updateTexture(texture,...args);
  };
  renderer.migration={backend:'webgpu',customMaterials:[],hooks:[],pendingTextureInitializations:0};
  renderer.library.fromMaterial=source=>{
    // TextureLoader replaces the shared Source when decoding completes.
    // Cloned room maps may already have a version before that first image.
    for(const value of Object.values(source))if(value?.isTexture&&!value.isRenderTargetTexture&&value.image===null)value.image=placeholder;
    if(source.isShaderMaterial){
      if(cache.get(source)?.version!==source.version){const node=source.uniforms.time&&source.fragmentShader.includes('float crest=')?portHarborWater(source):portShaderMaterial(source,renderer);cache.get(source)?.node.dispose();cache.set(source,{node,version:source.version});renderer.migration.customMaterials.push(source.name||source.uuid);}
      return cache.get(source).node;
    }
    const material=convert(source);
    if(configured.has(material))return material;
    configured.add(material);
    if(!source.userData.harborSurface)portMaterialHooks(source,material,renderer);
    if(source.userData.harborSurface){
      const key=source.customProgramCacheKey();
      const coord=key.includes('metal')?vec2(positionWorld.x.add(positionWorld.z),positionWorld.y):positionWorld.xz;
      material.colorNode=reference('color','color',source).mul(texture(source.map,coord.div(key.includes('asphalt')?3:2)));
    }
    if(source.userData.viewmodelDepth||source.customProgramCacheKey().includes('viewmodel-spots'))material.depthNode=viewZToPerspectiveDepth(positionView.z,cameraNear,cameraFar).mul(reference('renderOrder','float').greaterThanEqual(1000).select(.01,1));
    return material;
  };
  return renderer;
}
