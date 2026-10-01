import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial,ShaderChunk} from '../vendor/three.module.js';
import {isolateViewmodelSpotlights,installBoundedLightEvaluation} from '../bounded-lighting.js';

test('viewmodel lantern isolation preserves authored bounce and leaves world lighting intact',()=>{
 installBoundedLightEvaluation();
 const worldChunk=ShaderChunk.lights_fragment_begin;
 const material=new MeshStandardMaterial();let calls=0;
 material.onBeforeCompile=shader=>{calls++;shader.fragmentShader+='\n// authored-bounce';};
 material.customProgramCacheKey=()=> 'authored-bounce-v2';
 isolateViewmodelSpotlights(material);
 const key=material.customProgramCacheKey(),hook=material.onBeforeCompile;
 isolateViewmodelSpotlights(material);
 assert.equal(material.onBeforeCompile,hook);
 assert.equal(material.customProgramCacheKey(),key);
 assert.ok(key.startsWith('authored-bounce-v2'));
 const shader={fragmentShader:'#include <lights_fragment_begin>'};material.onBeforeCompile(shader);
 assert.equal(calls,1);
 assert.ok(shader.fragmentShader.includes('// authored-bounce'));
 assert.ok(shader.fragmentShader.includes('directLight.color = vec3( 0.0 ); directLight.visible = false;'));
 assert.ok(shader.fragmentShader.includes('getPointLightInfo( pointLight, geometryPosition, directLight );'));
 assert.equal(ShaderChunk.lights_fragment_begin,worldChunk);
 assert.equal(new MeshStandardMaterial().customProgramCacheKey().includes('viewmodel-spots-v1'),false);
 material.dispose();
});
