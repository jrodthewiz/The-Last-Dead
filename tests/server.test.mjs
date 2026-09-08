import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseArgs,startServer} from '../server.mjs';

test('Railway PORT wins over legacy local port and binds publicly',()=>{
 const options=parseArgs([],{PORT:'8080',DEAD_ARRIVAL_PORT:'5200'});
 assert.equal(options.port,8080);
 assert.equal(options.host,'0.0.0.0');
 assert.equal(parseArgs([],{}).host,'127.0.0.1');
 assert.equal(parseArgs([],{PORT:'8080',HOST:'127.0.0.1'}).host,'127.0.0.1');
});
test('production host serves the built game and new weapon module',async()=>{
 const options=parseArgs([],{PORT:'8080'});
 const app=await startServer({...options,port:0});
 try{
  assert.equal(app.server.address().address,'0.0.0.0');
  for(const route of ['/', '/weapon-ossuary.js','/assets/models/evil-warden.glb']){
   const response=await fetch(`http://127.0.0.1:${app.port}${route}`);
   assert.equal(response.status,200,route);
   if(route==='/')assert.match(await response.text(),/The Last Dead/);
   else await response.arrayBuffer();
  }
 }finally{app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));}
});