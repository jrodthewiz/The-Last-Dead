import test from 'node:test';
import assert from 'node:assert/strict';
import {startServer,startLocalServer} from '../server.mjs';

test('local debug server skips an occupied port and preserves its listener',async()=>{
  const original=await startServer({port:0});let fallback;
  try{
    fallback=await startLocalServer({port:original.port});
    assert.notEqual(fallback.port,original.port);
    assert.ok(fallback.port>original.port&&fallback.port<=original.port+20);
    for(const port of [original.port,fallback.port]){
      const response=await fetch(`http://127.0.0.1:${port}/`);
      assert.equal(response.status,200);await response.text();
    }
    await assert.rejects(startServer({port:original.port}),{code:'EADDRINUSE'});
  }finally{
    for(const instance of [fallback,original])if(instance){instance.server.closeAllConnections();await new Promise(resolve=>instance.server.close(resolve));}
  }
});

test('local debug server preserves ephemeral ports and rejects invalid configuration',async()=>{
  const instance=await startLocalServer({port:0});
  try{assert.ok(instance.port>0);}finally{await new Promise(resolve=>instance.server.close(resolve));}
  await assert.rejects(startLocalServer({port:-1}),/Invalid port/);
});

test('a completely occupied preferred range falls back to an OS-assigned port',async()=>{
  const occupied=[];let fallback;
  try{
    // Find a full range without interfering with any pre-existing listener.
    let base;
    for(let attempt=0;attempt<30&&!base;attempt++){
      const first=await startServer({port:0});occupied.push(first);
      if(first.port>65515){await new Promise(r=>first.server.close(r));occupied.length=0;continue;}
      try{for(let offset=1;offset<=20;offset++)occupied.push(await startServer({port:first.port+offset}));base=first.port;}
      catch(error){for(const item of occupied)await new Promise(r=>item.server.close(r));occupied.length=0;if(error.code!=='EADDRINUSE')throw error;}
    }
    assert.ok(base,'could not reserve a test range');
    fallback=await startLocalServer({port:base});
    assert.ok(fallback.port<base||fallback.port>base+20);
    for(const item of [...occupied,fallback]){const response=await fetch(`http://127.0.0.1:${item.port}/`);assert.equal(response.status,200);await response.text();}
  }finally{for(const item of [...occupied,...(fallback?[fallback]:[])]){item.server.closeAllConnections();await new Promise(r=>item.server.close(r));}}
});
