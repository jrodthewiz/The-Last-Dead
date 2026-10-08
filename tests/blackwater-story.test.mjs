import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createModel, architectureColliders } from '../assets/blackwater-kit/architecture.js';
import { createBlackwaterMaterials } from '../assets/blackwater-kit/materials.js';
import { buildBlackwaterInteriorStory, buildBlackwaterHouseStory } from '../assets/blackwater-kit/interior-story.js';
import { createHouseFurniturePlan } from '../assets/blackwater-kit/house-interior.js';

const house = { id: 'family', kind: 'house', label: '18 MAIN STREET', width: 16, depth: 16, height: 6.4, seed: 1410, enterable: true, doorOffset: -2, x: 192, y: .13, z: 72, yaw: Math.PI };
const shop = { id: 'pharmacy', kind: 'shop', label: 'BELL PHARMACY', width: 16, depth: 12, height: 11, seed: 1405, enterable: true, doorOffset: 2, x: 200, y: .13, z: 42 };

function fixture() {
  const materials = createBlackwaterMaterials(), parent = new THREE.Group();
  const story = buildBlackwaterInteriorStory(parent, { buildings: [shop, house] }, materials);
  return { materials, parent, story, dispose() { story.dispose(); materials.dispose(); } };
}

test('story geometry remains finite, nondegenerate and within the bounded iteration budget', () => {
  const f = fixture();
  try {
    // Inspection03 baseline: 9 draws, 3,472 triangles. This iteration is allowed
    // five extra material batches and 5,000 triangles for both interiors.
    assert.ok(f.story.diagnostics.drawCalls <= 14);
    assert.ok(f.story.diagnostics.triangles <= 8472);
    assert.equal(f.story.diagnostics.colliderCount, 0);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    let measured = 0;
    f.story.root.traverse(mesh => {
      if (!mesh.isMesh) return;
      const g = mesh.geometry, p = g.attributes.position, index = g.index;
      for (const name of ['position', 'normal', 'uv']) assert.ok(g.attributes[name].array.every(Number.isFinite), `${mesh.name}: finite ${name}`);
      for (let i = 0; i < index.count; i += 3) {
        a.fromBufferAttribute(p, index.getX(i)); b.fromBufferAttribute(p, index.getX(i + 1)); c.fromBufferAttribute(p, index.getX(i + 2));
        assert.ok(b.sub(a).cross(c.sub(a)).lengthSq() > 1e-16, `${mesh.name}: nondegenerate triangle ${i / 3}`);
      }
      measured += index.count / 3;
    });
    assert.equal(measured, f.story.diagnostics.triangles);
  } finally { f.dispose(); }
});

test('standing family evidence stays inside authoritative furniture and both walking portals remain clear', () => {
  const f = fixture(), furniture = new Map(createHouseFurniturePlan(house, 2.475).map(item => [item.id, item]));
  try {
    const placements = f.story.diagnostics.placements.filter(p => p.building === house.id);
    for (const p of placements) {
      const { min, max } = p.bounds;
      assert.ok(min[1] >= .07 - 1e-5 && max[1] < 2.475, `${p.role}: inside floor/ceiling`);
      if (p.footprint) {
        const item = furniture.get(p.footprint); assert.ok(item, `${p.role}: known furniture owner`);
        for (const axis of [0, 2]) {
          const half = item.collisionSize[axis] / 2;
          assert.ok(min[axis] >= item.position[axis] - half - 1e-5, `${p.role}: minimum axis ${axis}`);
          assert.ok(max[axis] <= item.position[axis] + half + 1e-5, `${p.role}: maximum axis ${axis}`);
        }
      } else {
        const flatFloor = max[1] < .10, flatPartition = min[2] > .085 && max[2] < .18;
        assert.ok(flatFloor || flatPartition, `${p.role}: unowned decoration is a flat supported detail`);
      }
      if (min[0] < 0 && max[0] > -4) assert.ok(max[1] < .10, `${p.role}: four-metre corridor only receives flat floor evidence`);
    }
    // Raycast the actual merged world-space meshes, rather than relying only
    // on placement labels. These rays traverse the entire front/rear route.
    f.story.root.updateMatrixWorld(true);
    for (const x of [192.7, 194, 195.3]) for (const y of [.6, 1.4, 2.1]) for (const direction of [-1, 1]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(x, y + house.y, direction > 0 ? 62 : 82), new THREE.Vector3(0, 0, direction), 0, 20);
      assert.equal(ray.intersectObject(f.story.root, true).length, 0, `walk route x${x}/y${y}/direction${direction}`);
    }
  } finally { f.dispose(); }
});

test('bag, carton, maps, keys and frame contact the actual independently built furniture surfaces', () => {
  const f = fixture(), model = createModel({ ...house, materials: f.materials });
  const supportedRoles = new Set(['opened-evacuation-duffel-shell', 'packed-family-photo-carton', 'open-coffee-table-evacuation-map', 'folded-home-evacuation-map', 'left-behind-house-key-ring', 'left-behind-house-key', 'packed-family-photo-frame', 'interrupted-family-dinner-plate', 'overturned-dinner-mug']);
  try {
    model.root.updateMatrixWorld(true);
    const placements = f.story.diagnostics.placements.filter(p => p.building === house.id);
    for (const p of placements) if (supportedRoles.has(p.role) || /floor-trace|dropped-family|dropped-departure/.test(p.role)) {
      const { min, max } = p.bounds, x = (min[0] + max[0]) / 2, z = (min[2] + max[2]) / 2;
      const ray = new THREE.Raycaster(new THREE.Vector3(x, min[1] + .025, z), new THREE.Vector3(0, -1, 0), 0, .08);
      const hit = ray.intersectObject(model.root, true)[0];
      assert.ok(hit, `${p.role}: visible physical support within eight centimetres`);
      const gap = min[1] - hit.point.y;
      assert.ok(gap >= -.002 && gap <= .025, `${p.role}: support gap ${gap} m`);
    }
    for (const p of placements.filter(p => /fridge-pinned|fridge-family/.test(p.role))) {
      const ray = new THREE.Raycaster(new THREE.Vector3(6.10, p.position[1], p.position[2]), new THREE.Vector3(1, 0, 0), 0, .20);
      const hit = ray.intersectObject(model.root, true)[0]; assert.ok(hit, 'paper is mounted on the camera-facing refrigerator flank');
      const gap = hit.point.x - p.bounds.max[0];
      assert.ok(gap >= -.001 && gap < .012, `fridge paper contact gap ${gap} m`);
    }
  } finally { model.dispose(); f.dispose(); }
});

test('pharmacy packing evidence retains its three original solid footprints and door-to-cache sightline', () => {
  const f = fixture(), furniture = new Map(architectureColliders(shop).map(item => [item.id,item]));
  try {
    for (const p of f.story.diagnostics.placements.filter(p => p.building === shop.id && p.footprint)) {
      const item = furniture.get(p.footprint); assert.ok(item, `${p.role}: authoritative pharmacy footprint`);
      for (const axis of [0,2]) {
        assert.ok(p.bounds.min[axis] >= item.position[axis] - item.halfExtents[axis] - 1e-5, `${p.role}: minimum axis ${axis}`);
        assert.ok(p.bounds.max[axis] <= item.position[axis] + item.halfExtents[axis] + 1e-5, `${p.role}: maximum axis ${axis}`);
      }
    }
    f.story.root.updateMatrixWorld(true);
    for (const x of [200.35,202,203.65]) for (const y of [.6,1.4,2.2]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(x,y+shop.y,50),new THREE.Vector3(0,0,-1),0,11);
      assert.equal(ray.intersectObject(f.story.root,true).length,0,`pharmacy door-to-cache ${x}/${y}`);
    }
  } finally { f.dispose(); }
});

test('one owned printed atlas is shared across rooms and released once, while district materials survive', () => {
  const materials = createBlackwaterMaterials(), parent = new THREE.Group(), originalDocument = globalThis.document;
  const draw = () => {}, context = { fillRect: draw, fillText: draw, beginPath: draw, moveTo: draw, lineTo: draw, stroke: draw, arc: draw, fill: draw };
  let story;
  try {
    // Texture ownership can be exercised in Node without a browser canvas or
    // graphics context. The actual browser screenshot validates printed pixels.
    globalThis.document = { createElement: name => { assert.equal(name, 'canvas'); return { getContext: () => context, width: 0, height: 0 }; } };
    story = buildBlackwaterInteriorStory(parent, { buildings: [shop, house] }, materials);
  } finally { if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument; }
  const atlasMesh = story.root.children.find(mesh => mesh.material.userData.lookRole === 'sign');
  assert.ok(atlasMesh); const atlas = atlasMesh.material;
  assert.equal(story.root.children.filter(mesh => mesh.material === atlas).length, 1, 'all printed pieces share one draw');
  assert.equal(atlas.map.image.width, 1024); assert.equal(atlas.map.image.height, 1024);
  assert.equal(atlas.map.colorSpace, THREE.SRGBColorSpace);
  const uv = atlasMesh.geometry.attributes.uv; assert.ok(uv.array.every(v => v > 0 && v < 1), 'atlas sampling stays away from outer edges');
  let materialReleases = 0, textureReleases = 0, geometryReleases = 0, borrowedReleases = 0;
  atlas.addEventListener('dispose', () => materialReleases++); atlas.map.addEventListener('dispose', () => textureReleases++);
  for (const material of Object.values(materials)) material.addEventListener('dispose', () => borrowedReleases++);
  story.root.traverse(mesh => { if (mesh.isMesh) mesh.geometry.addEventListener('dispose', () => geometryReleases++); });
  story.dispose(); story.dispose();
  assert.equal(parent.children.length, 0); assert.equal(materialReleases, 1); assert.equal(textureReleases, 1);
  assert.equal(geometryReleases, story.diagnostics.drawCalls); assert.equal(borrowedReleases, 0);
  materials.dispose(); assert.equal(borrowedReleases, Object.keys(materials).length);
});

test('house-only story factory owns its atlas and shows an actual open cavity with clothing above the lip', () => {
  const materials = createBlackwaterMaterials(), parent = new THREE.Group();
  const story = buildBlackwaterHouseStory(parent, { ...house, x: 0, y: 0, z: 0, yaw: 0 }, materials);
  try {
    story.root.updateMatrixWorld(true);
    // A downward ray into the unfilled end of the open bag reaches its inner
    // bottom rather than a sphere or closed lid; packed clothing rises above it.
    const ray = new THREE.Raycaster(new THREE.Vector3(3.94, 1.4, 3.15), new THREE.Vector3(0, -1, 0), 0, 1);
    const hit = ray.intersectObject(story.root, true)[0];
    assert.ok(hit); assert.equal(hit.object.material, materials.fabric); assert.ok(hit.point.y < .80, `open cavity bottom ${hit.point.y}`);
    const garmentRay = new THREE.Raycaster(new THREE.Vector3(3.69, 1.7, 3.16), new THREE.Vector3(0, -1, 0), 0, 1);
    const garment = garmentRay.intersectObject(story.root, true)[0]; assert.equal(garment.object.material, materials.medicalRed); assert.ok(garment.point.y > .98);
    assert.equal(story.root.children.filter(mesh => mesh.material.userData.lookRole === 'sign').length, 1);
  } finally { story.dispose(); story.dispose(); materials.dispose(); }
});
