import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js';
import { createAfterlifeModel } from '../npc-afterlife-model.js';
import { CorpsePhysics } from '../corpse-physics.js';
import { makeDungeonCourse } from '../playground/map/dungeon-course.js';

// Optional baseline source captured with: git show HEAD:corpse-physics.js
const directory = new URL('../output/playwright/performance/', import.meta.url);
await mkdir(directory, { recursive: true });
let baseline;
try {
  const source = (await readFile(new URL('corpse-physics-before.txt', directory), 'utf8'))
    .replaceAll("'./vendor/three.module.js'", JSON.stringify(new URL('../vendor/three.module.js', import.meta.url).href))
    .replaceAll("'./vendor/cannon-es.js'", JSON.stringify(new URL('../vendor/cannon-es.js', import.meta.url).href));
  baseline = (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).CorpsePhysics;
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const previousBitmap = globalThis.createImageBitmap, previousSelf = globalThis.self;
globalThis.self = globalThis; globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });
let asset;
try {
  const bytes = await readFile(new URL('../assets/models/afterlife-ash-witness-rig-v05.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  asset = { template: gltf.scene, clips: gltf.animations };
} finally {
  if (previousBitmap === undefined) delete globalThis.createImageBitmap; else globalThis.createImageBitmap = previousBitmap;
  if (previousSelf === undefined) delete globalThis.self; else globalThis.self = previousSelf;
}
function measure(Physics) {
  const physics = new Physics(), scene = new THREE.Scene(), roots = [];
  physics.rebuild(makeDungeonCourse(0));
  for (let i = 0; i < 4; i++) {
    const root = createAfterlifeModel(asset, 0, i); root.position.set(20 + i * 2, 0, 20); scene.add(root); roots.push(root);
    physics.ensureRagdoll(root, { id: i, dead: true });
  }
  physics.update({ time: 0, mode: 'play' });
  const samples = [];
  for (let frame = 1; frame <= 150; frame++) {
    physics.update({ time: frame / 60, mode: 'play' });
    const start = performance.now(); physics.sync(); if (frame > 30) samples.push(performance.now() - start);
  }
  samples.sort((a,b) => a-b);
  const result = { medianMs: samples[60], p95Ms: samples[114], meanMs: samples.reduce((a,b) => a+b,0)/samples.length,
    poses: roots.map(root => { const poses = []; root.traverse(bone => { if(bone.isBone) poses.push([...bone.position.toArray(), ...bone.quaternion.toArray()]); }); return poses; }) };
  physics.dispose(); return result;
}
const report = { mode: 'Node CPU only, four actual imported corpse rigs, 120 measured syncs after warmup', rows: [] };
for (let repeat = 0; repeat < 3; repeat++) {
  const before = baseline ? measure(baseline) : null, after = measure(CorpsePhysics);
  if (before) for (let rig = 0; rig < 4; rig++) for (let bone = 0; bone < before.poses[rig].length; bone++)
    for (let axis = 0; axis < 7; axis++) assert.ok(Math.abs(before.poses[rig][bone][axis] - after.poses[rig][bone][axis]) < 1e-6, 'optimized sync preserves every local bone pose');
  if (before) delete before.poses; delete after.poses;
  report.rows.push({ repeat, before, after });
}
console.log(JSON.stringify(report));
await writeFile(new URL('corpse-sync.json', directory), JSON.stringify(report,null,2));
