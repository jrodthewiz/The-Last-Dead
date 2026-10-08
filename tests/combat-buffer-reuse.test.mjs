import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { Renderer } from '../renderer.js';

function fixture() {
  const r = Object.create(Renderer.prototype), geometry = new THREE.BoxGeometry(), material = new THREE.MeshBasicMaterial();
  const instance = () => new THREE.InstancedMesh(geometry, material, 96);
  const lines = () => { const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(256 * 6), 3)); return { geometry }; };
  Object.assign(r, { settings: { gore: false }, camera: new THREE.PerspectiveCamera(), weaponGroups: [],
    _combatMatrix: new THREE.Matrix4(), _combatQuat: new THREE.Quaternion(), _combatScale: new THREE.Vector3(),
    goreChunks: instance(), goreDroplets: instance(), bloodPools: instance(), projectileHostile: instance(), projectileReflected: instance(), projectileCore: instance(), coins: instance(),
    projectileTrails: lines(), reflectedTrails: lines(), tracerLines: lines(), railLines: lines(), coinGlints: lines(), hookLine: lines(),
    ordnanceDetails: { update() {} }, projectileWakes: { update() {} }, weaponFX: { update() {} }, _updateSpawnTelegraphs() {} });
  // Residue has a separate attribute in production; keep it separate here too.
  r.bloodPools.geometry = geometry.clone(); r.bloodPools.geometry.setAttribute('bloodState', new THREE.Float32BufferAttribute(new Float32Array(192), 2));
  return r;
}
const projectile = (x, extra = {}) => ({ x, y: 2, z: .5, vx: 1, vy: 2, vz: .5, age: .1, ...extra });

test('combat line buffers retain endpoints, projectile priority, exclusions and clearing across frames', () => {
  const r = fixture(), run = { projectiles: [projectile(1, { core: true }), projectile(2, { reflected: true }), projectile(3), projectile(4, { kind: 'rocket' })],
    tracers: [{ x: 1, y: 2, z: .5, tx: 3, ty: 4, tz: 1 }, { x: 5, y: 6, z: 1, tx: 7, ty: 8, tz: 2, rail: true }], course: { enemies: [] } };
  r._updateCombat(run, 1000);
  assert.equal(r.projectileHostile.count, 1); assert.equal(r.projectileCore.count, 1); assert.equal(r.projectileReflected.count, 1);
  assert.equal(r.projectileTrails.geometry.drawRange.count, 4);
  const positions = [...r.projectileTrails.geometry.attributes.position.array.slice(0, 12)].map(value => +value.toFixed(3));
  assert.deepEqual(positions, [12, 2, 8, 11.6, 1.8, 7.2, 4, 2, 8, 3.6, 1.8, 7.2], 'hostiles precede cores even when source order differs');
  assert.deepEqual([...r.tracerLines.geometry.attributes.position.array.slice(0, 6)], [4, 2, 8, 12, 4, 16]);
  assert.deepEqual([...r.railLines.geometry.attributes.position.array.slice(0, 6)], [20, 4, 24, 28, 8, 32]);
  const arrays = [r._hostileProjectiles, r._reflectedProjectiles, r._coreProjectiles], start = r._combatLineStart, end = r._combatLineEnd;
  run.projectiles = []; run.tracers = []; r._updateCombat(run, 1016);
  assert.equal(r.projectileTrails.geometry.drawRange.count, 0); assert.equal(r.reflectedTrails.geometry.drawRange.count, 0);
  assert.equal(r.tracerLines.geometry.drawRange.count, 0); assert.equal(r.railLines.geometry.drawRange.count, 0);
  assert.equal(r._combatLineStart, start); assert.equal(r._combatLineEnd, end);
  assert.equal(r._hostileProjectiles, arrays[0]); assert.equal(r._reflectedProjectiles, arrays[1]); assert.equal(r._coreProjectiles, arrays[2]);
  assert.ok(arrays.every(array => array.length === 0), 'old projectiles cannot remain in reused lists');
});

test('saturated projectile trails stay within the pool and preserve hostile priority', () => {
  const r = fixture(), run = { course: { enemies: [] }, projectiles: [...Array.from({ length: 12 }, (_, i) => projectile(i, { core: true })), ...Array.from({ length: 100 }, (_, i) => projectile(i + 100))] };
  r._updateCombat(run, 1000);
  assert.equal(r.projectileTrails.geometry.drawRange.count, 192);
  const positions = r.projectileTrails.geometry.attributes.position.array;
  assert.equal(positions[0], 400); assert.equal(positions[95 * 6], 780);
  assert.ok([...positions].every(Number.isFinite));
});
