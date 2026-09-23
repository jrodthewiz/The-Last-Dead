// Package a Blender-authored Ash Witness GLB for the browser runtime.
// Run from a workspace that has @gltf-transform, sharp, and draco3dgltf installed.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Reuse the already-installed Dogfight asset toolchain without adding a second
// dependency tree to this lightweight game repository.
const require = createRequire('C:/Users/wolfk/Desktop/Dogfight/package.json');
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { dedup, prune, resample, simplifyPrimitive, sparse, textureCompress } = require('@gltf-transform/functions');
const { MeshoptSimplifier } = require('meshoptimizer');
const sharp = require('sharp');

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(process.argv[2] || path.join(repoRoot, '.codex-temp', 'afterlife-ash-witness', 'ash-witness-authored.glb'));
const output = path.resolve(process.argv[3] || path.join(repoRoot, 'assets', 'models', 'afterlife-ash-witness.glb'));
const reportPath = path.resolve(process.argv[4] || path.join(repoRoot, 'assets', 'models', 'afterlife-ash-witness-package.json'));
const MAX_BYTES = 5 * 1024 * 1024;

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;

const raw = await readFile(source);
const document = await io.readBinary(raw);
const root = document.getRoot();
const before = {
  bytes: raw.byteLength,
  meshes: root.listMeshes().length,
  skins: root.listSkins().length,
  joints: root.listSkins().map((skin) => skin.listJoints().length),
  materials: root.listMaterials().length,
  textures: root.listTextures().length,
  animations: root.listAnimations().map((animation) => ({
    name: animation.getName(),
    channels: animation.listChannels().length,
  })),
};

let sourceTriangles = 0;
let simplifiedTriangles = 0;
for (const mesh of root.listMeshes()) {
  for (const primitive of mesh.listPrimitives()) {
    const beforeTriangles = Math.floor((primitive.getIndices()?.getCount() || 0) / 3);
    sourceTriangles += beforeTriangles;
    simplifyPrimitive(primitive, {
      simplifier: MeshoptSimplifier,
      ratio: 0.35,
      error: 0.001,
      lockBorder: true,
    });
    simplifiedTriangles += Math.floor((primitive.getIndices()?.getCount() || 0) / 3);
  }
}

await document.transform(
  prune(),
  dedup(),
  resample(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 74 }),
  sparse(),
);

const packed = await io.writeBinary(document);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, packed);
const afterRoot = document.getRoot();
const report = {
  character: 'Ash Witness',
  source,
  output,
  sourceSha256: hash(raw),
  outputSha256: hash(packed),
  before,
  after: {
    bytes: packed.byteLength,
    meshes: afterRoot.listMeshes().length,
    skins: afterRoot.listSkins().length,
    joints: afterRoot.listSkins().map((skin) => skin.listJoints().length),
    materials: afterRoot.listMaterials().length,
    textures: afterRoot.listTextures().length,
    animations: afterRoot.listAnimations().map((animation) => ({
      name: animation.getName(),
      channels: animation.listChannels().length,
    })),
    sourceTriangles,
    simplifiedTriangles,
  },
  recipe: {
    textureFormat: 'webp',
    textureMaxSize: 512,
    textureQuality: 74,
    simplifier: { algorithm: 'meshoptimizer', ratio: 0.35, error: 0.001, lockBorder: true },
    transforms: ['simplifyPrimitive', 'prune', 'dedup', 'resample', 'textureCompress', 'sparse'],
  },
  withinRuntimeBudget: packed.byteLength <= MAX_BYTES,
  runtimeBudgetBytes: MAX_BYTES,
  notes: [
    'The model is a visual enemy asset; collision remains procedural in the game.',
    'The Blender-authored Dread v02 clips are preserved as named GLB animations.',
    'Material and geometry reduction is intentionally conservative enough to keep the face and clothing readable in cold low light.',
  ],
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.withinRuntimeBudget) process.exitCode = 2;
