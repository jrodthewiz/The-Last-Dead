import * as THREE from './vendor/three.module.js';

/** Ordinary PBR shading with one baked color map. Source surface parameters
 * are constant within each original part and require no extra texture reads. */
export function createProjectionTextureMaterial(map){
  const material=new THREE.MeshStandardMaterial({map,roughness:1,metalness:1});
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 surfaceParams;\nvarying vec2 vSurfaceParams;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSurfaceParams = surfaceParams;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vSurfaceParams;').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor = vSurfaceParams.x;').replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor = vSurfaceParams.y;');
  };
  material.customProgramCacheKey=()=> 'projection-source-surface-v1';
  return material;
}
