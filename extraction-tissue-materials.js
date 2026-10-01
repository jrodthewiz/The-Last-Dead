import * as THREE from './vendor/three.module.js';

export const HARVEST_TISSUE_ALBEDO_URL = './assets/textures/harvest-tissue-atlas-v1.webp';
export const HARVEST_TISSUE_HEIGHT_URL = './assets/textures/harvest-tissue-height-v1.webp';
export const HARVEST_TISSUE_SHADER = Object.freeze({ steps: 8, maxUvOffset: .055, maxNormalSlope: .65, incidentLimit: 2.4 });

// This cache owns the two images. Corpse materials borrow them; disposing an
// individual corpse never invalidates another corpse's textures.
let sharedAssets = null;
function configureTexture(texture, colorSpace, name) {
  texture.colorSpace = colorSpace;
  texture.name = name;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  // The generated quadrants have no padded mip chain. Five derivative-sized
  // taps below filter within each tile instead of borrowing a neighbouring one.
  texture.generateMipmaps = false;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 1;
  texture.userData.sharedAsset = true;
  return texture;
}

function texturePromise(url, colorSpace, name) {
  return new Promise(resolve => {
    let pending;
    try {
      pending = new THREE.TextureLoader().load(url,
        texture => resolve(configureTexture(texture, colorSpace, name)),
        undefined, () => { pending?.dispose(); resolve(null); });
    } catch { pending?.dispose(); resolve(null); }
  });
}

function getSharedAssets() {
  if (sharedAssets) return sharedAssets;
  const entry = sharedAssets = { status: 'loading', users: 0, albedo: null, relief: null, packedRelief: false, ready: null };
  if (typeof document === 'undefined') {
    entry.status = 'unavailable'; entry.ready = Promise.resolve(entry); return entry;
  }
  entry.ready = Promise.all([
    texturePromise(HARVEST_TISSUE_ALBEDO_URL, THREE.SRGBColorSpace, 'HarvestTissueAlbedoV1'),
    texturePromise(HARVEST_TISSUE_HEIGHT_URL, THREE.NoColorSpace, 'HarvestTissueHeightV1'),
  ]).then(([albedo, relief]) => {
    if (albedo && relief) { entry.albedo = albedo; entry.relief = relief; entry.status = 'ready'; }
    else { albedo?.dispose(); relief?.dispose(); entry.status = 'unavailable'; }
    return entry;
  });
  return entry;
}

export function harvestTissueTexturesReady() { return getSharedAssets().ready; }
export function disposeHarvestTissueTextures() {
  if (!sharedAssets || sharedAssets.users) return false;
  // A pending loader retains this entry until both requests settle.
  const entry = sharedAssets;
  entry.ready.then(() => { entry.albedo?.dispose(); entry.relief?.dispose(); });
  sharedAssets = null;
  return true;
}

// Bound the incident light before N.L and the BRDF. The previous post-light
// color cap erased curvature whenever the close lantern reached its ceiling.
// A scalar radiance shoulder retains the light's chroma, normals and shadows.
function injectLightResponse(shader, incidentLimit) {
  shader.uniforms.uHarvestIncidentLimit = { value: incidentLimit };
  let physical = THREE.ShaderChunk.lights_physical_pars_fragment;
  physical = physical.replace('vec3 irradiance = dotNL * directLight.color;', `
    float harvestRadianceEnergy = max(max(directLight.color.r, directLight.color.g), directLight.color.b);
    vec3 harvestIncidentRadiance = directLight.color / (1. + harvestRadianceEnergy / max(uHarvestIncidentLimit, .01));
    vec3 irradiance = dotNL * harvestIncidentRadiance;`);
  physical = physical.replace('vec3 ccIrradiance = dotNLcc * directLight.color;', 'vec3 ccIrradiance = dotNLcc * harvestIncidentRadiance;');
  shader.fragmentShader = 'uniform float uHarvestIncidentLimit;\n' + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_pars_fragment>', physical);
}

/** Preserve form shading for the real wound edges and procedural fallback. */
export function applyHarvestTissueLightResponse(material, { incidentLimit = HARVEST_TISSUE_SHADER.incidentLimit } = {}) {
  if (!material || material.userData.harvestIncidentResponse) return material;
  const previous = material.onBeforeCompile, key = material.customProgramCacheKey();
  material.envMapIntensity = .22;
  material.onBeforeCompile = (shader, renderer) => { previous.call(material, shader, renderer); injectLightResponse(shader, incidentLimit); };
  material.customProgramCacheKey = () => `${key}-harvest-incident-v2-${incidentLimit}`;
  material.userData.harvestIncidentResponse = true;
  material.needsUpdate = true;
  return material;
}

const FRAGMENT_SUPPORT = `
uniform sampler2D uHarvestAlbedo;
uniform sampler2D uHarvestRelief;
uniform vec2 uHarvestTexel;
uniform float uHarvestPackedRelief;
uniform float uHarvestHeightScale;
uniform float uHarvestNormalStrength;
uniform float uHarvestTintStrength;
uniform float uHarvestDiffuseGain;
uniform float uHarvestOcclusion;
uniform float uHarvestRegionalGain;
uniform float uHarvestDebug;
varying vec2 vHarvestUv;
varying float vHarvestRegion;

vec2 harvestTileOrigin(float region) {
  return vec2(mod(region, 2.), 1. - floor(region / 2.)) * .5;
}
vec2 harvestAtlasUv(vec2 localUv, float region) {
  vec2 inset = max(uHarvestTexel * 5., vec2(.004));
  return harvestTileOrigin(region) + clamp(localUv, inset, vec2(1.) - inset) * .5;
}
// Unwrapped derivatives are passed explicitly: fract/repeated tube UVs and
// the variable-height ray march must never choose texture gradients themselves.
vec4 harvestTap(sampler2D image, vec2 uv, float region, vec2 dx, vec2 dy) {
  return texture2DGradEXT(image, harvestAtlasUv(uv, region), dx * .5, dy * .5);
}
vec4 harvestFiltered(sampler2D image, vec2 uv, float region, vec2 dx, vec2 dy) {
  vec2 major = dot(dx, dx) > dot(dy, dy) ? dx : dy;
  float footprint = max(length(dx / max(uHarvestTexel * 2., vec2(.0001))), length(dy / max(uHarvestTexel * 2., vec2(.0001))));
  vec4 center = harvestTap(image, uv, region, dx, dy);
  vec4 filtered = center * .28;
  filtered += harvestTap(image, uv - major * .4, region, dx, dy) * .16;
  filtered += harvestTap(image, uv - major * .2, region, dx, dy) * .20;
  filtered += harvestTap(image, uv + major * .2, region, dx, dy) * .20;
  filtered += harvestTap(image, uv + major * .4, region, dx, dy) * .16;
  return mix(center, filtered, smoothstep(1., 3., footprint));
}
float harvestHeight(vec2 uv, float region, vec2 dx, vec2 dy) {
  return harvestTap(uHarvestRelief, uv, region, dx, dy).r;
}
vec2 harvestParallax(vec2 uv, vec2 shift, float region, vec2 dx, vec2 dy) {
  vec2 stepUv = shift / 8.;
  vec2 current = uv, previous = uv;
  float depth = 0., oldSurface = 1. - harvestHeight(uv, region, dx, dy), surface = oldSurface;
  // A compile-time bound prevents unbounded work or grazing-angle explosions.
  for (int stepIndex = 0; stepIndex < 8; stepIndex++) {
    if (depth >= surface) break;
    previous = current; oldSurface = surface;
    current -= stepUv; depth += .125;
    surface = 1. - harvestHeight(current, region, dx, dy);
  }
  float after = surface - depth;
  float before = oldSurface - (depth - .125);
  float blend = clamp(before / max(before - after, .00001), 0., 1.);
  return mix(previous, current, blend);
}
`;

const MAP_FRAGMENT = `
  float harvestRegion = clamp(floor(vHarvestRegion + .5), 0., 3.);
  vec2 harvestDx = dFdx(vHarvestUv), harvestDy = dFdy(vHarvestUv);
  vec3 harvestPosition = -vViewPosition;
  vec3 harvestPx = dFdx(harvestPosition), harvestPy = dFdy(harvestPosition);
  #ifdef FLAT_SHADED
    vec3 harvestBaseNormal = normalize(cross(harvestPx, harvestPy));
  #else
    vec3 harvestBaseNormal = normalize(vNormal);
    #ifdef DOUBLE_SIDED
      harvestBaseNormal *= gl_FrontFacing ? 1. : -1.;
    #endif
  #endif
  float harvestDet = harvestDx.x * harvestDy.y - harvestDx.y * harvestDy.x;
  float harvestSafeDet = abs(harvestDet) > 1e-10 ? harvestDet : (harvestDet < 0. ? -1e-10 : 1e-10);
  vec3 harvestDpdu = (harvestPx * harvestDy.y - harvestPy * harvestDx.y) / harvestSafeDet;
  vec3 harvestDpdv = (harvestPy * harvestDx.x - harvestPx * harvestDy.x) / harvestSafeDet;
  harvestDpdu -= harvestBaseNormal * dot(harvestDpdu, harvestBaseNormal);
  harvestDpdv -= harvestBaseNormal * dot(harvestDpdv, harvestBaseNormal);
  float harvestE = dot(harvestDpdu, harvestDpdu), harvestF = dot(harvestDpdu, harvestDpdv), harvestG = dot(harvestDpdv, harvestDpdv);
  float harvestMetric = max(harvestE * harvestG - harvestF * harvestF, 1e-12);
  float harvestFrameValid = step(1e-10, abs(harvestDet)) * step(1e-12, harvestE * harvestG - harvestF * harvestF);
  vec3 harvestView = normalize(vViewPosition);
  vec2 harvestViewUv = vec2(dot(harvestView, harvestDpdu) * harvestG - dot(harvestView, harvestDpdv) * harvestF,
    dot(harvestView, harvestDpdv) * harvestE - dot(harvestView, harvestDpdu) * harvestF) / harvestMetric;
  float harvestFootprint = max(length(harvestDx / max(uHarvestTexel * 2., vec2(.0001))), length(harvestDy / max(uHarvestTexel * 2., vec2(.0001))));
  float harvestDetail = (1. - smoothstep(2., 14., harvestFootprint)) * harvestFrameValid;
  float harvestAmplitude = (harvestRegion < .5 ? .00075 : harvestRegion < 1.5 ? .00028 : harvestRegion < 2.5 ? .00048 : .0007) * uHarvestHeightScale;
  vec2 harvestShift = harvestViewUv * harvestAmplitude / max(abs(dot(harvestView, harvestBaseNormal)), .18);
  harvestShift *= min(1., .055 / max(length(harvestShift), .00001)) * harvestDetail;
  vec2 harvestUv = harvestParallax(fract(vHarvestUv), harvestShift, harvestRegion, harvestDx, harvestDy);
  vec4 harvestPigment = harvestFiltered(uHarvestAlbedo, harvestUv, harvestRegion, harvestDx, harvestDy);
  vec3 harvestRelief = harvestFiltered(uHarvestRelief, harvestUv, harvestRegion, harvestDx, harvestDy).rgb;
  float harvestRegionGain = harvestRegion > 2.5 ? .80 : harvestRegion > .5 && harvestRegion < 1.5 ? .70 : 1.;
  diffuseColor.rgb *= harvestPigment.rgb * uHarvestDiffuseGain * mix(1., harvestRegionGain, uHarvestRegionalGain);
  float harvestCavityAo = mix(mix(.84, 1., smoothstep(.12, .72, harvestRelief.r)), clamp(harvestRelief.b, .65, 1.), uHarvestPackedRelief) * uHarvestOcclusion;
`;

const NORMAL_FRAGMENT = `
  #include <normal_fragment_maps>
  vec2 harvestNormalStep = max(uHarvestTexel * 2., vec2(.0005));
  vec2 harvestHeightGradient = vec2(
    harvestHeight(harvestUv + vec2(harvestNormalStep.x, 0.), harvestRegion, harvestDx, harvestDy) - harvestHeight(harvestUv - vec2(harvestNormalStep.x, 0.), harvestRegion, harvestDx, harvestDy),
    harvestHeight(harvestUv + vec2(0., harvestNormalStep.y), harvestRegion, harvestDx, harvestDy) - harvestHeight(harvestUv - vec2(0., harvestNormalStep.y), harvestRegion, harvestDx, harvestDy)) / (2. * harvestNormalStep);
  vec3 harvestSurfaceGradient = (harvestDpdu * (harvestG * harvestHeightGradient.x - harvestF * harvestHeightGradient.y)
    + harvestDpdv * (harvestE * harvestHeightGradient.y - harvestF * harvestHeightGradient.x)) / harvestMetric;
  harvestSurfaceGradient *= harvestAmplitude * harvestDetail * uHarvestNormalStrength;
  float harvestSlope = harvestRegion > 2.5 ? .65 : harvestRegion > .5 && harvestRegion < 1.5 ? .35 : .55;
  harvestSurfaceGradient *= min(1., harvestSlope / max(length(harvestSurfaceGradient), .00001));
  // Add small surface relief to the authored curvature, never substitute a
  // flat texture normal for the rounded organ/tube silhouette.
  normal = normalize(normal - harvestSurfaceGradient);
  vec3 harvestNormalDx = dFdx(normal), harvestNormalDy = dFdy(normal);
  roughnessFactor = min(.94, sqrt(roughnessFactor * roughnessFactor + min(.12, max(dot(harvestNormalDx, harvestNormalDx), dot(harvestNormalDy, harvestNormalDy)))));
`;

/** Atlas material for semantic region attributes, or one constant edge region. */
export function createHarvestTissueMaterial({ albedo, relief, packedRelief = false, region = null, tintStrength = .08, diffuseGain = 1, occlusion = 1, regionalGain = true, heightScale = 1, normalStrength = .75, incidentLimit = HARVEST_TISSUE_SHADER.incidentLimit } = {}) {
  if (!albedo?.isTexture || !relief?.isTexture) throw new TypeError('Harvest tissue requires loaded albedo and scalar height textures.');
  configureTexture(albedo, THREE.SRGBColorSpace, 'HarvestTissueAlbedoV1');
  configureTexture(relief, THREE.NoColorSpace, 'HarvestTissueHeightV1');
  const width = Math.max(1, albedo.image?.width || 2048), height = Math.max(1, albedo.image?.height || 2048);
  const uniforms = {
    uHarvestAlbedo: { value: albedo }, uHarvestRelief: { value: relief }, uHarvestTexel: { value: new THREE.Vector2(1 / width, 1 / height) },
    uHarvestPackedRelief: { value: packedRelief ? 1 : 0 }, uHarvestHeightScale: { value: heightScale },
    uHarvestNormalStrength: { value: normalStrength }, uHarvestDebug: { value: 0 },
    uHarvestTintStrength: { value: THREE.MathUtils.clamp(tintStrength, 0, 1) },
    uHarvestDiffuseGain: { value: THREE.MathUtils.clamp(diffuseGain, 0, 1) },
    uHarvestOcclusion: { value: THREE.MathUtils.clamp(occlusion, 0, 1) },
    uHarvestRegionalGain: { value: regionalGain ? 1 : 0 },
  };
  const material = new THREE.MeshPhysicalMaterial({ name: 'HarvestImageTissuePBR', color: 0xffffff, vertexColors: true,
    roughness: .32, metalness: 0, specularIntensity: .38, envMapIntensity: .22, clearcoat: .10, clearcoatRoughness: .3, side: THREE.DoubleSide });
  material.userData.harvestTissueAtlas = true; material.userData.harvestTissueUniforms = uniforms;
  material.userData.harvestIncidentResponse = true;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `${region === null ? 'attribute float tissueRegion;\n' : ''}varying float vHarvestRegion;\nvarying vec2 vHarvestUv;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\nvHarvestUv = uv;\nvHarvestRegion = ${region === null ? 'tissueRegion' : Number(THREE.MathUtils.clamp(region, 0, 3)).toFixed(1)};`);
    shader.fragmentShader = FRAGMENT_SUPPORT + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', MAP_FRAGMENT);
    // Seeded surface pigment supplies mild local variation. The generated
    // albedo supplies tissue colour, rather than multiplying two dark reds.
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #ifdef USE_COLOR
        vec3 harvestVertexTint = vColor.rgb / max(max(max(vColor.r, vColor.g), vColor.b), .001);
        diffuseColor.rgb *= mix(vec3(1.), harvestVertexTint, uHarvestTintStrength);
        diffuseColor.rgb *= clamp(.82 + dot(vColor.rgb, vec3(.2126, .7152, .0722)) * (1. - uHarvestTintStrength), .82, 1.08);
      #endif`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      float roughnessFactor = harvestRegion > 2.5 ? .56 + .19 * (1. - harvestRelief.r) : .23 + .13 * harvestRelief.r;
      roughnessFactor = mix(roughnessFactor, clamp(harvestRelief.g, .22, .82), uHarvestPackedRelief);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', NORMAL_FRAGMENT);
    shader.fragmentShader = shader.fragmentShader.replace('#include <aomap_fragment>', `#include <aomap_fragment>\nreflectedLight.indirectDiffuse *= harvestCavityAo;\nreflectedLight.indirectSpecular *= harvestCavityAo;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      if(uHarvestDebug > .5 && uHarvestDebug < 1.5) outgoingLight = harvestPigment.rgb;
      if(uHarvestDebug > 1.5 && uHarvestDebug < 2.5) outgoingLight = vec3(harvestRelief.r);
      if(uHarvestDebug > 2.5 && uHarvestDebug < 3.5) outgoingLight = vec3(roughnessFactor);
      if(uHarvestDebug > 3.5 && uHarvestDebug < 4.5) outgoingLight = normal * .5 + .5;
      if(uHarvestDebug > 4.5) outgoingLight = vec3(harvestRegion / 3., 1. - harvestRegion / 3., .25);
      #include <opaque_fragment>`);
    injectLightResponse(shader, incidentLimit);
  };
  material.customProgramCacheKey = () => `harvest-image-tissue-v2-${region === null ? 'attributes' : region}-${incidentLimit}`;
  return material;
}

/** Apply shared image assets when ready, keeping source materials on failure. */
export function applyHarvestTissueMaterials(anatomy, { assets = null } = {}) {
  const entry = assets || getSharedAssets(); entry.users = (entry.users || 0) + 1;
  const entries = new Map(), materials = new Map(); let disposed = false, debugMode = 0;
  const materialFor = ({ region, tintStrength, diffuseGain, occlusion, regionalGain }) => {
    const key = `${region ?? 'attributes'}/${tintStrength}/${diffuseGain}/${occlusion}/${regionalGain}`;
    if (!materials.has(key)) {
      const material = createHarvestTissueMaterial({ ...entry, region, tintStrength, diffuseGain, occlusion, regionalGain });
      material.userData.harvestTissueUniforms.uHarvestDebug.value = debugMode;
      materials.set(key, material);
    }
    return materials.get(key);
  };
  const apply = record => {
    if (!disposed && entry.status === 'ready' && record.mesh.geometry.attributes.uv) {
      record.applied = materialFor(record); record.mesh.material = record.applied;
    }
  };
  const owner = {
    addMesh(mesh, { region = null, tintStrength = .08, diffuseGain = mesh?.name === 'DeepThoracicCavity' ? .18 : mesh?.name === 'PosteriorKidneys' ? .55 : 1,
      occlusion = mesh?.name === 'DeepThoracicCavity' ? .3 : mesh?.name === 'PosteriorKidneys' ? .7 : 1, regionalGain = true } = {}) {
      if (disposed || !mesh?.isMesh || !mesh.geometry?.attributes.uv) return false;
      if (entries.has(mesh)) return true;
      if (region === null && !mesh.geometry.attributes.tissueRegion) return false;
      const record = { mesh, original: mesh.material, region, tintStrength, diffuseGain, occlusion, regionalGain, applied: null };
      // Texture decode is asynchronous. Give the original PBR materials the
      // same bounded response so the first cut cannot flash overbright.
      for (const original of (Array.isArray(record.original) ? record.original : [record.original])) applyHarvestTissueLightResponse(original);
      entries.set(mesh, record); apply(record); return true;
    },
    removeMesh(mesh) {
      const record = entries.get(mesh); if (!record) return false;
      if (record.applied && mesh.material === record.applied) mesh.material = record.original;
      entries.delete(mesh);
      // Retire a removed edge's private variant, retaining any material still
      // borrowed by another live organ or edge in this owner.
      for (const [key, material] of materials) if (![...entries.values()].some(item => item.applied === material)) {
        material.dispose(); materials.delete(key);
      }
      return true;
    },
    setDebug(mode = 0) { debugMode = THREE.MathUtils.clamp(mode, 0, 5); for (const material of materials.values()) material.userData.harvestTissueUniforms.uHarvestDebug.value = debugMode; },
    diagnostics() { return { status: entry.status, meshes: entries.size, materials: materials.size, textures: entry.status === 'ready' ? 2 : 0, sharedTextures: true, scalarHeight: !entry.packedRelief, parallaxSteps: HARVEST_TISSUE_SHADER.steps, disposed }; },
    dispose() {
      if (disposed) return; disposed = true;
      for (const mesh of [...entries.keys()]) owner.removeMesh(mesh);
      for (const material of materials.values()) material.dispose(); materials.clear(); entries.clear(); entry.users--;
    },
    ready: null,
  };
  anatomy.root.traverse(node => owner.addMesh(node));
  owner.ready = Promise.resolve(entry.ready || entry).then(() => {
    // Injected assets used by deterministic tests may provide images directly.
    if (!entry.status) entry.status = entry.albedo && entry.relief ? 'ready' : 'unavailable';
    for (const record of entries.values()) apply(record);
    return owner.diagnostics();
  });
  return owner;
}
