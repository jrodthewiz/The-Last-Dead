import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
for(const kind of ['cabinet','recovery'])test(`${kind} bake preserves source triangles, normals and UV validity`,async()=>{
  const root=path.resolve('assets/projection-texture',kind),load=async f=>JSON.parse(await readFile(path.join(root,f),'utf8'));
  const [native,baked,manifest]=await Promise.all(['native.json','mesh.json','manifest.json'].map(load));
  const vertices=[],normals=[];for(const part of native.parts){for(const i of part.indices){vertices.push(...part.positions.slice(i*3,i*3+3));normals.push(...part.normals.slice(i*3,i*3+3));}}
  assert.equal(vertices.length,baked.indices.length*3);assert.equal(baked.indices.length/3,native.triangles);
  for(let i=0;i<baked.indices.length;i++){const at=baked.indices[i]*3;for(let c=0;c<3;c++){assert(Math.abs(vertices[i*3+c]-baked.positions[at+c])<1e-6,'Position unchanged');assert(Math.abs(normals[i*3+c]-baked.normals[at+c])<1e-6,'Normal unchanged');}}
  for(const uv of baked.uvs)assert(Number.isFinite(uv)&&uv>=-1e-6&&uv<=1+1e-6);
  assert.equal(baked.surfaceParams.length,baked.positions.length/3*2);
  const params=[];for(const part of native.parts)for(const i of part.indices)params.push(part.roughness,part.metalness);
  for(let i=0;i<baked.indices.length;i++)for(let c=0;c<2;c++)assert(Math.abs(params[i*2+c]-baked.surfaceParams[baked.indices[i]*2+c])<1e-6,'Material value unchanged');
  assert.equal(manifest.uvInteriorOverlapTexels,0);assert.equal(manifest.resolution,512);assert.deepEqual(manifest.runtimeMaps,['albedo']);assert(manifest.runtimeTextureBytesWithMipmaps<1.4e6);
});
test('default game does not import the experiment',async()=>{
  for(const name of ['index.html','main.js','renderer.js','afterlife-props.js','room-kit.js'])assert(!/projection-lab|assets\/projection-texture/.test(await readFile(name,'utf8')),`${name} has no experiment load`);
});
