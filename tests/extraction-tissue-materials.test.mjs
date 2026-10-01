import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {
  createHarvestTissueMaterial, applyHarvestTissueMaterials, applyHarvestTissueLightResponse,
  HARVEST_TISSUE_SHADER, harvestTissueTexturesReady, disposeHarvestTissueTextures,
} from '../extraction-tissue-materials.js';

function assets(status = 'ready') {
  return { status, albedo: new THREE.DataTexture(new Uint8Array(4 * 4 * 4).fill(128), 4, 4),
    relief: new THREE.DataTexture(new Uint8Array(4 * 4 * 4).fill(128), 4, 4), users: 0 };
}
function compile(material) {
  const shader = { vertexShader: THREE.ShaderLib.physical.vertexShader,
    fragmentShader: THREE.ShaderLib.physical.fragmentShader, uniforms: {} };
  material.onBeforeCompile(shader);
  return shader;
}
function mesh(name = 'LobedHeartAndGreatVessels', withRegion = true) {
  const geometry = new THREE.PlaneGeometry(.1, .1);
  if (withRegion) geometry.setAttribute('tissueRegion', new THREE.Float32BufferAttribute([0, 0, 0, 0], 1));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute([.2, .02, .02, .2, .02, .02, .2, .02, .02, .2, .02, .02], 3));
  const node = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()); node.name = name; return node;
}

test('atlas parallax is physically scaled, bounded, filtered and isolated to its semantic tile', () => {
  const images = assets(), material = createHarvestTissueMaterial(images), shader = compile(material);
  assert.equal(HARVEST_TISSUE_SHADER.steps, 8);
  assert.match(shader.vertexShader, /attribute float tissueRegion;/);
  assert.match(shader.vertexShader, /vHarvestUv = uv/);
  assert.match(shader.fragmentShader, /stepIndex < 8/);
  assert.match(shader.fragmentShader, /\.055 \/ max\(length\(harvestShift\)/);
  assert.match(shader.fragmentShader, /max\(abs\(dot\(harvestView, harvestBaseNormal\)\), \.18\)/);
  assert.match(shader.fragmentShader, /texture2DGradEXT\(image, harvestAtlasUv\(uv, region\), dx \* \.5, dy \* \.5\)/);
  assert.match(shader.fragmentShader, /clamp\(localUv, inset, vec2\(1\.\) - inset\)/);
  assert(shader.fragmentShader.indexOf('dFdx(vHarvestUv)') < shader.fragmentShader.indexOf('harvestParallax(fract(vHarvestUv)'));
  assert.match(shader.fragmentShader, /1\. - smoothstep\(2\., 14\., harvestFootprint\)/);
  assert.equal(images.albedo.colorSpace, THREE.SRGBColorSpace);
  assert.equal(images.relief.colorSpace, THREE.NoColorSpace);
  assert.equal(images.albedo.generateMipmaps, false);
  assert.equal(images.relief.generateMipmaps, false);
  assert.equal(images.albedo.minFilter, THREE.LinearFilter);
  assert.equal(shader.uniforms.uHarvestPackedRelief.value, 0);
  assert.equal(material.metalness, 0);
  assert.equal(material.emissive.getHex(), 0);
  material.dispose(); images.albedo.dispose(); images.relief.dispose();
});

test('shared height gives restrained micro-normal and roughness while keeping organ curvature', () => {
  const images = assets(), material = createHarvestTissueMaterial(images), shader = compile(material);
  assert.match(shader.fragmentShader, /normal = normalize\(normal - harvestSurfaceGradient\)/);
  assert.match(shader.fragmentShader, /harvestAmplitude \* harvestDetail \* uHarvestNormalStrength/);
  assert.match(shader.fragmentShader, /harvestSlope \/ max\(length\(harvestSurfaceGradient\)/);
  assert.match(shader.fragmentShader, /\.23 \+ \.13 \* harvestRelief\.r/);
  assert.match(shader.fragmentShader, /\.56 \+ \.19 \* \(1\. - harvestRelief\.r\)/);
  assert.match(shader.fragmentShader, /vColor\.rgb \/ max/);
  assert.doesNotMatch(shader.fragmentShader, /diffuseColor\.rgb \*= vColor/);
  assert.equal(shader.uniforms.uHarvestTintStrength.value, .08);
  assert.match(shader.fragmentShader, /uHarvestDebug > 3\.5/);
  material.dispose(); images.albedo.dispose(); images.relief.dispose();
});

test('close lantern response bounds incident radiance before form shading and retains existing shader hooks', () => {
  const material = new THREE.MeshPhysicalMaterial();
  material.onBeforeCompile = shader => { shader.uniforms.previousHook = { value: true }; };
  material.customProgramCacheKey = () => 'original-hook';
  applyHarvestTissueLightResponse(material);
  const firstHook = material.onBeforeCompile;
  applyHarvestTissueLightResponse(material);
  assert.equal(material.onBeforeCompile, firstHook, 'lighting wrapper is idempotent');
  const shader = compile(material);
  assert.equal(shader.uniforms.previousHook.value, true);
  assert.equal(shader.uniforms.uHarvestIncidentLimit.value, 2.4);
  assert.match(shader.fragmentShader, /vec3 irradiance = dotNL \* harvestIncidentRadiance/);
  assert.match(shader.fragmentShader, /vec3 ccIrradiance = dotNLcc \* harvestIncidentRadiance/);
  assert.doesNotMatch(shader.fragmentShader, /reflectedLight\.directDiffuse\s*\/=|harvestLimit/);
  assert.equal(material.customProgramCacheKey(), 'original-hook-harvest-incident-v2-2.4');
  material.dispose();
});

test('corpse owners share texture storage, keep recessed organ gain and add layered source edges', async () => {
  const images = assets(), root = new THREE.Group(), heart = mesh(), cavity = mesh('DeepThoracicCavity'), kidneys = mesh('PosteriorKidneys');
  root.add(heart, cavity, kidneys);
  const original = [heart.material, cavity.material, kidneys.material];
  const first = applyHarvestTissueMaterials({ root }, { assets: images }); await first.ready;
  const secondRoot = new THREE.Group(), secondHeart = mesh(); secondRoot.add(secondHeart);
  const second = applyHarvestTissueMaterials({ root: secondRoot }, { assets: images }); await second.ready;
  assert.equal(images.users, 2);
  assert.equal(heart.material.userData.harvestTissueUniforms.uHarvestAlbedo.value,
    secondHeart.material.userData.harvestTissueUniforms.uHarvestAlbedo.value);
  assert.equal(cavity.material.userData.harvestTissueUniforms.uHarvestDiffuseGain.value, .18);
  assert.equal(cavity.material.userData.harvestTissueUniforms.uHarvestOcclusion.value, .3);
  assert.equal(kidneys.material.userData.harvestTissueUniforms.uHarvestDiffuseGain.value, .55);
  const edge = mesh('ActualTornFascia', false), edgeOriginal = edge.material;
  assert.equal(first.addMesh(edge), false, 'attributes or an explicit region are required');
  assert.equal(first.addMesh(edge, { region: 1, tintStrength: .9 }), true);
  const edgeShader = compile(edge.material);
  assert.doesNotMatch(edgeShader.vertexShader, /attribute float tissueRegion/);
  assert.match(edgeShader.vertexShader, /vHarvestRegion = 1\.0/);
  assert.equal(edgeShader.uniforms.uHarvestTintStrength.value, .9);
  first.setDebug(4);
  assert.equal(edge.material.userData.harvestTissueUniforms.uHarvestDebug.value, 4);
  let textureDisposals = 0, ownedDisposals = 0, sourceDisposals = 0;
  images.albedo.addEventListener('dispose', () => textureDisposals++);
  images.relief.addEventListener('dispose', () => textureDisposals++);
  heart.material.addEventListener('dispose', () => ownedDisposals++);
  original[0].addEventListener('dispose', () => sourceDisposals++);
  first.dispose(); first.dispose();
  assert.equal(images.users, 1); assert.equal(ownedDisposals, 1); assert.equal(sourceDisposals, 0); assert.equal(textureDisposals, 0);
  assert.deepEqual([heart.material, cavity.material, kidneys.material], original); assert.equal(edge.material, edgeOriginal);
  assert(secondHeart.material.userData.harvestTissueAtlas, 'another corpse retains its live material');
  second.dispose(); assert.equal(images.users, 0);
  for (const node of [heart, cavity, kidneys, secondHeart, edge]) { node.geometry.dispose(); node.material.dispose(); }
  images.albedo.dispose(); images.relief.dispose();
});

test('failed or late assets retain source materials and cannot resurrect disposed corpse resources', async () => {
  const root = new THREE.Group(), node = mesh(); root.add(node); const original = node.material;
  const missing = { status: 'unavailable', users: 0 };
  const fallback = applyHarvestTissueMaterials({ root }, { assets: missing }); await fallback.ready;
  assert.equal(node.material, original); assert.equal(fallback.diagnostics().textures, 0);
  assert.equal(compile(original).uniforms.uHarvestIncidentLimit.value, 2.4, 'unavailable art retains bounded source lighting'); fallback.dispose();
  const late = assets('loading'); let finish;
  late.ready = new Promise(resolve => { finish = resolve; });
  const pending = applyHarvestTissueMaterials({ root }, { assets: late }); pending.setDebug(2); pending.dispose();
  late.status = 'ready'; finish(late); await pending.ready;
  assert.equal(node.material, original); assert.equal(pending.diagnostics().materials, 0); assert.equal(late.users, 0);
  late.albedo.dispose(); late.relief.dispose(); node.geometry.dispose(); original.dispose();
});

test('serosa and bone reduce diffuse pigment gain without capping reflected RGB or flattening normals', () => {
  const images = assets(), material = createHarvestTissueMaterial(images), shader = compile(material);
  assert.equal(shader.uniforms.uHarvestIncidentLimit.value, 2.4);
  assert.equal(shader.uniforms.uHarvestRegionalGain.value, 1);
  assert.match(shader.fragmentShader, /harvestRegion > 2\.5 \? \.80/);
  assert.match(shader.fragmentShader, /harvestRegion < 1\.5 \? \.70/);
  assert.match(shader.fragmentShader, /mix\(1\., harvestRegionGain, uHarvestRegionalGain\)/);
  assert.doesNotMatch(shader.fragmentShader, /reflectedLight\.directDiffuse\s*\/=|harvestLimit/);
  const edgeMaterial = createHarvestTissueMaterial({ ...images, diffuseGain: .62, occlusion: .7, regionalGain: false });
  const edgeShader = compile(edgeMaterial);
  assert.equal(edgeShader.uniforms.uHarvestRegionalGain.value, 0);
  assert.equal(edgeShader.uniforms.uHarvestDiffuseGain.value, .62);
  assert.equal(edgeShader.uniforms.uHarvestOcclusion.value, .7);
  material.dispose(); edgeMaterial.dispose(); images.albedo.dispose(); images.relief.dispose();
});

test('source edge replacement restores removed materials and keeps reused live variants allocated', async () => {
  const images = assets(), root = new THREE.Group(), organ = mesh(); root.add(organ);
  const owner = applyHarvestTissueMaterials({ root }, { assets: images }); await owner.ready;
  const oldEdge = mesh('OldSourceEdge'), replacement = mesh('ReplacementSourceEdge');
  const original = oldEdge.material, replacementOriginal = replacement.material;
  owner.addMesh(oldEdge, { tintStrength: .9, diffuseGain: .62, regionalGain: false });
  const oldAtlas = oldEdge.material; let removedDisposals = 0;
  oldAtlas.addEventListener('dispose', () => removedDisposals++);
  assert.equal(owner.removeMesh(oldEdge), true);
  assert.equal(oldEdge.material, original); assert.equal(removedDisposals, 1);
  assert.equal(owner.removeMesh(oldEdge), false); assert.equal(owner.diagnostics().meshes, 1);
  owner.addMesh(replacement, { tintStrength: .9, diffuseGain: .62, regionalGain: false });
  assert.notEqual(replacement.material, oldAtlas); assert.equal(owner.diagnostics().meshes, 2);
  const externalMaterial = new THREE.MeshStandardMaterial(); replacement.material = externalMaterial;
  owner.removeMesh(replacement);
  assert.equal(replacement.material, externalMaterial, 'preserve a later external replacement');
  const sibling = mesh('SiblingOrgan'); owner.addMesh(sibling);
  const sharedMaterial = organ.material; let sharedDisposals = 0;
  sharedMaterial.addEventListener('dispose', () => sharedDisposals++);
  assert.equal(sibling.material, sharedMaterial);
  owner.removeMesh(sibling); assert.equal(sharedDisposals, 0);
  assert.equal(organ.material, sharedMaterial); owner.dispose(); assert.equal(sharedDisposals, 1);
  for (const node of [organ, oldEdge, replacement, sibling]) { node.geometry.dispose(); node.material.dispose(); }
  replacementOriginal.dispose(); images.albedo.dispose(); images.relief.dispose();
});

test('removing an edge during image loading excludes it from the later atlas swap', async () => {
  const images = assets('loading'); let finish;
  images.ready = new Promise(resolve => { finish = resolve; });
  const root = new THREE.Group(), organ = mesh(), edge = mesh('TemporarySourceEdge'); root.add(organ);
  const original = edge.material, owner = applyHarvestTissueMaterials({ root }, { assets: images });
  owner.addMesh(edge); assert.equal(compile(original).uniforms.uHarvestIncidentLimit.value, 2.4);
  owner.removeMesh(edge); images.status = 'ready'; finish(images); await owner.ready;
  assert.equal(edge.material, original); assert.equal(owner.diagnostics().meshes, 1);
  assert(organ.material.userData.harvestTissueAtlas); owner.dispose();
  for (const node of [organ, edge]) { node.geometry.dispose(); node.material.dispose(); }
  images.albedo.dispose(); images.relief.dispose();
});

test('headless asset readiness resolves to an explicit procedural fallback without image allocations', async () => {
  const state = await harvestTissueTexturesReady();
  assert.equal(state.status, 'unavailable'); assert.equal(state.albedo, null); assert.equal(state.relief, null);
  assert.equal(disposeHarvestTissueTextures(), true);
});
