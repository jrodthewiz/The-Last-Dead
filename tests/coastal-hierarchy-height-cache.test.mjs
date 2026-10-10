import test from 'node:test';
import assert from 'node:assert/strict';
import {createCapeHierarchyHeightCache,capeGroundHierarchy} from '../coastal-terrain-fields.js';
import {capeGroundHeight} from '../coastal-terrain.js';

function traverse(visit){
 for(const [left,right,top,bottom] of [[128,448,314,416],[384,448,120,314],[384,448,0,120],[374,384,248,280]])
  for(let x=left;x<right;x+=32)for(let z=top;z<bottom;z+=32)
   for(let j=0;j<=Math.min(32,bottom-z);j++)for(let i=0;i<=Math.min(32,right-x);i++){
    const px=x+i,pz=z+j;
    if(pz<120||(px>=374&&px<=407&&pz>=391&&pz<=416))visit(px,pz);
   }
}

test('bounded exact cache preserves stencil order, signed zero, halos and uncached fractional/outside requests',()=>{
 const calls=[],cache=createCapeHierarchyHeightCache((x,z)=>{calls.push([x,z]);return x===383&&z===-1?-0:Math.PI*x-z/7;});
 try{
  assert.ok(Object.is(cache.sample(383,-1),-0));assert.ok(Object.is(cache.sample(383,-1),-0));
  for(const [x,z] of [[449,120],[373,390],[408,417]]){
   assert.equal(cache.sample(x,z),Math.PI*x-z/7);assert.equal(cache.sample(x,z),Math.PI*x-z/7);
  }
  for(const [x,z] of [[384.5,0],[450,120]]){cache.sample(x,z);cache.sample(x,z);}
  assert.equal(calls.length,8);assert.equal(cache.diagnostics.hits,4);
  assert.equal(cache.diagnostics.bytes,(67*122+36*28)*9);
  assert.deepEqual(calls.slice(0,4),[[383,-1],[449,120],[373,390],[408,417]]);
 }finally{cache.dispose();cache.dispose();}
 assert.equal(cache.diagnostics.retainedBytes,0);assert.throws(()=>cache.sample(384,0),/disposed/);
});

test('all actual chunk stencils retain exact hierarchy results and eliminate repeated authority queries',()=>{
 let queries=0,calls=0;
 const cache=createCapeHierarchyHeightCache((x,z)=>{queries++;return capeGroundHeight(x,z,{bridges:false});});
 try{
  traverse((x,z)=>{
   calls++;
   const canopy={pine:(x%11)/11,birch:(z%13)/13,cover:((x+z)%17)/17};
   assert.deepEqual(capeGroundHierarchy(x,z,canopy,cache.sample),capeGroundHierarchy(x,z,canopy));
  });
  assert.equal(calls,9063);assert.equal(cache.diagnostics.requests,45315);
  assert.equal(queries,cache.diagnostics.entries);assert.equal(queries,9174);
  assert.equal(cache.diagnostics.hits,45315-queries);
  const traversalQueries=queries;
  for(const [x,z]of [[384,0],[448,119],[374,391],[407,416],[384.125,2.25]]){
   const coordinates=[],sampler=(a,b)=>{coordinates.push([a,b]);return capeGroundHeight(a,b,{bridges:false});};
   assert.deepEqual(capeGroundHierarchy(x,z,{},cache.sample),capeGroundHierarchy(x,z,{},sampler));
   assert.deepEqual(coordinates,[[x,z],[x-1,z],[x+1,z],[x,z-1],[x,z+1]]);
  }
  assert.equal(capeGroundHierarchy(448,120,{},()=>{throw Error('outside region');}),null);
  console.log(JSON.stringify({scope:'same actual construction traversal',calls,uncachedQueries:45315,cachedQueries:traversalQueries,hits:45315-traversalQueries,temporaryBytes:cache.diagnostics.bytes}));
 }finally{cache.dispose();}
 assert.equal(cache.diagnostics.retainedBytes,0);
});
