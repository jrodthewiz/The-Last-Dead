import test from 'node:test';
import assert from 'node:assert/strict';
import {VIEWMODEL_CLIPS} from '../assets/survivor/viewmodel-motion-clips.js';
import {sampleViewmodelClip} from '../assets/survivor/viewmodel-motion.js';

test('38 Blender actions have finite bounded motion and exact rest or loop endpoints',()=>{
 assert.equal(Object.keys(VIEWMODEL_CLIPS).length,38);
 for(const [name,clip] of Object.entries(VIEWMODEL_CLIPS)){
  assert.equal(clip.samples.length,Math.ceil(clip.duration*clip.fps)+1);
  for(const row of clip.samples){assert.equal(row.length,6);assert(row.every(v=>Number.isFinite(v)&&Math.abs(v)<.6),name);}
  const endpoint=name.endsWith('/walk')?clip.samples[0]:[0,0,0,0,0,0];
  for(const t of [clip.duration,clip.duration+5,Infinity])assert(sampleViewmodelClip(name,t,new Float64Array(6)).every((v,i)=>Math.abs(v-endpoint[i])<1e-6),name);
  // Sampling the final fractional tick must not overshoot or skip the endpoint.
  const p=sampleViewmodelClip(name,clip.duration-.001,new Float64Array(6));assert(p.every(v=>Math.abs(v)<.01),name);
 }
});
