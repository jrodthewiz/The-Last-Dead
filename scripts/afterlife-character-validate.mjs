// Lightweight intake gate for the shipped Ash Witness GLB.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/wolfk/Desktop/Dogfight/package.json');
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.resolve(process.argv[2] || path.join(rootDir, 'assets', 'models', 'afterlife-ash-witness-manifest.json'));
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const glbPath = path.resolve(path.dirname(manifestPath), manifest.runtime.file);
const bytes = await readFile(glbPath);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const document = await io.readBinary(bytes);
const gltfRoot = document.getRoot();
let triangles = 0;
for (const mesh of gltfRoot.listMeshes()) {
  for (const primitive of mesh.listPrimitives()) triangles += Math.floor((primitive.getIndices()?.getCount() || 0) / 3);
}
const durations = Object.fromEntries(gltfRoot.listAnimations().map((animation) => [
  animation.getName(), Math.max(...animation.listSamplers().map((sampler) => Math.max(...sampler.getInput().getArray()))),
]));
const requiredClips = Object.values(manifest.clips).map((clip) => clip.name);
const extensions = gltfRoot.listExtensionsUsed().map((extension) => extension.extensionName);
const unsupported = extensions.filter((extension) => extension === 'KHR_draco_mesh_compression' || extension === 'EXT_meshopt_compression');
const checks = {
  hashMatchesManifest: sha256 === manifest.provenance.runtimeSha256,
  sizeWithinBudget: bytes.byteLength <= manifest.provenance.runtimeBytes && bytes.byteLength <= 5 * 1024 * 1024,
  triangleBudget: triangles <= 30_000,
  oneVisualMesh: gltfRoot.listMeshes().length === 1,
  oneSkin: gltfRoot.listSkins().length === 1,
  expectedJointCount: gltfRoot.listSkins()[0]?.listJoints().length === manifest.rig.jointCount,
  clipsPresent: requiredClips.every((name) => Number.isFinite(durations[name])),
  clipDurationsClose: requiredClips.every((name) => Math.abs(durations[name] - manifest.clips[Object.keys(manifest.clips).find((key) => manifest.clips[key].name === name)].durationSeconds) < 0.03),
  noRuntimeDecoderExtension: unsupported.length === 0,
};
const report = {
  ok: Object.values(checks).every(Boolean),
  glb: glbPath,
  bytes: bytes.byteLength,
  sha256,
  triangles,
  joints: gltfRoot.listSkins()[0]?.listJoints().length || 0,
  extensions,
  animations: durations,
  checks,
};
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
