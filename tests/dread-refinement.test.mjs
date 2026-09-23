import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { makeDungeonCourse } from '../playground/map/dungeon-course.js';
import { buildAuthoredWorld } from '../world-authored.js';
import { buildHorrorDetails } from '../world-horror.js';
import { buildSetDressingProp, setDressingMaterials } from '../world-setdressing.js';

const MATERIALS = [
  'black', 'metalDark', 'weaponDark', 'steel', 'metal', 'rust', 'red', 'enemyRed',
  'orange', 'gold', 'glass', 'cyan', 'gore', 'enemyArmor', 'bone', 'flesh', 'iron',
  'violet', 'enemyViolet', 'wall', 'wallDeep', 'floorTrim',
];

function materials() {
  return Object.fromEntries(MATERIALS.map(name => [name, new THREE.MeshStandardMaterial({ color: 0x777777 })]));
}

function triangles(geometry) {
  return Math.round((geometry?.index?.count || geometry?.attributes?.position?.count || 0) / 3);
}

function totalTriangles(root) {
  let total = 0;
  root.traverse(node => { if (node.isMesh) total += triangles(node.geometry) * (node.count || 1); });
  return total;
}

test('Story tunnel ribs use segmented load-bearing profiles inside the former rib budget', () => {
  const course = makeDungeonCourse(2);
  const world = new THREE.Group();
  buildAuthoredWorld(world, materials(), course);
  const ribs = [];
  world.traverse(node => { if (node.isMesh && node.name.startsWith('TunnelRib_')) ribs.push(node); });
  assert.ok(ribs.length > 0);
  assert.ok(ribs.every(rib => rib.geometry.type === 'ExtrudeGeometry'));
  assert.ok(ribs.every(rib => rib.geometry.userData.archProfile === 'segmented-load-rib-v2'));
  assert.ok(ribs.every(rib => triangles(rib.geometry) <= 384), 'profiled ribs stay below the old torus geometry budget');
});

test('ossuary detail removes bead-like relics while keeping one merged low-cost draw per role', () => {
  const course = makeDungeonCourse(2);
  const root = new THREE.Group();
  const detail = buildHorrorDetails(root, materials(), course).detailKit;
  const colonnade = detail.getObjectByName('HorrorKit_furniture-colonnade');
  const relic = detail.getObjectByName('HorrorKit_relic-skull-niche');
  const glow = detail.getObjectByName('HorrorKit_relic-glow-skull-niche');
  assert.equal(colonnade.geometry.userData.decorRevision, 'ossuary-load-rib-v2');
  assert.equal(relic.geometry.userData.decorRevision, 'ossuary-mortuary-niche-v2');
  assert.ok(triangles(colonnade.geometry) <= 1712, 'rib buttress stays within the old colonnade geometry budget');
  assert.ok(triangles(relic.geometry) <= 516, 'mortuary niche stays within the old plaque geometry budget');
  assert.ok(triangles(glow.geometry) <= 192, 'niche signal stays within the old glow geometry budget');
  assert.equal(detail.children.filter(node => node.isInstancedMesh && /colonnade|skull-niche/.test(node.name)).length, 3);
});

test('campaign ossuary rubble keeps the landmark cue with a restrained finite silhouette', () => {
  const prop = buildSetDressingProp('skullMound', setDressingMaterials({}, 'ossuary'), 7);
  assert.equal(prop.userData.decorRevision, 'ossuary-rubble-remains-v2');
  assert.ok(totalTriangles(prop) <= 2400, 'rubble remains below the replacement budget');
  const bounds = new THREE.Box3().setFromObject(prop);
  assert.ok(bounds.min.y > -.4 && bounds.max.y > .9);
});
