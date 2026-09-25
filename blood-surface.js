import * as THREE from './vendor/three.module.js';

export const BLOOD_ATLAS_URL = './assets/textures/blood-residue-atlas-v2.webp';
let atlas = null;
let ready = Promise.resolve();

function bloodAtlas() {
  if (atlas) return atlas;
  if (typeof document === 'undefined') {
    atlas = new THREE.DataTexture(new Uint8Array([80, 8, 10, 255]), 1, 1);
    atlas.needsUpdate = true;
  } else {
    ready = new Promise(resolve => {
      atlas = new THREE.TextureLoader().load(BLOOD_ATLAS_URL, resolve, undefined, () => resolve(null));
    });
  }
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 4;
  atlas.userData.sharedAsset = true;
  atlas.name = 'BloodResidueAtlasV2';
  return atlas;
}

export function bloodAtlasReady() { bloodAtlas(); return ready; }
export function disposeBloodAtlas() { atlas?.dispose(); atlas = null; ready = Promise.resolve(); }

/** One lit, non-emissive material for four irregular residue silhouettes. */
export function createBloodSurfaceMaterial({instanced = false, variant = 0, dry = 0, opacity = 1, impact = false} = {}) {
  const material = new THREE.MeshPhysicalMaterial({
    name: impact ? 'BloodImpactPBR' : 'BloodResiduePBR', color: impact ? 0xe3c7bd : 0xb4a7a1, map: bloodAtlas(),
    roughness: impact ? .31 : .46, metalness: 0, envMapIntensity: impact ? .2 : .12, specularIntensity: impact ? .27 : .18,
    transparent: true, opacity, alphaTest: .015, depthWrite: false,
    side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  material.userData.bloodSurface = true;
  material.userData.bloodImpact = impact;
  material.onBeforeCompile = shader => {
    shader.vertexShader = (instanced
      ? 'attribute vec2 bloodState; varying vec2 vBloodState;\n'
      : 'varying vec2 vBloodState;\n') + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvBloodState = ' + (instanced ? 'bloodState' : `vec2(${Number(variant).toFixed(1)},${Number(dry).toFixed(3)})`) + ';');
    shader.fragmentShader = 'varying vec2 vBloodState;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        float tile = clamp(floor(vBloodState.x + .5), 0., 3.);
        vec2 tileOffset = vec2(mod(tile, 2.), 1. - floor(tile / 2.)) * .5;
        vec2 bloodUv = tileOffset + clamp(vMapUv, vec2(.006), vec2(.994)) * .5;
        vec4 sampledDiffuseColor = texture2D(map, bloodUv);
        // Compress baked color variation. Illumination and wet sheen belong
        // to scene lights, never a white painted highlight or emissive pass.
        sampledDiffuseColor.rgb = min(sampledDiffuseColor.rgb * ${impact ? '1.28' : '1.04'}, vec3(${impact ? '.46, .14, .105' : '.34, .095, .07'}));
        diffuseColor *= sampledDiffuseColor;
        diffuseColor.rgb *= mix(vec3(1.), vec3(.43, .34, .28), clamp(vBloodState.y, 0., 1.));
      #endif
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      roughnessFactor = mix(.46, .88, clamp(vBloodState.y, 0., 1.));
      #ifdef USE_MAP
        roughnessFactor = min(.95, roughnessFactor + (1. - sampledDiffuseColor.a) * .14);
      #endif
    `);
  };
  material.customProgramCacheKey = () => `blood-residue-v3-${impact ? 'impact' : 'residue'}-${instanced ? 'instances' : `${variant}-${dry}`}`;
  return material;
}

export function createBloodResiduePool(capacity = 128) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.setAttribute('bloodState', new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2).setUsage(THREE.DynamicDrawUsage));
  const mesh = new THREE.InstancedMesh(geometry, createBloodSurfaceMaterial({instanced: true}), capacity);
  mesh.name = 'BloodPools';
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.renderOrder = 2;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return mesh;
}
