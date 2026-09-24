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
  const sourceMaterials = materials();
  const wornMap = new THREE.Texture();
  wornMap.userData.sharedAsset = true;
  sourceMaterials.steel.map = wornMap;
  const world = new THREE.Group();
  buildAuthoredWorld(world, sourceMaterials, course);
  const ribs = [];
  world.traverse(node => { if (node.isMesh && node.name.startsWith('TunnelRib_')) ribs.push(node); });
  assert.ok(ribs.length > 0);
  assert.ok(ribs.every(rib => rib.geometry.type === 'ExtrudeGeometry'));
  assert.ok(ribs.every(rib => rib.geometry.userData.archProfile === 'segmented-load-rib-v2'));
  assert.ok(ribs.every(rib => triangles(rib.geometry) <= 384), 'profiled ribs stay below the old torus geometry budget');
  assert.ok(ribs.every(rib => rib.userData.afterlifeSurfaceRole === 'roomTrim'), 'ossuary ribs use the shared worn service finish role');
  assert.ok(ribs.every(rib => rib.material === sourceMaterials.steel), 'ossuary ribs retain the shared source so a late worn-steel map can sync');
  assert.ok(ribs.every(rib => rib.material.map === wornMap), 'ossuary ribs retain the shared worn-steel map');
});

test('ossuary entry removes the diagonal overhead conduit and isolated rib-stack skull beads', () => {
  const course = makeDungeonCourse(2);
  const world = new THREE.Group();
  buildAuthoredWorld(world, materials(), course);
  const ribStacks = [];
  const beads = [];
  world.traverse(node => {
    if (node.isGroup && /^StoryLandmark_f3-/.test(node.name || '') && /rib-stack$/i.test(node.userData?.modelId || '')) ribStacks.push(node);
    if (node.isMesh && /^RibStackSkull_/.test(node.name || '')) beads.push(node);
  });
  assert.ok(ribStacks.length >= 2, 'the ossuary still keeps structural rib-stack landmarks');
  assert.equal(beads.length, 0, 'isolated faceted skull beads are removed from the visible rib stacks');
  assert.ok(ribStacks.every(stack => stack.userData.decorRevision === 'ossuary-rib-stack-structure-v3'));

  const entry = world.getObjectByName('AuthoredSetpiece_f3-sp-entry-bone-gate');
  const signalTubes = [];
  entry?.traverse(node => {
    if (node.isMesh && node.geometry?.type === 'TubeGeometry') signalTubes.push(node);
  });
  assert.equal(signalTubes.length, 0, 'the entry arch has no bright unsupported diagonal signal rod');
});

test('ossuary detail removes bead-like relics while keeping one merged low-cost draw per role', () => {
  const course = makeDungeonCourse(2);
  const root = new THREE.Group();
  const sourceMaterials = materials();
  const detail = buildHorrorDetails(root, sourceMaterials, course).detailKit;
  const colonnade = detail.getObjectByName('HorrorKit_furniture-colonnade');
  const relic = detail.getObjectByName('HorrorKit_relic-skull-niche');
  const glow = detail.getObjectByName('HorrorKit_relic-glow-skull-niche');
  assert.equal(colonnade.geometry.userData.decorRevision, 'ossuary-mortuary-console-v4');
  assert.equal(relic.geometry.userData.decorRevision, 'ossuary-mortuary-niche-v3');
  assert.ok(triangles(colonnade.geometry) <= 1712, 'rib buttress stays within the old colonnade geometry budget');
  assert.ok(triangles(relic.geometry) <= 516, 'mortuary niche stays within the old plaque geometry budget');
  assert.ok(triangles(glow.geometry) <= 192, 'niche signal stays within the old glow geometry budget');
  assert.equal(detail.children.filter(node => node.isInstancedMesh && /colonnade|skull-niche/.test(node.name)).length, 3);
  assert.equal(colonnade.material, relic.material, 'service frame and niche share one worn metal material');
  assert.equal(colonnade.material.userData.wornFinish, 'dread-worn-steel-v1');
  assert.equal(colonnade.material.userData.roomRole, 'roomTrim');
  assert.ok(triangles(glow.geometry) < 100, 'niche signal is one attached sill slit rather than a floating cross');
});

test('campaign ossuary rubble keeps the landmark cue with a restrained finite silhouette', () => {
  const prop = buildSetDressingProp('skullMound', setDressingMaterials({}, 'ossuary'), 7);
  assert.equal(prop.userData.decorRevision, 'ossuary-rubble-remains-v2');
  assert.ok(totalTriangles(prop) <= 2400, 'rubble remains below the replacement budget');
  const bounds = new THREE.Box3().setFromObject(prop);
  assert.ok(bounds.min.y > -.4 && bounds.max.y > .9);
});
