import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { makeCampaignCourse, newRun } from '../engine.js';
import { buildSetDressing, buildSetDressingProp, setDressingMaterials, SETDRESSING_SPECS } from '../world-setdressing.js';
import { buildLifeField } from '../world-polish.js';

const SECTORS = ['bloodworks', 'ossuary', 'choir'];
const EXPECTED = [
  { specimenVat: 5, gurney: 5, crateStack: 6 },
  { skullMound: 5, coffinStack: 4, candleAltar: 3 },
  { fallenBell: 3, choirStall: 7 },
];

test('every set-dressing spec builds a grounded, batchable, finite prop', () => {
  for (const [kind, spec] of Object.entries(SETDRESSING_SPECS)) {
    const prop = buildSetDressingProp(kind, setDressingMaterials({}, spec.sector), 7);
    assert.ok(prop, kind + ' has a factory');
    assert.ok(spec.parts.length >= 4, kind + ' names its parts');
    const bounds = new THREE.Box3().setFromObject(prop);
    assert.ok(bounds.min.y > -.4 && bounds.min.y < .05, kind + ' rests on the floor (' + bounds.min.y + ')');
    assert.ok(bounds.max.y > .9, kind + ' is tall enough to read at speed');
    prop.traverse(mesh => {
      if (!mesh.isMesh) return;
      for (const name of ['position', 'normal', 'uv']) assert.ok(mesh.geometry.attributes[name], mesh.name + ' keeps ' + name + ' for batching');
      assert.ok(mesh.geometry.attributes.position.array.every(Number.isFinite), mesh.name + ' is finite');
    });
  }
});

test('campaign sectors place their own props clear of spawn and combat lanes', () => {
  SECTORS.forEach((sector, index) => {
    // newRun installs the room gates and renderCells used by the browser.
    const course = newRun(makeCampaignCourse(index), { requireEntry: true }).course;
    const group = buildSetDressing(new THREE.Group(), {}, course);
    const counts = Object.fromEntries(Object.keys(EXPECTED[index]).map(kind => [kind, group.children.filter(prop => prop.userData.setDressing === kind).length]));
    assert.deepEqual(counts, EXPECTED[index], sector + ' places every planned prop family in the live map');
    const field = buildLifeField(course);
    const spawn = { x: course.playerSpawn.x * 4, z: course.playerSpawn.y * 4 };
    for (const prop of group.children) {
      const spec = SETDRESSING_SPECS[prop.userData.setDressing];
      assert.equal(spec.sector, sector, prop.name + ' belongs to ' + sector);
      assert.ok(Math.hypot(prop.position.x - spawn.x, prop.position.z - spawn.z) > 3.5, prop.name + ' clears the spawn');
      assert.ok(field.accepts(prop.position.x, prop.position.z, spec.radius * .8, 'ground'), prop.name + ' clears lanes and walls');
    }
  });
  const story = buildSetDressing(new THREE.Group(), {}, { dungeon: true });
  assert.equal(story.children.length, 0, 'story floors keep their own authored dressing');
});
