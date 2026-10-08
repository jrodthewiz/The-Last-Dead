import * as THREE from './vendor/three.module.js';
import {BlackwaterPaintedMaterial} from './blackwater-render-looks.js';
import { color, float, lights, positionGeometry, positionLocal, texture, uniform, uv, vec3, vec4 } from './vendor/three.tsl.js';
import { TreeGeometry } from './assets/forest-kit/ez-tree/tree.js';
import TreeOptions from './assets/forest-kit/ez-tree/options.js';
import { ASH_MEDIUM, PINE_MEDIUM } from './assets/forest-kit/presets.js';

// EZ-Tree growth is pinned and vendored, not downloaded in the game. One seeded
// skeleton supplies all three LODs; every placement borrows those same buffers.
export const FOREST_LOD_DETAILS = Object.freeze([
  Object.freeze({ sectionStride: 2, segmentFactor: .75, leafStride: 2, leafScale: 1.15 }),
  Object.freeze({ sectionStride: 3, segmentFactor: .6, leafStride: 3, leafScale: 1.3, billboard: 'single' }),
  Object.freeze({ sectionStride: 6, segmentFactor: .4, leafStride: 4, leafScale: 1.5, billboard: 'single' }),
]);
const SPECIES = ['deciduous', 'conifer'];
const SEEDS = { deciduous: [36330, 36349, 36381], conifer: [13977, 14003, 14059] };
const DEFAULT_PALETTE = Object.freeze({ bark: '#866643', deciduous: '#92ad4a', conifer: '#3e826d' });
const MAX_TREES = 512;
const TAU = Math.PI * 2;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const geometryTriangles = geometry => geometry.index.count / 3;

function hash(value) {
  const text = String(value);
  let state = 2166136261;
  for (let i = 0; i < text.length; i++) state = Math.imul(state ^ text.charCodeAt(i), 16777619);
  return state >>> 0;
}

function fallbackPixels(kind, size = 64) {
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4, u = (x + .5) / size, v = 1 - (y + .5) / size;
    if (kind === 'normal') { pixels.set([128, 128, 255, 255], i); continue; }
    if (kind === 'bark') {
      const groove = .5 + .5 * Math.sin(u * TAU * 9 + Math.sin(v * TAU * 3));
      const tint = 115 + Math.round(groove * 45);
      pixels.set([tint, tint, tint, 255], i); continue;
    }
    let coverage = Math.abs(u - .5) < .018 && v > .05 && v < .93;
    for (let pair = 0; pair < 5; pair++) for (const side of [-1, 1]) {
      const centerV = .22 + pair * .14, width = kind === 'pine' ? .17 : .14;
      const centerU = .5 + side * width;
      const a = (u - centerU) / width, b = (v - centerV) / (kind === 'pine' ? .10 : .06);
      if (a * a + b * b < 1) coverage = true;
    }
    const tone = 113 + Math.round(v * 37);
    pixels.set([tone - 15, tone + 20, tone - 25, coverage ? 255 : 0], i);
  }
  return pixels;
}

// A stable Texture object contains a deterministic cutout before its local PNG
// loads. Browser ImageLoader replaces its image, not the Texture or shader node.
function createTexture(kind, file, resources, loadTextures, status) {
  const size = 64, pixels = fallbackPixels(kind, size);
  let map;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');
    if (context) {
      const image = context.createImageData(size, size); image.data.set(pixels); context.putImageData(image, 0, 0);
      map = new THREE.Texture(canvas); map.needsUpdate = true;
    }
  }
  if (!map) { map = new THREE.DataTexture(pixels, size, size); map.flipY = true; map.needsUpdate = true; }
  map.name = `Forest:${kind}`;
  map.colorSpace = kind === 'normal' ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = ['bark', 'normal'].includes(kind) ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  map.generateMipmaps = true; map.minFilter = THREE.LinearMipmapLinearFilter; map.magFilter = THREE.LinearFilter;
  map.anisotropy = ['bark', 'normal'].includes(kind) ? 4 : 2;
  map.userData = { forestOwned: true, source: file, fallback: true, alphaCutout: ['ash', 'pine'].includes(kind) };
  resources.textures.add(map);
  status.push({ kind, file, state: 'fallback' });
  const record = status.at(-1);
  const ready = !loadTextures || typeof document === 'undefined' ? Promise.resolve(record) : new Promise(resolve => {
    new THREE.ImageLoader().load(new URL(`./assets/forest-kit/textures/${file}`, import.meta.url).href, image => {
      if (resources.disposed) { record.state = 'disposed'; resolve(record); return; }
      map.image = image; map.needsUpdate = true; map.userData.fallback = false;
      record.state = 'loaded'; record.width = image.width; record.height = image.height; resolve(record);
    }, undefined, () => { record.state = resources.disposed ? 'disposed' : 'fallback-error'; resolve(record); });
  });
  return { map, ready };
}

function removeCollapsedTriangles(geometry) {
  const positions = geometry.attributes.position, index = geometry.index.array, kept = [];
  let removed = 0;
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i], b = index[i + 1], c = index[i + 2];
    const ux = positions.getX(b) - positions.getX(a), uy = positions.getY(b) - positions.getY(a), uz = positions.getZ(b) - positions.getZ(a);
    const vx = positions.getX(c) - positions.getX(a), vy = positions.getY(c) - positions.getY(a), vz = positions.getZ(c) - positions.getZ(a);
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (Number.isFinite(cx + cy + cz) && cx * cx + cy * cy + cz * cz > 1e-18) kept.push(a, b, c); else removed++;
  }
  if (removed) geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(kept), 1));
  return removed;
}

function buildTemplate(species, templateIndex, resources) {
  const options = new TreeOptions(); options.copy(species === 'deciduous' ? ASH_MEDIUM : PINE_MEDIUM);
  options.seed = SEEDS[species][templateIndex];
  const generator = new TreeGeometry(options), levels = [], union = new THREE.Box3();
  // Estimate meters for a twelve-meter reference tree. Arc-length V is stable
  // over ring reductions. Integer radial repeats keep the seam continuous.
  const referenceHeight = species === 'deciduous' ? 84 : 52;
  for (const detail of FOREST_LOD_DETAILS) {
    const pair = generator.createGeometry({ ...detail, barkTextureMeters: .60 * referenceHeight / 12 });
    for (const geometry of Object.values(pair)) { geometry.computeBoundingBox(); union.union(geometry.boundingBox); }
    levels.push(pair);
  }
  const originalHeight = union.max.y;
  let removedTriangles = 0;
  for (let lod = 0; lod < levels.length; lod++) for (const [part, geometry] of Object.entries(levels[lod])) {
    geometry.scale(1 / originalHeight, 1 / originalHeight, 1 / originalHeight);
    if (part === 'branches') {
      // Root flare fits the same narrow trunk proxy; no extra ground meshes.
      const position = geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        const flare = 1 + .15 * (1 - clamp(position.getY(i) / .045, 0, 1));
        position.setX(i, position.getX(i) * flare); position.setZ(i, position.getZ(i) * flare);
      }
      // Rounded radial normals continue to face outward after the small flare.
    }
    removedTriangles += removeCollapsedTriangles(geometry);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    geometry.name = `Forest:${species}:${templateIndex}:${lod}:${part}`;
    geometry.userData = { forestOwned: true, species, templateIndex, lod, part, sourceSeed: options.seed };
    resources.geometries.add(geometry);
  }
  const bounds = new THREE.Box3(); for (const pair of levels) for (const geometry of Object.values(pair)) bounds.union(geometry.boundingBox);
  return { species, templateIndex, seed: options.seed, levels, bounds, rootRadius: options.branch.radius[0] * 1.15 / originalHeight, originalHeight, removedTriangles, branches: generator.skeleton.branches.length, leaves: generator.skeleton.leaves.length };
}

function sourceParameters(source, fallbackColor) {
  return {color:source?.color?.clone()||new THREE.Color(fallbackColor)};
}

/**
 * placements are world meters with y at the authoritative ground contact.
 * {id,species:'deciduous'|'conifer',x,y,z,height?,yaw?,seed?,collisionRadius?}
 * Root owns terrain sampling, placement exclusions and physics. Returned
 * trunkProxies are metadata only; branches/leaves are decorative and non-solid.
 * materials may supply bark/deciduous/conifer colors and borrowed bark maps.
 * Await ready before compile/capture, then update(camera, elapsedSeconds).
 */
export function createForestVegetation({ placements = [], materials = {}, lightSources = null, palette = {}, lodDistances = [0, 35, 80], cullDistance = 190, shadowDistance = 35, loadTextures = true, wind = true } = {}) {
  const creationStart = performance.now();
  if (!Array.isArray(placements) || placements.length > MAX_TREES) throw new RangeError(`Forest requires at most ${MAX_TREES} placements`);
  if (!Array.isArray(lodDistances) || lodDistances.length !== 3 || !lodDistances.every(Number.isFinite) || lodDistances[0] !== 0 || lodDistances[1] <= 0 || lodDistances[2] <= lodDistances[1]) throw new RangeError('Forest LOD distances must be [0, near, far] in ascending meters');
  if (!Number.isFinite(cullDistance) || cullDistance <= lodDistances[2] || !Number.isFinite(shadowDistance) || shadowDistance < 0) throw new RangeError('Forest distance limits must be finite and ordered');
  // Validate before acquiring any GPU resources so rejected input cannot leak.
  const checkedIds = new Set();
  for (let index = 0; index < placements.length; index++) {
    const p = placements[index], id = String(p?.id ?? `forest-${index}`);
    if (!p || !SPECIES.includes(p.species || 'deciduous') || checkedIds.has(id) || ![p.x, p.y, p.z].every(Number.isFinite)) throw new TypeError(`Invalid forest placement ${id}`);
    if ((p.height !== undefined && (!Number.isFinite(p.height) || p.height < 4 || p.height > 24)) || (p.yaw !== undefined && !Number.isFinite(p.yaw)) || (p.collisionRadius !== undefined && (!Number.isFinite(p.collisionRadius) || p.collisionRadius < .10 || p.collisionRadius > .55))) throw new RangeError(`Invalid forest dimensions ${id}`);
    checkedIds.add(id);
  }
  const root = new THREE.Group(); root.name = 'ProceduralForest';
  const resources = { materials: new Set(), geometries: new Set(), textures: new Set(), disposed: false };
  const status = [], pending = [], nativeMaterials = {}, selectedPalette = { ...DEFAULT_PALETTE, ...palette };
  const leafTime = uniform(0), lighting = Array.isArray(lightSources) ? lights(lightSources.filter(light => light?.isLight)) : null;
  const hasSpecies = new Set(placements.map(p => p.species || 'deciduous'));
  const maps = {};
  if (placements.length) {
    for (const [kind, file] of [['bark', 'bark-color.jpg'], ['normal', 'bark-normalgl.jpg'], ...SPECIES.filter(s => hasSpecies.has(s)).map(s => [s === 'deciduous' ? 'ash' : 'pine', s === 'deciduous' ? 'ash.png' : 'pine.png'])]) {
      const loaded = createTexture(kind, file, resources, loadTextures, status); maps[kind] = loaded.map; pending.push(loaded.ready);
    }
    const bark = new BlackwaterPaintedMaterial(sourceParameters(materials.bark, selectedPalette.bark));
    bark.map = materials.bark?.map || maps.bark; bark.normalMap = materials.bark?.normalMap || maps.normal; bark.normalScale.set(.5, .5);
    bark.roughnessMap = materials.bark?.roughnessMap || null;
    const barkSample = texture(bark.map).rgb.dot(vec3(.2126, .7152, .0722));
    bark.colorNode = color(bark.color).mul(float(.67).add(barkSample.mul(.85).min(.43)));
    bark.name = 'Forest:Bark'; bark.userData = { forestOwned: true, sharedLibrary: true, lookRole: 'forest-bark', approximateTextureMeters: .60 };
    if (lighting) bark.lightsNode = lighting; resources.materials.add(bark); nativeMaterials.bark = bark;
    for (const species of SPECIES.filter(s => hasSpecies.has(s))) {
      const material = new BlackwaterPaintedMaterial(sourceParameters(materials[species], selectedPalette[species]));
      material.side = THREE.DoubleSide; material.map = species === 'deciduous' ? maps.ash : maps.pine;
      material.alphaTest = species === 'deciduous' ? .42 : .32; material.transparent = false; material.depthWrite = true;
      const sample = texture(material.map), luminance = sample.rgb.dot(vec3(.2126, .7152, .0722));
      // Preserve real veins/needle texture while assigning broad graphic values.
      // Source color is not multiplied twice; imported greens were already dark.
      material.colorNode = vec4(color(material.color).mul(float(.66).add(luminance.mul(1.45).min(.48))), sample.a);
      if (wind) {
        const rooted = uv().y.pow(2), phase = leafTime.mul(1.45).add(positionLocal.x.mul(.17)).add(positionLocal.z.mul(.13)).add(positionGeometry.y.mul(11));
        // Native positionNode runs after instance matrices. Amplitudes are world
        // meters (not normalized template units); UV.y=0 roots remain exact.
        material.positionNode = positionLocal.add(vec3(phase.sin().mul(rooted).mul(.038), phase.mul(1.2).sin().mul(rooted).mul(.006), phase.mul(.83).cos().mul(rooted).mul(.026)));
      }
      material.name = `Forest:${species}`;
      material.userData = { forestOwned: true, sharedLibrary: true, lookRole: 'forest-foliage', alphaCutout: true, nativeRootedLeafWind: !!wind, branchWind: false };
      if (lighting) material.lightsNode = lighting; resources.materials.add(material); nativeMaterials[species] = material;
    }
  }
  const templates = new Map(), buckets = new Map(), trees = [], trunkProxies = [];
  for (let index = 0; index < placements.length; index++) {
    const p = placements[index], species = p.species || 'deciduous', id = String(p.id ?? `forest-${index}`);
    const seed = hash(p.seed ?? id), templateIndex = seed % 3, key = `${species}/${templateIndex}`;
    if (!templates.has(key)) templates.set(key, buildTemplate(species, templateIndex, resources));
    const template = templates.get(key), height = p.height ?? (species === 'deciduous' ? 11 : 14);
    const radius = p.collisionRadius ?? clamp(height * template.rootRadius + .055, .24, .55);
    const horizontalScale = Math.min(height, radius / template.rootRadius), yaw = p.yaw ?? (seed / 4294967296) * TAU;
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(horizontalScale, height, horizontalScale));
    const bounds = template.bounds.clone().applyMatrix4(matrix).expandByScalar(.05), center = bounds.getCenter(new THREE.Vector3()), sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const dryness = species === 'deciduous' ? (seed % 997) / 997 : .15 * ((seed % 997) / 997);
    const leafColor = new THREE.Color().setRGB(1 + dryness * .14, 1 - dryness * .045, 1 - dryness * .21, THREE.LinearSRGBColorSpace);
    const barkColor = new THREE.Color().setRGB(.91 + dryness * .09, .92 + dryness * .06, .92 + dryness * .03, THREE.LinearSRGBColorSpace);
    const tree = { id, species, seed, templateIndex, template, matrix, bounds, center, sphere, leafColor, barkColor, x: p.x, y: p.y, z: p.z, height, yaw, horizontalScale, radius, lod: -1 };
    trees.push(tree); if (!buckets.has(key)) buckets.set(key, { template, trees: [], levels: [], counts: [0, 0, 0], shadow: [false, false, false] }); buckets.get(key).trees.push(tree);
    trunkProxies.push({ id, species, shape: 'cylinder', x: p.x, y: p.y, z: p.z, radius, height, minY: p.y, maxY: p.y + height, bounds: { minX: p.x - radius, maxX: p.x + radius, minY: p.y, maxY: p.y + height, minZ: p.z - radius, maxZ: p.z + radius }, visualRootRadius: template.rootRadius * horizontalScale, decorativeBranchesNonSolid: true });
  }
  for (const bucket of buckets.values()) for (let lod = 0; lod < 3; lod++) {
    const pair = {};
    for (const part of ['branches', 'leaves']) {
      const material = part === 'branches' ? nativeMaterials.bark : nativeMaterials[bucket.template.species];
      const mesh = new THREE.InstancedMesh(bucket.template.levels[lod][part], material, bucket.trees.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      // Allocate one color buffer per pool before compilation, including empty
      // pools, so changing LOD never changes the shader's vertex contract.
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(bucket.trees.length * 3), 3).setUsage(THREE.DynamicDrawUsage);
      mesh.name = `Forest:${bucket.template.species}:${bucket.template.templateIndex}:LOD${lod}:${part}`;
      mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.castShadow = lod === 0 && shadowDistance > 0;
      mesh.userData = { forestOwned: true, part, species: bucket.template.species, lod, templateIndex: bucket.template.templateIndex, maxInstances: bucket.trees.length };
      root.add(mesh); pair[part] = mesh;
    }
    bucket.levels.push(pair);
  }
  const frustum = new THREE.Frustum(), projection = new THREE.Matrix4(), cameraPosition = new THREE.Vector3(), lastPosition = new THREE.Vector3(Infinity, Infinity, Infinity), lastQuaternion = new THREE.Quaternion();
  let lastTime = -Infinity, updateCount = 0, disposed = false, enabled = true;
  const current = { visibleTrees: 0, culledTrees: 0, draws: 0, triangles: 0, shadowDraws: 0, shadowTriangles: 0, lodTrees: [0, 0, 0] };

  function update(camera, elapsedSeconds = 0, force = false) {
    if (disposed) return;
    if (Number.isFinite(elapsedSeconds)) leafTime.value = elapsedSeconds;
    const hasCamera = !!camera?.isCamera;
    if (hasCamera) {
      camera.updateMatrixWorld(); cameraPosition.setFromMatrixPosition(camera.matrixWorld);
      if (!force && cameraPosition.distanceToSquared(lastPosition) < .25 && camera.quaternion.angleTo(lastQuaternion) < .025 && elapsedSeconds - lastTime < .16) return;
      projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projection, camera.coordinateSystem, camera.reversedDepth);
      lastPosition.copy(cameraPosition); lastQuaternion.copy(camera.quaternion); lastTime = elapsedSeconds;
    }
    current.visibleTrees = 0; current.culledTrees = 0; current.draws = 0; current.triangles = 0; current.shadowDraws = 0; current.shadowTriangles = 0; current.lodTrees.fill(0);
    for (const bucket of buckets.values()) {
      const { counts, shadow } = bucket; counts.fill(0); shadow.fill(false);
      for (const tree of bucket.trees) {
        const distance = hasCamera ? Math.hypot(tree.x - cameraPosition.x, tree.z - cameraPosition.z) : 0;
        // Keep close off-screen trees for grounded sun shadows; distant pools
        // contain only camera-visible crowns. Culling includes the full crown.
        if (!enabled || (hasCamera && (distance - tree.sphere.radius > cullDistance || (distance > lodDistances[1] && !frustum.intersectsSphere(tree.sphere))))) { tree.lod = -1; current.culledTrees++; continue; }
        let lod = distance >= lodDistances[2] ? 2 : distance >= lodDistances[1] ? 1 : 0;
        if (tree.lod >= 0 && tree.lod < 2 && distance < lodDistances[tree.lod + 1] * 1.06 && lod > tree.lod) lod = tree.lod;
        if (tree.lod > 0 && distance > lodDistances[tree.lod] * .94 && lod < tree.lod) lod = tree.lod;
        tree.lod = lod; const slot = counts[lod]++, pair = bucket.levels[lod];
        pair.branches.setMatrixAt(slot, tree.matrix); pair.leaves.setMatrixAt(slot, tree.matrix);
        pair.branches.setColorAt(slot, tree.barkColor); pair.leaves.setColorAt(slot, tree.leafColor);
        if (lod === 0 && distance <= shadowDistance) shadow[lod] = true;
        current.visibleTrees++; current.lodTrees[lod]++;
      }
      for (let lod = 0; lod < 3; lod++) for (const part of ['branches', 'leaves']) {
        const mesh = bucket.levels[lod][part]; mesh.count = counts[lod]; mesh.visible = counts[lod] > 0; mesh.castShadow = shadow[lod];
        if (mesh.visible) {
          mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
          const triangles = geometryTriangles(mesh.geometry) * mesh.count; current.draws++; current.triangles += triangles;
          if (mesh.castShadow) { current.shadowDraws++; current.shadowTriangles += triangles; }
        }
      }
    }
    updateCount++;
  }
  update(null, 0, true);
  const creationMs = performance.now() - creationStart;
  const ready = Promise.all(pending).then(records => ({ loaded: records.filter(r => r.state === 'loaded').length, fallback: records.filter(r => r.state.startsWith('fallback')).length, disposed: resources.disposed, records }));
  return {
    root, ready, trunkProxies, update,
    bounds: trees.map(tree => ({ id: tree.id, species: tree.species, min: tree.bounds.min.toArray(), max: tree.bounds.max.toArray(), ground: [tree.x, tree.y, tree.z], templateSeed: tree.template.seed, height: tree.height })),
    setVisible(value) { if (disposed) return; enabled = !!value; root.visible = enabled; lastPosition.set(Infinity, Infinity, Infinity); lastTime = -Infinity; update(null, leafTime.value, true); },
    diagnostics() {
      const geometryBytes = [...resources.geometries].reduce((bytes, geometry) => bytes + geometry.index.array.byteLength + Object.values(geometry.attributes).reduce((sum, attribute) => sum + attribute.array.byteLength, 0), 0);
      const instanceBytes = root.children.reduce((bytes, mesh) => bytes + mesh.instanceMatrix.array.byteLength + mesh.instanceColor.array.byteLength, 0);
      return { source: 'EZ-Tree 1.1.0 MIT / dcf309bd86bd521083d9c70f01f2de45fdc7c457', placements: trees.length, maxPlacements: MAX_TREES, templates: templates.size, geometries: resources.geometries.size, materials: resources.materials.size, textures: resources.textures.size, pooledMeshes: root.children.length, maxDraws: templates.size * 6, ...current, lodTrees: [...current.lodTrees], lodDistances: [...lodDistances], cullDistance, shadowDistance, shadowScope: 'near pools only; a pool containing a nearby shadow caster also casts its other near trees', triangleCostPerTree: [...templates.values()].map(t => ({ species: t.species, templateIndex: t.templateIndex, seed: t.seed, branches: t.branches, leafClusters: t.leaves, lod: t.levels.map(pair => geometryTriangles(pair.branches) + geometryTriangles(pair.leaves)), removedCollapsedTriangles: t.removedTriangles })), textureStatus: status.map(record => ({ ...record })), textureBytesUpperBound: resources.textures.size * 1024 * 1024 * 4 * 4 / 3, geometryBytes, instanceBytes, creationMs, approximateBarkTileMeters: .60, wind: wind ? 'native TSL; leaf tips<=4.7cm displacement, exact UV roots; branches static' : 'static', updateCount, disposed, nativeMaterials: true, noNetworkRuntimeExceptBundledLocalImages: true, borrowedMaterialsMutated: false };
    },
    dispose() {
      if (disposed) return; disposed = true; resources.disposed = true;
      root.removeFromParent(); for (const mesh of root.children) mesh.dispose(); root.clear();
      for (const geometry of resources.geometries) geometry.dispose();
      for (const material of resources.materials) material.dispose();
      for (const map of resources.textures) map.dispose();
    },
  };
}
