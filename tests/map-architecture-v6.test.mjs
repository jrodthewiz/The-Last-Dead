import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { makeDungeonCourse, setDungeonOpeningOpen } from '../playground/map/dungeon-course.js';
import { roomContainsCell } from '../playground/map/dungeon-compiler.js';
import { buildDungeonPlaceKit, planDungeonPlaceKit } from '../dungeon-place-kit.js';

const STYLE_BY_FLOOR = ['foundry', 'surgical', 'crypt', 'choir', null];

function materialFixture() {
  // One borrowed texture/material is enough to exercise cloning and texture
  // reuse without loading any of the browser's authored material assets.
  const texture = new THREE.Texture();
  const source = new THREE.MeshStandardMaterial({ color: 0x888888, map: texture });
  return { texture, source, materials: { wall: source, wornSteel: source, glass: source, wallDeep: source } };
}

function buildKit(course, fixture) {
  const root = new THREE.Group();
  const group = buildDungeonPlaceKit(root, fixture.materials, course);
  assert.equal(root.children.length, 1);
  assert.equal(root.children[0], group);
  return group;
}

function physicalEnds(beam) {
  const low = Math.floor(beam.longX ? beam.z0 : beam.x0);
  const high = Math.ceil(beam.longX ? beam.z1 : beam.x1);
  return [low, high].map(cross => ({
    horizontal: beam.longX,
    x: beam.longX ? beam.at : cross,
    z: beam.longX ? cross : beam.at,
  }));
}

test('architectural bay plans serialize deterministically and survive live doorway changes on every floor', () => {
  for (let index = 0; index < 5; index++) {
    const course = makeDungeonCourse(index), plan = planDungeonPlaceKit(course);
    const encoded = JSON.stringify(plan);
    assert.deepEqual(JSON.parse(encoded), plan, `${course.id}: plan is plain serializable data`);
    assert.equal(JSON.stringify(planDungeonPlaceKit(course)), encoded, `${course.id}: repeat planning is deterministic`);
    for (const opening of course.openings) setDungeonOpeningOpen(course, opening.id, true);
    assert.equal(JSON.stringify(planDungeonPlaceKit(course)), encoded,
      `${course.id}: opening doors cannot move permanent architectural supports`);
    for (const opening of course.openings) setDungeonOpeningOpen(course, opening.id, false);
    assert.equal(JSON.stringify(planDungeonPlaceKit(course)), encoded,
      `${course.id}: closed doorway panels cannot become permanent supports`);
    assert.ok(plan.ceilings.length > 0, `${course.id}: existing roof coverage stays present`);
    if (index === 4) {
      assert.deepEqual(plan.beams, [], 'the final floor retains its bespoke route-scale ribs');
      assert.deepEqual(plan.walls, []);
      assert.deepEqual(plan.rooms, []);
    } else {
      assert.ok(plan.beams.length > 0, `${course.id}: authored rooms receive structural bays`);
      assert.ok(plan.beams.every(beam => beam.style === STYLE_BY_FLOOR[index]));
    }
  }
});

test('each bay spans one contiguous room-footprint run and anchors both ends to physical permanent walls', () => {
  let checked = 0, exteriorOwnedEnds = 0;
  for (let index = 0; index < 4; index++) {
    const course = makeDungeonCourse(index);
    for (const beam of planDungeonPlaceKit(course).beams) {
      const room = course.rooms.find(candidate => candidate.id === beam.roomId);
      assert.ok(room, `${beam.roomId}: bay has a real owning room`);
      assert.equal(beam.longX ? beam.x0 : beam.z0, beam.at);
      assert.equal(beam.longX ? beam.x1 : beam.z1, beam.at);
      const low = Math.floor(beam.longX ? beam.z0 : beam.x0);
      const high = Math.ceil(beam.longX ? beam.z1 : beam.x1);
      assert.ok(high - low >= 2, `${beam.roomId}: bay has enough room to read as a span`);
      const point = cross => beam.longX ? [beam.at, cross] : [cross, beam.at];
      for (let cross = low + .125; cross < high; cross += .125) {
        assert.ok(roomContainsCell(room, ...point(cross)),
          `${beam.roomId}: bay crosses clipped or disconnected footprint at ${cross}`);
      }
      assert.equal(roomContainsCell(room, ...point(low - .5)), false,
        `${beam.roomId}: low end must reach its footprint edge`);
      assert.equal(roomContainsCell(room, ...point(high + .5)), false,
        `${beam.roomId}: high end must reach its footprint edge`);
      for (const endpoint of physicalEnds(beam)) {
        const wall = course.permanentWalls.find(candidate => candidate.horizontal === endpoint.horizontal
          && candidate.x === endpoint.x && candidate.z === endpoint.z);
        assert.ok(wall, `${beam.roomId}: endpoint ${endpoint.x},${endpoint.z} floats in an opening`);
        if (!roomContainsCell(room, wall.cx, wall.cy)) exteriorOwnedEnds++;
        for (const opening of course.openings) {
          const overlaps = opening.axis === (endpoint.horizontal ? 'h' : 'v')
            && opening.at === (endpoint.horizontal ? endpoint.z : endpoint.x)
            && (endpoint.horizontal ? endpoint.x : endpoint.z) > opening.span[0]
            && (endpoint.horizontal ? endpoint.x : endpoint.z) < opening.span[1] + 1;
          assert.equal(overlaps, false, `${beam.roomId}: support occupies ${opening.id}`);
        }
      }
      checked++;
    }
  }
  assert.ok(checked >= 12, 'exercise varied cross-sections across all four architectural styles');
  assert.ok(exteriorOwnedEnds > 0, 'exercise physical edges whose deduplicated owner is outside the room');
});

test('crypt and choir vaults share an instanced rib geometry and keep every transformed rib above 3.6 metres', () => {
  const fixture = materialFixture(), matrix = new THREE.Matrix4();
  let sharedGeometry = null;
  for (const index of [2, 3]) {
    const course = makeDungeonCourse(index), group = buildKit(course, fixture);
    const planned = group.userData.plan.beams.length;
    const ribs = group.children.filter(mesh => mesh.name.endsWith('_rib'));
    assert.equal(ribs.length, index === 2 ? 1 : 2, `${course.id}: bounded rib batches`);
    assert.equal(ribs.reduce((sum, mesh) => sum + mesh.count, 0), planned * (index === 2 ? 1 : 2),
      `${course.id}: each bay produces exactly its authored rib layers`);
    for (const mesh of ribs) {
      assert.ok(mesh.isInstancedMesh);
      sharedGeometry ??= mesh.geometry;
      assert.equal(mesh.geometry, sharedGeometry, 'stone and bronze vaults reuse one shared mesh asset');
      assert.equal(mesh.geometry.userData.sharedAsset, true);
      mesh.geometry.computeBoundingBox();
      for (let instance = 0; instance < mesh.count; instance++) {
        mesh.getMatrixAt(instance, matrix);
        assert.ok(matrix.elements.every(Number.isFinite), `${mesh.name}: finite instance transform`);
        const bounds = mesh.geometry.boundingBox.clone().applyMatrix4(matrix);
        assert.ok(bounds.min.y > 3.6, `${mesh.name}:${instance}: rib obstructs the eye/body corridor at ${bounds.min.y}`);
        assert.ok(bounds.max.y < 6.3, `${mesh.name}:${instance}: crown protrudes through the existing roof`);
      }
    }
    const ceilings = group.getObjectByName('DungeonPlace_ceiling_box');
    assert.equal(ceilings.count, group.userData.plan.ceilings.length);
  }
});

test('architectural bays stay within shared instancing budgets and create no light or texture objects', () => {
  const fixture = materialFixture();
  // Counts describe the intended structural recipe: existing wall dressings,
  // complete bay assemblies, and one roof panel per planned ceiling cell.
  const instancesPerWall = [7, 16, 9, 7, 0];
  const instancesPerBay = [6, 7, 5, 6, 0];
  const allowedAddedNames = [
    ['DungeonPlace_trim_box'],
    [],
    ['DungeonPlace_bone_rib'],
    ['DungeonPlace_frame_box', 'DungeonPlace_trim_box', 'DungeonPlace_frame_rib', 'DungeonPlace_trim_rib'],
    [],
  ];
  for (let index = 0; index < 5; index++) {
    const course = makeDungeonCourse(index), group = buildKit(course, fixture), plan = group.userData.plan;
    // Suppress bay-eligible room roles to measure shape-batch additions against
    // wall/ceiling-only dressing. Existing style and permanent wall edges remain.
    const wallOnly = { ...course, rooms: course.rooms.map(room => ({ ...room,
      kind: ['secret', 'exit'].includes(room.kind) ? room.kind : 'ward' })) };
    const base = buildKit(wallOnly, fixture), existingNames = new Set(base.children.map(mesh => mesh.name));
    const added = group.children.filter(mesh => !existingNames.has(mesh.name));
    assert.deepEqual(added.map(mesh => mesh.name).sort(), [...allowedAddedNames[index]].sort(),
      `${course.id}: complete bay assemblies add only the bounded shared shape batches`);
    assert.ok(group.children.every(mesh => mesh.isInstancedMesh), `${course.id}: architecture stays batched`);
    assert.equal(group.children.reduce((sum, mesh) => sum + mesh.count, 0),
      plan.walls.length * instancesPerWall[index] + plan.beams.length * instancesPerBay[index] + plan.ceilings.length,
      `${course.id}: mesh instance counts must match complete planned assemblies`);
    assert.equal(group.userData.wallPanels, plan.walls.length);
    assert.equal(group.userData.overheadBeams, plan.beams.length);
    assert.equal(group.userData.vaultRibs, index === 2 || index === 3 ? plan.beams.length : 0);
    for (const built of [group, base]) built.traverse(object => {
      assert.equal(Boolean(object.isLight), false, `${course.id}: no extra lighting cost`);
      if (!object.isMesh) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        for (const value of Object.values(material)) if (value?.isTexture) {
          assert.equal(value, fixture.texture, `${course.id}: reuse borrowed textures`);
        }
      }
    });
    if (index === 4) {
      assert.equal(group.children.length, 1, 'the final-floor place kit keeps only existing ceiling coverage');
      assert.equal(group.children[0].name, 'DungeonPlace_ceiling_box');
    }
  }
  assert.equal(fixture.source.color.getHex(), 0x888888, 'palette clones cannot recolor a borrowed source material');
});
