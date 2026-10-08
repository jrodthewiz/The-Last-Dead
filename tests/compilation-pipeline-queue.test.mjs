import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompilationPipelineQueue} from '../vendor/compilation-pipeline-queue.js';

test('native pipeline submissions overlap up to the cap and completion waits for all of them',async()=>{
  const queue=createCompilationPipelineQueue(3),releases=[];
  const pipeline=()=>new Promise(resolve=>releases.push(resolve));
  await queue.submit([pipeline()]);await queue.submit([pipeline()]);
  let submitted=false;const third=queue.submit([pipeline()]).then(()=>submitted=true);
  await new Promise(setImmediate);assert.equal(submitted,false);assert.equal(releases.length,3);
  releases[0]();await third;assert.equal(submitted,true);
  let finished=false;const done=queue.finish().then(()=>finished=true);
  await new Promise(setImmediate);assert.equal(finished,false);
  releases[1]();releases[2]();await done;assert.equal(finished,true);
});

test('pipeline failure propagates only after all promises in its submission settle',async()=>{
  const queue=createCompilationPipelineQueue(2);let release;
  await queue.submit([Promise.reject(Error('invalid shader')),new Promise(resolve=>release=resolve)]);
  let finished=false;const done=queue.finish().finally(()=>finished=true);done.catch(()=>{});
  await new Promise(setImmediate);assert.equal(finished,false);release();
  await assert.rejects(done,/invalid shader/);await assert.rejects(queue.submit([Promise.resolve()]),/invalid shader/);
});

test('cached render objects enqueue no GPU work and an invalid cap is rejected',async()=>{
  assert.throws(()=>createCompilationPipelineQueue(0),RangeError);
  const queue=createCompilationPipelineQueue();for(let i=0;i<10000;i++)await queue.submit([]);await queue.finish();
});
