import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const assetUrl = new URL('../assets/models/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('afterlife-character-family-manifest.json', assetUrl), 'utf8'));

function glbJson(bytes) {
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF', 'binary glTF magic');
  assert.equal(bytes.readUInt32LE(4), 2, 'glTF 2.0');
  assert.equal(bytes.readUInt32LE(8), bytes.length, 'declared GLB length');
  const jsonLength = bytes.readUInt32LE(12);
  assert.equal(bytes.toString('ascii', 16, 20), 'JSON', 'first chunk is JSON');
  return JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
}

test('three afterlife characters keep their skinned animation libraries under the browser budget', async () => {
  assert.equal(manifest.characters.length, 3);
  for (const character of manifest.characters) {
    const bytes = await readFile(new URL(character.file, assetUrl));
    const gltf = glbJson(bytes);
    const packageReport = JSON.parse(await readFile(
      new URL(character.file.replace(/\.glb$/, '-package.json'), assetUrl), 'utf8',
    ));
    assert.ok(bytes.length < 5 * 1024 * 1024, character.id + ': browser asset is under 5 MiB');
    assert.equal(packageReport.after.bytes, bytes.length);
    assert.equal(gltf.skins?.length, 1, character.id + ': one skin');
    assert.equal(gltf.skins[0].joints.length, 24, character.id + ': full humanoid rig');
    assert.equal(gltf.meshes?.length, 1, character.id + ': one visual mesh');
    assert.ok(packageReport.after.simplifiedTriangles < 40000, character.id + ': geometry budget');
    const names = gltf.animations?.map(clip => clip.name) || [];
    assert.deepEqual(new Set(names), new Set(Object.values(character.clips)), character.id + ': every named motion ships');
    for (const clip of gltf.animations) {
      assert.ok(clip.channels.length >= 20, character.id + '/' + clip.name + ': keyed skeleton');
      const times = clip.samplers.map(sampler => gltf.accessors[sampler.input]);
      assert.ok(times.some(accessor => accessor.count > 2 && accessor.max?.[0] > accessor.min?.[0]),
        character.id + '/' + clip.name + ': nonzero motion duration');
    }
  }
});
