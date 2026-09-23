import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { makeDungeonCourse } from '../playground/map/dungeon-course.js';
import { createCampaignCourse } from '../campaign.js';
import { afterlifeMapDesignDiagnostics, buildAfterlifeMapDesign } from '../world-afterlife-design.js';

function materials() {
  const make = () => new THREE.MeshStandardMaterial({ color: 0x5d6868, roughness: .8, metalness: .2 });
  return {
    floorTrim: make(), metalDark: make(), black: make(), rust: make(), bone: make(),
  };
}

function topology(course) {
  return JSON.stringify({ cells: course.cells, walls: course.walls, blocks: course.blocks });
}

test('the map composition pass stays bounded and leaves every course topology intact', () => {
  const courses = [
    ...[0, 1, 2, 3, 4].map(makeDungeonCourse),
    ...[0, 1, 2].map(createCampaignCourse),
  ];
  for (const course of courses) {
    const before = topology(course);
    const root = new THREE.Group();
    const result = buildAfterlifeMapDesign(root, materials(), course);
    assert.equal(topology(course), before, course.id + ': composition must not mutate collision topology');
    assert.equal(result.diagnostics.collisionChanged, false, course.id + ': map layer reports visual-only ownership');
    assert.ok(result.diagnostics.draws <= 6, course.id + ': visible map design should stay under six instanced draws');
    assert.ok(result.diagnostics.triangles <= 25000, course.id + ': map design should stay under the lightweight triangle budget');
    assert.ok(result.diagnostics.sightlineBreaks >= 1, course.id + ': map design needs a grounded sightline break');
    assert.ok(result.diagnostics.upperSilhouettePieces >= 1, course.id + ': route should gain an upper silhouette cue');
    assert.equal(afterlifeMapDesignDiagnostics(result.root).courseId, course.id);
    result.dispose();
    assert.equal(root.children.length, 0, course.id + ': map design disposal removes its owned root');
  }
});

test('map-design prop slots accept low-detail external models without changing the draw budget contract', () => {
  const course = makeDungeonCourse(2);
  const calls = [];
  const result = buildAfterlifeMapDesign(new THREE.Group(), materials(), course, {
    propFactories: {
      wheelchair: ({ slot }) => { calls.push(slot.id); return new THREE.Group(); },
      'mourning-cabinet': ({ slot }) => { calls.push(slot.id); return new THREE.Group(); },
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(result.diagnostics.externalPropsAttached.length, 2);
  assert.equal(result.diagnostics.propsFallback, 0);
  assert.deepEqual(result.diagnostics.externalPropErrors, []);
  const wheelchair = result.diagnostics.propSlots.find(slot => slot.kind === 'wheelchair');
  assert.equal(wheelchair.lightingPool, true, 'wheelchair should sit in the first authored entry light pool');
  assert.equal(wheelchair.anchor, 'entry');
  assert.equal(wheelchair.pillarClearance, true, 'wheelchair should clear the first entry tunnel jamb');
  assert.equal(wheelchair.clearanceFrom, 'f3-sp-entry-bone-gate');
  const firstLight = course.lights.find(light => /entry|spawn/i.test(String(light.role))) || course.lights[0];
  const lightX = firstLight.anchor[0] * 4;
  const lightZ = firstLight.anchor[1] * 4;
  assert.ok(Math.hypot(wheelchair.position[0] - lightX, wheelchair.position[2] - lightZ) < 4.5, 'wheelchair should remain inside the first light envelope');
  result.dispose();
});

test('story composition uses one grounded edge divider and a lateral ceiling silhouette', () => {
  const course = makeDungeonCourse(2);
  const result = buildAfterlifeMapDesign(new THREE.Group(), materials(), course, {
    propFactories: {
      wheelchair: () => new THREE.Group(),
      'mourning-cabinet': () => new THREE.Group(),
    },
  });
  const { diagnostics } = result;
  assert.equal(diagnostics.composition.mode, 'story-edge-divider');
  assert.equal(diagnostics.sightlineBreaks, 1);
  assert.equal(diagnostics.upperSilhouettePieces, 1);
  assert.ok(diagnostics.composition.divider.anchor[1] > 0, 'divider must be grounded from the floor');
  assert.ok(Math.abs(diagnostics.composition.divider.anchor[0] - diagnostics.composition.divider.openingCenter[0]) > 6, 'divider must sit at an opening edge');
  assert.ok(diagnostics.composition.silhouette.anchor[1] > 5, 'silhouette must remain high');
  assert.ok(Math.abs(diagnostics.composition.silhouette.anchor[0] - diagnostics.composition.divider.anchor[0]) > 20, 'silhouette should create a second lateral read');
  result.dispose();
});
